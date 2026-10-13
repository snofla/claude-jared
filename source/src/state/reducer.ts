import type { AnyReview, Draft, LineSelection, Review, SetReview, SourceFile } from '../types'
import { handle, type EngineState } from '../engine/engine'
import { toEngineState } from '../engine/page-host'
import { PROTOCOL_VERSION, type Request, type SubmitOptions } from '../engine/protocol'
import { clampToFile, diffOf } from '../lib/diff'
import { openSet, type OpenSet } from '../lib/set-open'
import { clampToFile as clampToSetFile, savedPlace, viewComments } from '../lib/set-view'
import { codeForRange, rangeOf } from '../lib/review'
import { moveSelection } from '../lib/selection'

export interface AppState {
  /** The file that is open; for a set of files, the one that stands for them: see `openSet`. */
  file: SourceFile | null
  review: AnyReview | null
  /** The files of a set, when one is open, and the rows that they are drawn as. The selection and the draft are in those rows. */
  set: OpenSet | null
  selection: LineSelection | null
  draft: Draft | null
  /**
   * What the caller that opened the file told Jared to call the delivery of the review, and who is to receive it: the words on
   * the button (none: the default, which is Jared's own string) and the name in the line that says where the review goes.
   * Neither is stored in the review or in the browser: a page that is loaded again without its caller shows the defaults.
   */
  submitLabel: string | null
  submitTarget: string | null
  /** What the caller said about what happens once the review is taken (when the dialog closes, the message, the banner), or none. */
  submitOptions: SubmitOptions | null
  /**
   * When the review was last *sent* to its delivery (a receiver answered, or a script took it), as opposed to copied or downloaded,
   * which `submittedAt` of the review also records. The header says sent only for this. Not stored: it is of this page's session.
   */
  sentAt: string | null
}

export const emptyState: AppState = { file: null, review: null, set: null, selection: null, draft: null, submitLabel: null, submitTarget: null, submitOptions: null, sentAt: null }

export type Action =
  /**
   * Open a file by its name and text, with the review that was kept for it or `null` for a new one (`now` is the time of a new one).
   * The engine reads the text, so it is the engine that refuses what cannot be opened; a kept review that does not fit the text is
   * left out, and the file opens with a new review.
   */
  | { type: 'open'; name: string; text: string; review: Review | null; now: string }
  /** Open several files together, with the review that was kept for them or `null` for a new one. */
  | { type: 'openSet'; files: Array<{ name: string; text: string }>; review: SetReview | null; now: string }
  | { type: 'close' }
  /** The file and review that something other than the reviewer's hands has made, such as a request on the page. */
  | { type: 'adopt'; file: SourceFile | null; review: AnyReview | null; set?: OpenSet | null; submitLabel?: string | null; submitTarget?: string | null; submitOptions?: SubmitOptions | null }
  /** Set the words for delivering the review, with the file that is open (for a receiver that brought them with the file). */
  | { type: 'setDelivery'; submitLabel: string | null; submitTarget: string | null; submitOptions: SubmitOptions | null }
  | { type: 'setLanguage'; language: string }
  /** `commit: false` is used while dragging: the highlight follows the pointer but an open draft stays put. */
  | { type: 'select'; selection: LineSelection | null; commit?: boolean }
  /**
   * Move the selection by `delta` lines from where the reducer's own selection is, so that moves which arrive before the page
   * has rendered, such as a held key repeating, add up. `extend` keeps the anchor, as Shift does.
   */
  | { type: 'moveSelection'; delta: number; extend: boolean }
  | { type: 'commitSelection' }
  | { type: 'startDraft' }
  | { type: 'editComment'; id: string }
  | { type: 'patchDraft'; patch: { comment?: string; suggestion?: string } }
  | { type: 'toggleSuggestion' }
  | { type: 'saveDraft'; id: string; now: string }
  | { type: 'cancelDraft' }
  | { type: 'deleteComment'; id: string; now: string }
  | { type: 'setSummary'; summary: string; now: string }
  | { type: 'markSubmitted'; now: string }
  /** The review reached its delivery: it has left (as `markSubmitted` says) and it was sent. */
  /** The review of the file with this hash reached its delivery; a review of another file, opened in the meantime, is left alone. */
  | { type: 'markSent'; now: string; hash: string }

/** A request of the engine's protocol, without the two fields that every request has. */
type Ask = Request extends infer R ? (R extends unknown ? Omit<R, 'protocol' | 'id'> : never) : never

/**
 * The file and the review that the engine makes of a request, run on the file and review that the page holds. The review state is
 * changed by the engine and by nothing else here (the engine of `src/engine/engine.ts`, the one that a script or a receiver asks
 * too); `null` when the engine refused the request, so that the page is left as it was.
 */
function viaEngine(state: AppState, request: Ask): { file: SourceFile; review: AnyReview; set: OpenSet | null } | null {
  const outcome = handle(toEngineState(state), { protocol: PROTOCOL_VERSION, id: 'interface', ...request } as Request)
  const refused = outcome.replies.some((reply) => reply.type === 'error')
  if (outcome.state.set && !refused) {
    const { files, review } = outcome.state.set
    // The files of a set do not change under any request but `open`, which starts from nothing: the same objects are kept.
    if (state.set && state.file && state.review?.version === 2) return { file: state.file, set: state.set, review }
    return { ...openSet(files, review), review }
  }
  const adopted = adoptedFrom(outcome.state, refused, state.file)
  return adopted && { ...adopted, set: null }
}

/**
 * What the page holds after the engine's answer: the same file object when the file did not change, so that what depends on it does
 * not run again. Only a change of language changes the file of the page, for every request but `open`, which starts from nothing.
 */
function adoptedFrom({ source, review }: EngineState, refused: boolean, current: SourceFile | null): { file: SourceFile; review: Review } | null {
  if (refused || !source || !review) return null
  const file = current && current.language === source.language ? current : { name: source.name, content: source.content, lines: source.content.split('\n'), language: source.language, hash: source.hash }
  return { file, review }
}

/** Move an open draft onto the current selection. */
function syncDraft(state: AppState, selection: LineSelection | null): Draft | null {
  const { draft, file } = state
  if (!draft || !file || !selection) return draft
  const range = rangeOf(selection)
  if (range.start === draft.range.start && range.end === draft.range.end) return draft
  const suggestion =
    draft.suggestion !== null && !draft.suggestionDirty ? codeForRange(file.lines, range) : draft.suggestion
  return { ...draft, range, suggestion }
}

/**
 * The selection of a move by keys in a set of files, off the headers: a move that lands on a file's header goes on, in the direction of the move, to the
 * next line of a file, so that the keys carry the reviewer from one file into the next. `null` when there is no line to go to.
 */
function hopHeaders(set: OpenSet, selection: LineSelection, delta: number): LineSelection | null {
  const step = delta < 0 ? -1 : 1
  let row = selection.focus
  while (set.layout.rows[row - 1]?.line === null) row += step
  return set.layout.rows[row - 1] ? { anchor: row, focus: row } : null
}

/** Whether the row `row` is in a file of the set whose language is a diff. */
const inDiffFile = (set: OpenSet, row: number): boolean => {
  const place = set.layout.rows[row - 1]
  return !!place && set.layout.texts[place.file].language === 'diff'
}

/** The state with another selection, which an open draft follows unless `commit` is false. */
function withSelection(state: AppState, wanted: LineSelection | null, commit = true): AppState {
  // On a diff, and in a set of files, a selection stays in the file it began in, so that a comment is about one file.
  const diff = state.file && diffOf(state.file.language, state.file.lines)
  const next = wanted && state.set ? clampToSetFile(state.set.layout, wanted) : wanted && diff ? clampToFile(diff, wanted) : wanted
  const prev = state.selection
  if (prev === next || (prev && next && prev.anchor === next.anchor && prev.focus === next.focus)) return state
  return { ...state, selection: next, draft: commit ? syncDraft(state, next) : state.draft }
}

export function reducer(state: AppState, action: Action): AppState {
  const { file, review, draft } = state

  switch (action.type) {
    case 'open': {
      const request = { type: 'open', name: action.name, text: action.text, now: action.now } as const
      const opened = viaEngine(emptyState, { ...request, review: action.review }) ?? viaEngine(emptyState, { ...request, review: null })
      return opened ? { ...emptyState, file: opened.file, review: opened.review, set: opened.set } : state
    }

    case 'openSet': {
      const request = { type: 'open', files: action.files, now: action.now } as const
      const opened = viaEngine(emptyState, { ...request, review: action.review }) ?? viaEngine(emptyState, { ...request, review: null })
      return opened ? { ...emptyState, file: opened.file, review: opened.review, set: opened.set } : state
    }

    case 'setDelivery':
      return file ? { ...state, submitLabel: action.submitLabel, submitTarget: action.submitTarget, submitOptions: action.submitOptions } : state

    case 'close':
      return emptyState

    case 'adopt': {
      if (!action.file || !action.review) return emptyState
      const delivery = { submitLabel: action.submitLabel ?? null, submitTarget: action.submitTarget ?? null, submitOptions: action.submitOptions ?? null }
      // Another file starts a new view, as opening one does. The same file keeps what the reviewer is doing, unless it is
      // about a comment that is no longer there.
      if (action.file.hash !== file?.hash) return { file: action.file, review: action.review, set: action.set ?? null, selection: null, draft: null, sentAt: null, ...delivery }
      const comments = action.review.comments
      // A review older than the one the page had is another review, and what was sent is not it.
      const sentAt = review && action.review.updatedAt >= review.updatedAt ? state.sentAt : null
      return { ...state, ...delivery, sentAt, file: action.file, review: action.review, set: action.set ?? state.set, draft: draft && draft.id !== null && !comments.some((c) => c.id === draft.id) ? null : draft }
    }

    case 'setLanguage': {
      const changed = viaEngine(state, { type: 'setLanguage', language: action.language })
      return changed ? { ...state, ...changed } : state
    }

    case 'select':
      return withSelection(state, action.selection, action.commit !== false)

    case 'moveSelection': {
      if (!file) return state
      const moved = moveSelection(state.selection, action.delta, action.extend, file.lines.length)
      return withSelection(state, state.set && !action.extend ? hopHeaders(state.set, moved, action.delta) ?? state.selection : moved)
    }

    case 'commitSelection':
      return { ...state, draft: syncDraft(state, state.selection) }

    case 'startDraft': {
      if (!file || !state.selection || draft) return state
      return {
        ...state,
        draft: { id: null, range: rangeOf(state.selection), comment: '', suggestion: null, suggestionDirty: false },
      }
    }

    case 'editComment': {
      const target = (state.set && review ? viewComments(state.set.layout, review.comments) : review?.comments)?.find((c) => c.id === action.id)
      if (!target) return state
      return {
        ...state,
        selection: { anchor: target.startLine, focus: target.endLine },
        draft: {
          id: target.id,
          range: { start: target.startLine, end: target.endLine },
          comment: target.comment,
          suggestion: target.suggestion,
          suggestionDirty: target.suggestion !== null,
        },
      }
    }

    case 'patchDraft': {
      if (!draft) return state
      const { comment, suggestion } = action.patch
      return {
        ...state,
        draft: {
          ...draft,
          comment: comment ?? draft.comment,
          suggestion: suggestion ?? draft.suggestion,
          suggestionDirty: suggestion !== undefined ? true : draft.suggestionDirty,
        },
      }
    }

    case 'toggleSuggestion': {
      if (!draft || !file) return state
      // A diff gets no suggestion, there being no file to replace lines of; one that is already there can still be taken away. A file of a set that is a diff is the same.
      if (draft.suggestion === null && (diffOf(file.language, file.lines) || (state.set && inDiffFile(state.set, draft.range.start)))) return state
      const suggestion = draft.suggestion === null ? codeForRange(file.lines, draft.range) : null
      return { ...state, draft: { ...draft, suggestion, suggestionDirty: false } }
    }

    case 'saveDraft': {
      if (!draft) return state
      // In a set the rows of the draft are saved as the lines of one file, which the comment names; rows that are not lines of one file name none, and the engine refuses them.
      const place = state.set ? savedPlace(state.set.layout, draft.range.start, draft.range.end) : null
      const saved = viaEngine(state, {
        type: 'saveComment',
        commentId: draft.id ?? action.id,
        ...(place ? { file: place.file } : {}),
        startLine: place?.startLine ?? draft.range.start,
        endLine: place?.endLine ?? draft.range.end,
        comment: draft.comment,
        suggestion: draft.suggestion,
        now: action.now,
      })
      return saved ? { ...state, ...saved, selection: null, draft: null } : state
    }

    case 'cancelDraft':
      return draft ? { ...state, draft: null } : state

    case 'deleteComment': {
      const deleted = viaEngine(state, { type: 'deleteComment', commentId: action.id, now: action.now })
      return deleted ? { ...state, ...deleted, draft: draft?.id === action.id ? null : draft } : state
    }

    case 'setSummary': {
      const summarised = viaEngine(state, { type: 'setSummary', summary: action.summary, now: action.now })
      return summarised ? { ...state, ...summarised } : state
    }

    case 'markSubmitted': {
      const marked = viaEngine(state, { type: 'markSubmitted', now: action.now })
      return marked ? { ...state, ...marked } : state
    }

    case 'markSent': {
      // Only the review of the file that was sent: a file opened in the meantime has another review, which is left alone.
      const marked = file?.hash === action.hash ? viaEngine(state, { type: 'markSubmitted', now: action.now }) : null
      return marked ? { ...state, ...marked, sentAt: action.now } : state
    }
  }
}

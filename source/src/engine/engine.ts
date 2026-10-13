import type { Review, SetReview } from '../types.ts'
import { diffOf, inOneFile } from '../lib/diff.ts'
import { reviewFileName, toJson, toMarkdown } from '../lib/export.ts'
import { LANGUAGE_OPTIONS } from '../lib/language.ts'
import { MAX_SET_FILES, newReview, newSetReview, upsertComment, upsertSetComment } from '../lib/review.ts'
import { ONLY_TEXT } from '../lib/review-files.ts'
import { MAX_SET_BYTES, prepareSource } from '../lib/source.ts'
import { formatBytes } from '../lib/util.ts'
import {
  errorReply,
  parseRequest,
  PROTOCOL_VERSION,
  type ErrorCode,
  type ExportRequest,
  type OpenOneRequest,
  type OpenSetRequest,
  type Reply,
  type Request,
  type SessionReply,
  type SetSessionReply,
  type SetSourceReply,
  type SourceReply,
  type SubmitOptions,
} from './protocol.ts'

/**
 * Everything the engine knows: the open file's text and the review of it. Plain data that can be kept anywhere,
 * for example as JSON between two requests, so the engine itself holds nothing between calls.
 */
export interface EngineState {
  source: { name: string; content: string; language: string; hash: string; submitLabel?: string; submitTarget?: string; submitOptions?: SubmitOptions } | null
  review: Review | null
  /** Several files open at once, and their review: then `source` and `review` are `null`. Absent when one file is open or none. */
  set?: SetState | null
}

/**
 * The files of a review of several files and their review. `files[i]` is the text of `review.files[i]` (same id, name and hash): the order is the
 * review's, and a review that is restored keeps the order it had, whatever order the files were opened in.
 */
export interface SetState {
  files: Array<{ id: string; name: string; hash: string; content: string }>
  review: SetReview
  submitLabel?: string
  submitTarget?: string
  submitOptions?: SubmitOptions
}

export const emptyEngineState: EngineState = { source: null, review: null }

export interface Outcome {
  state: EngineState
  replies: Reply[]
}

const linesOf = (content: string): string[] => content.split('\n')

/** Whether a review that is for this very text also has only lines that the text has. */
const reviewFits = (review: Review, lineCount: number): boolean =>
  review.file.lineCount === lineCount && !review.comments.some((c) => c.endLine > lineCount)

function session(state: EngineState, replyTo: string): SessionReply | SetSessionReply {
  const { source, review, set } = state
  if (set) return { protocol: PROTOCOL_VERSION, replyTo, type: 'session', file: null, files: set.review.files.map((file) => ({ ...file })), review: set.review }
  return {
    protocol: PROTOCOL_VERSION,
    replyTo,
    type: 'session',
    file: source && review ? { name: source.name, language: source.language, lineCount: review.file.lineCount, hash: source.hash } : null,
    review,
  }
}

function refuse(state: EngineState, request: { id: string }, code: ErrorCode, message: string): Outcome {
  return { state, replies: [errorReply(request.id, code, message)] }
}

function answer(state: EngineState, request: { id: string }): Outcome {
  return { state, replies: [session(state, request.id)] }
}

function doExport(state: EngineState, request: ExportRequest): Outcome {
  const review = state.set?.review ?? state.review
  if (!review) return refuse(state, request, 'no-session', 'export: no file is open.')
  const markdown = request.format === 'markdown'
  return {
    state,
    replies: [
      {
        protocol: PROTOCOL_VERSION,
        replyTo: request.id,
        type: 'exported',
        format: request.format,
        fileName: reviewFileName(review, markdown ? 'md' : 'json'),
        mime: markdown ? 'text/markdown' : 'application/json',
        text: markdown ? toMarkdown(review) : toJson(review),
      },
    ],
  }
}

/** What the caller said about delivering the review, to keep with the file or the files. */
const deliveryOf = (request: { submitLabel?: string; submitTarget?: string; submitOptions?: SubmitOptions }) => ({
  ...(request.submitLabel === undefined ? {} : { submitLabel: request.submitLabel }),
  ...(request.submitTarget === undefined ? {} : { submitTarget: request.submitTarget }),
  ...(request.submitOptions === undefined ? {} : { submitOptions: request.submitOptions }),
})

function openOne(state: EngineState, request: OpenOneRequest): Outcome {
  const prepared = prepareSource(request.name, request.text)
  if (!prepared.ok) return refuse(state, request, 'file-rejected', prepared.error)
  const file = prepared.file
  let restored = request.review
  if (restored) {
    if (restored.file.hash !== file.hash) {
      return refuse(state, request, 'review-mismatch', `open: the review is for another file or another version of "${restored.file.name}".`)
    }
    if (!reviewFits(restored, file.lines.length)) {
      return refuse(state, request, 'invalid-review', 'open: the review has lines that the file does not have.')
    }
  } else {
    restored = newReview(file, request.now)
  }
  // A restored review keeps the language its reviewer chose, as the app does when it reopens a file.
  return answer({ source: { name: file.name, content: file.content, language: restored.file.language, hash: file.hash, ...deliveryOf(request) }, review: restored }, request)
}

function openSet(state: EngineState, request: OpenSetRequest): Outcome {
  if (request.files.length > MAX_SET_FILES) {
    return refuse(state, request, 'too-big', `open: ${request.files.length} files are more than the ${MAX_SET_FILES} that one review holds.`)
  }
  // The files in the order they came in; each is checked as a file of its own, and the text of all of them together is held to one limit.
  let bytes = 0
  const prepared = []
  for (const given of request.files) {
    const one = prepareSource(given.name, given.text)
    if (!one.ok) return refuse(state, request, 'file-rejected', one.error)
    bytes += new TextEncoder().encode(given.text).length
    if (bytes > MAX_SET_BYTES) {
      return refuse(state, request, 'too-big', `open: with "${given.name}" the files are ${formatBytes(bytes)}, and ${formatBytes(MAX_SET_BYTES)} is the most that one review holds.`)
    }
    prepared.push(one.file)
  }
  let review = request.review
  let ordered = prepared
  if (review) {
    // A review that is restored is for these same files, in whatever order they came: it keeps its own order and the ids it gave them.
    const mine = new Map(prepared.map((file) => [file.name, file]))
    const same = review.files.length === prepared.length && review.files.every((entry) => mine.get(entry.name)?.hash === entry.hash)
    if (!same) return refuse(state, request, 'review-mismatch', 'open: the review is for other files or other versions of them.')
    ordered = review.files.map((entry) => mine.get(entry.name)!)
    if (review.files.some((entry, i) => entry.lineCount !== ordered[i].lines.length)) {
      return refuse(state, request, 'invalid-review', 'open: the review has lines that the files do not have.')
    }
  } else {
    review = newSetReview(prepared, request.now)
  }
  const files = review.files.map((entry, i) => ({ id: entry.id, name: entry.name, hash: entry.hash, content: ordered[i].content }))
  return answer({ source: null, review: null, set: { files, review, ...deliveryOf(request) } }, request)
}

/** Act on a request when several files are open. `open` and `close` replace what is open and are not here. */
function handleSet(state: EngineState, set: SetState, request: Exclude<Request, { type: 'open' | 'close' }>): Outcome {
  const { review } = set
  const next = (changed: SetReview): Outcome => answer({ ...state, set: { ...set, review: changed } }, request)
  switch (request.type) {
    case 'getSession':
      return answer(state, request)

    case 'getSource': {
      const reply: SetSourceReply = {
        protocol: PROTOCOL_VERSION,
        replyTo: request.id,
        type: 'source',
        file: null,
        files: review.files.map((entry, i) => ({ ...entry, text: set.files[i].content })),
        ...deliveryOf(set),
      }
      return { state, replies: [reply] }
    }

    case 'setLanguage':
      return refuse(state, request, 'bad-language', 'setLanguage: several files are open, and each has the language that its name gives; there is no language to set for them.')

    case 'saveComment': {
      const index = review.files.findIndex((entry) => entry.id === request.file)
      if (index < 0) {
        return refuse(state, request, 'no-such-file', request.file === undefined ? 'saveComment: several files are open, so "file" must say which one the comment is about.' : `saveComment: there is no file "${request.file}" in this review.`)
      }
      const entry = review.files[index]
      if (request.endLine < request.startLine || request.endLine > entry.lineCount) {
        return refuse(state, request, 'bad-range', `saveComment: lines ${request.startLine} to ${request.endLine} are not inside the ${entry.lineCount} lines of "${entry.name}".`)
      }
      const lines = linesOf(set.files[index].content)
      const diff = diffOf(entry.language, lines)
      if (diff && !inOneFile(diff, request.startLine, request.endLine)) {
        return refuse(state, request, 'bad-range', `saveComment: lines ${request.startLine} to ${request.endLine} are in more than one file of the diff "${entry.name}", and a comment is about one file.`)
      }
      const changed = upsertSetComment(
        review,
        entry.id,
        lines,
        { id: request.commentId, startLine: request.startLine, endLine: request.endLine, comment: request.comment, suggestion: request.suggestion },
        request.now,
      )
      if (!changed) return refuse(state, request, 'empty-comment', 'saveComment: a comment needs words, or a suggestion that differs from the code.')
      return next(changed)
    }

    case 'deleteComment': {
      if (!review.comments.some((c) => c.id === request.commentId)) {
        return refuse(state, request, 'no-such-comment', `deleteComment: there is no comment "${request.commentId}".`)
      }
      return next({ ...review, comments: review.comments.filter((c) => c.id !== request.commentId), updatedAt: request.now })
    }

    case 'setSummary':
      return next({ ...review, summary: request.summary, updatedAt: request.now })

    case 'markSubmitted':
      return next({ ...review, submittedAt: request.now })

    case 'submit': {
      const given = request.review
      const sameFiles = (files: SetReview['files']) =>
        files.length === review.files.length && files.every((entry, i) => entry.id === review.files[i].id && entry.name === review.files[i].name && entry.hash === review.files[i].hash)
      if (given.version !== 2 || !sameFiles(given.files)) {
        return refuse(state, request, 'review-mismatch', 'submit: the review is not for the open files, but for other files or other versions of them.')
      }
      if (given.files.some((entry, i) => entry.lineCount !== review.files[i].lineCount)) {
        return refuse(state, request, 'invalid-review', 'submit: the review has lines that the files do not have.')
      }
      // The review is kept as its reviewer wrote it; only the moment of delivery is added.
      return next({ ...given, submittedAt: request.now })
    }

    case 'export':
      return doExport(state, request)
  }
}

/** Act on one request. Pure: the new state and the replies depend on the old state and the request, and on nothing else. */
export function handle(state: EngineState, request: Request): Outcome {
  const { source, review, set } = state
  if (set && request.type !== 'open' && request.type !== 'close') return handleSet(state, set, request)

  switch (request.type) {
    case 'open':
      return request.files ? openSet(state, request) : openOne(state, request)

    case 'close':
      return answer(emptyEngineState, request)

    case 'getSession':
      return answer(state, request)

    case 'getSource': {
      if (!source || !review) return refuse(state, request, 'no-session', 'getSource: no file is open.')
      const reply: SourceReply = {
        protocol: PROTOCOL_VERSION,
        replyTo: request.id,
        type: 'source',
        file: { name: source.name, language: source.language, lineCount: review.file.lineCount, hash: source.hash },
        text: source.content,
        ...deliveryOf(source),
      }
      return { state, replies: [reply] }
    }

    case 'setLanguage': {
      if (!source || !review) return refuse(state, request, 'no-session', 'setLanguage: no file is open.')
      if (!LANGUAGE_OPTIONS.some((option) => option.id === request.language)) {
        return refuse(state, request, 'bad-language', `setLanguage: "${request.language}" is not a language this engine knows.`)
      }
      return answer(
        { source: { ...source, language: request.language }, review: { ...review, file: { ...review.file, language: request.language } } },
        request,
      )
    }

    case 'saveComment': {
      if (!source || !review) return refuse(state, request, 'no-session', 'saveComment: no file is open.')
      // The one open file is "f1", as it is in the entries of a list of files; naming another is naming a file that is not there.
      if (request.file !== undefined && request.file !== ONLY_TEXT) {
        return refuse(state, request, 'no-such-file', `saveComment: there is no file "${request.file}" in this review: the one open file is "${ONLY_TEXT}".`)
      }
      if (request.endLine < request.startLine || request.endLine > review.file.lineCount) {
        return refuse(state, request, 'bad-range', `saveComment: lines ${request.startLine} to ${request.endLine} are not inside the file's ${review.file.lineCount} lines.`)
      }
      const lines = linesOf(source.content)
      const diff = diffOf(review.file.language, lines)
      if (diff && !inOneFile(diff, request.startLine, request.endLine)) {
        return refuse(state, request, 'bad-range', `saveComment: lines ${request.startLine} to ${request.endLine} are in more than one file of the diff, and a comment is about one file.`)
      }
      const next = upsertComment(
        review,
        lines,
        { id: request.commentId, startLine: request.startLine, endLine: request.endLine, comment: request.comment, suggestion: request.suggestion },
        request.now,
      )
      if (!next) return refuse(state, request, 'empty-comment', 'saveComment: a comment needs words, or a suggestion that differs from the code.')
      return answer({ source, review: next }, request)
    }

    case 'deleteComment': {
      if (!source || !review) return refuse(state, request, 'no-session', 'deleteComment: no file is open.')
      if (!review.comments.some((c) => c.id === request.commentId)) {
        return refuse(state, request, 'no-such-comment', `deleteComment: there is no comment "${request.commentId}".`)
      }
      const comments = review.comments.filter((c) => c.id !== request.commentId)
      return answer({ source, review: { ...review, comments, updatedAt: request.now } }, request)
    }

    case 'setSummary':
      if (!source || !review) return refuse(state, request, 'no-session', 'setSummary: no file is open.')
      return answer({ source, review: { ...review, summary: request.summary, updatedAt: request.now } }, request)

    case 'markSubmitted':
      if (!source || !review) return refuse(state, request, 'no-session', 'markSubmitted: no file is open.')
      return answer({ source, review: { ...review, submittedAt: request.now } }, request)

    case 'submit': {
      if (!source || !review) return refuse(state, request, 'no-session', 'submit: no file is open.')
      const given = request.review
      if (given.version !== 1 || given.file.hash !== source.hash) {
        return refuse(state, request, 'review-mismatch', `submit: the review is not for the open file "${source.name}", but for another file or another version of it.`)
      }
      if (!reviewFits(given, review.file.lineCount)) {
        return refuse(state, request, 'invalid-review', 'submit: the review has lines that the file does not have.')
      }
      // The review is kept as its reviewer wrote it, language included; only the moment of delivery is added.
      return answer({ source: { ...source, language: given.file.language }, review: { ...given, submittedAt: request.now } }, request)
    }

    case 'export':
      return doExport(state, request)
  }
}

/** Check a value that arrived from outside, then act on it. A bad message gets an error reply and changes nothing. */
export function handleMessage(state: EngineState, value: unknown): Outcome {
  const parsed = parseRequest(value)
  return parsed.ok ? handle(state, parsed.request) : { state, replies: [parsed.reply] }
}

export interface Engine {
  handleMessage(value: unknown): Reply[]
  getState(): EngineState
}

/** An engine that keeps its own state, for a peer that is a long-lived process: a pipe, a socket, a WebAssembly instance. */
export function createEngine(initial: EngineState = emptyEngineState): Engine {
  let state = initial
  return {
    handleMessage(value) {
      const outcome = handleMessage(state, value)
      state = outcome.state
      return outcome.replies
    },
    getState: () => state,
  }
}

import type { AnyReview, Draft, Review, SetReview, SourceFile } from '../types.ts'
import { setHashOf } from '../lib/hash.ts'
import { draftHasText } from '../lib/review.ts'
import { openSet, type OpenSet } from '../lib/set-open.ts'
import { prepareSource } from '../lib/source.ts'
import { emptyEngineState, handle, type EngineState } from './engine.ts'
import type { Outbox, OutboxRules } from './outbox.ts'
import { errorReply, parseRequest, PROTOCOL_VERSION, sameSubmitOptions, type Event, type Reply, type SubmitOptions } from './protocol.ts'

/**
 * The protocol on a page: what a script on the page (a browser tool, a test, a console) can ask of the interface the way
 * any caller asks of the engine. The page is not an engine, it has a person in it, so a request is run against what the
 * page shows: its file and review become an `EngineState`, the engine's own `handle` acts on it, and what comes out is
 * given back for the page to adopt. Every request of the protocol therefore works, by the engine's rules.
 */
export interface PageSession {
  /** The file that is open; for a set of files, the one that stands for them (see `openSet`). */
  file: SourceFile | null
  review: AnyReview | null
  /** The files of a set and their layout, when a set is open. */
  set?: OpenSet | null
  /** The comment being written, which the engine knows nothing of. Only used to see whether there is work to lose. */
  draft: Draft | null
  /** What the caller that opened the file told Jared to call the delivery of the review, and who receives it (see `OpenRequest`). */
  submitLabel?: string | null
  submitTarget?: string | null
  /** What the caller said about what happens once the review is taken (see `SubmitOptions`), or none. */
  submitOptions?: SubmitOptions | null
}

/** What the page adopts: the file and its review, and the words for delivering it. */
export interface Adopted {
  file: SourceFile | null
  review: AnyReview | null
  set: OpenSet | null
  submitLabel: string | null
  submitTarget: string | null
  submitOptions: SubmitOptions | null
}

/** What the page is to show afterwards: `null` when the request changed nothing. */
export type PageOutcome = { replies: Reply[]; adopt: Adopted | null }

export function toEngineState({ file, review, set, submitLabel, submitTarget, submitOptions }: Pick<PageSession, 'file' | 'review' | 'set' | 'submitLabel' | 'submitTarget' | 'submitOptions'>): EngineState {
  if (!file || !review) return emptyEngineState
  if (review.version === 2) {
    if (!set) return emptyEngineState
    return {
      source: null,
      review: null,
      set: {
        files: set.files.map((f, i) => ({ id: review.files[i].id, name: f.name, hash: f.hash, content: f.content })),
        review,
        ...(submitLabel ? { submitLabel } : {}),
        ...(submitTarget ? { submitTarget } : {}),
        ...(submitOptions ? { submitOptions } : {}),
      },
    }
  }
  return {
    source: {
      name: file.name,
      content: file.content,
      language: file.language,
      hash: file.hash,
      ...(submitLabel ? { submitLabel } : {}),
      ...(submitTarget ? { submitTarget } : {}),
      ...(submitOptions ? { submitOptions } : {}),
    },
    review,
  }
}

export function fromEngineState({ source, review, set }: EngineState): Adopted {
  if (set) {
    return {
      ...openSet(set.files, set.review),
      review: set.review,
      submitLabel: set.submitLabel ?? null,
      submitTarget: set.submitTarget ?? null,
      submitOptions: set.submitOptions ?? null,
    }
  }
  if (!source || !review) return { file: null, review: null, set: null, submitLabel: null, submitTarget: null, submitOptions: null }
  return {
    file: { name: source.name, content: source.content, lines: source.content.split('\n'), language: source.language, hash: source.hash },
    review,
    set: null,
    submitLabel: source.submitLabel ?? null,
    submitTarget: source.submitTarget ?? null,
    submitOptions: source.submitOptions ?? null,
  }
}

/** Whether replacing the session would throw away a reviewer's work: a comment that is saved or one being written. */
const hasWork = ({ review, draft }: PageSession): boolean => (review?.comments.length ?? 0) > 0 || draftHasText(draft)

/**
 * Act on one message that arrived on the page. Pure: the page does the adopting. Never throws.
 *
 * `stored` finds a review that the page kept from an earlier visit by the hash of its file. A file that is opened with no
 * review of its own gets it back, as a dropped file does, so that a request cannot quietly write over earlier comments. `storedSet` does the
 * same for several files, by the hash of the set (`setHashOf` of the files as given).
 */
export function handleAppMessage(
  session: PageSession,
  value: unknown,
  stored?: (hash: string) => Review | null,
  storedSet?: (setHash: string) => SetReview | null,
): PageOutcome {
  const parsed = parseRequest(value)
  if (!parsed.ok) return { replies: [parsed.reply], adopt: null }
  let { request } = parsed
  const before = toEngineState(session)

  if (request.type === 'open' || request.type === 'close') {
    const prepared = request.type === 'open' && request.files === undefined ? prepareSource(request.name, request.text) : null
    // A set of files that the engine would refuse is refused with its words; only a good one can be declined.
    const goodSet = request.type === 'open' && request.files !== undefined && !handle(emptyEngineState, request).replies.some((reply) => reply.type === 'error')
    const preparedSet = request.type === 'open' && request.files !== undefined && goodSet ? request.files.map((given) => prepareSource(given.name, given.text)) : null
    const setHash = preparedSet && preparedSet.every((file) => file.ok) ? setHashOf(preparedSet.map((file) => file.file)) : null
    // The same file, or the same files, again, asked for without a review of its own, changes nothing: it is answered with what is open. Words for
    // the delivery that it brings are the exception, and are taken: the file and its review stay as they are.
    const incomingHash = prepared?.ok ? prepared.file.hash : setHash
    if (request.type === 'open' && request.review === null && incomingHash !== null && incomingHash === session.file?.hash) {
      const label = request.submitLabel ?? session.submitLabel ?? null
      const target = request.submitTarget ?? session.submitTarget ?? null
      // Settings that are given replace the whole of the old ones; none given leaves them as they are.
      const options = request.submitOptions ?? session.submitOptions ?? null
      const changed = label !== (session.submitLabel ?? null) || target !== (session.submitTarget ?? null) || !sameSubmitOptions(options, session.submitOptions)
      return {
        replies: handle(before, { protocol: PROTOCOL_VERSION, id: request.id, type: 'getSession' }).replies,
        adopt: changed && session.file && session.review ? { file: session.file, review: session.review, set: session.set ?? null, submitLabel: label, submitTarget: target, submitOptions: options } : null,
      }
    }
    // A file that cannot be opened is the engine's to refuse, with its words; only a good one can be declined.
    if ((request.type === 'close' || prepared?.ok || goodSet) && hasWork(session)) {
      const what = request.type === 'open' ? (request.files === undefined ? `opening "${request.name}"` : 'opening these files') : 'closing the file'
      return { replies: [errorReply(request.id, 'declined', `${request.type}: ${what} would throw away the reviewer's work on "${session.file?.name}". Ask the reviewer first.`)], adopt: null }
    }
    if (request.type === 'open' && request.files === undefined && request.review === null && prepared?.ok) {
      request = { ...request, review: stored?.(prepared.file.hash) ?? null }
    }
    if (request.type === 'open' && request.files !== undefined && request.review === null && setHash !== null) {
      request = { ...request, review: storedSet?.(setHash) ?? null }
    }
  }

  const outcome = handle(before, request)
  return { replies: outcome.replies, adopt: outcome.state === before ? null : fromEngineState(outcome.state) }
}

/** How long `waitForSubmit` waits when it is not told: 40 seconds, under the 45 at which the browser tool cuts a script call off. */
export const DEFAULT_SUBMIT_WAIT_MS = 40_000
/** The longest it waits: ten minutes. */
export const MAX_SUBMIT_WAIT_MS = 600_000

/**
 * What the page's outbox does with its events: a review takes the place of a review that no call has taken, and the newest stays, whoever has
 * taken it, until a file is opened or closed, so that a review that a call took and whose caller is gone is not lost; a cancel and a skip are
 * emptied by the call that takes them.
 */
export const eventRules: OutboxRules<Event> = {
  replaces: (incoming, kept) => incoming.type === 'submitted' && kept.type === 'submitted',
  retained: (event) => event.type === 'submitted',
}

/**
 * What `window.jared.waitForSubmit(timeoutMs, afterRevision)` does: take the oldest event that the page has for the script and that the
 * script has not seen, waiting for one up to `timeoutMs`, and say `{ type: "timeout" }` if none came. A review that the reviewer has handed over
 * is new when its `revision` is above `afterRevision` (default 0, so any review is); the reviewer's cancel and skip are always new. An event
 * that came before the call is kept for it.
 */
export async function waitForSubmit(outbox: Outbox<Event>, timeoutMs?: number, afterRevision?: number): Promise<Event | { type: 'timeout' }> {
  const wanted = Number.isFinite(timeoutMs) ? (timeoutMs as number) : DEFAULT_SUBMIT_WAIT_MS // not a number, whatever a script passes in, is not finite
  const seen = Number.isFinite(afterRevision) ? (afterRevision as number) : 0
  return (await outbox.next(Math.min(Math.max(wanted, 0), MAX_SUBMIT_WAIT_MS), (event) => event.type !== 'submitted' || event.revision > seen)) ?? { type: 'timeout' }
}

import type { Draft, Review, SourceFile } from '../types.ts'
import { draftHasText } from '../lib/review.ts'
import { prepareSource } from '../lib/source.ts'
import { emptyEngineState, handle, type EngineState } from './engine.ts'
import type { Outbox } from './outbox.ts'
import { errorReply, parseRequest, PROTOCOL_VERSION, sameSubmitOptions, type Reply, type SubmitOptions, type SubmittedEvent } from './protocol.ts'

/**
 * The protocol on a page: what a script on the page (a browser tool, a test, a console) can ask of the interface the way
 * any caller asks of the engine. The page is not an engine, it has a person in it, so a request is run against what the
 * page shows: its file and review become an `EngineState`, the engine's own `handle` acts on it, and what comes out is
 * given back for the page to adopt. Every request of the protocol therefore works, by the engine's rules.
 */
export interface PageSession {
  file: SourceFile | null
  review: Review | null
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
  review: Review | null
  submitLabel: string | null
  submitTarget: string | null
  submitOptions: SubmitOptions | null
}

/** What the page is to show afterwards: `null` when the request changed nothing. */
export type PageOutcome = { replies: Reply[]; adopt: Adopted | null }

export function toEngineState({ file, review, submitLabel, submitTarget, submitOptions }: Pick<PageSession, 'file' | 'review' | 'submitLabel' | 'submitTarget' | 'submitOptions'>): EngineState {
  if (!file || !review) return emptyEngineState
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

export function fromEngineState({ source, review }: EngineState): Adopted {
  if (!source || !review) return { file: null, review: null, submitLabel: null, submitTarget: null, submitOptions: null }
  return {
    file: { name: source.name, content: source.content, lines: source.content.split('\n'), language: source.language, hash: source.hash },
    review,
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
 * review of its own gets it back, as a dropped file does, so that a request cannot quietly write over earlier comments.
 */
export function handleAppMessage(session: PageSession, value: unknown, stored?: (hash: string) => Review | null): PageOutcome {
  const parsed = parseRequest(value)
  if (!parsed.ok) return { replies: [parsed.reply], adopt: null }
  let { request } = parsed
  const before = toEngineState(session)

  if (request.type === 'open' || request.type === 'close') {
    const prepared = request.type === 'open' ? prepareSource(request.name, request.text) : null
    // The same file again, asked for without a review of its own, changes nothing: it is answered with what is open. Words for
    // the delivery that it brings are the exception, and are taken: the file and its review stay as they are.
    if (prepared?.ok && request.type === 'open' && request.review === null && prepared.file.hash === session.file?.hash) {
      const label = request.submitLabel ?? session.submitLabel ?? null
      const target = request.submitTarget ?? session.submitTarget ?? null
      // Settings that are given replace the whole of the old ones; none given leaves them as they are.
      const options = request.submitOptions ?? session.submitOptions ?? null
      const changed = label !== (session.submitLabel ?? null) || target !== (session.submitTarget ?? null) || !sameSubmitOptions(options, session.submitOptions)
      return {
        replies: handle(before, { protocol: PROTOCOL_VERSION, id: request.id, type: 'getSession' }).replies,
        adopt: changed && session.file && session.review ? { file: session.file, review: session.review, submitLabel: label, submitTarget: target, submitOptions: options } : null,
      }
    }
    // A file that cannot be opened is the engine's to refuse, with its words; only a good one can be declined.
    if ((request.type === 'close' || prepared?.ok) && hasWork(session)) {
      const what = request.type === 'open' ? `opening "${request.name}"` : 'closing the file'
      return { replies: [errorReply(request.id, 'declined', `${request.type}: ${what} would throw away the reviewer's work on "${session.file?.name}". Ask the reviewer first.`)], adopt: null }
    }
    if (request.type === 'open' && request.review === null && prepared?.ok) {
      request = { ...request, review: stored?.(prepared.file.hash) ?? null }
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
 * What `window.jared.waitForSubmit(timeoutMs)` does: take the oldest review that the reviewer has handed over, waiting for one up to
 * `timeoutMs`, and say `{ type: "timeout" }` if none came. A review handed over before the call is kept for it.
 */
export async function waitForSubmit(outbox: Outbox<SubmittedEvent>, timeoutMs?: number): Promise<SubmittedEvent | { type: 'timeout' }> {
  const wanted = Number.isFinite(timeoutMs) ? (timeoutMs as number) : DEFAULT_SUBMIT_WAIT_MS // not a number, whatever a script passes in, is not finite
  return (await outbox.next(Math.min(Math.max(wanted, 0), MAX_SUBMIT_WAIT_MS))) ?? { type: 'timeout' }
}

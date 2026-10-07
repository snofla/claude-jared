import { COPY } from '../lib/copy.ts'
import type { Review } from '../types.ts'
import { httpClientTransport } from './http-client.ts'
import { PROTOCOL_VERSION, submitOptions, words, type ErrorReply, type Reply, type SubmitOptions } from './protocol.ts'
import { createClient, type RequestInput } from './transport.ts'

export interface ReceiverClientOptions {
  /** The `fetch` to use. Default: the global one. */
  fetch?: typeof fetch
  /** How long to wait for an answer. Default 10 seconds. */
  timeoutMs?: number
  /** Who the sender named as the one that receives the review, for the words of what goes wrong; `null` when nobody was. */
  target?: string | null
}

/**
 * The file a receiver holds, and the words for delivering its review that its caller gave (none: the defaults), and what the caller said
 * about what happens once the review is taken (none: the defaults).
 */
export type SourceResult =
  | { ok: true; name: string; text: string; submitLabel: string | null; submitTarget: string | null; submitOptions: SubmitOptions | null }
  | { ok: false; error: string }
export type SendResult = { ok: true } | { ok: false; error: string }

const TIMEOUT_MS = 10_000

/** What a person should read when the receiver refuses a request. */
function refusal(reply: ErrorReply, target: string | null): string {
  switch (reply.code) {
    case 'review-mismatch':
      return COPY.reviewForAnotherFile(target)
    case 'invalid-review':
      return COPY.refusedReview(target)
    case 'no-session':
      return COPY.notWaiting(target)
    default:
      return COPY.answeredWithError(target, reply.message)
  }
}

/** Ask a receiver one thing and give back its answer, or the words for why there was none. */
async function ask(address: string, input: RequestInput, options: ReceiverClientOptions): Promise<{ reply: Reply } | { error: string }> {
  const client = createClient(httpClientTransport(address, { fetch: options.fetch }), { timeoutMs: options.timeoutMs ?? TIMEOUT_MS })
  try {
    return { reply: await client.request(input) }
  } catch {
    // createClient only ever rejects with an Error, whatever the transport threw; the browser's own words for it ("Failed to fetch", and
    // other words in other browsers) are English, differ from browser to browser and tell the reviewer nothing to act on, so they are not shown.
    const host = new URL(address).host
    return { error: input.type === 'getSource' ? COPY.couldNotReachForFile(options.target ?? null, host) : COPY.couldNotReach(options.target ?? null, host) }
  } finally {
    client.close()
  }
}

/** Get the file that a receiver has open, as a name and its text. */
export async function fetchSource(address: string, options: ReceiverClientOptions = {}): Promise<SourceResult> {
  const answer = await ask(address, { type: 'getSource' }, options)
  if ('error' in answer) return { ok: false, error: answer.error }
  const { reply } = answer
  // The words are shown as they come, so they are checked as a request's are: what will not do is no words, and settings that will not do are no settings.
  if (reply.type === 'source') {
    const options = submitOptions(reply.submitOptions)
    return { ok: true, name: reply.file.name, text: reply.text, submitLabel: words(reply.submitLabel) || null, submitTarget: words(reply.submitTarget) || null, submitOptions: (options.ok && options.options) || null }
  }
  return { ok: false, error: reply.type === 'error' ? refusal(reply, options.target ?? null) : COPY.unexpectedAnswer(options.target ?? null) }
}

/** Hand a finished review to a receiver. It is delivered once the receiver has said so, not before. */
export async function sendReview(address: string, review: Review, now: string, options: ReceiverClientOptions = {}): Promise<SendResult> {
  const answer = await ask(address, { type: 'submit', review, now }, options)
  if ('error' in answer) return { ok: false, error: answer.error }
  const { reply } = answer
  if (reply.type === 'session') return { ok: true }
  return { ok: false, error: reply.type === 'error' ? refusal(reply, options.target ?? null) : COPY.unexpectedAnswer(options.target ?? null) }
}

/**
 * Tell a receiver that the reviewer gave the review up, as one `cancelled` message that answers nothing: there is no stream to open and no reply
 * to wait for, only the receiver's word that it took the message. It is not tried again.
 */
export async function sendCancelled(address: string, seq: number, options: ReceiverClientOptions = {}): Promise<SendResult> {
  try {
    await httpClientTransport(address, { fetch: options.fetch }).send({ protocol: PROTOCOL_VERSION, type: 'cancelled', seq }) // no listener, so no stream to close
    return { ok: true }
  } catch {
    return { ok: false, error: COPY.couldNotReach(options.target ?? null, new URL(address).host) }
  }
}

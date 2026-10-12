import { COPY } from '../lib/copy.ts'
import type { Review } from '../types.ts'
import { httpClientTransport } from './http-client.ts'
import { PROTOCOL_VERSION, submitOptions, words, type ErrorReply, type Reply, type ReviewChanges, type SubmitOptions } from './protocol.ts'
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
export const sendCancelled = (address: string, seq: number, options: ReceiverClientOptions = {}): Promise<SendResult> => sendEnd(address, 'cancelled', seq, options)

/** Tell a receiver that the reviewer chose not to review the file now, in the same way: one `skipped` message that answers nothing, not tried again. */
export const sendSkipped = (address: string, seq: number, options: ReceiverClientOptions = {}): Promise<SendResult> => sendEnd(address, 'skipped', seq, options)

async function sendEnd(address: string, type: 'cancelled' | 'skipped', seq: number, options: ReceiverClientOptions): Promise<SendResult> {
  try {
    await httpClientTransport(address, { fetch: options.fetch }).send({ protocol: PROTOCOL_VERSION, type, seq }) // no listener, so no stream to close
    return { ok: true }
  } catch {
    return { ok: false, error: COPY.couldNotReach(options.target ?? null, new URL(address).host) }
  }
}

export interface ServiceSendOptions extends ReceiverClientOptions {
  /** What differs from the review that the service was sent before, as the ids of comments: a help for a program that lost its context. */
  changes?: ReviewChanges
}

/** What the page is told of a send to the service: the revision that the service wrote the review as, which only it counts, or the words for why there was none. */
export type ServiceSendResult = { ok: true; revision: number } | { ok: false; error: string }

/**
 * What the service answers to a POST: `{ "ok": true, "revision": <whole number from 1> }`, or `{ "ok": false, "code": ..., "message": ... }` with the status
 * of a refusal; anything else is none.
 */
function serviceAnswer(value: unknown, delivered: boolean): { ok: true; revision: number } | { ok: false; code: string; message: string } | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const answer = value as Record<string, unknown>
  if (answer.ok === true && delivered && typeof answer.revision === 'number' && Number.isInteger(answer.revision) && answer.revision >= 1) return { ok: true, revision: answer.revision }
  if (answer.ok === false && !delivered && typeof answer.code === 'string' && typeof answer.message === 'string') return { ok: false, code: answer.code, message: answer.message }
  return null
}

/**
 * Hand a finished review to the Jared service, at the address of the folder of the review that the page was served from: one POST of the receiver's
 * own `submit` message, with the note of what changed, and the answer is in the reply, so there is no stream to open. The page sends no number of its
 * own, because it counts from 1 every time that it is loaded and the service refuses a number below the file's: the service numbers the review, and
 * the reply says how. It is delivered once the service has said that the file is written, not before, which is not that a program has taken it. It is
 * not tried again.
 */
export async function sendToService(address: string, review: Review, now: string, options: ServiceSendOptions = {}): Promise<ServiceSendResult> {
  const target = options.target ?? null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? TIMEOUT_MS)
  try {
    const response = await (options.fetch ?? fetch)(`${address}/message`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        protocol: PROTOCOL_VERSION,
        id: 'review',
        type: 'submit',
        review: { ...review, submittedAt: now },
        now,
        ...(options.changes ? { changes: options.changes } : {}),
      }),
      signal: controller.signal,
    })
    const answer = serviceAnswer(await response.json().catch(() => null), response.ok)
    if (answer === null) return { ok: false, error: COPY.unexpectedAnswer(target) }
    if (answer.ok) return { ok: true, revision: answer.revision }
    if (answer.code === 'invalid') return { ok: false, error: COPY.refusedReview(target) }
    if (answer.code === 'closed') return { ok: false, error: COPY.notWaiting(target) }
    if (answer.code === 'large') return { ok: false, error: COPY.serviceTooBig }
    if (answer.code === 'write') return { ok: false, error: COPY.serviceNotSaved }
    return { ok: false, error: COPY.serviceRefused(answer.message) }
  } catch {
    // As for a receiver: the browser's own words for a failure are not shown, and a request that was given up is no answer.
    return { ok: false, error: COPY.couldNotReach(target, new URL(address).host) }
  } finally {
    clearTimeout(timer)
  }
}

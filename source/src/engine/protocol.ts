import type { Review } from '../types.ts'
import { parseReview } from '../lib/review.ts'

/**
 * The messages between a caller and the Jared engine. Every message is a JSON object, so it can cross a function
 * call, a `postMessage`, a line on a pipe, a file or a socket without changing. The engine reads no clock and makes
 * no ids: the caller puts the time (`now`) and the ids in the message.
 *
 * A request has an `id` chosen by the caller; each reply carries it back as `replyTo`.
 */
export const PROTOCOL_VERSION = 1

export type ReviewFormat = 'json' | 'markdown'

interface Envelope {
  protocol: typeof PROTOCOL_VERSION
}

// ---- requests ----------------------------------------------------------------------------------------------------

interface RequestBase extends Envelope {
  id: string
}

/** The most characters of a `submitLabel` or a `submitTarget`: they are put on the page by whoever sent the request. */
export const MAX_WORDS = 40
/**
 * The most characters of `submitOptions.message`, the words that tell the reviewer that a review was sent: they are drawn as a banner, which
 * holds about 45 characters a line at 375 px, so that 80 stay on two lines (the longest default message is 56).
 */
export const MAX_MESSAGE = 80

/** When the dialog closes by itself once a delivery has taken the review: after a moment, at once, or not at all. */
export type Closes = 'moment' | 'now' | 'never'
export const CLOSES: readonly Closes[] = ['moment', 'now', 'never']

/**
 * What a caller may set about what happens once its delivery has taken the review: `closes`, when the dialog closes by itself
 * (default `moment`); `message`, the words that tell the reviewer, in place of Jared's own (default: Jared's own); and `banner`, whether
 * that message is also drawn as a banner under the header (default `true`; the message is announced either way). Each is optional.
 */
export interface SubmitOptions {
  closes?: Closes
  message?: string
  banner?: boolean
}

/**
 * Open a file from its name and text. With a `review`, that review is restored; it must be for this very text.
 *
 * `submitLabel` and `submitTarget` are what the caller tells Jared to call the delivery of the review: the words on the button
 * (none: "Export review") and the name of whoever is to receive it (none: "the program that opened Jared"). The engine keeps
 * them with the file and gives them back with `getSource`, so that a peer that only asks the engine for its file learns them too.
 * `submitOptions` is what the caller says about what happens once the review has been taken (see `SubmitOptions`); it is kept and given
 * back in the same way.
 */
export interface OpenRequest extends RequestBase {
  type: 'open'
  name: string
  text: string
  review: Review | null
  now: string
  submitLabel?: string
  submitTarget?: string
  submitOptions?: SubmitOptions
}

export interface CloseRequest extends RequestBase {
  type: 'close'
}

export interface GetSessionRequest extends RequestBase {
  type: 'getSession'
}

/** Ask for the open file's text, for a viewer that knows nothing but the engine's address. */
export interface GetSourceRequest extends RequestBase {
  type: 'getSource'
}

export interface SetLanguageRequest extends RequestBase {
  type: 'setLanguage'
  language: string
}

/** Add a comment, or replace the one whose id is `commentId`. Lines are numbered from 1, the range is inclusive. */
export interface SaveCommentRequest extends RequestBase {
  type: 'saveComment'
  commentId: string
  startLine: number
  endLine: number
  comment: string
  suggestion: string | null
  now: string
}

export interface DeleteCommentRequest extends RequestBase {
  type: 'deleteComment'
  commentId: string
  now: string
}

export interface SetSummaryRequest extends RequestBase {
  type: 'setSummary'
  summary: string
  now: string
}

export interface MarkSubmittedRequest extends RequestBase {
  type: 'markSubmitted'
  now: string
}

/**
 * Hand over a finished review of the open file. It must be for this very text; it is kept as it is, marked submitted at
 * `now`. Unlike `open` it does not replace the file, so a review for another file is refused instead of opened.
 */
export interface SubmitRequest extends RequestBase {
  type: 'submit'
  review: Review
  now: string
}

export interface ExportRequest extends RequestBase {
  type: 'export'
  format: ReviewFormat
}

export type Request =
  | OpenRequest
  | CloseRequest
  | GetSessionRequest
  | GetSourceRequest
  | SetLanguageRequest
  | SaveCommentRequest
  | DeleteCommentRequest
  | SetSummaryRequest
  | MarkSubmittedRequest
  | SubmitRequest
  | ExportRequest

export type RequestType = Request['type']

export const REQUEST_TYPES: readonly RequestType[] = [
  'open',
  'close',
  'getSession',
  'getSource',
  'setLanguage',
  'saveComment',
  'deleteComment',
  'setSummary',
  'markSubmitted',
  'submit',
  'export',
]

// ---- replies -----------------------------------------------------------------------------------------------------

interface ReplyBase extends Envelope {
  /** The `id` of the request this answers; `null` when the request had no usable id. */
  replyTo: string | null
}

export interface SessionFile {
  name: string
  language: string
  lineCount: number
  hash: string
}

/** The state after a request: what is open and its review, or both `null`. The text is not sent back. */
export interface SessionReply extends ReplyBase {
  replyTo: string
  type: 'session'
  file: SessionFile | null
  review: Review | null
}

/** The open file and its text, with the words for delivering its review if the caller gave any (see `OpenRequest`). */
export interface SourceReply extends ReplyBase {
  replyTo: string
  type: 'source'
  file: SessionFile
  text: string
  submitLabel?: string
  submitTarget?: string
  submitOptions?: SubmitOptions
}

export interface ExportedReply extends ReplyBase {
  replyTo: string
  type: 'exported'
  format: ReviewFormat
  fileName: string
  mime: string
  text: string
}

export const ERROR_CODES = [
  'invalid-message',
  'unsupported-protocol',
  'unknown-type',
  'file-rejected',
  'invalid-review',
  'review-mismatch',
  'no-session',
  'bad-range',
  'bad-language',
  'empty-comment',
  'no-such-comment',
  'declined',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export interface ErrorReply extends ReplyBase {
  type: 'error'
  code: ErrorCode
  message: string
}

export type Reply = SessionReply | SourceReply | ExportedReply | ErrorReply

/**
 * A message from the engine's side that answers no request: something happened that its peer may want to know. The first is
 * `submitted`, sent when the reviewer hands the review over on a page that a script drives. `seq` counts them from 1 within a page.
 */
export interface SubmittedEvent extends Envelope {
  type: 'submitted'
  seq: number
  review: Review
}

export type Event = SubmittedEvent

export const EVENT_TYPES = ['submitted'] as const

/** Whether a value that arrived from a peer has the shape of an event. */
export function isEvent(value: unknown): value is Event {
  return isRecord(value) && value.protocol === PROTOCOL_VERSION && (EVENT_TYPES as readonly unknown[]).includes(value.type) && !('replyTo' in value)
}

export type Message = Request | Reply | Event

export const REPLY_TYPES = ['session', 'source', 'exported', 'error'] as const

export function errorReply(replyTo: string | null, code: ErrorCode, message: string): ErrorReply {
  return { protocol: PROTOCOL_VERSION, replyTo, type: 'error', code, message }
}

/** Whether a value that arrived from a peer has the shape of a reply. Used to match replies to requests. */
export function isReply(value: unknown): value is Reply {
  if (!isRecord(value) || value.protocol !== PROTOCOL_VERSION) return false
  if (!(typeof value.replyTo === 'string' || value.replyTo === null)) return false
  return (REPLY_TYPES as readonly unknown[]).includes(value.type)
}

// ---- reading what arrives ----------------------------------------------------------------------------------------

export type ParsedRequest = { ok: true; request: Request } | { ok: false; reply: ErrorReply }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isString = (value: unknown): value is string => typeof value === 'string'
const isNonEmpty = (value: unknown): value is string => typeof value === 'string' && value !== ''
const isLine = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1

/**
 * A few words that a caller puts on the page: trimmed, 1 to `MAX_WORDS` characters (code points, so an emoji is one), no control
 * characters, line or paragraph separators, lone surrogates or invisible formatting characters (zero-width spaces, the marks and
 * overrides that change the direction of text), and at least one character that can be seen. The joiners that emoji sequences and
 * some scripts need are allowed. `undefined` when there are none (absent or null), `false` when what is there will not do.
 */
export function words(value: unknown, max: number = MAX_WORDS): string | undefined | false {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') return false
  const text = value.trim()
  const characters = [...text]
  const hidden = (c: string) => /[\p{Cc}\p{Cs}\p{Zl}\p{Zp}\p{Cf}]/u.test(c) && c !== '\u200c' && c !== '\u200d'
  const seen = characters.some((c) => /[^\s\p{Cf}]/u.test(c))
  return characters.length <= max && seen && !characters.some(hidden) ? text : false
}

/** What `submitOptions` found wrong: the field, as it is named in the message, and what it must be. */
export type SubmitOptionsResult = { ok: true; options: SubmitOptions | undefined } | { ok: false; field: string; wanted: string }

/**
 * The settings that a caller gave for what happens after a review was taken (`SubmitOptions`). `options` is `undefined` when there are none:
 * absent, `null`, or an object that sets nothing; a setting that is `null` is absent, as the words are. An object with a key that is not a
 * setting is refused and says which, so that `close` for `closes` is told and not quietly ignored.
 */
export function submitOptions(value: unknown): SubmitOptionsResult {
  if (value === undefined || value === null) return { ok: true, options: undefined }
  const wanted = 'an object with the settings closes, message and banner'
  if (!isRecord(value)) return { ok: false, field: 'submitOptions', wanted }
  const unknown = Object.keys(value).find((key) => key !== 'closes' && key !== 'message' && key !== 'banner')
  if (unknown !== undefined) return { ok: false, field: 'submitOptions', wanted: `${wanted}, and there is no setting "${unknown}"` }
  const options: SubmitOptions = {}
  if (value.closes !== undefined && value.closes !== null) {
    if (!(CLOSES as readonly unknown[]).includes(value.closes)) return { ok: false, field: 'submitOptions.closes', wanted: 'one of "moment", "now" or "never"' }
    options.closes = value.closes as Closes
  }
  const message = words(value.message, MAX_MESSAGE)
  if (message === false) {
    return { ok: false, field: 'submitOptions.message', wanted: `a string of 1 to ${MAX_MESSAGE} characters with no control characters, line breaks or invisible characters` }
  }
  if (message !== undefined) options.message = message
  if (value.banner !== undefined && value.banner !== null) {
    if (typeof value.banner !== 'boolean') return { ok: false, field: 'submitOptions.banner', wanted: 'true or false' }
    options.banner = value.banner
  }
  return { ok: true, options: Object.keys(options).length === 0 ? undefined : options }
}

/** Whether two sets of settings say the same: an absent setting is the same as an absent object. */
export const sameSubmitOptions = (a: SubmitOptions | null | undefined, b: SubmitOptions | null | undefined): boolean =>
  a?.closes === b?.closes && a?.message === b?.message && a?.banner === b?.banner

/** Check a message that came from outside before the engine acts on it. Never throws: a bad message is an error reply. */
export function parseRequest(value: unknown): ParsedRequest {
  if (!isRecord(value)) {
    return fail(null, 'invalid-message', 'A message is a JSON object.')
  }
  const id = isNonEmpty(value.id) ? value.id : null
  if (value.protocol !== PROTOCOL_VERSION) {
    return fail(id, 'unsupported-protocol', `This engine speaks protocol ${PROTOCOL_VERSION}; the message says ${JSON.stringify(value.protocol)}.`)
  }
  if (id === null) return fail(null, 'invalid-message', '"id" must be a non-empty string.')

  const type = value.type
  if (!(REQUEST_TYPES as readonly unknown[]).includes(type)) {
    return fail(id, 'unknown-type', `"${String(type)}" is not a request this engine knows.`)
  }

  const bad = (field: string, wanted: string): ParsedRequest => fail(id, 'invalid-message', `${String(type)}: "${field}" must be ${wanted}.`)
  const base = { protocol: PROTOCOL_VERSION, id } as const

  switch (type as RequestType) {
    case 'open': {
      if (!isNonEmpty(value.name)) return bad('name', 'a non-empty string')
      if (!isString(value.text)) return bad('text', 'a string')
      if (!isNonEmpty(value.now)) return bad('now', 'a non-empty string')
      let review: Review | null = null
      if (value.review !== undefined && value.review !== null) {
        review = parseReview(value.review)
        if (review === null) return fail(id, 'invalid-review', 'open: "review" is not a Jared review of version 1.')
      }
      const submitLabel = words(value.submitLabel)
      if (submitLabel === false) return bad('submitLabel', `a string of 1 to ${MAX_WORDS} characters with no control characters, line breaks or invisible characters`)
      const submitTarget = words(value.submitTarget)
      if (submitTarget === false) return bad('submitTarget', `a string of 1 to ${MAX_WORDS} characters with no control characters, line breaks or invisible characters`)
      const options = submitOptions(value.submitOptions)
      if (!options.ok) return bad(options.field, options.wanted)
      return ok({
        ...base,
        type: 'open',
        name: value.name,
        text: value.text,
        review,
        now: value.now,
        ...(submitLabel === undefined ? {} : { submitLabel }),
        ...(submitTarget === undefined ? {} : { submitTarget }),
        ...(options.options === undefined ? {} : { submitOptions: options.options }),
      })
    }
    case 'close':
      return ok({ ...base, type: 'close' })
    case 'getSession':
      return ok({ ...base, type: 'getSession' })
    case 'getSource':
      return ok({ ...base, type: 'getSource' })
    case 'setLanguage':
      if (!isNonEmpty(value.language)) return bad('language', 'a non-empty string')
      return ok({ ...base, type: 'setLanguage', language: value.language })
    case 'saveComment': {
      if (!isNonEmpty(value.commentId)) return bad('commentId', 'a non-empty string')
      if (!isLine(value.startLine)) return bad('startLine', 'a whole number from 1')
      if (!isLine(value.endLine)) return bad('endLine', 'a whole number from 1')
      if (!isString(value.comment)) return bad('comment', 'a string')
      if (!(isString(value.suggestion) || value.suggestion === null)) return bad('suggestion', 'a string or null')
      if (!isNonEmpty(value.now)) return bad('now', 'a non-empty string')
      return ok({
        ...base,
        type: 'saveComment',
        commentId: value.commentId,
        startLine: value.startLine,
        endLine: value.endLine,
        comment: value.comment,
        suggestion: value.suggestion,
        now: value.now,
      })
    }
    case 'deleteComment':
      if (!isNonEmpty(value.commentId)) return bad('commentId', 'a non-empty string')
      if (!isNonEmpty(value.now)) return bad('now', 'a non-empty string')
      return ok({ ...base, type: 'deleteComment', commentId: value.commentId, now: value.now })
    case 'setSummary':
      if (!isString(value.summary)) return bad('summary', 'a string')
      if (!isNonEmpty(value.now)) return bad('now', 'a non-empty string')
      return ok({ ...base, type: 'setSummary', summary: value.summary, now: value.now })
    case 'markSubmitted':
      if (!isNonEmpty(value.now)) return bad('now', 'a non-empty string')
      return ok({ ...base, type: 'markSubmitted', now: value.now })
    case 'submit': {
      if (!isNonEmpty(value.now)) return bad('now', 'a non-empty string')
      const review = parseReview(value.review)
      if (review === null) return fail(id, 'invalid-review', 'submit: "review" is not a Jared review of version 1.')
      return ok({ ...base, type: 'submit', review, now: value.now })
    }
    case 'export':
      if (value.format !== 'json' && value.format !== 'markdown') return bad('format', '"json" or "markdown"')
      return ok({ ...base, type: 'export', format: value.format })
  }
}

function ok(request: Request): ParsedRequest {
  return { ok: true, request }
}

function fail(replyTo: string | null, code: ErrorCode, message: string): ParsedRequest {
  return { ok: false, reply: errorReply(replyTo, code, message) }
}

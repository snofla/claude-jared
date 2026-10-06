/**
 * A link that carries protocol requests: `<Jared's address>#jared=<base64url of JSON>`, where the JSON is one request or an
 * array of them. A fragment is never sent to a server, so the file in it stays between the page and whoever made the link.
 * This is only the carrier: what the requests mean, and whether they are good ones, is for the protocol (`parseRequest`).
 */
export const FRAGMENT_KEY = 'jared'
/** The longest value accepted. Jared opens files of up to 512 KB, which is about 700,000 characters in base64. */
export const MAX_FRAGMENT_LENGTH = 1_000_000
export const MAX_MESSAGES = 20

export type FragmentRead = { ok: true; messages: Array<Record<string, unknown>> } | { ok: false; error: string }

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** The value for `#jared=`: requests as JSON, as UTF-8, in base64url without padding. */
export function fragmentValue(messages: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(messages))
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Jared's address with the requests in its fragment. Whatever fragment the address had is replaced. Throws if it is too long. */
export function linkWith(base: string, messages: unknown): string {
  const value = fragmentValue(messages)
  if (value.length > MAX_FRAGMENT_LENGTH) throw new Error(`The requests are too big for a link: ${value.length} characters, and ${MAX_FRAGMENT_LENGTH} is the most.`)
  const link = new URL(base)
  link.hash = `${FRAGMENT_KEY}=${value}`
  return link.toString()
}

/**
 * The requests in an address's fragment (`location.hash`). `null` when it has none, so that an address with another kind
 * of fragment is left alone; otherwise the requests, or a sentence saying what is wrong with them.
 */
export function readFragment(hash: string): FragmentRead | null {
  const value = new URLSearchParams(hash.replace(/^#/, '')).get(FRAGMENT_KEY)
  if (value === null) return null
  const fail = (error: string): FragmentRead => ({ ok: false, error: `The link could not be read: ${error}` })

  if (value === '') return fail('it has nothing in it.')
  if (value.length > MAX_FRAGMENT_LENGTH) return fail(`it is ${value.length} characters long, and ${MAX_FRAGMENT_LENGTH} is the most.`)
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(value)) return fail('it is not base64url.')
  if (value.replace(/=+$/, '').length % 4 === 1) return fail('it is not base64url.')

  let text: string
  try {
    const binary = atob(value.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/'))
    text = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)))
  } catch {
    return fail('it is not text in UTF-8.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return fail('it is not JSON.')
  }

  return requestsIn(parsed, fail)
}

/** The requests in a value that was read from JSON: one request or an array of them, in the limits of a link. */
function requestsIn(parsed: unknown, fail: (error: string) => FragmentRead): FragmentRead {
  const messages = Array.isArray(parsed) ? parsed : [parsed]
  if (messages.length === 0) return fail('it holds no requests.')
  if (messages.length > MAX_MESSAGES) return fail(`it holds ${messages.length} requests, and ${MAX_MESSAGES} is the most.`)
  if (!messages.every(isObject)) return fail('a request is not a JSON object.')
  return { ok: true, messages }
}

/**
 * The name of the page's global that carries requests in when the page is a file opened from a path (`file://`), where the
 * fragment of a link does not survive the system's opener (measured in Safari): a script beside the page, `jared-boot.js`,
 * sets `window.__JARED_BOOT` to one request or an array of them before the page's own script runs.
 */
export const BOOT_KEY = '__JARED_BOOT'

/**
 * The requests that came with the page, from the value of `window.__JARED_BOOT`. `null` when there is none (`undefined`), so
 * that a page opened any other way carries on as before; otherwise the requests, or a sentence saying what is wrong with them.
 */
export function readBoot(value: unknown): FragmentRead | null {
  if (value === undefined) return null
  return requestsIn(value, (error) => ({ ok: false, error: `The file jared-boot.js that came with this page could not be read: ${error}` }))
}

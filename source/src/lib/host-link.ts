/** The query parameter that carries a receiver's address into Jared. */
export const HOST_PARAM = 'host'

const LOOPBACK = ['127.0.0.1', 'localhost', '[::1]']

/**
 * A receiver's address, if Jared may talk to it: `http` on this computer, with a path of one part (the secret), and
 * nothing else in it. Anything else gives `null`. This is the rule that keeps a crafted link from making Jared send a
 * review to another computer: only an address on this computer is ever used. Returns the address without a trailing `/`.
 */
export function receiverAddress(value: string): string | null {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' || !LOOPBACK.includes(url.hostname)) return null
  if (url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') return null
  const secret = /^\/([^/]+)\/?$/.exec(url.pathname)
  return secret ? `${url.origin}/${secret[1]}` : null
}

/** The receiver's address in a page's query string (`location.search`), or `null` when there is none that Jared may use. */
export function hostFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get(HOST_PARAM)
  return value === null ? null : receiverAddress(value)
}

/** Jared's own address with a receiver's address added, for a person to open. Throws if the receiver is not one Jared may use. */
export function jaredLink(jaredUrl: string, receiver: string): string {
  const address = receiverAddress(receiver)
  if (address === null) throw new Error(`"${receiver}" is not an address that Jared will send a review to: it must be http, on this computer, with one secret in its path.`)
  const link = new URL(jaredUrl)
  link.searchParams.set(HOST_PARAM, address)
  return link.toString()
}

/**
 * The name of the page's global that the script of a review sets, `window.__JARED_SERVICE`, when the review comes back as a file: the address of
 * the review's folder at the service that served the page (`serviceAddress` says whether Jared may use it).
 */
export const SERVICE_KEY = '__JARED_SERVICE'

/**
 * The address of a review's folder at a service that Jared may send the review to: `http` on this computer, with a path of two parts, the secret
 * (32 lower-case hexadecimal digits, as the service makes it) and the name of the folder (`review.` and six letters or digits, as the helper
 * makes it), and nothing else in it, and on the origin that served the page itself (`ownOrigin`, which is `window.location.origin`), so that a
 * script that sets the global cannot send a review to another program on this computer. Anything else gives `null`. Returns the address without
 * a trailing `/`.
 */
export function serviceAddress(value: unknown, ownOrigin: string): string | null {
  if (typeof value !== 'string') return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' || !LOOPBACK.includes(url.hostname) || url.origin !== ownOrigin) return null
  if (url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') return null
  const path = /^\/([0-9a-f]{32})\/(review\.[A-Za-z0-9]{6})\/?$/.exec(url.pathname)
  return path ? `${url.origin}/${path[1]}/${path[2]}` : null
}

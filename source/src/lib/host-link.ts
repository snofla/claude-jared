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

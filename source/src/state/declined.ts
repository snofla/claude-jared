import { parseRequest, type Reply } from '../engine/protocol'
import { COPY } from '../lib/copy'

/** What the page shows of itself that the words need: the name of the file that is open, and who the delivery of its review is for. */
export interface DeclinedPage {
  fileName: string | null
  submitTarget: string | null
}

/**
 * The line to tell the reviewer when the page declined a script's `open` or `close` because it would have thrown their work away: who
 * asked, what it asked for, and that the review was kept. It is `null` when none of the replies declines that request, so a script's other
 * calls say nothing. Pure.
 *
 * The caller is named by the `submitTarget` of the request that asked, otherwise by the one the open review came with, and otherwise
 * not at all: the words then say "A program".
 */
export function declinedNotice(value: unknown, replies: Reply[], page: DeclinedPage): string | null {
  const parsed = parseRequest(value)
  if (!parsed.ok) return null
  const { request } = parsed
  if (request.type !== 'open' && request.type !== 'close') return null
  if (!replies.some((reply) => reply.type === 'error' && reply.code === 'declined' && reply.replyTo === request.id)) return null
  if (request.type === 'close') return COPY.declinedClose(page.submitTarget, page.fileName)
  return COPY.declinedOpen(request.submitTarget ?? page.submitTarget, request.name, page.fileName)
}

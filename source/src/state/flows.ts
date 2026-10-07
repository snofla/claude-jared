import type { Draft, Review, SourceFile } from '../types'
import { COPY } from '../lib/copy'
import type { Platform, Picked } from '../lib/platform'
import { draftHasText, planOpen } from '../lib/review'
import { prepareSource } from '../lib/source'
import type { Action } from './reducer'

/**
 * What the interface does with the places it runs in: open a file and ask about replacing a review, go back to a kept one,
 * leave a file. Each flow takes the platform, so that a test runs it on `memoryPlatform` and a tab runs it on `browserPlatform`; none of them calls
 * a browser API, and none of them dispatches: they say what to dispatch, and the interface does it.
 */

/** What came of asking to open a file. */
export type OpenOutcome =
  /** Open it: dispatch the action. The file is the one that the page will hold, with the language of its kept review. */
  | { kind: 'opened'; action: Action; file: SourceFile }
  /** The file that is open already: nothing changes. */
  | { kind: 'same' }
  /** The reviewer chose to keep what is open. */
  | { kind: 'declined' }
  /** The file cannot be opened, and why. */
  | { kind: 'refused'; error: string }

/** What a flow needs to know of the page: the review that is open, and the comment being written. */
export interface OpenSession {
  review: Review | null
  draft: Draft | null
}

/** Keep the file, so that it can be opened again after a visit, and remember that it is the one that is open. */
export function keepOpen(platform: Platform, file: SourceFile): void {
  platform.reviews.saveSource(file)
  platform.reviews.setLast(file.hash)
}

/** Remember that no file is open. */
export function closeFile(platform: Platform): void {
  platform.reviews.setLast(null)
}

/** Whether giving the review up needs a question first: there is something to lose: saved comments, an overall summary or a comment being written. An empty review is given up at once. */
export function mustAskBeforeCancel(session: OpenSession): boolean {
  return (session.review?.comments.length ?? 0) > 0 || (session.review?.summary.trim() ?? '') !== '' || draftHasText(session.draft)
}

/** Give a review up: forget the file and its review, as Forget does on the start page, and remember that no file is open. */
export function cancelReview(platform: Platform, hash: string): void {
  platform.reviews.forget(hash)
  closeFile(platform)
}

/** The file, kept, with the review that was kept for it (a file that was reviewed before comes back as it was, language included). */
function open(platform: Platform, incoming: SourceFile): Extract<OpenOutcome, { kind: 'opened' }> {
  const stored = platform.reviews.review(incoming.hash)
  const file = stored ? { ...incoming, language: stored.file.language } : incoming
  keepOpen(platform, file)
  return { kind: 'opened', file, action: { type: 'open', name: file.name, text: file.content, review: stored, now: platform.environment.now() } }
}

/** Open a file over what is open: nothing for the file that is open, and a question when something would be lost (saved comments, or a comment being written). */
export function openFile(platform: Platform, session: OpenSession, incoming: SourceFile): OpenOutcome {
  const plan = planOpen(session.review, session.draft, incoming)
  if (plan.kind === 'ignore') return { kind: 'same' }
  if (plan.kind === 'ask' && !platform.prompts.confirm(plan.message)) return { kind: 'declined' }
  return open(platform, incoming)
}

/** Open what was picked or dropped. The question comes after the read, so that a file that is refused never asks to replace anything. */
export async function openPicked(platform: Platform, session: OpenSession, picked: Picked): Promise<OpenOutcome> {
  const read = await platform.input.read(picked)
  return read.ok ? openFile(platform, session, read.file) : { kind: 'refused', error: read.error }
}

/** Open a file that arrived as text, such as the one that a receiver holds. */
export function openText(platform: Platform, session: OpenSession, name: string, text: string): OpenOutcome {
  const prepared = prepareSource(name, text)
  return prepared.ok ? openFile(platform, session, prepared.file) : { kind: 'refused', error: prepared.error }
}

/** Go back to a file that was kept; when it is not there any more it is forgotten, and that is said. */
export function openRecent(platform: Platform, hash: string): OpenOutcome | { kind: 'gone' } {
  const kept = platform.reviews.session(hash)
  if (kept) return open(platform, kept.file)
  platform.reviews.forget(hash)
  return { kind: 'gone' }
}

/** Whether to go on with something that would throw away the comment being written: no question when there is no comment. */
export function mayDiscard(platform: Platform, draft: Draft | null): boolean {
  return !draftHasText(draft) || platform.prompts.confirm(COPY.discardComment)
}

/** What to ask the reviewer when a link asks to replace the file and the page declined: what the replacing would lose, or the page's own words. */
export function replaceQuestion(session: OpenSession, name: string, text: string, declined: string): string {
  const prepared = prepareSource(name, text)
  const plan = prepared.ok ? planOpen(session.review, session.draft, prepared.file) : null
  return plan?.kind === 'ask' ? plan.message : declined
}

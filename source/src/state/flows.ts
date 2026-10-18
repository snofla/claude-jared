import type { AnyReview, Draft, SourceFile } from '../types'
import type { KeptSet } from '../lib/platform'
import { COPY } from '../lib/copy'
import { setHashOf } from '../lib/hash'
import type { Platform, Picked } from '../lib/platform'
import { draftHasText, planOpen } from '../lib/review'
import { MAX_BYTES, MAX_SET_BYTES, buildSource, prepareSource, tooBig } from '../lib/source'
import { MAX_SCANNED, MAX_SET_FILES, planPicked, type SetPlan } from '../lib/set-pick'
import { formatBytes } from '../lib/util'
import type { Action, AppState } from './reducer'

/**
 * What the interface does with the places it runs in: open a file and ask about replacing a review, go back to a kept one,
 * leave a file. Each flow takes the platform, so that a test runs it on `memoryPlatform` and a tab runs it on `browserPlatform`; none of them calls
 * a browser API, and none of them dispatches: they say what to dispatch, and the interface does it.
 */

/** What came of asking to open a file. */
export type OpenOutcome =
  /**
   * Open it: dispatch the action. The file is the one that the page will hold, with the language of its kept review; `null` for a set of files,
   * which the page builds itself. `note` is what to tell the reviewer once it is open, such as which files of a pick were left out.
   */
  | { kind: 'opened'; action: Action; file: SourceFile | null; note?: string }
  /** The file that is open already: nothing changes. */
  | { kind: 'same' }
  /** The reviewer chose to keep what is open. */
  | { kind: 'declined' }
  /** The file cannot be opened, and why. */
  | { kind: 'refused'; error: string }

/** What a flow needs to know of the page: the review that is open, and the comment being written. */
export interface OpenSession {
  review: AnyReview | null
  draft: Draft | null
}

/** Keep the file, so that it can be opened again after a visit, and remember that it is the one that is open. */
export function keepOpen(platform: Platform, file: SourceFile): void {
  platform.reviews.saveSource(file)
  platform.reviews.setLast(file.hash)
}

/** What is open, as far as keeping its review goes: the file (for a set, the one that stands for it), its review, and the files of a set. */
export type KeptOpen = Pick<AppState, 'file' | 'review' | 'set'>

/**
 * Keep the review of what is open, as the page does once it has drawn a change: a review of one file as it is, and a set whole the first time, with its
 * files, and then its review alone. `keptSet` is the hash of the set that is kept whole already, and what comes back is the hash of the one that is kept
 * whole now; with nothing open, nothing is kept and none is.
 */
export function keepReview(platform: Platform, open: KeptOpen, keptSet: string | null): string | null {
  const { file, review, set } = open
  if (!review || !file) return null
  if (review.version === 1) platform.reviews.saveReview(review)
  else if (set) {
    if (keptSet === file.hash) platform.reviews.saveSetReview(review)
    else {
      platform.reviews.saveSet(set.files, review)
      platform.reviews.setLast(file.hash)
      return file.hash
    }
  }
  return keptSet
}

/**
 * Keep the review that a request takes the page away from, before the page adopts what comes next. The page keeps a review once it has drawn a change,
 * and a script can send a change and a `close`, or an `open` of another file, at once: the two are drawn together, after the file is left, and the change
 * would never be kept. `next` is the file that the request leaves open; when it is the one that is open, nothing is left and nothing is kept here.
 * `keptSet` as for `keepReview`.
 */
export function keepBeforeLeaving(platform: Platform, left: KeptOpen, next: SourceFile | null, keptSet: string | null): string | null {
  return next?.hash === left.file?.hash ? keptSet : keepReview(platform, left, keptSet)
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

/** Open the files of a set that was kept, with the review that was kept for them. */
function openSetAction(platform: Platform, set: KeptSet): Action {
  return { type: 'openSet', files: set.files.map((file) => ({ name: file.name, text: file.content })), review: set.review, now: platform.environment.now() }
}

/** What to open at the start, when something was open at the last visit: the file with its review, or the set of files with its review. */
export function restoreLast(platform: Platform): Action | null {
  const last = platform.reviews.last()
  if (last) return { type: 'open', name: last.file.name, text: last.file.content, review: last.review, now: platform.environment.now() }
  const set = platform.reviews.lastSet()
  return set ? openSetAction(platform, set) : null
}

/** What to tell the reviewer of a pick that opens none: the reason, and what was left out. */
function refusal(plan: Extract<SetPlan, { kind: 'refused' }>): string {
  const reason =
    plan.reason === 'nothing'
      ? COPY.setNothing
      : plan.reason === 'folder'
        ? COPY.setFolderNotRead
        : plan.reason === 'too-many'
          ? COPY.setTooMany(plan.count, MAX_SET_FILES)
          : plan.reason === 'too-many-found'
            ? COPY.setTooManyFound(MAX_SCANNED, MAX_SET_FILES)
            : COPY.setTooBigTogether(formatBytes(MAX_SET_BYTES))
  return plan.leftOut.length > 0 ? `${reason} ${COPY.setLeftOut(plan.leftOut, formatBytes(MAX_BYTES))}` : reason
}

/**
 * Open what was picked or dropped when it may be several files or a folder. One file is opened exactly as `openPicked` opens it, with the same
 * words when it is refused. Several are a set when two or more are text: in path order, what is left out is said, and nothing is opened of a pick
 * that is too much, which is not cut to size. The question about replacing a review comes after the read, as for a file.
 */
export async function openPickedMany(platform: Platform, session: OpenSession, picked: Picked): Promise<OpenOutcome> {
  const read = await platform.input.readMany(picked)
  if (read.files.length === 1 && read.unread === 0 && !read.unreadFolders?.length) {
    const only = read.files[0]
    if (only.text === null) return { kind: 'refused', error: only.size > MAX_BYTES ? tooBig(only.name, only.size) : COPY.couldNotRead(only.name) }
    return openText(platform, session, only.name, only.text)
  }
  const plan = planPicked(read)
  if (plan.kind === 'refused') return { kind: 'refused', error: refusal(plan) }
  const note = plan.leftOut.length > 0 ? COPY.setLeftOut(plan.leftOut, formatBytes(MAX_BYTES)) : undefined
  if (plan.kind === 'one') {
    const outcome = openText(platform, session, plan.file.name, plan.file.text)
    return outcome.kind === 'opened' ? { ...outcome, note } : outcome
  }
  // The set stands for its files in the one question and the one comparison that a file would: its name says how many there are, its hash is the set's.
  const incoming = { name: COPY.fileCount(plan.files.length), hash: setHashOf(plan.files.map((f) => buildSource(f.name, f.text))) }
  const ask = planOpen(session.review, session.draft, incoming)
  if (ask.kind === 'ignore') return { kind: 'same' }
  if (ask.kind === 'ask' && !platform.prompts.confirm(ask.message)) return { kind: 'declined' }
  // The same files again bring back the review that was kept for them, as the same file does: the page keeps a set on its own, so nothing is saved here.
  return { kind: 'opened', file: null, note, action: { type: 'openSet', files: plan.files, review: platform.reviews.setReview(incoming.hash), now: platform.environment.now() } }
}

/** Go back to a file or a set of files that was kept; when it is not there any more it is forgotten, and that is said. */
export function openRecent(platform: Platform, hash: string): OpenOutcome | { kind: 'gone' } {
  const set = platform.reviews.savedSet(hash)
  if (set) {
    platform.reviews.setLast(hash)
    return { kind: 'opened', file: null, action: openSetAction(platform, set) }
  }
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

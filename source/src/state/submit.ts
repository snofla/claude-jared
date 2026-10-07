import { COPY } from '../lib/copy'
import { NOBODY_YET_MS, type Delivery } from '../lib/delivery'

/**
 * What the submit dialog remembers, and the rules it follows: what an event does to it, and what is drawn from it. The dialog's markup, its
 * effects (the timers, the modal, the focus) and its calls to the platform and to the caller stay in `SubmitDialog`; it dispatches what
 * happened and reads what to draw, and holds nothing of its own besides the review and the dialog's element.
 */

export type Format = 'md' | 'json'

/** How the review is leaving: handed to a program (a receiver or a script), put on the clipboard for Claude (a link), or only exported. */
export type Way = 'delivered' | 'link' | 'plain'

/** What the delivery answered to a send: taken (and for how long the dialog stays open after that, or `null` for as long as the reviewer wants), or why not. */
export type SendResult = { ok: true; closeAfterMs: number | null } | { ok: false; error: string }

export interface SubmitState {
  /** The format that the reviewer chose; the clipboard link shows JSON whatever it is (`shownFormat`). */
  format: Format
  /** The last thing that happened in the dialog, in words, or `null`: then the line is what the review waits for, or when it was last sent. */
  status: string | null
  /** The last copy or send did not work: the line is the error's, and the other ways to export open by themselves. */
  failed: boolean
  /** The last send failed (a failed copy is not that): the line that points to copying and downloading goes under it. */
  sendFailed: boolean
  sending: boolean
  /** The time of the handover that nobody picked up for `NOBODY_YET_MS`, when there is one. */
  lateFor: number | null
  /** The reviewer opened the group of the other ways to export. */
  userOpen: boolean
  /**
   * The review was taken and nothing was changed: the dialog closes by itself after a moment. Held as the `updatedAt` it began with, so that an
   * edit, which moves it, cancels the moment (`closeAfterMs`).
   */
  closingFor: { updatedAt: string; afterMs: number } | null
}

export const initialSubmitState: SubmitState = {
  format: 'md',
  status: null,
  failed: false,
  sendFailed: false,
  sending: false,
  lateFor: null,
  userOpen: false,
  closingFor: null,
}

export type SubmitEvent =
  | { type: 'formatChosen'; format: Format }
  /** The review was downloaded under this name. */
  | { type: 'downloaded'; name: string }
  /** The review was copied, or the clipboard refused; the words depend on the way and, for a link, on who is to be told. */
  | { type: 'copied'; ok: boolean; way: Way; linkTarget: string | null }
  /** The review is being handed to its delivery: a caller is waited for, a receiver is sent to. */
  | { type: 'sendStarted'; delivery: Delivery | null }
  /** The delivery answered. `updatedAt` is the review's, now: what the automatic close is held against. */
  | { type: 'sendFinished'; result: SendResult; updatedAt: string }
  /** The review has been with a caller, not taken, for too long. */
  | { type: 'lateFired'; waitingSince: number }
  | { type: 'toggled'; open: boolean }
  /** A key or a press inside the dialog: the reviewer is doing something, so it does not close under them. */
  | { type: 'closingCancelled' }

/** The state with these fields changed, or the state itself when none of them is, so that nothing is drawn again for nothing. */
function changed(state: SubmitState, fields: Partial<SubmitState>): SubmitState {
  const keys = Object.keys(fields) as (keyof SubmitState)[]
  return keys.every((key) => Object.is(state[key], fields[key])) ? state : { ...state, ...fields }
}

export function submitReducer(state: SubmitState, event: SubmitEvent): SubmitState {
  switch (event.type) {
    case 'formatChosen':
      return changed(state, { format: event.format })
    case 'downloaded':
      // `failed` stays as it was: a download after a refused copy leaves the line in the error's style, as it always did.
      return changed(state, { status: COPY.downloaded(event.name) })
    case 'copied': {
      const link = event.way === 'link'
      const words = event.ok
        ? link ? COPY.copiedForLink(event.linkTarget) : COPY.copied
        : link ? COPY.clipboardRefusedLink(event.linkTarget) : COPY.clipboardRefused
      return changed(state, { failed: !event.ok, status: words })
    }
    case 'sendStarted':
      return changed(state, {
        sending: true,
        failed: false,
        sendFailed: false,
        status: event.delivery?.kind === 'caller' ? COPY.waiting(event.delivery.target) : COPY.sending,
      })
    case 'sendFinished': {
      const { result, updatedAt } = event
      if (!result.ok) return changed(state, { sending: false, failed: true, sendFailed: true, status: result.error })
      // What the page now knows is in the line of the last delivery, so the status is cleared.
      const closingFor = result.closeAfterMs === null ? null : { updatedAt, afterMs: result.closeAfterMs }
      return changed(state, { sending: false, status: null, closingFor })
    }
    case 'lateFired':
      return changed(state, { lateFor: event.waitingSince })
    case 'toggled':
      return changed(state, { userOpen: event.open })
    case 'closingCancelled':
      return changed(state, { closingFor: null })
  }
}

export const wayOf = (delivery: Delivery | null, forClaude: boolean | undefined): Way => (delivery ? 'delivered' : forClaude ? 'link' : 'plain')

/** For the clipboard link the format is JSON, which is what Claude reads, and the reviewer is not asked to choose. */
export const shownFormat = (way: Way, format: Format): Format => (way === 'link' ? 'json' : format)

export const mimeOf = (format: Format): string => (format === 'md' ? 'text/markdown' : 'application/json')

/** A review waits with a script, or is being sent: its button is marked unavailable, and pressing it again does nothing. */
export const busy = (state: SubmitState, waiting: boolean): boolean => state.sending || waiting

/** The check mark before the status line: only for what worked, and not while something is going on. */
export const showsCheck = (state: SubmitState, waiting: boolean): boolean => !state.failed && !busy(state, waiting)

/** Whether the handover that began at `waitingSince` was not taken in time. */
export const isLate = (state: SubmitState, waitingSince: number | null): boolean => waitingSince !== null && state.lateFor === waitingSince

/** How long to wait, from `now`, before saying that nobody has taken a review handed over at `waitingSince`: what is left of `NOBODY_YET_MS`, none if it is spent. */
export const lateDelayMs = (waitingSince: number, now: number): number => Math.max(0, NOBODY_YET_MS - (now - waitingSince))

/** What the status line says: the last thing that happened here, else that the review waits, else when it was last sent (`last`). */
export const statusLine = (state: SubmitState, waiting: boolean, delivery: Delivery | null, last: string | null): string | null =>
  state.status ?? (waiting ? COPY.waiting(delivery?.target ?? null) : last)

/**
 * Whether the group of the other ways to export is open. They are kept out of the way, and come out by themselves when the delivery has not
 * worked or has not been received; once open, by the reviewer or by the dialog, it stays open: it is not closed again under a reviewer who
 * may be about to press something in it.
 */
export const groupOpen = (state: SubmitState, late: boolean): boolean => state.userOpen || state.failed || late

/** After how long the dialog closes by itself, or `null`: only while the review is as it was when it was taken. */
export const closeAfterMs = (state: SubmitState, updatedAt: string): number | null =>
  state.closingFor !== null && state.closingFor.updatedAt === updatedAt ? state.closingFor.afterMs : null

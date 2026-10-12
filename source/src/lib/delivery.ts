import type { Closes, SubmitOptions } from '../engine/protocol.ts'
import type { Review } from '../types.ts'
import { COPY } from './copy.ts'
import { hasUnsubmittedChanges } from './review.ts'
import { formatTime } from './util.ts'

/**
 * How a review leaves Jared, and what the page says about it. There are three cases, and the wording follows what really happens:
 * with nothing to hand the review to it is exported (copied, downloaded); with a receiver that Jared reaches over a transport
 * (`?host=`) it is sent, and said to be sent once the receiver has answered; with a caller that drives the page by script it is
 * handed to the caller, and said to be waiting until the caller has taken it. The words of the default are Jared's own, so that
 * they can be translated; words that a caller gave are held as they came and are never made into the default.
 */

/** The button, the dialog's title and the header's status when nothing takes the review. */
export const EXPORT_LABEL = COPY.exportLabel
/** The button of a delivery whose sender gave no words. */
export const SUBMIT_LABEL = COPY.submitLabel
/** How long a review may stay with the page, not taken by a caller, before the dialog says that nobody has picked it up: a guess, to be measured. */
export const NOBODY_YET_MS = 90_000

/** How long to wait, from `now`, before saying that nobody has taken a review handed over at `waitingSince`: what is left of `NOBODY_YET_MS`, none if it is spent. */
export const lateDelayMs = (waitingSince: number, now: number): number => Math.max(0, NOBODY_YET_MS - (now - waitingSince))

/** Whether the handover that began at `waitingSince` was not taken in time: `lateFor` is the handover that the timer fired for. */
export const isLateFor = (lateFor: number | null, waitingSince: number | null): boolean => waitingSince !== null && lateFor === waitingSince

/**
 * What the page tells the reviewer to do while a program has been handed the review and has not taken it: the notice of the strip under the
 * header, and of the dialog if it is opened meanwhile. After the late time it adds the way out, and once the reviewer has changed the review since the
 * press (`changedSincePress`) it says that the changes are not in what was handed over, which is the review as it was then, and how to send them. After a
 * review that a call took (`update`), what the reviewer is to tell the program is that changes were sent. `null` when no review waits.
 */
export const waitingWords = (waiting: boolean, late: boolean, target: string | null, changedSincePress = false, update = false): string | null => {
  if (!waiting) return null
  const first = update ? (late ? COPY.updateNobodyYet(target) : COPY.updateNotice(target)) : late ? COPY.nobodyYet(target) : COPY.waitingNotice(target)
  return [first, changedSincePress && COPY.changedAfterPress].filter(Boolean).join(' ')
}

/**
 * How long the dialog says "Sent at ..." after a review was taken, with nothing changed since, before it closes by itself: a
 * guess, to be tried with readers as `NOBODY_YET_MS` is.
 */
export const CLOSE_AFTER_SENT_MS = 1500

export type DeliveryKind = 'receiver' | 'caller'

export interface Delivery {
  kind: DeliveryKind
  /** The words on the button and the dialog's title. */
  label: string
  /** The caller's name for whoever receives the review, or `null`. */
  target: string | null
}

/** The delivery that this page has, or `null`: a receiver (its address) wins over a caller that gave words for the button. */
export function deliveryOf(host: string | null, submitLabel: string | null, submitTarget: string | null): Delivery | null {
  if (host !== null) return { kind: 'receiver', label: submitLabel ?? SUBMIT_LABEL, target: submitTarget }
  if (submitLabel !== null) return { kind: 'caller', label: submitLabel, target: submitTarget }
  return null
}

export const buttonLabel = (delivery: Delivery | null): string => delivery?.label ?? EXPORT_LABEL

/**
 * The words of the button that sends the review. Before the first press, and for a delivery that cannot take changes, they are the program's own;
 * after a press (`changes`, the number of changes since it) they say how many changes the next press will send, or that there are none.
 */
export const sendLabel = (delivery: Delivery | null, changes: number | null): string =>
  changes === null ? buttonLabel(delivery) : changes > 0 ? COPY.sendChanges(changes) : COPY.inStep(delivery?.target ?? null)

/**
 * What the window says of a review that has nothing in it, no comment and no summary: what the program will get, or what the export will hold. A review with
 * only a summary is not empty, and the window says nothing of it. `null` when there is nothing to say.
 */
export const emptyReviewNotice = (comments: number, summary: string, delivery: Delivery | null): string | null =>
  comments > 0 || summary.trim() !== '' ? null : delivery ? COPY.noCommentsSending(delivery.target) : COPY.noCommentsExporting

export type Tone = 'muted' | 'ok' | 'warn'

/**
 * What the header says about the review. `handedOver` is a review that the page has given to a caller that has not taken it:
 * that is not sent yet, and the header does not say it is.
 */
export function statusOf(review: Review, handedOver: boolean, sentAt: string | null): { text: string; tone: Tone } {
  if (handedOver) return { text: COPY.waiting, tone: 'warn' }
  // Sent is said only of a review that reached its delivery; one that was copied or downloaded was exported, even on a page that has a delivery.
  if (sentAt !== null) return review.updatedAt > sentAt ? { text: COPY.editedSinceSent, tone: 'warn' } : { text: COPY.sent(formatTime(sentAt)), tone: 'ok' }
  if (!review.submittedAt) return { text: COPY.draft, tone: 'muted' }
  if (hasUnsubmittedChanges(review)) return { text: COPY.editedSinceExport, tone: 'warn' }
  return { text: COPY.exported(formatTime(review.submittedAt)), tone: 'ok' }
}

/** The dialog's line about the last delivery, or `null` before there was one: the time, and that later changes have not gone. */
export function lastDelivery(review: Review, delivery: Delivery | null, sentAt: string | null): string | null {
  if (!delivery || sentAt === null) return null
  const time = formatTime(sentAt)
  return review.updatedAt > sentAt ? COPY.sentAtChanged(time) : COPY.sentAt(time)
}

/** Whether the review is as it was when the button was pressed, at `pressedAt`: nothing was changed since (`updatedAt` moves with every edit, and sending does not move it). */
export const sentUnchanged = (review: Review, pressedAt: string): boolean => review.updatedAt <= pressedAt

/** Whether a program has taken the review as it is: it was sent, at `sentAt`, and nothing has changed since. The review has then been delivered, and the dialog does not offer to give it up. */
export const takenAsItIs = (review: Review, sentAt: string | null): boolean => sentAt !== null && sentUnchanged(review, sentAt)

/**
 * Whom giving the review up tells: the program that started the review, as long as it has not taken the review as it is. The answer is the name
 * that the program gave for whoever receives the review, `null` when it gave none, and `undefined` when nobody is told: no program started the
 * review, or the one that did has the review as it is and waits for nothing.
 */
export const toldOfCancel = (delivery: Delivery | null, review: Review, sentAt: string | null): string | null | undefined =>
  delivery === null || takenAsItIs(review, sentAt) ? undefined : delivery.target

/**
 * Whether a program waits for the review: it started the review and has taken nothing yet (`sentAt` is `null`). Skip review is offered then, and Back
 * to start asks first, because the program would otherwise go on waiting for a review that the reviewer has left. After a take, edited since or not, the
 * program's turn has ended and it looks again only when the reviewer says that they sent changes, so it is not waiting: nothing is offered and Back to
 * start goes back at once (the review is kept in any case).
 */
export const programWaits = (delivery: Delivery | null, sentAt: string | null): boolean => delivery !== null && sentAt === null

/**
 * Whether the reviewer has to tell the program that they left the review, by skipping it or by discarding it: a script that drives the page looks at the
 * page only when it is asked, so the start page says what to tell it; a receiver is told at once. It is one rule for both exits, so that when the page can
 * wake the program by itself (a file that a waiting command watches), it is changed here and both banners go.
 */
export const mustTellProgram = (delivery: Delivery | null): boolean => delivery?.kind === 'caller'

/**
 * What a caller said about what happens once its delivery has taken the review, with the defaults filled in: when the dialog closes
 * by itself, the words of the message that tells the reviewer (`null`: Jared's own), and whether the message is drawn as a banner. This is the one
 * place where the defaults are.
 */
export interface AfterSentSettings {
  closes: Closes
  message: string | null
  banner: boolean
}

export function afterSentSettings(options: SubmitOptions | null | undefined): AfterSentSettings {
  return { closes: options?.closes ?? 'moment', message: options?.message ?? null, banner: options?.banner ?? true }
}

/** How long the dialog says "Sent at ..." before it closes by itself: `CLOSE_AFTER_SENT_MS` after a moment, none after `now`, and `null` for never. */
export function closeDelayMs(closes: Closes): number | null {
  return closes === 'never' ? null : closes === 'now' ? 0 : CLOSE_AFTER_SENT_MS
}

/**
 * Whether the dialog closes at the press and leaves the rest to the page. A review that a program has to take (a caller that drives the page)
 * can wait a long time, and the reviewer goes on working meanwhile, so the dialog does not wait with it: the strip under the header says what
 * to do, and the message or the banner of a failure comes as they do for a dialog that the reviewer closed. A receiver answers within a moment,
 * so the dialog waits for it and says "Sent at ..." as before. A caller that set `closes` to `never` wants the dialog kept, and has it.
 */
export const closesAtPress = (delivery: Delivery | null, closes: Closes): boolean => delivery?.kind === 'caller' && closes !== 'never'

/** The message that tells the reviewer that a review was sent: the caller's words, as given, or Jared's own for whoever receives it. */
export const sentMessage = (target: string | null, settings: AfterSentSettings, viaService = false): string =>
  settings.message ?? (viaService ? COPY.reviewSentToService(target) : COPY.reviewSent(target))

/**
 * What happens when a delivery has been taken (a receiver answered, or a script took the review). `closes`: the dialog is open and nothing
 * changed since the press, so it says "Sent at ..." for `CLOSE_AFTER_SENT_MS`, closes by itself, and the page tells the reviewer in a message after
 * it has closed. `stays`: the dialog is open and the reviewer changed something, so it stays, and its line says that the changes have not been sent.
 * `tells`: the dialog is not open (the reviewer closed it while it was sent, or the script took the review later), so the message comes at once.
 * A caller that set `closes` to `never` keeps the dialog open: it `stays`, and its own line is the confirmation.
 */
export type AfterSent = 'closes' | 'stays' | 'tells'

export function afterSent({ dialogOpen, unchanged, closes = 'moment' }: { dialogOpen: boolean; unchanged: boolean; closes?: Closes }): AfterSent {
  if (!dialogOpen) return 'tells'
  return unchanged && closes !== 'never' ? 'closes' : 'stays'
}

/**
 * The dialog's line under the preview: where the review will go, and, once it has been taken with nothing changed since, where it went. After
 * a change it is the future again, which is true of the changed review, and the footer says that the changes have not been sent.
 */
export function destinationLine(delivery: Delivery, address: string | null, review: Review, sentAt: string | null): string {
  return sentAt !== null && review.updatedAt <= sentAt ? COPY.wasSentTo(delivery.target) : COPY.willBeSentTo(delivery.target, address)
}

/**
 * Whether a send that failed is told in the red banner: when nobody is looking at the dialog that would say it, and not when the reviewer gave the
 * review up, because they know that it was not sent, and the banner would say that a different file was opened.
 */
export const failureIsTold = (dialogOpen: boolean, givenUp: boolean): boolean => !dialogOpen && !givenUp

/** Whether pressing the button again can mend a failed send: not when a different file was opened, or when there is no review. */
export const canTryAgain = (error: string): boolean => error !== COPY.fileChanged && error !== COPY.nothingToSend

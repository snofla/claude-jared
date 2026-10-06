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

export type Tone = 'muted' | 'ok' | 'warn'

/**
 * What the header says about the review. `handedOver` is a review that the page has given to a caller that has not taken it:
 * that is not sent yet, and the header does not say it is.
 */
export function statusOf(review: Review, delivery: Delivery | null, handedOver: boolean, sentAt: string | null): { text: string; tone: Tone } {
  if (handedOver) return { text: COPY.waiting(delivery?.target ?? null), tone: 'warn' }
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

/** The message that tells the reviewer that a review was sent: the caller's words, as given, or Jared's own for whoever receives it. */
export const sentMessage = (target: string | null, settings: AfterSentSettings): string => settings.message ?? COPY.reviewSent(target)

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

/** Whether pressing the button again can mend a failed send: not when a different file was opened, or when there is no review. */
export const canTryAgain = (error: string): boolean => error !== COPY.fileChanged && error !== COPY.nothingToSend

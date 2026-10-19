import { changeCount, deltaSince, marksOf, noteOf, type Mark, type Snapshot } from '../lib/changes'
import { PROTOCOL_VERSION, type ReviewChanges, type SubmittedEvent } from '../engine/protocol'
import type { AnyReview } from '../types'

/**
 * What the page remembers of handing a review over, and what it draws from that: the review handed to a script that has not taken it yet, the last
 * press of a delivery that takes changes, and what a program took last. The calls, the counters, the timers and the messages stay in `useHandover`; it
 * dispatches what happened and reads what to draw.
 */

/** A press of a delivery that takes changes: for which file (by its hash), its number, and the review as it was then. */
export interface Press {
  hash: string
  revision: number
  snapshot: Snapshot
}

/** What a program took last: its number, and the review as it was then. The note that goes with the next press is against it. */
export interface Taken {
  revision: number
  snapshot: Snapshot
}

export interface HandoverState {
  /** When, and for which file (by its hash), the reviewer handed a review over to a script that has not taken it yet. */
  handed: { at: number; hash: string } | null
  /** What the last press of a delivery that takes changes carried: the page tells the reviewer what the next press will send. */
  pressed: Press | null
  /** What a call took last (a press that was replaced was never taken). */
  taken: Taken | null
}

export const initialHandover: HandoverState = { handed: null, pressed: null, taken: null }

export type HandoverAction =
  /** The service answered for a press: it is the press that counts, and the one that was taken. */
  | { type: 'answered'; hash: string; revision: number; snapshot: Snapshot }
  /** A press handed the review to the script on the page, which has not taken it yet. */
  | { type: 'handed'; hash: string; revision: number; snapshot: Snapshot; at: number }
  /** The script took the review that a press handed over, or the page dropped it: the page waits no more. */
  | { type: 'settled'; taken: boolean; revision: number; snapshot: Snapshot }
  /** The file that the presses were for is closed, or another is opened. */
  | { type: 'forget' }

export function handoverReducer(state: HandoverState, action: HandoverAction): HandoverState {
  switch (action.type) {
    case 'answered': {
      const { hash, revision, snapshot } = action
      return { ...state, pressed: { hash, revision, snapshot }, taken: { revision, snapshot } }
    }
    case 'handed': {
      const { hash, revision, snapshot, at } = action
      return { ...state, pressed: { hash, revision, snapshot }, handed: { at, hash } }
    }
    case 'settled':
      return { ...state, handed: null, taken: action.taken ? { revision: action.revision, snapshot: action.snapshot } : state.taken }
    case 'forget':
      return { ...state, pressed: null, taken: null }
  }
}

/** What differs from the review that a program took last, numbered by that review's press, to go with the next one. */
export const changesNote = (taken: Taken | null, review: AnyReview): ReviewChanges => noteOf(taken?.revision ?? 0, deltaSince(taken?.snapshot ?? null, review))

/** The event that hands a review to the script on the page: the review as it is at the press, marked as submitted then. */
export const submittedEvent = (seq: number, revision: number, review: AnyReview, now: string, changes: ReviewChanges): SubmittedEvent => ({
  protocol: PROTOCOL_VERSION,
  type: 'submitted',
  seq,
  revision,
  review: { ...review, submittedAt: now },
  changes,
})

const NO_MARKS: ReadonlyMap<string, Mark> = new Map() // the same map each time, so that what draws it is not drawn again

/** What the page draws from the handing over, for the file that is open. */
export interface Pending {
  /** Since when the page has waited for a script to take the review of this file, or `null`. */
  waitingSince: number | null
  /** How many changes the button will send after a first press, or `null` when it opens the dialog. */
  changes: number | null
  /** The comments that changed since the press, for the panel. */
  marks: ReadonlyMap<string, Mark>
  /** The page waits for the script, and the reviewer changed something since the press. */
  changedSincePress: boolean
  /** A program took a review before: the next one is an update. */
  update: boolean
}

/**
 * After a first press of a delivery that takes changes (`takesChanges`: a script on the page, or the service), the button sends the later state: how many
 * changes it will send, which comments they are, and what a script that took a review before is to be told. A page that has the service's address and a
 * receiver's too sends to the receiver, which records no press: `pressed` stays null.
 */
export function pendingOf(state: HandoverState, { fileHash, review, takesChanges }: { fileHash: string | undefined; review: AnyReview | null; takesChanges: boolean }): Pending {
  const { handed, pressed, taken } = state
  const waitingSince = handed !== null && handed.hash === fileHash ? handed.at : null
  const updates = takesChanges && pressed !== null && pressed.hash === fileHash && review !== null
  const delta = updates && review ? deltaSince(pressed.snapshot, review) : null
  const changes = delta ? changeCount(delta) : null
  const marks = delta ? marksOf(delta) : NO_MARKS
  const changedSincePress = waitingSince !== null && changes !== null && changes > 0
  return { waitingSince, changes, marks, changedSincePress, update: taken !== null }
}

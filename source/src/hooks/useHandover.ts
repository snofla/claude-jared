import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { createOutbox } from '../engine/outbox'
import { eventRules } from '../engine/page-host'
import { endsReview, PROTOCOL_VERSION, type Event } from '../engine/protocol'
import { sendCancelled, sendReview, sendSkipped, sendToService } from '../engine/receiver-client'
import { COPY } from '../lib/copy'
import { snapshotOf } from '../lib/changes'
import { afterSent, afterSentSettings, canTryAgain, closeDelayMs, failureIsTold, sentMessage, sentUnchanged, type Delivery } from '../lib/delivery'
import type { Platform } from '../lib/platform'
import { changesNote, handoverReducer, initialHandover, pendingOf, submittedEvent } from '../state/handover'
import type { Action, AppState } from '../state/reducer'
import { useLate } from './useLate'
import { useLatest } from './useTokens'

/** A banner of the page: an error, or a warning. */
export interface Notice {
  kind: 'error' | 'warn'
  text: string
}

/** Where a review goes besides a script on the page, as the page found it when it loaded. */
export interface Addresses {
  /** The receiver of the link (`?host=`), or `null`. */
  host: string | null
  /** The review's folder at the Jared service that served the page, or `null`. */
  service: string | null
  /** The receiver of the link, or the service that served the page: either answers. */
  sendTo: string | null
  /** The review goes to the service, which keeps it as a file. */
  viaService: boolean
}

interface Options {
  services: Platform
  state: AppState
  stateRef: RefObject<AppState>
  dispatch: Dispatch<Action>
  addresses: Addresses
  delivery: Delivery | null
  submitOpen: boolean
  setSubmitOpen: (open: boolean) => void
  setNotice: Dispatch<SetStateAction<Notice | null>>
}

/**
 * The handing over of a review: to the receiver of the link, to the service that served the page, or to the script that drives the page, with the
 * presses, the messages and the banners that go with it. What it remembers and what is drawn from it are `state/handover`; this holds it with the
 * counters, the timers, the outbox and the calls, and gives the page what to draw and what to do.
 */
export function useHandover({ services, state, stateRef, dispatch, addresses, delivery, submitOpen, setSubmitOpen, setNotice }: Options) {
  const { host, service, sendTo, viaService } = addresses
  // Reviews that the reviewer has handed over to a script that drives the page, and that it has not taken yet.
  const outbox = useMemo(() => createOutbox<Event>(eventRules), [])
  // What the page has told its peer, of every kind, counted from 1.
  const events = useRef(0)
  // The presses of the review button for the file that is open, counted from 1; a file that is opened starts again.
  const revisions = useRef(0)
  // What was handed over, what the last press of a delivery that takes changes carried, and what a call took last: the page tells the reviewer what the
  // next press will send, and the note that goes with a review is against what was taken.
  const [handover, dispatchHandover] = useReducer(handoverReducer, initialHandover)
  const handoverRef = useLatest(handover)
  // The message that says a review was sent, for when the dialog was not there to say it, and whether it is to be told once the dialog has closed.
  const [sentText, setSentText] = useState<string | null>(null)
  const tellOnClose = useRef(false)
  // The red banner of a send that failed after its dialog was closed: the next send takes it away, so that it is never beside the message that says it was sent.
  const failedSend = useRef<Notice | null>(null)
  // The reviewer stopped the review, and kept it or discarded it: the send that was waiting is dropped with it, and that is not told as a failure.
  const givenUp = useRef(false)
  // The warning that a script's request was declined. Discarding the review takes it away with the review that it says was kept.
  const declinedNote = useRef<Notice | null>(null)
  const sentTimer = useRef(0)
  const submitOpenRef = useLatest(submitOpen)
  const sentTextRef = useLatest(sentText)
  // A message that replaces one is emptied before it is set, so that a second one with the same words is read again. One that comes when there
  // is none is set at once: the strip under the header gives way to it in the same render, and the code under them does not move twice. The
  // message goes when another file is opened or the file is closed, and when the next send begins.
  const tellSent = useCallback(
    (text: string) => {
      window.clearTimeout(sentTimer.current)
      if (sentTextRef.current === null) return setSentText(text)
      setSentText(null)
      sentTimer.current = window.setTimeout(() => setSentText(text), 100)
    },
    [sentTextRef],
  )
  // The page forgets what was pressed and taken when the file that it was for is closed or another is opened.
  const forgetPresses = useCallback(() => dispatchHandover({ type: 'forget' }), [])
  const clearSent = useCallback(() => {
    window.clearTimeout(sentTimer.current)
    setSentText(null)
    tellOnClose.current = false
  }, [])
  useEffect(() => {
    // The dialog closed by itself: what is outside a modal dialog is not heard while it is open, so the message waits until it has gone.
    if (submitOpen || !tellOnClose.current) return
    tellOnClose.current = false
    tellSent(sentMessage(state.submitTarget, afterSentSettings(state.submitOptions), viaService))
  }, [submitOpen, tellSent, state.submitTarget, state.submitOptions, viaService])

  // Hand the review over: to the receiver, which answers, or to the script that drives the page, which asks for it. Either marks the
  // review sent once it has happened, so the status never says more than the page has seen. What follows depends on whether the dialog is
  // still open and on whether the reviewer changed anything since the press (`afterSent`): a failure that nobody is looking at is told in the banner.
  const deliver = useCallback(async (): Promise<{ ok: true; closeAfterMs: number | null } | { ok: false; error: string }> => {
    const current = stateRef.current.review
    if (!current) return { ok: false, error: COPY.nothingToSend }
    clearSent()
    givenUp.current = false
    const stale = failedSend.current
    failedSend.current = null
    if (stale) setNotice((shown) => (shown === stale ? null : shown))
    const now = services.environment.now()
    const hash = stateRef.current.file?.hash ?? ''
    let outcome: { ok: true } | { ok: false; error: string }
    if (host) {
      outcome = await sendReview(host, current, now, { target: stateRef.current.submitTarget })
    } else if (service) {
      // Each press is a later state of the review, whole, with what differs from the last one that the service answered for. The service numbers
      // it and says so in its reply (the page counts from 1 on every load, and the service refuses a number below the file's), and a press that it
      // answered for is the one that counts as taken: the next note is against that number.
      const sent = snapshotOf(current)
      const changes = changesNote(handoverRef.current.taken, current)
      const answer = await sendToService(service, current, now, { changes, target: stateRef.current.submitTarget })
      outcome = answer
      if (answer.ok) dispatchHandover({ type: 'answered', hash, revision: answer.revision, snapshot: sent })
    } else {
      const revision = ++revisions.current
      const sent = snapshotOf(current)
      const changes = changesNote(handoverRef.current.taken, current)
      const event = submittedEvent(++events.current, revision, current, now, changes)
      dispatchHandover({ type: 'handed', hash, revision, snapshot: sent, at: Date.now() })
      const result = await outbox.post(event)
      // A later press took this one's place before any call took it: that press carries the review, and it has the state of the hand-over.
      if (result === 'replaced') return { ok: true, closeAfterMs: null }
      dispatchHandover({ type: 'settled', taken: result === 'taken', revision, snapshot: sent })
      outcome = result === 'taken' ? { ok: true } : { ok: false, error: COPY.fileChanged }
    }
    if (!outcome.ok) {
      const told = failureIsTold(submitOpenRef.current, givenUp.current)
      givenUp.current = false
      if (told) {
        failedSend.current = { kind: 'error', text: COPY.notSent(outcome.error, canTryAgain(outcome.error)) }
        setNotice(failedSend.current)
      }
      return outcome
    }
    dispatch({ type: 'markSent', now, hash })
    // Edits made while the review was on its way have moved `updatedAt` past the time of the press; the state read here is from before `markSent`, which does not move it.
    const latest = stateRef.current.review
    const unchanged = !!latest && stateRef.current.file?.hash === hash && sentUnchanged(latest, now)
    const settings = afterSentSettings(stateRef.current.submitOptions)
    const next = afterSent({ dialogOpen: submitOpenRef.current, unchanged, closes: settings.closes })
    if (next === 'tells') tellSent(sentMessage(stateRef.current.submitTarget, settings, viaService))
    return { ok: true, closeAfterMs: next === 'closes' ? closeDelayMs(settings.closes) : null }
  }, [host, service, viaService, outbox, stateRef, services, submitOpenRef, clearSent, tellSent, handoverRef, dispatch, setNotice])
  // A review handed over for a file that is no longer open is of no use to whoever asks next, and is not waited for: whichever way the
  // file was replaced (the reviewer's, a script's, a link's). A cancel or a skip is the one thing that stays when the page is left with no file open:
  // it is about the file that was just left, and it is for the script that is waiting or asks next. Opening a file drops it.
  const fileHash = state.file?.hash
  useEffect(() => {
    outbox.clear(fileHash === undefined ? endsReview : undefined)
    revisions.current = 0
  }, [fileHash, outbox])
  const pending = pendingOf(handover, { fileHash, review: state.review, takesChanges: delivery?.kind === 'caller' || service !== null })
  const late = useLate(pending.waitingSince)
  const nothingNew = () => tellSent(COPY.nothingNew(delivery?.target ?? null))
  // The button: the dialog for a first press, and the changes at once after it, or a word that there is nothing new.
  const press = () => {
    if (pending.changes === null) return setSubmitOpen(true)
    if (pending.changes === 0) return nothingNew()
    void deliver()
  }

  // Tell the program that started the review that the reviewer gave it up, so that it stops waiting: the receiver, at the address that the
  // page was given, or the script that drives the page, through the outbox. The page does not wait for an answer, and tries once.
  const tellOfCancel = () => {
    const seq = ++events.current
    if (sendTo) void sendCancelled(sendTo, seq, { target: state.submitTarget })
    else void outbox.post({ protocol: PROTOCOL_VERSION, type: 'cancelled', seq })
  }

  // Tell the program that started the review that the reviewer chose not to review the file now, as tellOfCancel tells it that the review was given up.
  const tellOfSkip = () => {
    const seq = ++events.current
    if (sendTo) void sendSkipped(sendTo, seq, { target: state.submitTarget })
    else void outbox.post({ protocol: PROTOCOL_VERSION, type: 'skipped', seq })
  }

  // The reviewer gave the review up or skipped it: a send that was waiting is dropped with it, and that is not told as a failure.
  const giveUp = () => {
    givenUp.current = true
  }
  // A script's request was declined: the warning says that the review was kept.
  const onDeclined = useCallback(
    (text: string) => {
      declinedNote.current = { kind: 'warn', text }
      setNotice(declinedNote.current)
    },
    [setNotice],
  )
  // Discarding the review takes the warning that a request was declined away with the review that it says was kept.
  const dropDeclined = () => {
    const stale = declinedNote.current
    declinedNote.current = null
    if (stale) setNotice((shown) => (shown === stale ? null : shown))
  }

  return {
    outbox,
    deliver,
    press,
    nothingNew,
    sentText,
    clearSent,
    forgetPresses,
    onSentClosed: () => (tellOnClose.current = true),
    tellOfCancel,
    tellOfSkip,
    giveUp,
    onDeclined,
    dropDeclined,
    late,
    ...pending,
  }
}

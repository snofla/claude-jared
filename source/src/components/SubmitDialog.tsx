import { useEffect, useReducer, useRef } from 'react'
import { usePlatform } from '../hooks/usePlatform'
import { useLatest } from '../hooks/useTokens'
import { COPY } from '../lib/copy'
import { buttonLabel, destinationLine, emptyReviewNotice, lastDelivery, sendLabel, takenAsItIs, waitingWords, type Delivery } from '../lib/delivery'
import { reviewFileName, toJson, toMarkdown } from '../lib/export'
import {
  busy,
  canCancel,
  closeAfterMs,
  groupOpen,
  initialSubmitState,
  mimeOf,
  shownFormat,
  showsCheck,
  statusLine,
  submitReducer,
  wayOf,
  type Format,
  type SendResult,
} from '../state/submit'
import type { Review } from '../types'
import { Button, Dialog, DialogFoot, Disclosure, IconCheck, IconCopy, IconDownload, IconSend, LiveStatus, Notice, SegmentedControl, TextField, type SegmentedOption } from '../ui'

interface Props {
  review: Review
  onSummary: (summary: string) => void
  /** Called once the review has actually left the app by being copied or downloaded: a delivery is marked by whoever runs it. */
  onSubmitted: () => void
  /**
   * What takes the review, when something does: a receiver that Jared reaches over a transport, or a script that drives the page.
   * The delivery is the one main button, and wears the words that its program gave; copying and downloading go into a group under it.
   */
  delivery: Delivery | null
  /** For a receiver: where it listens, to say so. */
  to?: string
  /**
   * Hand the review to the delivery, and resolve once it has been taken (a receiver answered, or the script asked for it). `closeAfterMs` is
   * how long the dialog is to wait before it closes by itself (`afterSent` and the caller's `closes`), or `null` when it is to stay open.
   */
  deliver?: () => Promise<SendResult>
  /** When the review was given to a script that has not taken it yet, as a time; else `null`. */
  waitingSince: number | null
  /** That review has been with the script, not taken, for too long (`useLate`, which the strip under the header reads too). */
  late: boolean
  /** The reviewer has changed the review since the press: what the script will take is the review as it was then. */
  changedSincePress: boolean
  /** How many changes the next press will send, once there was a press of a delivery that takes changes: then the button sends the later state, even while the earlier one waits. `null` before that. */
  changes: number | null
  /** A call has taken a review of this file before: what the reviewer is to tell the program is that changes were sent. */
  update: boolean
  /** The reviewer pressed the button with nothing new to send: the page says so. */
  onNothingNew: () => void
  /**
   * The dialog closes at the press, and the page tells the rest: a script can take long to take the review, and the reviewer goes on working
   * meanwhile (`closesAtPress`). Then the dialog does not wait for `deliver`.
   */
  closesAtPress: boolean
  /** When the review was last sent to its delivery, or `null`. */
  sentAt: string | null
  /** Set when Jared was opened by a link that carries requests: the review goes to the clipboard, as JSON, for Claude to read. A delivery wins over it. */
  forClaude?: boolean
  /** The name the link gave for whoever is to be told, when the review goes to the clipboard, or `null`. */
  linkTarget: string | null
  /** Every way that the dialog closes: Esc, the ×, the backdrop and the moment after a send. It runs once, from the dialog's own `close` event. */
  onClose: () => void
  /** The dialog closed by itself, because the review was taken and nothing was changed: the page tells the reviewer, once the dialog is gone. */
  onSentClosed: () => void
  /** Called when the reviewer presses Discard review in the foot. The question comes over the dialog, and the dialog is still there when the reviewer keeps the review. */
  onCancel: () => void
  /** Called when the reviewer presses Skip review in the foot, which is offered only while a program waits for the review: the review is kept. `null` when it is not offered. */
  onSkip: (() => void) | null
}

const FORMATS: readonly SegmentedOption<Format>[] = [
  { value: 'md', label: 'Markdown' },
  { value: 'json', label: 'JSON' },
]

export function SubmitDialog({ review, onSummary, onSubmitted, delivery, to, deliver, waitingSince, late, changedSincePress, changes, update, onNothingNew, closesAtPress, sentAt, forClaude, linkTarget, onClose, onSentClosed, onCancel, onSkip }: Props) {
  const { submit } = usePlatform()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [state, dispatch] = useReducer(submitReducer, initialSubmitState)
  const closeAfter = closeAfterMs(state, review.updatedAt)
  const reviewRef = useLatest(review)
  const onSentClosedRef = useLatest(onSentClosed)

  useEffect(() => {
    if (closeAfter === null) return
    const timer = setTimeout(() => {
      dialogRef.current?.close() // through the dialog's own close(), as every way out goes: its `close` event runs `onClose` once
      onSentClosedRef.current()
    }, closeAfter)
    return () => clearTimeout(timer)
  }, [closeAfter, onSentClosedRef])

  const way = wayOf(delivery, forClaude)
  const shown = shownFormat(way, state.format)
  const text = shown === 'md' ? toMarkdown(review) : toJson(review)
  const count = review.comments.length
  const empty = emptyReviewNotice(count, review.summary, delivery)
  const label = buttonLabel(delivery)
  const waiting = waitingSince !== null
  const taken = takenAsItIs(review, sentAt)
  const last = lastDelivery(review, delivery, sentAt)
  const line = statusLine(state, waiting, last)
  // A later press replaces a review that waits, so the button is not unavailable for that: only a send that is on its way (to a receiver) holds it.
  const unavailable = busy(state, waiting && changes === null)
  const sendWords = sendLabel(delivery, changes)
  // Download, in a link's dialog, is in the group of the other ways to export too, so a clipboard that is refused opens it.
  const groupIsOpen = groupOpen(state, late)

  const download = () => {
    const name = reviewFileName(review, shown)
    submit.download(name, text, mimeOf(shown))
    dispatch({ type: 'downloaded', name })
    onSubmitted()
  }

  const copy = async () => {
    const ok = await submit.copy(text)
    dispatch({ type: 'copied', ok, way, linkTarget })
    if (ok) onSubmitted()
  }

  const run = async () => {
    if (!deliver || unavailable) return // the button is only marked unavailable, so that the focus stays on it
    if (changes === 0) {
      dialogRef.current?.close()
      onNothingNew()
      return
    }
    if (closesAtPress) {
      // The page takes it from here: the strip under the header says what to do, and the message or the banner of a failure comes as it does for a dialog that was closed.
      void deliver()
      dialogRef.current?.close() // through the dialog's own close(), as every way out goes: its `close` event runs `onClose` once
      return
    }
    dispatch({ type: 'sendStarted', delivery })
    const result = await deliver()
    dispatch({ type: 'sendFinished', result, updatedAt: reviewRef.current.updatedAt })
  }

  const copyButton = (primary: boolean) => (
    <Button variant={primary ? 'primary' : 'default'} icon={<IconCopy />} onClick={() => void copy()}>
      Copy
    </Button>
  )
  const downloadButton = (primary: boolean) => (
    <Button variant={primary ? 'primary' : 'default'} icon={<IconDownload />} onClick={download}>
      Download
    </Button>
  )
  const formatControl = (
    <SegmentedControl label="Format" options={FORMATS} value={state.format} onChange={(format) => dispatch({ type: 'formatChosen', format })} />
  )

  return (
    <Dialog
      ref={dialogRef}
      title={label}
      subtitle={
        <>
          <code>{review.file.name}</code> · {COPY.commentCount(count)}
        </>
      }
      closeLabel={COPY.close}
      closeTitle={COPY.closeTitle(COPY.keyEscape)}
      onClose={onClose}
      onKeyDownCapture={() => dispatch({ type: 'closingCancelled' })}
      onPointerDownCapture={() => dispatch({ type: 'closingCancelled' })}
    >
      {empty && <Notice tone="info">{empty}</Notice>}

      <TextField
        className="summary-field"
        labelStyle="plain"
        label="Overall summary"
        hint="optional"
        rows={3}
        placeholder="Anything that doesn't belong to a specific line: overall impression, blockers, praise…"
        value={review.summary}
        onChange={(e) => onSummary(e.target.value)}
      />

      <div className="dialog-label">
        Preview
        {way === 'plain' && formatControl}
      </div>
      <pre className="preview" tabIndex={0} aria-label={`Preview of the review, as ${shown === 'md' ? 'Markdown' : 'JSON'}`}>
        {text}
      </pre>

      <div className="dialog-notes">
        <p className="muted dialog-dest">
          {way === 'delivered' ? destinationLine(delivery!, to ?? null, review, sentAt) : way === 'link' ? COPY.lineLink(linkTarget) : COPY.lineExport}
        </p>
        <LiveStatus>
          {waiting && <Notice tone="warn">{waitingWords(waiting, late, delivery?.target ?? null, changedSincePress, update)}</Notice>}
        </LiveStatus>
      </div>

      <DialogFoot>
        {canCancel(state, waiting, taken) && (
          <>
            {onSkip && (
              <Button variant="ghost" onClick={onSkip}>
                {COPY.skipReview}
              </Button>
            )}
            <Button variant="ghost" onClick={onCancel}>
              {COPY.discardReview}
            </Button>
          </>
        )}
        <span className={state.failed ? 'status status-error dialog-status' : 'status muted dialog-status'} role="status" aria-live="polite">
          {line && (
            <>
              {showsCheck(state, waiting) && <IconCheck />} {line}
            </>
          )}
        </span>
        <span className="dialog-actions">
          {way === 'delivered' ? (
            <Button variant={changes === 0 ? 'default' : 'primary'} icon={<IconSend />} busy={unavailable} onClick={() => void run()} title={sendWords} aria-label={sendWords}>
              <span className="submit-label">{sendWords}</span>
            </Button>
          ) : way === 'link' ? (
            copyButton(true)
          ) : (
            <>
              {downloadButton(true)}
              {copyButton(false)}
            </>
          )}
        </span>
      </DialogFoot>

      {state.sendFailed && <p className="muted dialog-dest">{COPY.copyInstead}</p>}

      {way !== 'plain' && (
        <Disclosure summary={COPY.otherWaysToExport} open={groupIsOpen} onToggle={(open) => dispatch({ type: 'toggled', open })}>
          {way === 'delivered' && formatControl}
          <span className="dialog-actions dialog-actions-start">
            {way === 'delivered' && copyButton(false)}
            {downloadButton(false)}
          </span>
        </Disclosure>
      )}
    </Dialog>
  )
}

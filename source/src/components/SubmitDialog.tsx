import { useEffect, useRef, useState } from 'react'
import { usePlatform } from '../hooks/usePlatform'
import { useLatest } from '../hooks/useTokens'
import { COPY } from '../lib/copy'
import { buttonLabel, destinationLine, lastDelivery, NOBODY_YET_MS, type Delivery } from '../lib/delivery'
import { reviewFileName, toJson, toMarkdown } from '../lib/export'
import type { Review } from '../types'
import { IconCheck, IconCopy, IconDownload, IconSend, IconX } from './icons'

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
  deliver?: () => Promise<{ ok: true; closeAfterMs: number | null } | { ok: false; error: string }>
  /** When the review was given to a script that has not taken it yet, as a time; else `null`. */
  waitingSince: number | null
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
}

type Format = 'md' | 'json'

/** How the review is leaving: handed to a program (a receiver or a script), put on the clipboard for Claude (a link), or only exported. */
type Way = 'delivered' | 'link' | 'plain'

function FormatControl({ format, onChange }: { format: Format; onChange: (format: Format) => void }) {
  return (
    <div className="seg" role="radiogroup" aria-label="Format">
      {(['md', 'json'] as const).map((f) => (
        <label key={f} className={format === f ? 'seg-btn is-on' : 'seg-btn'}>
          <input type="radio" name="format" className="sr-only" value={f} checked={format === f} onChange={() => onChange(f)} />
          {f === 'md' ? 'Markdown' : 'JSON'}
        </label>
      ))}
    </div>
  )
}

export function SubmitDialog({ review, onSummary, onSubmitted, delivery, to, deliver, waitingSince, sentAt, forClaude, linkTarget, onClose, onSentClosed }: Props) {
  const { submit } = usePlatform()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [format, setFormat] = useState<Format>('md')
  const [status, setStatus] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  // The last send failed (a failed copy is not that): the line that points to copying and downloading is under it.
  const [sendFailed, setSendFailed] = useState(false)
  const [sending, setSending] = useState(false)
  // The time of the handover that nobody has picked up for `NOBODY_YET_MS`, when there is one.
  const [lateFor, setLateFor] = useState<number | null>(null)
  const [userOpen, setUserOpen] = useState(false)
  // The review was taken and nothing was changed: the dialog closes by itself after a moment. Held as the `updatedAt` it began with, so that
  // an edit, which moves it, cancels the moment; a key or a press inside the dialog cancels it too.
  const [closingFor, setClosingFor] = useState<{ updatedAt: string; afterMs: number } | null>(null)
  const closeAfterMs = closingFor !== null && closingFor.updatedAt === review.updatedAt ? closingFor.afterMs : null
  const reviewRef = useLatest(review)
  const onSentClosedRef = useLatest(onSentClosed)

  // Every way out goes through the dialog's own close(): its `close` event then runs `onClose` once, and the browser puts the focus back on
  // the button that opened it (a dialog that is only unmounted leaves the focus on the page's body).
  const close = () => dialogRef.current?.close()

  useEffect(() => {
    if (closeAfterMs === null) return
    const timer = setTimeout(() => {
      dialogRef.current?.close()
      onSentClosedRef.current()
    }, closeAfterMs)
    return () => clearTimeout(timer)
  }, [closeAfterMs, onSentClosedRef])

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    // showModal() puts the focus in the first field; on a phone that raises the keyboard over a dialog that has not been read.
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  // A review that a script has not taken after a while may be one that nobody is asking for: say so, so that the reviewer is never stuck.
  useEffect(() => {
    if (waitingSince === null) return
    const timer = setTimeout(() => setLateFor(waitingSince), Math.max(0, NOBODY_YET_MS - (Date.now() - waitingSince)))
    return () => clearTimeout(timer)
  }, [waitingSince])
  const late = waitingSince !== null && lateFor === waitingSince

  const way: Way = delivery ? 'delivered' : forClaude ? 'link' : 'plain'
  // For the clipboard link the format is JSON, which is what Claude reads, and the reviewer is not asked to choose.
  const shown: Format = way === 'link' ? 'json' : format
  const text = shown === 'md' ? toMarkdown(review) : toJson(review)
  const count = review.comments.length
  const label = buttonLabel(delivery)
  const waiting = waitingSince !== null
  const last = lastDelivery(review, delivery, sentAt)
  // What the status line says: the last thing that happened here, else that the review waits, else when it was last sent.
  const line = status ?? (waiting ? COPY.waiting(delivery?.target ?? null) : last)
  // The other ways to export are kept out of the way, and come out by themselves when the delivery has not worked or has not been received.
  // Download, in a link's dialog, is in the group too, so a clipboard that is refused opens it. Once the group is open, by the reviewer or
  // by the dialog, it stays open: it is not closed again under a reviewer who may be about to press something in it.
  const groupOpen = userOpen || failed || late

  const download = () => {
    const name = reviewFileName(review, shown)
    submit.download(name, text, shown === 'md' ? 'text/markdown' : 'application/json')
    setStatus(COPY.downloaded(name))
    onSubmitted()
  }

  const copy = async () => {
    const ok = await submit.copy(text)
    setFailed(!ok)
    const refused = way === 'link' ? COPY.clipboardRefusedLink(linkTarget) : COPY.clipboardRefused
    setStatus(ok ? (way === 'link' ? COPY.copiedForLink(linkTarget) : COPY.copied) : refused)
    if (ok) onSubmitted()
  }

  const run = async () => {
    if (!deliver || sending || waiting) return // the button is only marked unavailable, so that the focus stays on it
    setSending(true)
    setFailed(false)
    setSendFailed(false)
    setStatus(delivery?.kind === 'caller' ? COPY.waiting(delivery.target) : COPY.sending)
    const result = await deliver()
    setSending(false)
    if (result.ok) {
      setStatus(null) // what the page now knows is in the line of the last delivery
      setClosingFor(result.closeAfterMs === null ? null : { updatedAt: reviewRef.current.updatedAt, afterMs: result.closeAfterMs })
    } else {
      setFailed(true)
      setSendFailed(true)
      setStatus(result.error)
    }
  }

  const copyButton = (primary: boolean) => (
    <button type="button" className={primary ? 'btn btn-primary' : 'btn'} onClick={() => void copy()}>
      <IconCopy /> Copy
    </button>
  )
  const downloadButton = (primary: boolean) => (
    <button type="button" className={primary ? 'btn btn-primary' : 'btn'} onClick={download}>
      <IconDownload /> Download
    </button>
  )

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby="submit-title"
      onClose={onClose}
      onKeyDownCapture={() => setClosingFor(null)}
      onPointerDownCapture={() => setClosingFor(null)}
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className="dialog-body">
        <header className="dialog-head">
          <div className="dialog-title">
            <h2 id="submit-title" ref={headingRef} tabIndex={-1}>
              {label}
            </h2>
            <button type="button" className="icon-btn" aria-label={COPY.close} title={COPY.closeTitle(COPY.keyEscape)} onClick={close}>
              <IconX />
            </button>
          </div>
          <p className="muted">
            <code>{review.file.name}</code> · {COPY.commentCount(count)}
          </p>
        </header>

        {count === 0 && <p className="notice notice-info">{delivery ? COPY.noCommentsSending : COPY.noCommentsExporting}</p>}

        <label className="dialog-label" htmlFor="summary">
          Overall summary <span className="muted">optional</span>
        </label>
        <textarea
          id="summary"
          className="field"
          rows={3}
          placeholder="Anything that doesn't belong to a specific line: overall impression, blockers, praise…"
          value={review.summary}
          onChange={(e) => onSummary(e.target.value)}
        />

        <div className="dialog-label">
          Preview
          {way === 'plain' && <FormatControl format={format} onChange={setFormat} />}
        </div>
        <pre className="preview" tabIndex={0} aria-label={`Preview of the review, as ${shown === 'md' ? 'Markdown' : 'JSON'}`}>
          {text}
        </pre>

        <p className="muted dialog-dest">
          {way === 'delivered' ? destinationLine(delivery!, to ?? null, review, sentAt) : way === 'link' ? COPY.lineLink(linkTarget) : COPY.lineExport}
        </p>
        {late && (
          <p className="notice notice-warn" role="status">
            {COPY.nobodyYet}
          </p>
        )}

        <footer className="dialog-foot">
          <span className={failed ? 'status status-error' : 'status muted'} role="status" aria-live="polite">
            {line && (
              <>
                {!failed && !sending && !waiting && <IconCheck />} {line}
              </>
            )}
          </span>
          <span className="dialog-actions">
            {way === 'delivered' ? (
              <button type="button" className="btn btn-primary" aria-disabled={sending || waiting} onClick={() => void run()} title={label} aria-label={label}>
                <IconSend /> <span className="submit-label">{label}</span>
              </button>
            ) : way === 'link' ? (
              copyButton(true)
            ) : (
              <>
                {downloadButton(true)}
                {copyButton(false)}
              </>
            )}
          </span>
        </footer>

        {sendFailed && <p className="muted dialog-dest">{COPY.copyInstead}</p>}

        {way !== 'plain' && (
          <details className="dialog-keep" open={groupOpen} onToggle={(e) => setUserOpen(e.currentTarget.open)}>
            <summary>{COPY.otherWaysToExport}</summary>
            <div className="dialog-keep-body">
              {way === 'delivered' && <FormatControl format={format} onChange={setFormat} />}
              <span className="dialog-actions">
                {way === 'delivered' && copyButton(false)}
                {downloadButton(false)}
              </span>
            </div>
          </details>
        )}
      </div>
    </dialog>
  )
}

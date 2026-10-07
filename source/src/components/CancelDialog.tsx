import { COPY } from '../lib/copy'
import { Button, Dialog, DialogFoot } from '../ui'

interface Props {
  /** The comments saved on the open file. */
  comments: number
  /** The review has an overall summary. */
  summary: boolean
  /** A comment is being written. */
  writing: boolean
  fileName: string
  /** Who is told that the review was cancelled: left out when nobody is told, `null` for a program that has no name to give, and otherwise its name. */
  tells?: string | null
  onKeep: () => void
  onCancel: () => void
}

/**
 * The question before a review is given up. Every way out except the danger button keeps the review: Escape, the cross and a press on the
 * backdrop all end in `onKeep`, so that the key that closes things never discards comments.
 */
export function CancelDialog({ comments, summary, writing, fileName, tells, onKeep, onCancel }: Props) {
  return (
    <Dialog title={COPY.cancelTitle} closeLabel={COPY.close} closeTitle={COPY.closeTitle(COPY.keyEscape)} onClose={onKeep}>
      {comments > 0 && <p className="cancel-text">{COPY.cancelDiscards(comments, fileName)}</p>}
      {summary && <p className="cancel-text">{COPY.cancelDiscardsSummary}</p>}
      {writing && <p className="cancel-text">{COPY.cancelDiscardsDraft}</p>}
      {tells !== undefined && <p className="cancel-text">{COPY.cancelTells(tells)}</p>}
      <DialogFoot>
        <span className="dialog-actions">
          <Button onClick={onKeep}>{COPY.keepReviewing}</Button>
          <Button variant="danger" onClick={onCancel}>
            {COPY.cancelReview}
          </Button>
        </span>
      </DialogFoot>
    </Dialog>
  )
}

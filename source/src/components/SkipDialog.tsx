import { COPY } from '../lib/copy'
import { Button, Dialog, DialogFoot } from '../ui'

interface Props {
  /** The name that the caller gave for whoever waits for the review, or `null` for a program that gave none. */
  target: string | null
  onKeep: () => void
  onSkip: () => void
}

/**
 * The question of Back to start while a program waits for the review. Every way out but the button that skips the review keeps reviewing:
 * Escape, the cross and a press on the backdrop all end in `onKeep`, so that the key that closes things never leaves the review behind.
 */
export function SkipDialog({ target, onKeep, onSkip }: Props) {
  return (
    <Dialog title={COPY.skipTitle(target)} closeLabel={COPY.close} closeTitle={COPY.closeTitle(COPY.keyEscape)} onClose={onKeep}>
      <p className="cancel-text">{COPY.skipKept}</p>
      <DialogFoot>
        <span className="dialog-actions">
          <Button onClick={onKeep}>{COPY.keepReviewing}</Button>
          <Button variant="primary" onClick={onSkip}>
            {COPY.skipReview}
          </Button>
        </span>
      </DialogFoot>
    </Dialog>
  )
}

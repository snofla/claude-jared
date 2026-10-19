import { Alert, Button } from '../ui'
import { COPY } from '../lib/copy'

interface Props {
  /** What the reviewer is to do while a program has not taken the review, or `null` when no review waits: then the strip is not drawn and its live region is empty. */
  words: string | null
  /** The review has been with the program for too long: the way out is offered beside the words. */
  late: boolean
  /** The button that stops the review (the question of stopping comes first), or `null` when the window does not offer it either: the program has the review as it is. */
  onStop: (() => void) | null
  /** The words of that button and its tooltip, by the one rule of the header: it stops the review while a program waits, and closes the file after the program took the review. */
  stopLabel: string
  stopTip: string
  /** Open the dialog, where the review can be copied or downloaded. */
  onOtherWays: () => void
}

/**
 * The state of a review that a program has been handed and has not taken, under the header, where the reviewer goes on working: the dialog that
 * sent it has closed. The region is in the page, empty, before the words arrive, so that they are announced; the buttons are outside it.
 */
export function DeliveryStrip({ words, late, onStop, stopLabel, stopTip, onOtherWays }: Props) {
  const buttons = [
    onStop && (
      <Button key="stop" size="sm" variant="ghost" onClick={onStop} title={stopTip}>
        {stopLabel}
      </Button>
    ),
    late && (
      <Button key="other" size="sm" onClick={onOtherWays}>
        {COPY.copyOrDownload}
      </Button>
    ),
  ].filter(Boolean)
  return (
    <Alert tone="warn" role="status" actions={buttons.length > 0 ? buttons : null}>
      {words}
    </Alert>
  )
}

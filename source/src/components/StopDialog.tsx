import { COPY } from '../lib/copy'
import { Button, Dialog, DialogFoot } from '../ui'

interface Props {
  /** The name of the open file, or of the set of files, as the header gives it. */
  name: string
  /** How many files the review holds: more than one for a set, which is stopped as one review. */
  files: number
  /** Who waits for the review: `null` when nobody does; otherwise `target`, the name that the program gave for whoever receives the review, or `null` when it gave none. */
  waiting: { target: string | null } | null
  /**
   * Who is told if the review is discarded, when nobody waits: a program that took an earlier version of the review, `target` being its name or `null` when it gave none;
   * `null` when nobody is told. The line is drawn only in the form that asks, since only Discard tells that program (Keep tells nobody).
   */
  discardTells: { target: string | null } | null
  /** How many comments the review has saved, on all its files. */
  comments: number
  /** The review has an overall summary. */
  summary: boolean
  /** A comment is being written, which neither choice keeps. */
  writing: boolean
  /** Keep reviewing: nothing is stopped and nobody is told. */
  onKeep: () => void
  /** Stop and keep what there is: the review is kept for later, and a program that waits is told that the review was skipped. */
  onStop: () => void
  /** Stop and discard what there is: a program that waits is told that the review was discarded. */
  onDiscard: () => void
}

/**
 * The one question of Stop reviewing and Close file. While a program waits it names the program and what it is told;
 * when the review has comments or an overall summary it asks what happens to them, with Keep as the main button; otherwise the question is short, and its main
 * button stops. When nobody waits but a program took an earlier version of the review, the question that asks says that it is told if the review is discarded. A comment that is being written is named in every case, since neither choice keeps it. Every way out but the buttons that stop keeps reviewing:
 * Escape, the cross and a press on the backdrop all end in `onKeep`, so that the key that closes things never leaves the review behind or discards a comment.
 */
export function StopDialog({ name, files, waiting, discardTells, comments, summary, writing, onKeep, onStop, onDiscard }: Props) {
  const asks = comments > 0 || summary
  return (
    <Dialog title={waiting ? COPY.stopTitle(name) : COPY.closeTitleOf(name)} closeLabel={COPY.close} closeTitle={COPY.closeTitle(COPY.keyEscape)} onClose={onKeep}>
      {waiting && <p className="cancel-text">{COPY.stopWaits(waiting.target)}</p>}
      {comments > 0 && <p className="cancel-text">{COPY.stopAskComments(comments)}</p>}
      {comments > 0 && summary && <p className="cancel-text">{COPY.stopSummaryGoesWith(comments)}</p>}
      {comments === 0 && summary && <p className="cancel-text">{COPY.stopAskSummary}</p>}
      {asks && <p className="cancel-text">{COPY.stopKeptLater}</p>}
      {asks && !waiting && discardTells && <p className="cancel-text">{COPY.closeTellsOfDiscard(discardTells.target)}</p>}
      {writing && <p className="cancel-text">{COPY.stopDraftLost}</p>}
      <DialogFoot>
        <span className="dialog-actions">
          <Button onClick={onKeep}>{COPY.keepReviewing}</Button>
          {asks ? (
            <>
              <Button variant="danger" onClick={onDiscard}>
                {comments > 0 ? COPY.discardComments(comments) : COPY.discardSummary}
              </Button>
              <Button variant="primary" onClick={onStop}>
                {comments > 0 ? COPY.keepComments(comments) : COPY.keepSummary}
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={onStop}>
              {waiting ? COPY.stopReviewing : COPY.closeFile(files)}
            </Button>
          )}
        </span>
      </DialogFoot>
    </Dialog>
  )
}

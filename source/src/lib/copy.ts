/**
 * The words of the delivery, the header, the dialog's statuses and the composer's warning, in one place. Nothing else spells them out (the tests and the
 * documents go through this file), and a change of wording is a change here. They are Jared's own strings; words that a caller
 * gives (`submitLabel`, `submitTarget`) are not in this file, and are never made into the default. Each message is whole, with
 * its gaps for names, so that it can be translated as it is. The dialog's other labels (its field names, such as Overall summary,
 * and Copy, Download, Markdown and JSON) are not here yet: they wait for localisation.
 */
export const COPY = {
  /** The button, the dialog's title and the header's status when nothing takes the review. */
  exportLabel: 'Export review',
  /** The button of a delivery whose sender gave no words. */
  submitLabel: 'Submit review',

  draft: 'Draft',
  /** Copied or downloaded: it left Jared, and nobody was handed it. */
  exported: (time: string): string => `Exported ${time}`,
  editedSinceExport: 'Edited since export',
  /** Sent to the receiver, or taken by the program that opened Jared. Said of nothing else. */
  sent: (time: string): string => `Sent ${time}`,
  editedSinceSent: 'Edited since sending',
  /** The review is with the page's API and nobody has taken it: not sent yet. */
  waiting: (target: string | null): string => (target === null ? 'Waiting to be received' : `Waiting for ${target}`),

  sending: 'Sending…',
  /**
   * What the page says once the review has been taken, when the dialog is not there to say it: a visible message that is heard as
   * well, and the same message for both. With the name that the sender gave, and without one. It has no time: the header and the dialog's line keep it.
   */
  reviewSent: (target: string | null): string => (target === null ? 'Review sent to the program that opened Jared.' : `Review sent to ${target}.`),
  /** The name of the × that takes that message away. */
  dismiss: 'Dismiss',
  /** The dialog, after a delivery: when, as a sentence, and with what has not gone. */
  sentAt: (time: string): string => `Sent at ${time}.`,
  sentAtChanged: (time: string): string => `Sent at ${time}. Changes made since then have not been sent.`,
  nobodyYet: 'Not received yet. You can keep waiting, or copy or download the review.',
  /** The heading of the group that holds the other ways to get the review out. */
  otherWaysToExport: 'Other ways to export',
  /** The × in the dialog's heading: its name, and its title with the key that does the same. */
  close: 'Close',
  closeTitle: (key: string): string => `Close (${key})`,
  keyEscape: 'Esc',
  /** The dialog's one line when nothing takes the review, and when a link asked for the review on the clipboard (with who to tell). */
  lineExport: 'This review stays in this browser until you copy or download it.',
  lineLink: (target: string | null): string =>
    target === null
      ? 'Copy puts this review on the clipboard as JSON. Then tell the program that opened Jared that the review is on the clipboard.'
      : `Copy puts this review on the clipboard as JSON. Then tell ${target} that the review is on the clipboard.`,
  /** What the dialog says after Copy and Download, and when the clipboard is refused. No final full stop. */
  copied: 'Copied to clipboard',
  copiedForLink: (target: string | null): string =>
    target === null
      ? 'Copied. Now tell the program that opened Jared that the review is on the clipboard.'
      : `Copied. Now tell ${target} that the review is on the clipboard.`,
  downloaded: (name: string): string => `Downloaded ${name}`,
  clipboardRefused: 'Could not access the clipboard. Use Download instead.',
  clipboardRefusedLink: (target: string | null): string =>
    target === null
      ? 'Could not access the clipboard. Download the review, then give the file to the program that opened Jared.'
      : `Could not access the clipboard. Download the review, then give the file to ${target}.`,
  noCommentsExporting: 'There are no comments yet. Exporting now gives an empty review.',
  noCommentsSending: 'There are no comments yet. Sending now gives an empty review.',
  /** How many comments the review has, under the dialog's title. English-only plural: localisation replaces it with `Intl.PluralRules`, so do not copy the pattern. */
  commentCount: (count: number): string => (count === 0 ? 'no comments' : count === 1 ? '1 comment' : `${count} comments`),
  /** The line that says where a delivery goes; it does not name the button, which wears the sender's words. Each case is one whole message. */
  willBeSentTo: (target: string | null, address: string | null): string => {
    if (target !== null) {
      return address === null ? `This review will be sent to ${target}.` : `This review will be sent to ${target} (waiting at ${address}).`
    }
    return address === null ? 'This review will be sent to the program that opened Jared.' : `This review will be sent to the program that opened Jared (${address}).`
  },
  /** Under the preview of a delivery that has been taken, with nothing changed since: the line that says where it will go, in the past. No address, which is no longer waiting. */
  wasSentTo: (target: string | null): string => (target === null ? 'This review was sent to the program that opened Jared.' : `This review was sent to ${target}.`),
  nothingToSend: 'There is no review to send.',
  /**
   * The red banner for a send that failed after the dialog was closed: the cause, which ends with a full stop, and, when trying
   * again can work, where to do it. `again` is false for what no second try mends (a different file, no review).
   */
  notSent: (cause: string, again: boolean): string => (again ? `The review was not sent. ${cause} Open the review dialog to try again or to copy or download the review.` : `The review was not sent. ${cause}`),
  /** The question before something replaces the comment that is being written. */
  discardComment: 'Discard the comment you are writing?',
  /**
   * What goes wrong with the receiver of a delivery, each as two whole messages: with the name that the sender gave (`target`), and
   * without one, for "the program that opened Jared". `address` is where Jared looked; `message` is the engine's own sentence.
   */
  couldNotReach: (target: string | null, address: string): string =>
    target === null
      ? `Could not reach the program that opened Jared at ${address}. It may have stopped waiting.`
      : `Could not reach ${target} at ${address}. It may have stopped waiting.`,
  couldNotReachForFile: (target: string | null, address: string): string =>
    target === null
      ? `Could not reach the program that opened Jared at ${address}, so Jared cannot get the file for review. It may have stopped waiting.`
      : `Could not reach ${target} at ${address}, so Jared cannot get the file for review. It may have stopped waiting.`,
  reviewForAnotherFile: (target: string | null): string =>
    target === null
      ? 'This review is for a different file, or a different version of it, than the one the program that opened Jared is waiting for.'
      : `This review is for a different file, or a different version of it, than the one ${target} is waiting for.`,
  refusedReview: (target: string | null): string =>
    target === null ? 'The program that opened Jared refused this review because it does not fit the file.' : `${target} refused this review because it does not fit the file.`,
  notWaiting: (target: string | null): string => (target === null ? 'The program that opened Jared is not waiting any more.' : `${target} is not waiting any more.`),
  /** The receiver's own sentence is given as it came, with a full stop when it has none, because the banner that tells it goes on with another sentence. */
  answeredWithError: (target: string | null, message: string): string => {
    const said = /[.!?]$/.test(message) ? message : `${message}.`
    return target === null ? `The program that opened Jared answered with an error: ${said}` : `${target} answered with an error: ${said}`
  },
  unexpectedAnswer: (target: string | null): string =>
    target === null ? 'The program that opened Jared sent an answer that Jared did not expect.' : `${target} sent an answer that Jared did not expect.`,
  /**
   * The composer, when the suggestion being written overlaps the suggestion of another comment: `range` is the other's lines, or
   * a list of them built with `Intl.ListFormat`, in lower case after "on" ("lines 5–10 and line 9"). It does not say what a reader will do.
   */
  suggestionOverlapsOne: (range: string): string => `This suggestion overlaps the one on ${range}, so they cannot both be applied.`,
  suggestionOverlapsSeveral: (ranges: string): string => `This suggestion overlaps the ones on ${ranges}, so they cannot all be applied.`,
  /** Under the error, when sending failed, as a line of its own. */
  copyInstead: 'You can copy or download the review instead.',
  fileChanged: 'A different file was opened before the review was received.',
} as const

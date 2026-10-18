/**
 * The words of the delivery, the header, the dialog's statuses and the composer's warning, in one place. Nothing else spells them out (the tests and the
 * documents go through this file), and a change of wording is a change here. They are Jared's own strings; words that a caller
 * gives (`submitLabel`, `submitTarget`) are not in this file, and are never made into the default. Each message is whole, with
 * its gaps for names, so that it can be translated as it is. The dialog's other labels (its field names, such as Overall summary,
 * and Copy, Download, Markdown and JSON) are not here yet: they wait for localisation.
 */
/**
 * Names in one line, as both lists of the page say them: "a and b", "a, b and c", and, when there are more than are named, "a, b, c and 2 more". English-only:
 * localisation replaces it with `Intl.ListFormat`.
 */
const listed = (items: readonly string[]): string => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0])

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
  /**
   * The review is with the page's API and nobody has taken it: not sent yet. For the header's chip and the dialog's line, so it is short and names nobody: a
   * program that waits to be told that the review is submitted does not take it until it is told, so the words do not say that anything is working.
   */
  waiting: 'Not taken yet',
  /** What the dialog tells the reviewer at once, in a notice, while a script has not taken the review: to tell the program that the review is submitted. */
  waitingNotice: (target: string | null): string => (target === null ? 'Tell the program that opened Jared that you have submitted the review.' : `Tell ${target} that you have submitted the review.`),

  sending: 'Sending…',
  /**
   * What the page says once the review has been taken, when the dialog is not there to say it: a visible message that is heard as
   * well, and the same message for both. With the name that the sender gave, and without one. It has no time: the header and the dialog's line keep it.
   */
  reviewSent: (target: string | null): string => (target === null ? 'Review sent to the program that opened Jared.' : `Review sent to ${target}.`),
  /**
   * The same for a review that the Jared service kept as a file, where "sent" is all that the page knows: the program may not have it yet, and what to do about that.
   * The second sentence goes when a real session has shown that a finished background command wakes the session that waits for the file.
   */
  reviewSentToService: (target: string | null): string =>
    target === null
      ? 'Review sent to the program that opened Jared. If it has not answered in a minute, tell it that you pressed the button.'
      : `Review sent to ${target}. If ${target} has not answered in a minute, tell it that you pressed the button.`,
  /** The name of the × that takes that message away. */
  dismiss: 'Dismiss',
  /** The dialog, after a delivery: when, as a sentence, and with what has not gone. */
  sentAt: (time: string): string => `Sent at ${time}.`,
  sentAtChanged: (time: string): string => `Sent at ${time}. Changes made since then have not been sent.`,
  /** Added to the notice while a program has not taken the review, once the reviewer has changed it: what was handed over is the review as it was at the press. */
  changedAfterPress: 'Changes you made after pressing the button are not in what you sent. Press Send changes to send them.',
  /** The button after a first press: how many changes it will send, or that there is nothing new (the words of the program that takes the review, when it gave a name). */
  sendChanges: (count: number): string => `Send changes (${count})`,
  inStep: (target: string | null): string => (target === null ? 'Nothing new to send' : `Up to date with ${target}`),
  /** What a press says when there is nothing new to send. */
  nothingNew: (target: string | null): string => (target === null ? 'Nothing new to send: the program has the review as it is.' : `Nothing new to send: ${target} has the review as it is.`),
  /** The notice of a press that sent changes to a program that took the review before: what to tell it, and, after a while, the way out. */
  updateNotice: (target: string | null): string => (target === null ? 'Tell the program that opened Jared that you have sent changes.' : `Tell ${target} that you have sent changes.`),
  updateNobodyYet: (target: string | null): string =>
    target === null
      ? 'Tell the program that opened Jared that you have sent changes. If the program does not take them, copy or download the review.'
      : `Tell ${target} that you have sent changes. If ${target} does not take them, copy or download the review.`,
  /** The item of the menu that opens the window of the summary and the preview, once the button sends at once. */
  reviewWindow: 'Summary, preview and export…',
  /** The marks beside a comment in the list: what the next press will send. */
  markNew: 'new',
  markEdited: 'edited',
  /** The same notice after a while, with the way out added: its first sentence is the one of `waitingNotice`, so that it reads as one thought. */
  nobodyYet: (target: string | null): string =>
    target === null
      ? 'Tell the program that opened Jared that you have submitted the review. If the program does not take it, copy or download the review.'
      : `Tell ${target} that you have submitted the review. If ${target} does not take it, copy or download the review.`,
  /** The heading of the group that holds the other ways to get the review out. */
  otherWaysToExport: 'Other ways to export',
  /** The button of the strip under the header, after the late time: it opens the dialog, where the review can be copied or downloaded. */
  copyOrDownload: 'Copy or download',
  /** The × in the dialog's heading: its name, and its title with the key that does the same. */
  close: 'Close',
  closeTitle: (key: string): string => `Close (${key})`,
  keyEscape: 'Esc',
  /** The ⋯ button of the header: its accessible name and its tooltip. The menu holds the actions that are needed now and then, which have no place in the header all the time. */
  moreActions: 'More actions',
  /** The list of the files of a diff beside the code: its name, the button of the header that shows and hides it, and the button in it that makes it narrow and wide again. */
  files: 'Files',
  /** The tooltip of the header button that shows and hides the list. The button's name is `files`, its visible text: the name has to contain what is seen, so that a voice control that says "Files" finds it. */
  filesToggle: 'Show or hide the file list',
  filesCollapse: 'Collapse the file list',
  filesExpand: 'Expand the file list',
  /** The button that closes the list when it is a drawer (below the width of the comments drawer): the same noun as the two above. */
  filesClose: 'Close the file list',
  /** How many of the files the reviewer has marked, and how many files the diff has. English-only plurals: localisation replaces them with `Intl.PluralRules`. */
  filesViewed: (viewed: number, total: number): string => `${viewed} of ${total} viewed`,
  fileCount: (count: number): string => (count === 1 ? '1 file' : `${count} files`),
  /** What a kept review of several files shows in the list on the start page, after its number of files: the names of the first, and how many more. English-only plural, like the ones above. */
  recentFiles: (count: number, names: readonly string[]): string => listed(count > names.length ? [...names, `${count - names.length} more`] : names),
  /** The title of the button that forgets a kept review of several files, on the start page. */
  forgetSet: 'Forget these files and their review',
  /**
   * What the page leaves out of a pick of several files, in one line: each name with the reason, and, after five, how many more. The reasons are
   * six separate messages; `limit` is the size of the largest file, as the page writes sizes. English-only list, like the plurals around it.
   */
  setLeftOut: (items: ReadonlyArray<{ name: string; why: 'not-text' | 'too-big' | 'empty' | 'unreadable' | 'unreadable-folder' | 'same-name' }>, limit: string): string => {
    const reason = { 'not-text': 'not text', 'too-big': `more than ${limit}`, empty: 'empty', unreadable: 'could not be read', 'unreadable-folder': 'folder could not be read', 'same-name': 'same name as another file' } as const
    const shown = items.slice(0, 5).map((item) => `${item.name} (${reason[item.why]})`)
    const rest = items.length - shown.length
    return `Left out: ${listed(rest > 0 ? [...shown, `${rest} more`] : shown)}.`
  },
  /** Why a pick of several files opens none: no file that is text, more files than a review holds, or more text than a review holds. `limit` and `most` are sizes, as the page writes them. */
  setNothing: 'There is no file here that Jared can open.',
  /** A dropped folder that the browser would not read, when no file could be opened: what happened to Jared, and what to do. It names no cause, since only the failure of the read is known. */
  setFolderNotRead: 'This browser did not let Jared read that folder. Choose the files in it instead, or open Jared from Claude: a review that Claude starts may read a folder where this page could not.',
  /** A picked file that the browser would not read. */
  couldNotRead: (name: string): string => `Could not read ${name}.`,
  setTooMany: (count: number, most: number): string => `${count} files are more than the ${most} that Jared opens in one review. Choose fewer files.`,
  /** A folder with more files in it than the page looks at: the number is the most that it looks at, so it is not a count of the files in the folder. */
  setTooManyFound: (looked: number, most: number): string => `There are more than ${looked} files here, and Jared opens at most ${most} in one review. Choose fewer files.`,
  /** The files are more than a review holds, and how much more is not said: the page stops reading once it is sure of it. */
  setTooBigTogether: (limit: string): string => `Together, these files are more than the ${limit} that Jared opens in one review. Choose fewer files.`,
  /** The summary in the header's chip for a diff of two files or more: one message with its three numbers, so that a language can put the parts in its own order. */
  filesChip: (count: number, added: number, deleted: number): string => `${COPY.fileCount(count)}, +${added} −${deleted}`,
  /** The same chip for a screen reader and its tooltip: "+18 −7" is read "plus 18 minus 7". English-only plural of "line", like the two above. */
  filesChipName: (count: number, added: number, deleted: number): string =>
    `${COPY.fileCount(count)}, ${added} ${added === 1 ? 'line' : 'lines'} added and ${deleted} removed`,
  /** The mark on a file that the reviewer has looked at: the button's text in a file's header, and its accessible name in the list. */
  viewed: 'Viewed',
  viewedMark: (path: string): string => `Viewed: ${path}`,
  /** What a letter in the list stands for, for a screen reader and the tooltip: the status of a file, in four separate messages. The letters are git's and are not translated. */
  fileStatus: { A: 'Added', M: 'Modified', D: 'Deleted', R: 'Renamed' },
  /** The key hints at the foot of the list: each beside its key, so each is a whole message. */
  filesKeys: { next: 'next file', previous: 'previous file', viewed: 'viewed' },
  /** The heading of the choice of colour scheme in that menu. */
  colourScheme: 'Colour scheme',
  /** The names of its three choices. */
  themeChoice: { system: 'System', light: 'Light', dark: 'Dark' },
  /** The button that gives a review up, and the danger button of its question. */
  discardReview: 'Discard review',
  /** The safe button of that question: nothing is discarded and nobody is told. */
  keepReviewing: 'Keep reviewing',
  cancelTitle: 'Discard this review?',
  /** What giving a review up discards: the comments saved on the open file. */
  cancelDiscards: (count: number, name: string): string => `${COPY.commentCount(count)} on ${name} will be discarded.`,
  /** What giving a review up discards when a comment is being written. */
  cancelDiscardsDraft: 'The comment you are writing will be discarded.',
  /** What giving a review up discards when it has an overall summary, whether or not it has comments. */
  cancelDiscardsSummary: 'The overall summary will be discarded.',
  /** The button that skips a review: it leaves the file without reviewing it now, keeps the review and tells the program that waits. */
  skipReview: 'Skip review',
  /** The question of Back to start when a program waits for the review: who waits, by the caller's name for them or as the program that opened Jared. */
  skipTitle: (target: string | null): string => (target === null ? 'The program that opened Jared is waiting for this review.' : `${target} is waiting for this review.`),
  /** What skipping does, under that question: the review is kept for later. */
  skipKept: 'Skipping leaves this file for now. Your review is kept, and you can go on with it from the start page.',
  /** The banner on the start page after a skip of a review that a script started: the script does not hear of it until the reviewer says so. */
  skipTellProgram: (target: string | null): string => (target === null ? 'Tell the program that opened Jared that you skipped the review.' : `Tell ${target} that you skipped the review.`),
  /** The banner on the start page after a discard of a review that a script started, for the same reason as the one after a skip. */
  discardTellProgram: (target: string | null): string => (target === null ? 'Tell the program that opened Jared that you discarded the review.' : `Tell ${target} that you discarded the review.`),
  /** What giving a review up tells whoever waits for it: the caller's name for them, or the program that opened Jared when there is none. */
  cancelTells: (target: string | null): string => (target === null ? 'The program that opened Jared will be told that you discarded the review.' : `${target} will be told that you discarded the review.`),
  /**
   * What the banner says when a program asked, through the page's own interface, to open another file and the page kept the open review
   * (`kept` is the name of that file): who asked (the caller's name for itself, or a program when it gave none) and the file it asked for.
   */
  declinedOpen: (asker: string | null, name: string, kept: string | null): string => {
    const who = asker ?? 'A program'
    return kept === null ? `${who} asked to open ${name}. Your review was kept.` : `${who} asked to open ${name}. Your review of ${kept} was kept.`
  },
  /** The same for a program that asked to close the open file, which it names when the page has its name. */
  declinedClose: (asker: string | null, kept: string | null): string => {
    const who = asker ?? 'A program'
    return kept === null ? `${who} asked to close the file. Your review was kept.` : `${who} asked to close ${kept}. Your review was kept.`
  },
  /** What the page says when it was opened for a review that has expired and shows a review that it restored from its storage: it cannot show the review that was meant, and the one it shows may be another. */
  bootExpired: 'This review has expired, so what the page shows may be another one. Ask Claude to open the file again.',
  /** The same when the page shows no review: there is no other review to warn about. */
  bootExpiredEmpty: 'This review has expired. Ask Claude to open the file again.',
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
  /** The window of a review with no comment and no summary: what is in it, as a statement and not as a caution. The words of a program that takes the review name it. */
  noCommentsExporting: 'No comments. The review that you export has none.',
  noCommentsSending: (target: string | null): string =>
    target === null ? 'No comments. The program that opened Jared will be told that you found nothing to say.' : `No comments. ${target} will be told that you found nothing to say.`,
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
  /** What the Jared service refuses with, in the page's own words and with no name of a program, because no program was told: a review that is over what it takes, a file that it could not write, and any other refusal in its own sentence. */
  serviceTooBig: 'This review is more than 4 MB, which is too much to hand over.',
  serviceNotSaved: 'The review could not be saved on this computer.',
  serviceRefused: (message: string): string => `The service refused the review: ${/[.!?]$/.test(message) ? message : `${message}.`}`,
  /** Inside a link of a comment, read by a screen reader and not drawn: what the link does that its words do not say. */
  opensInNewTab: ', opens in a new tab',
  /** The two views of the comment field, and the name of the pair for a screen reader. */
  commentWrite: 'Write',
  commentPreview: 'Preview',
  commentViews: 'Write or preview the comment',
  /** Quiet, at the right of the two views: what the comment is written in. */
  commentMarkdown: 'Markdown',
  /** Under the field on the Write view. */
  writeCaption: 'The comment is shown formatted.',
  /** After it, where there is a keyboard: the shortcuts, with the key that goes with each (`⌘` on Apple's computers, `Ctrl+` elsewhere) as a variable. */
  writeKeys: (mod: string): string => `${mod}B bold · ${mod}I italic · ${mod}K link`,
  /** Under the preview. */
  previewCaption: 'This is how the comment will look. Links open in a new tab.',
  /** The preview of a comment with no words yet. */
  previewEmpty: 'Nothing to preview yet.',
  /** After the label of the suggestion field: what a suggestion does. */
  suggestionReplaces: 'replaces the selected lines',
  /** After the line above, with a "·" between, where there is a keyboard: what Tab and Escape do in the suggestion field. The keys are variables, so that they can change. */
  suggestionKeys: (tab: string, esc: string): string => `${tab} indents, ${esc} then ${tab} leaves the field`,
  /** The folded row of a suggestion's diff in its card: how many unchanged lines it hides. */
  unchangedLines: (count: number): string => (count === 1 ? '1 unchanged line' : `${count} unchanged lines`),
  /** The accessible name of that row, a button that opens the run: the words it shows, after what it does. */
  showUnchanged: (count: number): string => `Show ${COPY.unchangedLines(count)}`,
  /** Read before the code of a removed line of that diff, and not drawn: the sign `−` is drawn and not read. */
  diffRemoved: 'removed, ',
  /** The same, before the code of an added line, for the sign `+`. */
  diffAdded: 'added, ',
  /**
   * The composer, when the suggestion being written overlaps the suggestion of another comment: `range` is the other's lines, or
   * a list of them built with `Intl.ListFormat`, in lower case after "on" ("lines 5–10 and line 9"). It does not say what a reader will do.
   */
  suggestionOverlapsOne: (range: string): string => `This suggestion overlaps the one on ${range}, so they cannot both be applied.`,
  suggestionOverlapsSeveral: (ranges: string): string => `This suggestion overlaps the ones on ${ranges}, so they cannot all be applied.`,
  /**
   * Under the error, when sending failed, as a line of its own: the one place that says that the review was not sent, for every cause (a receiver, a
   * script that drives the page, a file that was replaced), so that each cause says only why. The banner of a closed dialog says it in `notSent`.
   */
  copyInstead: 'The review was not sent. You can copy or download it instead.',
  fileChanged: 'A different file was opened before the review was received.',
} as const

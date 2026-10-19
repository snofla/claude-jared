# Changelog

What changed in each release of the Jared plugin, newest first.

## 0.16.8 — 2026-10-19

- Nothing changes in what Jared does or how it looks. This release changes how its page is put together and tested.
- In the source of the page, the code that hands a review over, to Claude or to another program, is now apart from the page's main component, in a reducer and a hook of its own. It behaves as before.
- The gallery of the components, a page for development that the plugin does not carry, can now draw one group of components at a time, and write the computed styles of every group into the page, for tests that check how the components look.
- `package.json` names four packages that tests use to draw the page and act on it without a browser: three of Testing Library, and happy-dom. None of them is in the page.

## 0.16.7 — 2026-10-18

- **A change that Claude makes just before it leaves a file is now kept.** A change that a script makes in an open review through the page, such as Claude through its browser tool (a comment deleted, a summary written, the review marked as having left Jared), and that it follows at once by closing the file or opening another, is now kept in the browser.
  - Before, the page answered that it was done but kept the old review, so a deleted comment came back when the file was opened again. Nothing changes for a person working in the page.
- The page does a little less work while you review: finding the folded runs of a suggestion's diff, reading the list of recent reviews, and sizing the suggestion field as you type each cost less.
- The packages that build the page are updated within their ranges, React and Vite among them, and the notices name the new versions of React.

## 0.16.6 — 2026-10-18

- **A saved suggestion is shown as a diff of the lines that change.** In its card, the lines that a suggestion keeps are drawn once, plain, and only the lines that differ are red or green, with the words that changed in a stronger tint. A long run of unchanged lines is folded into one line that says how many there are, and opens when you click it.
  - A screen reader hears whether a line is removed or added, and a long diff can be scrolled from the keyboard.
- **The page no longer stops on a long text.** Opening a long file, or typing or saving a long suggestion, no longer holds the page for a moment: a long text is coloured a part at a time, and the page answers in between. The colours still come all at once, a moment after the text.
- **A file name with accented or non-Latin letters stays as it is.** A file such as `é.ts` or `日本語.ts`, opened alone, now keeps its name in the tab's title, the header and the exported review, where it was garbled before (`Ã©.ts`). Several files opened together kept their names already.

## 0.16.5 — 2026-10-17

- **The suggestion field is coloured as you type.** The field of a suggested implementation is now coloured as the file's language while you type. A line you change is plain for a moment, until its colours follow, and a language that Jared's page does not carry stays plain.
  - The bracket that pairs with the one at the cursor is marked, with its partner, and a selection is a tint over the colours.
  - A screen reader hears the field as before, and in forced colours the field shows its own letters.
- **`Enter` keeps the indentation in the suggestion field.** A new line starts at the indentation of the line you are on, with one level more after an opening bracket just before the cursor, and after a colon in Python and YAML. Pressed between a bracket and its closing one, `Enter` puts the closing one on a line of its own, with the cursor on the line between.
  - `Shift+Enter` is a plain new line, and the browser's undo takes each press back.
- The README of the plugin says that Jared opens with your file, or your files.

## 0.16.0 — 2026-10-16

- **A comment is drawn as Markdown.** In its card a comment shows paragraphs, bold, italic, code spans, links, bullet and numbered lists, quotes and fenced code, which is coloured as code. Raw HTML, images and headings are not drawn: a `#` line stays text. What you typed is what is kept.
  - A link opens in a new tab, shows its address when you rest on it, and tells a screen reader that it opens in a new tab.
  - The list of comments shows each comment's words in one line, without the marks.
- **Writing aids in the comment field.** `⌘B`, `⌘I` and `⌘K` (`Ctrl` with the same letters on other computers) make the selected words bold or italic, or a link; a second press takes the marks off, and with nothing selected the marks go in with the cursor between them. `Enter` at the end of a list item starts the next item, and on an empty item ends the list.
  - **Write** and **Preview** over the field show the Markdown as typed, or the comment as it will look, with each link's address after it.
- **Tab indents in the suggestion field.** `Tab` indents the selected lines, or adds one level at the cursor, and `Shift+Tab` takes one level off, by the file's own unit of indentation; the browser's undo takes each press back. To leave the field with the keyboard, press `Esc` and then `Tab`; a second `Esc` cancels the comment, as before.
- **The exported Markdown cannot be broken by a comment's words.** A comment or the summary can no longer turn into a heading of the document, and a code fence or raw HTML that it leaves open (an HTML comment with no `-->`, a `<script>`, `<style>`, `<pre>` or `<textarea>` with no end tag) is closed at the end of the words, so that the comments after it are no longer swallowed or hidden in a Markdown viewer. The JSON is unchanged.
- The README of the plugin has new pictures, each in the light and the dark scheme: Jared in the browser pane of the Claude app, beside the conversation, then a file and a diff as Jared draws them now.

## 0.15.1 — 2026-10-13

- **Your saved reviews stay after the service stops.** Jared now opens at the same place in your session's browser each time the small service starts, so your saved reviews, the sets of files you kept and your **Viewed** marks are still under **Continue reviewing** after the service has been stopped, has ended by itself after half an hour, or has been replaced by an update of the plugin.
  - If another program is using that place, Jared takes another one once, and the earlier reviews are not shown there.
- **Several files open in one order, whichever way you name them.** When you pick or drop several files, they open in order of their whole paths, with capital and small letters together, so that `badge.css` stands beside `Badge.tsx` and not after every capitalised name. Claude sorts the files of a wildcard in the same way.
  - A review that you saved keeps the order it had when you open the same files again.
- **A dropped folder that the browser will not read is said to be unread.** When a browser will not read a dropped folder (Chrome does not, on a page opened from a file), Jared says that this browser did not let it read the folder and what to do instead, and not that there is no file to open.
  - A folder that did not open among files that did is named in the line of what was left out, as a folder that could not be read.

## 0.15.0 — 2026-10-13

- **You can review several files together.** Name them after `/jared:review` by wildcard or by a list, for example `/jared:review src/lib/*.ts` or `/jared:review a.ts, b.ts`, and they open as one review.
  - Claude says in one line how many files it found. It asks before it opens more than 20 files, and when a pattern matches nothing, and it leaves out a file that is empty, is not text or is too big, and says so.
  - Jared opens at most 100 files, and 512 KB in all. When the files are together more than that, Claude says the total and offers the first files that fit, and does not offer to open them all.
  - Several files open in your session's browser only. If your session has no browser, or you set an address for Jared, Claude says so and stops.
  - In Jared the files are in one scroll, each with a header that has its name, its language and a **Viewed** button. You can comment on any of them. A diff among them is shown as plain lines, coloured as a diff.
  - The review is kept: **Continue reviewing** on the start page lists it as "3 files", with the names of the first.
  - When the review comes back, Claude works through it file by file, and edits only the file that each comment names.
- **A list of the files, beside the code, for several files and for a diff of several files.** The new **Files** button in the header opens it.
  - Each file shows its number of comments and a tick for **Viewed**, and, for a file of a diff, its status: added, modified, deleted or renamed. On a narrow window the list is a rail or a drawer.
  - `]` and `[` go to the next and the previous file, and `V` marks the one in view. Each file's header has a **Viewed** button too, and the comments are grouped by file.
  - For a diff of several files, the header says, for example, "3 files, +18 −7".
- **On the start page you can pick several files at once, and drop several files or a folder.** They open together as one review, in order of path.
  - A folder's files are named by their path. Files and folders whose names start with a dot, and `node_modules`, are skipped.
  - A line says which files were left out. If there are more than 100 files, or more than 512 KB in all, none is opened and a message says so.
- **Claude now says beforehand that a wait that ran out of time is not a failure.** Claude Code shows such a wait, and one that ended because you discarded or skipped the review, as a command that "failed with exit code 3". Claude says in advance that it is the end of the wait.

## 0.14.1 — 2026-10-12

- After an update of the plugin, the next review replaces a Jared service that an earlier version started with one of the new version, so you need not run `/jared:stop` yourself; this holds for the update to 0.14.1 from any earlier version. A service of a newer version is never replaced by an older one. `/jared:status` also says which version of the plugin started the service.
- The README of the plugin is easier to read. The options of `/jared:review` are in a table, with a second table of the ways of `--via` in the order that `auto` tries them. Sentences that read awkwardly now say plainly that only the way you name is tried and that `--block` is not available in the plugin. The *Update* section says how to see which version you have and that an update takes effect only after the restart.

## 0.14.0 — 2026-10-12

- **In the Claude app, your review now comes back to the session by itself.** You press **Submit review** in Jared, and Claude picks the review up without being told.
  - Claude says that it will pick the review up. If it has not answered in a minute, tell it that you pressed the button; Jared's message under the header says so too.
  - The plugin tries this way first when your session has a browser and a background command wakes it; `--via background` asks for it. When a session has both the browser pane of the app and Claude in Chrome, Claude uses the pane, so that the whole review stays inside the app.
  - A session that is not woken by background commands says so once and uses the earlier way, in which you tell Claude that you pressed the button.
  - After Claude has worked through your review, it watches for up to ten minutes for the changes that you send. It starts watching as soon as it has read your review, so a round that you stop does not end the watch. When nothing comes in time, it says so in one line and does not ask whether to wait again.
  - Claude no longer repeats an exit code or the name of a status when it tells you what happened. When Jared cannot hand the review over, it says why in its own words, for example "This review is more than 4 MB, which is too much to hand over."
- **After you press the button, you can go on reviewing and send further changes.**
  - The button reads **Send changes (3)**, where the number is how many comments you added, edited or deleted since (a changed summary counts as one), and a press sends the review as it is now, at once. With nothing new it reads **Up to date with Claude**.
  - The list of comments marks the ones that the next press will send, **new** or **edited**. The **⋯** menu has **Summary, preview and export…**, which opens the window of the summary, the preview and the export.
  - Claude works only on what is new or edited since the last time, and says what the update held in one line, for example "Update 2: 2 new, 1 edited, 1 deleted".
  - When you have to tell Claude that you pressed the button (the earlier way), the window closes at the press, the header says "Not taken yet", and a notice under it tells you what to tell Claude and, if you change the review after pressing, that the changes are not in what you sent and that **Send changes** sends them.
  - After a while that notice adds a button that opens the window again, where you can copy or download the review. Giving up a review that waits no longer shows a message that a different file was opened.
- **Skip review**, in the **⋯** menu and in the window that sends the review, leaves the file without reviewing it now, tells Claude that you skipped it, and keeps your review under **Continue reviewing**.
  - Claude tells you that you skipped it and that Jared keeps your comments. In the earlier way, the start page also tells you to tell Claude that you skipped or discarded the review.
  - **Back to start** now asks first while Claude waits for the review. **Cancel review** is now called **Discard review**.
- In the earlier way, Claude no longer checks again and again, for up to ten minutes, whether you have sent your review. It tells you that the file is open and waits for you to say that you have submitted the review, and then takes it. If nothing has been submitted yet, it says so and asks you to press the button and tell it again.
- In the **Export review** or **Submit review** window, a review with no comment and no summary says "No comments." and what will happen: that Claude will be told that you found nothing to say, or that the export has none. The message is no longer drawn as a warning, and a review that has only a summary no longer gets the warning that sending gives an empty review.
  - Given a review with no comments and no summary, Claude says in one line that you found nothing to say, and stops.
- In the **Export review** or **Submit review** window, when a review cannot be sent, the line under the reason now says that the review was not sent, and that you can copy or download it instead.
- The README of the plugin has a new section, *Options*, that lists the options of `/jared:review`: `--rev`, `--jared`, `--via` with the ways that `auto` takes in order, `--block`, `--closes`, `--message` and `--banner`. It says what each does and that `--block` is not available in the plugin.
- The README of the plugin and the form for reporting a problem now say that Jared opens in your session's browser, the browser pane of the Claude app or Claude in Chrome, and not only in the pane.

## 0.13.2 — 2026-10-08

- In the **Export review** or **Submit review** window, after a copy was refused or a send failed, a download is shown as a success, with its check mark, and no longer as an error. The group **Other ways to export**, which the failure opened, now stays open after a download or a copy that works.
- The banner of an expired review says only that the review has expired and to ask Claude to open the file again, when the page shows no review. It no longer warns that the page may show another one.
- The drag overlay, which shows when a file is dragged over the page, is a little darker.

## 0.13.1 — 2026-10-07

- The page of a review that Claude opened for you keeps its file for an hour, where it kept it for ten minutes: you can reload it, or open it again, within that time. After that the page says so in a warning banner, "This review has expired, so what the page shows may be another one. Ask Claude to open the file again.", where it used to show the last session without a word.

## 0.13.0 — 2026-10-07

- The header has less in it. **Open…**, the colour scheme and **Cancel review** are now in a **⋯** menu (*More actions*), and at a width of 900 px the header fits on one line, where it took two. The colour scheme is a choice of **System**, **Light** and **Dark**, with the one that is on checked; the start page keeps its button that cycles through them. Keys work as in any menu: the arrows, `Home` and `End` move, `Enter` or `Space` chooses, `Esc` closes.
- **Cancel review**, in that menu and in the foot of the **Export review** or **Submit review** window, gives a review up: it forgets the file and its review and goes back to the start page. It asks first when the review has comments, an overall summary or a comment being written, with **Keep reviewing** (or `Esc`) to leave everything as it was; a review with nothing in it is given up at once.
- When Claude started the review with `/jared:review` and is waiting for it, **Cancel review** tells it that you cancelled: Claude stops waiting and tells you, instead of waiting until the time is up. The question says who will be told. A program that has already taken the review, with nothing changed since, is not told.
- When Claude asks Jared to open or close a file while you have comments or are writing one, the page still does not throw your work away, and now shows a warning banner that says who asked and that your review was kept, for example "Claude asked to open a.ts. Your review of sample.ts was kept." `/jared:review` tells you about the banner too. When a link opens a file, Jared still asks you, as before.
- In Claude in Chrome, when the tool hides the text of a comment's `code` (it hides text that looks like a cookie or a query string, such as `for (let i = 0; i <= n; i++) {`), `/jared:review` says once that the text was hidden and that the comments were not compared, marks them as unchecked, and applies a suggestion of such a comment only when you say so. It used to take such a comment for changed, and to ask without saying why.

## 0.12.1 — 2026-10-07

- On a phone or a tablet, the small icon buttons are 44 px square, like the other buttons, so that a finger can press them: the pencil and the trash can on a comment, and the crosses that close the comments panel, dismiss a message, forget a kept review under **Continue reviewing** and close the review dialog. With a mouse they look as before.
- On a phone or a tablet, the review dialog is 16 px taller, because its cross is bigger, and its heading is centred on the cross, a little lower. With a mouse, the dialog looks as before.
- In a diff, the label beside a file's name (for example added or renamed) is a little bolder.
- When reviews begin at the same moment, for example in several Claude sessions, they now use one Jared service. Each used to start a service of its own, with its own list of saved reviews, and each stayed running for half an hour.
- The page shows the version of Jared in small, quiet words beside its name, in the header and on the start page. On a narrow screen the header leaves it out, and the start page still shows it.
- Two new commands. `/jared:version` says the version of the plugin, which is the number that the page shows, and the form **Report a problem** now asks for it. `/jared:status` says whether the Jared service is running, since when, and when it ends by itself; asking counts as a use of it, so it puts that end off.
- `/jared:stop` now says how long the service had run.

## 0.12.0 — 2026-10-07

- You can review a commit by its hash: `/jared:review 74664abd` opens the change of that commit as a diff, with its message above it. A hash, an abbreviated hash, a tag, a branch or `HEAD~2` will do; `--rev <commit>` says that a word is a commit even if a file has that name; and a range of commits is not one commit. The plugin looks the commit up in the git repository of the folder your session is in, so it needs git.
- In a diff, the name of a file that has a space and a letter outside ASCII in it is shown as it is. It was shown in quotes, with escapes, and a comment on it named the wrong file.
- The label of the **Delete** button is dark in the dark scheme. It was white on the red, at a contrast of 2.52:1; it is now 7.71:1.
- A button that is on, such as the comments button in the header, no longer looks off while the pointer is over it: it keeps its look, and its border thickens.
- Small changes in size. The small buttons (**Delete** and **Keep** in the delete confirmation, **Comment** in the selection bar) are 28 px high, where they were 26, with a mouse too, so the comment card that holds the confirmation is 2 px taller. The key hints, such as the **C** and **Esc**, are 12 px, where they were 11.

## 0.11.4 — 2026-10-06

- On a phone or a tablet, buttons in Jared are now 44 px high, so that a finger can press them. The header is taller as a result. With a mouse, nothing changes.
- `THIRD-PARTY-NOTICES.md` now links to Jared's own license, `LICENSE`.
- Problems can be reported as an issue on GitHub. The form **Report a problem** asks for what is needed, and the README says how to open it.

## 0.11.3 — 2026-10-06

First public release.

- `/jared:review` opens a source file or a diff in Jared and brings your review back into the session, from the browser pane of the Claude app or from your own browser with **Copy** or **Download**.
- `/jared:stop` stops the small local service that serves Jared to the pane.
- Jared comes with the plugin as one file. It needs no server and no Node.
- The source of that page, without its tests, is in `source/`: you can build it yourself and compare it with the page in the plugin.
- Two plugin settings: the words on the review button (`submit_label`, "Submit review" unless you change it), and the address of a Jared that runs elsewhere (`jared_url`).

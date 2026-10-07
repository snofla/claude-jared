# Changelog

What changed in each release of the Jared plugin, newest first.

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

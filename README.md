# Jared for Claude Code

Jared /ˈdʒær.əd/ is not Gerrit /ˈɡɛr.ɪt/.

Syntax-highlighted, file-based review for Claude.

A Claude Code plugin. It opens a source file, a diff or a commit in Jared, a line-by-line review app, and brings your review back into the session.

## What it looks like

A file in Jared, with two comments. The first has a suggested change.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="screenshots/review-dark.png">
  <img alt="Jared showing retry.ts, a short TypeScript file, with two comments, each under the lines that it is about, the first with a suggested change, and a list of the comments on the right." src="screenshots/review-light.png">
</picture>

A diff is shown as changes. A comment on it says which file it is about, and which lines of the old and the new version.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="screenshots/diff-dark.png">
  <img alt="Jared showing a diff of src/retry.ts, with the removed lines in red, the added lines in green and two comments." src="screenshots/diff-light.png">
</picture>

## Requirements

- Claude Code
- a browser
- `sh` and `perl` (macOS and Linux have both)
- a command that reads the clipboard: `pbpaste` on macOS, `wl-paste` or `xclip` on Linux

## Install

In a terminal, add the marketplace from GitHub, then install the plugin:

```bash
claude plugin marketplace add snofla/claude-jared
claude plugin install jared@claude-jared
```

## Use

In a Claude Code session, give the plugin a source file, a diff or a commit:

```
/jared:review path/to/file.ts
/jared:review 74664abd
```

A commit is opened as its change, with its message above it; the plugin looks it up in the git repository of the folder your session is in.

You can also ask in words: "review `path/to/file.ts` in Jared" or "review commit `74664abd` in Jared".

To see which version of the plugin you have, run `/jared:version`.

Jared opens with your file, in your session's browser if it has one (the browser pane of the Claude app, or Claude in Chrome), and otherwise in your own browser. Write your comments there. How the review comes back depends on which of the two it is.

### In your session's browser

Press **Submit review**. The review goes to the session. If it has not answered in a minute, tell it that you pressed the button.

Your session's browser gets Jared from a small service on your computer. It stops by itself after half an hour without use. To see whether it is running, and when it ends, run `/jared:status`. To stop it sooner, run `/jared:stop`.

### In your own browser

Jared opens from a single file on your computer. It needs no server and no Node.

Press **Export review**, then choose one of two ways:

- **Copy** puts the review on the clipboard. Tell the session that it is there.
- **Download** saves the review as `file.ts.review.json` in your downloads folder. Give the session the path of that file and the path of the source file:

  ```
  /jared:review path/to/file.ts.review.json path/to/file.ts
  ```

### Options

You can add these after the file, the diff or the commit. None is needed.

- `--rev <commit>` says that the word you gave is a commit, even if a file has that name.
- `--jared <address>` says where Jared runs, for this review only; the plugin setting `jared_url` sets it for all. Use it only for a Jared that you run yourself or trust, as for the setting.
- `--via <way>` says how the file gets to Jared and the review comes back. The default, `auto`, takes the first of these that fits:
  - `background`: Jared opens in your session's browser (the browser pane of the Claude app, or Claude in Chrome), and when you press **Submit review** the review comes to the session by itself, if a background command wakes your session.
  - `serve`: the same browser, but you tell the session that you pressed the button.
  - `file`: Jared opens in your own browser, and you copy or download the review.
  - `browser` and `clipboard`: for a Jared that runs somewhere else; they need the plugin setting `jared_url`.

  Name one of them to use that way and no other.
- `--block` waits in place, for a run that cannot end its turn, such as `claude -p`. This plugin does not support it, and says so.
- `--closes moment|now|never` says when Jared's window closes by itself once the review is received: after a moment (the default), at once, or never.
- `--message <words>` sets the words that tell you the review was sent, 1 to 80 characters. The default is "Review sent to Claude."
- `--banner true|false` says whether that message is drawn under the header; a screen reader hears it either way. The default is true.

The last three cannot be used when Jared opens in your own browser, so `auto` does not choose that way when you give one of them.

## Where Jared runs

The plugin carries a copy of Jared, so nothing else needs to run.

To use a Jared that runs somewhere else, set the plugin setting `jared_url` ("Where Jared runs") to its address. The plugin then opens your file there, for a file of up to about 75 KB. Set it only for a Jared that you run yourself or trust, because the page at that address receives the file that you review.

## Update

In a terminal, update the marketplace and then the plugin, and restart Claude Code:

```bash
claude plugin marketplace update claude-jared
claude plugin update jared@claude-jared
```

What changed in each version is in [CHANGELOG.md](CHANGELOG.md).

## Remove

In a terminal, remove the plugin and then the marketplace:

```bash
claude plugin uninstall jared@claude-jared
claude plugin marketplace remove claude-jared
```

## Source

The copy of Jared in `claude-plugin/app/jared.html` is built from the files in `source/`, so you can build it yourself and compare. You need Node 26 or newer and npm.

```bash
cd source
npm ci
npm run build:single
shasum -a 256 dist-single/jared.html ../claude-plugin/app/jared.html
```

The last command prints one checksum for each file, and the two should be the same. (On Linux, `sha256sum` does the same as `shasum -a 256`.)

Only `npm run build:single` works in `source/`: the tests and the other scripts of `package.json` are not in this repository.

GitHub makes the same comparison on every push to `main`, and shows the result:

[![Page checksum](https://github.com/snofla/claude-jared/actions/workflows/verify.yml/badge.svg?branch=main)](https://github.com/snofla/claude-jared/actions/workflows/verify.yml)

This repository is made by a script from the repository where Jared is developed. Every release is published from there, and never from this repository.

## Problems and changes

To report a problem, [open an issue](https://github.com/snofla/claude-jared/issues/new/choose) on GitHub and choose **Report a problem**. Issues are public: do not paste private code or secrets. An issue does not promise an answer, a time or a fix.

Patches are welcome. A patch that is accepted is merged here and into the repository where Jared is developed, so it stays in the releases that follow.

## License

The plugin and the source of its page are under the MIT license: see [LICENSE](LICENSE). The copy of Jared that it carries contains third-party code and data under their own licenses: see [claude-plugin/THIRD-PARTY-NOTICES.md](claude-plugin/THIRD-PARTY-NOTICES.md).

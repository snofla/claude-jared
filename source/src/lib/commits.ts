import { diffOf } from './diff.ts'
import { DIFF_LANGUAGE } from './language.ts'

/**
 * A review of a branch is a set of files in which every text is one commit: a diff whose head says which commit it is, so that the page needs no field of
 * the review to know. The head is the one that the plugin's helper, `jared-link`, writes: a line `commit` and the whole hash, `Author:` and the author's name, `Date:` and the
 * author's date in strict ISO form, an empty line, the message with every line indented by four spaces, as `git log` shows it, and the diff, which begins at its
 * first `diff --git` line. The indent is what keeps the lines of a message, a quoted patch among them, from being taken for the diff. A text with any other head is a
 * file, and nothing here ever fails: `null` and the list of files are the answers to what cannot be read.
 */

export interface Commit {
  /** The whole hash: 40 hexadecimal digits, or 64 in a repository that hashes with SHA-256. */
  hash: string
  /** The author's name as the head gives it, with no address. */
  author: string
  /** The author's date as the head gives it: ISO 8601 with the author's own offset, such as `2026-10-28T10:04:00+01:00`. */
  date: string
  /** The whole message, without the blank lines and spaces round it. */
  message: string
  /** The first line of the message. */
  subject: string
}

const HASH = /^commit ([0-9a-f]{40}|[0-9a-f]{64})$/
const AUTHOR = /^Author:(?: (.*))?$/
const DATE = /^Date: (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))$/
/**
 * How far every line of a commit's message is indented in its text: four spaces, as `git log` shows a message. With the indent, no line of a message, a quoted
 * patch among them, can be taken for the start of the diff. It must match the indent that the plugin's helper, `jared-link`, asks git for, `%w(0,4,4)%B`, whose
 * last two numbers are these four spaces: when one changes, so must the other. A blank line of a message may come as these spaces or as nothing, and either is read.
 */
const INDENT = '    '

/**
 * The commit that a text is, from its lines, or `null` when its head cannot be read: that is a file. A date must be one that JavaScript reads as well as look like one.
 * The message is the run of lines after the head's empty line that are empty or begin with four spaces; the four spaces are taken off, so a blank line of a
 * message may be written either way. It ends at the first line that is neither, which is where the diff begins, or at the end of the text. A commit with no diff,
 * or with one that has no hunk (an empty commit, a binary file only), is still a commit: the page draws it as text.
 */
export function readCommit(lines: readonly string[]): Commit | null {
  const hash = HASH.exec(lines[0] ?? '')
  const author = AUTHOR.exec(lines[1] ?? '')
  const date = DATE.exec(lines[2] ?? '')
  if (!hash || !author || !date || Number.isNaN(Date.parse(date[1])) || lines[3] !== '') return null
  let end = 4
  while (end < lines.length && (lines[end] === '' || lines[end].startsWith(INDENT))) end++
  const message = lines
    .slice(4, end)
    .map((line) => line.slice(INDENT.length))
    .join('\n')
    .trim()
  return { hash: hash[1], author: (author[1] ?? '').trim(), date: date[1], message, subject: message.split('\n', 1)[0] }
}

/** The first seven characters of a hash, which is how a commit is named to the reviewer and to Claude. */
export const shortHash = (hash: string): string => hash.slice(0, 7)

/** The day of a commit as the list shows it, read from the date as the author wrote it, so that the reviewer's time zone does not move it to the day before or after: `28 Oct`. */
export function commitDay(date: string): string {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** What the list beside the code is a list of. */
export type ListKind = 'files' | 'commits'

/**
 * The commits of a set, in the set's order, when every text of it is a commit; `null` otherwise. A review of one text is never a list of commits, since a
 * branch of one commit opens as one diff, and a set with one text that is not a commit is a list of files, whatever the others are.
 */
export function commitsOf(texts: ReadonlyArray<{ lines: readonly string[] }>): Commit[] | null {
  if (texts.length < 2) return null
  const commits = texts.map((text) => readCommit(text.lines))
  return commits.every((commit): commit is Commit => commit !== null) ? commits : null
}

/** The commits of a set by the id of the text that holds each, when every text is one; `undefined` otherwise, as for `commitsOf`. */
export function commitHeads(texts: ReadonlyArray<{ id: string; lines: readonly string[] }>): ReadonlyMap<string, Commit> | undefined {
  const commits = commitsOf(texts)
  return commits ? new Map(texts.map((text, place) => [text.id, commits[place]])) : undefined
}

/** What the pane lists for these texts, which is all that the page asks of them. */
export const listKind = (texts: ReadonlyArray<{ lines: readonly string[] }>): ListKind => (commitsOf(texts) === null ? 'files' : 'commits')

/** The order that the commits are listed in: the branch's own, in which its commits apply (not always the order of their dates), or its reverse. */
export type CommitOrder = 'branch' | 'reverse'

/**
 * The places in the set of `count` commits, in the order that the list shows them from the top. They are places and not copies, so that a commit's mark, its
 * count and its being chosen stay with it when the order changes.
 */
export function commitPlaces(count: number, order: CommitOrder): number[] {
  const places = Array.from({ length: count }, (_, place) => place)
  return order === 'reverse' ? places.reverse() : places
}

/** The other order. */
export const otherOrder = (order: CommitOrder): CommitOrder => (order === 'branch' ? 'reverse' : 'branch')

/**
 * The paths of the files that a commit's text changes, as its diff names them, and the old path of a file that was renamed; none for a commit with no hunk, which
 * the page draws as text and lists no files for.
 */
export function commitPaths(lines: readonly string[]): string[] {
  const files = diffOf(DIFF_LANGUAGE, lines)?.files ?? []
  return files.flatMap((file) => (file.oldPath !== null && file.oldPath !== file.path ? [file.path, file.oldPath] : [file.path]))
}

/** The lines that a commit's text adds and removes, in all its files; none for a commit with no hunk, which the page draws as text. */
export function commitStats(lines: readonly string[]): { added: number; deleted: number } {
  let added = 0
  let deleted = 0
  for (const row of diffOf(DIFF_LANGUAGE, lines)?.rows ?? []) {
    if (row.kind === 'add') added++
    else if (row.kind === 'del') deleted++
  }
  return { added, deleted }
}

/** A commit and the paths of its files, which is what the filter looks at. */
export interface CommitEntry {
  commit: Commit
  paths: readonly string[]
}

/**
 * The places of the commits that the query matches, without regard to case and with the spaces round it left out; every place for an empty query.
 * A commit matches when its message or its author holds the query, when a path of its files does, or when its hash begins with it, as git takes a hash from its
 * first characters. They are places, as `matchingFiles` gives them.
 */
export function matchingCommits(entries: readonly CommitEntry[], query: string): number[] {
  const wanted = query.trim().toLowerCase()
  const holds = (text: string) => text.toLowerCase().includes(wanted)
  return entries.flatMap(({ commit, paths }, place) => (commit.hash.startsWith(wanted) || holds(commit.message) || holds(commit.author) || paths.some(holds) ? [place] : []))
}

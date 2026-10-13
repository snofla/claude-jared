import type { ReviewComment } from '../types.ts'
import type { ParsedDiff } from './diff.ts'
import { diffEntries, ONLY_TEXT, type FileEntry } from './review-files.ts'

/**
 * The files of a review as the list beside the code shows them: one entry for each file of a diff, in the order of the diff. A review of one file
 * has none, and the page draws no list. The entry does not depend on where it came from, so that a list of files that are not a diff
 * can be shown by the same pane.
 */

export type { FileEntry, FileLetter } from './review-files.ts'

/** One entry for each file of the diff; none when the text is not a diff. */
export function fileEntries(diff: ParsedDiff | null): FileEntry[] {
  return diff ? diffEntries(diff, ONLY_TEXT) : []
}

/** Whether the page draws a list of files at all: one file needs none. */
export const hasFileList = (entries: readonly FileEntry[]): boolean => entries.length > 1

/** The index of the file that line `line` is in; -1 for a line above the first file. */
export function fileAt(entries: readonly FileEntry[], line: number): number {
  let found = -1
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].startRow <= line) found = i
    else break
  }
  return found
}

/** The index that a step of `delta` from `from` lands on, kept inside the list; from above the first file a step forward lands on the first, and in an empty list there is none (-1). */
export function stepFile(count: number, from: number, delta: 1 | -1): number {
  return Math.min(count - 1, Math.max(0, from + delta))
}

/** How many comments each file has: a comment is on the file that its first line is in. */
export function commentCounts(entries: readonly FileEntry[], comments: readonly ReviewComment[]): number[] {
  const counts = entries.map(() => 0)
  for (const comment of comments) {
    const i = fileAt(entries, comment.startLine)
    if (i >= 0) counts[i] += 1
  }
  return counts
}

/** The files, and the lines added and removed, over the whole diff. */
export function totals(entries: readonly FileEntry[]): { files: number; added: number; deleted: number } {
  return {
    files: entries.length,
    added: entries.reduce((n, e) => n + (e.added ?? 0), 0),
    deleted: entries.reduce((n, e) => n + (e.deleted ?? 0), 0),
  }
}

/** The set with `id` in it if it was not, and without it if it was; the set that came in is not changed. */
export function toggled(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

/** How many of the entries are marked: marks for files that are no longer in the list (a diff that changed under the mark) are not counted. */
export const viewedCount = (viewed: ReadonlySet<string>, entries: readonly FileEntry[]): number => entries.filter((e) => viewed.has(e.id)).length

/** How the list is shown when the reviewer has not chosen: open when the window is wide enough for three columns of a useful width, a rail when it is not, and closed below the width at which the comments panel is a drawer too. */
export type FilesMode = 'open' | 'rail' | 'closed'

export const autoFilesMode = (fromOpenWidth: boolean, fromRailWidth: boolean): FilesMode => (fromOpenWidth ? 'open' : fromRailWidth ? 'rail' : 'closed')

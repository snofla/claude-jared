import type { FileStatus, ParsedDiff } from './diff.ts'

/**
 * The entries of the list of files beside the code. An entry does not depend on where it came from, so that one list can show a diff, a set of plain
 * files and a set that has a diff in it: `diffEntries` makes the entries of the files of a diff, and `setEntries` those of a set.
 */

export type FileLetter = 'A' | 'M' | 'D' | 'R'

export interface FileEntry {
  /** What names the entry and never changes for it: a plain file's id is its text's, a file of a diff is `<text id>::<path>`. */
  id: string
  path: string
  /** What happened to the file, as a letter; `null` for a plain file. */
  status: FileLetter | null
  /** The lines added and removed; `null` for a plain file. */
  added: number | null
  deleted: number | null
  /** How many lines the entry has in its text: for a file of a diff, its rows from its header to its last. */
  lineCount: number
  language: string
  /** The row where the entry begins: for a file of a diff, its header row in its text; for a file of a set, its header row in the set's rows. */
  startRow: number
  /** The id of the text the entry lives in: "f1" for a review of one file, and the file's id in a set. */
  textId: string
}

/** The id of the one text of a review of one file. */
export const ONLY_TEXT = 'f1'

const LETTER: Record<FileStatus, FileLetter> = { modified: 'M', added: 'A', deleted: 'D', renamed: 'R' }

/** One entry for each file of a parsed diff that lives in the text `textId`, in the order of the diff. */
export function diffEntries(parsed: ParsedDiff, textId: string): FileEntry[] {
  const added = parsed.files.map(() => 0)
  const deleted = parsed.files.map(() => 0)
  for (const row of parsed.rows) {
    if (row.file < 0) continue
    if (row.kind === 'add') added[row.file] += 1
    else if (row.kind === 'del') deleted[row.file] += 1
  }
  return parsed.files.map((file, i) => ({
    id: `${textId}::${file.path}`,
    path: file.path,
    status: LETTER[file.status],
    added: added[i],
    deleted: deleted[i],
    lineCount: file.last - file.first + 1,
    language: file.language,
    startRow: file.first,
    textId,
  }))
}

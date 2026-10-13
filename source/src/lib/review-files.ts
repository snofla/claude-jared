import type { Review, ReviewComment, SetReview } from '../types.ts'
import { diffOf, type FileStatus, type ParsedDiff } from './diff.ts'

/**
 * The files of a review as the list beside the code shows them. A review is made of texts: one for a review of one file (a source file or a
 * diff), one for each file of a set. A text that is a diff has a file for each file of the diff, so a review has an entry for each of those and
 * for each plain file. The entry does not depend on where it came from, so that one list can show a diff, a set of plain files and a set that
 * has a diff in it.
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
  /** The first line of the entry in its text: 1 for a plain file, and for a file of a diff its header row. */
  startRow: number
  /** The id of the text the entry lives in: "f1" for a review of one file, and the file's id in a set. */
  textId: string
}

/** A text of a review as the entries are made from it: a file's name, the language it is shown as and its lines. */
export interface ReviewText {
  name: string
  language: string
  lines: readonly string[]
}

/** The id of the one text of a review of one file. */
export const ONLY_TEXT = 'f1'

const LETTER: Record<FileStatus, FileLetter> = { modified: 'M', added: 'A', deleted: 'D', renamed: 'R' }

const isSet = (review: Review | SetReview | null): review is SetReview => review?.version === 2

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

/**
 * One entry for each plain file and each file of a diff, in the order of the texts and, within a diff, of the diff. `texts` are in the order of the
 * review's files; a set gives each its id (by position, as `newSetReview` does) and a review of one file has the one text "f1". A text whose language
 * is `diff` but that has no hunk is a plain file.
 */
export function reviewFiles(texts: readonly ReviewText[], review: Review | SetReview | null): FileEntry[] {
  return texts.flatMap((text, index): FileEntry[] => {
    const textId = isSet(review) ? (review.files[index]?.id ?? `f${index + 1}`) : ONLY_TEXT
    const parsed = diffOf(text.language, text.lines)
    if (!parsed) {
      return [{ id: textId, path: text.name, status: null, added: null, deleted: null, lineCount: text.lines.length, language: text.language, startRow: 1, textId }]
    }
    return diffEntries(parsed, textId)
  })
}

/** The id of the entry that a comment belongs to: its file for a plain file, and `<file>::<path>` for a comment on a file of a diff. */
export function entryIdOf(comment: Pick<ReviewComment, 'file' | 'place'>): string {
  const text = comment.file ?? ONLY_TEXT
  return comment.place ? `${text}::${comment.place.path}` : text
}

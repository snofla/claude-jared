import type { LineRange, LineSelection, ReviewComment } from '../types.ts'
import type { FileEntry } from './files.ts'

/**
 * A review of several files drawn as one list of rows: a header row for each file, then the file's own lines. The viewer, the selection and the
 * comment bars all work in rows of that list; a file's lines keep their own numbers (in the gutter and in the saved comment), and this is the one
 * place that knows how a row and a line of a file stand for each other.
 */

/** A comment of a set names its file: `ReviewComment` has the same optional field once the format of several files is on this branch. */
export type SetComment = ReviewComment & {
  file?: string
  /** Set on a comment that `viewComments` has put in rows: what the comment is called, with the file and the lines of that file, since its own lines are rows. */
  viewLabel?: string
}

/** A file of the set as the viewer is given it. */
export interface SetText {
  /** The id of the file in the review: "f1", "f2" and so on. A comment names its file by it. */
  id: string
  name: string
  language: string
  lines: readonly string[]
}

export interface SetRow {
  /** The index of the file in the set. */
  file: number
  /** The line of the file's text; `null` for the file's header row. */
  line: number | null
}

export interface SetLayout {
  texts: readonly SetText[]
  /** `rows[n - 1]` is row n. */
  rows: readonly SetRow[]
  /** The row of each file's header. */
  headers: readonly number[]
  /** The row of each file's last line; the header's row for a file with no lines. */
  lasts: readonly number[]
}

export function setLayout(texts: readonly SetText[]): SetLayout {
  const rows: SetRow[] = []
  const headers: number[] = []
  const lasts: number[] = []
  texts.forEach((text, file) => {
    rows.push({ file, line: null })
    headers.push(rows.length)
    for (let line = 1; line <= text.lines.length; line++) rows.push({ file, line })
    lasts.push(rows.length)
  })
  return { texts, rows, headers, lasts }
}

/** The text that row `row` shows: a file's name for its header, and the line for a line. */
export function textOfRow(layout: SetLayout, row: number): string {
  const place = layout.rows[row - 1]
  if (!place) return ''
  const text = layout.texts[place.file]
  return place.line === null ? text.name : text.lines[place.line - 1]
}

/** The row that line `line` of file `file` is drawn on; `null` for a file or a line that the set does not have. */
export function rowOfLine(layout: SetLayout, file: number, line: number): number | null {
  const header = layout.headers[file]
  if (header === undefined || line < 1 || line > layout.texts[file].lines.length) return null
  return header + line
}

/** The file that a row is in, and the line of it that the row is; `null` for a row that is not in the set. The line is `null` on a file's header. */
export function placeOfRow(layout: SetLayout, row: number): SetRow | null {
  return layout.rows[row - 1] ?? null
}

/** The first and the last row of the file that `row` is in, its header included. */
export function fileBounds(layout: SetLayout, row: number): LineRange {
  const place = layout.rows[row - 1]
  if (!place) return { start: row, end: row }
  return { start: layout.headers[place.file], end: layout.lasts[place.file] }
}

/** Whether the rows `start` to `end` are in one file. */
export function inOneFile(layout: SetLayout, start: number, end: number): boolean {
  const a = layout.rows[start - 1]
  const b = layout.rows[end - 1]
  return !!a && !!b && a.file === b.file
}

/** The selection kept inside the file that it began in, and off the headers, which have no line to comment on: the end that crossed is held at the file's edge. */
export function clampToFile(layout: SetLayout, selection: LineSelection): LineSelection {
  const { start, end } = fileBounds(layout, selection.anchor)
  const first = layout.rows[start - 1]?.line === null ? start + 1 : start
  const inside = (row: number) => Math.min(end, Math.max(first, row))
  return { anchor: inside(selection.anchor), focus: inside(selection.focus) }
}

/** What a comment made on rows `start` to `end` is saved with: its file's id and the lines of that file. `null` for rows that cross files or that are a header. */
export function savedPlace(layout: SetLayout, start: number, end: number): { file: string; startLine: number; endLine: number } | null {
  const a = layout.rows[start - 1]
  const b = layout.rows[end - 1]
  if (!a || !b || a.file !== b.file || a.line === null || b.line === null) return null
  return { file: layout.texts[a.file].id, startLine: a.line, endLine: b.line }
}

/**
 * The comments as the viewer draws them: the ones on files of the set, with their lines replaced by the rows that those lines are on. A comment on a
 * file that the set does not have, or on a line the file does not have, is left out.
 */
export function viewComments(layout: SetLayout, comments: readonly SetComment[]): SetComment[] {
  const byId = new Map(layout.texts.map((text, index) => [text.id, index]))
  return comments.flatMap((comment) => {
    const file = byId.get(comment.file ?? '')
    if (file === undefined) return []
    const startLine = rowOfLine(layout, file, comment.startLine)
    const endLine = rowOfLine(layout, file, comment.endLine)
    if (startLine === null || endLine === null) return []
    return [{ ...comment, startLine, endLine, viewLabel: labelOfLines(layout.texts[file].name, comment.startLine, comment.endLine) }]
  })
}

/** What lines `start` to `end` of a file are called: its name and the lines, as "a.ts · lines 3–5". */
const labelOfLines = (name: string, start: number, end: number): string => `${name} · ${start === end ? `line ${start}` : `lines ${start}–${end}`}`

/** What rows `start` to `end` are called: the file and its lines; for rows in two files, or on a header, the file that `start` is in, or nothing if it is in none. */
export function setRangeLabel(layout: SetLayout, start: number, end: number): string {
  const a = layout.rows[start - 1]
  const b = layout.rows[end - 1]
  if (!a) return ''
  const name = layout.texts[a.file].name
  if (a.line === null || !b || b.file !== a.file || b.line === null) return name
  return labelOfLines(name, a.line, b.line)
}

/**
 * The entries of the Files pane for a set: one for each file, which begins on the file's header row. A file that is a diff is one entry too: it is drawn
 * as text, with the colours of its language, and not as a diff.
 */
export function setEntries(layout: SetLayout): FileEntry[] {
  return layout.texts.map((text, file) => ({
    id: text.id,
    path: text.name,
    status: null,
    added: null,
    deleted: null,
    lineCount: text.lines.length,
    language: text.language,
    startRow: layout.headers[file],
    textId: text.id,
  }))
}

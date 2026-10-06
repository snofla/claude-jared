import type { DiffPlace, LineRange, LineSelection } from '../types.ts'
import type { LineTokens } from './highlight.ts'
import { DIFF_LANGUAGE, detectLanguage, PLAIN_TEXT } from './language.ts'
import { clamp } from './util.ts'

/**
 * A unified diff, the text `git diff` and `diff -u` write, read as rows. Every line of the text is one row, so row n is line n
 * of the text and the selection, the comments and the engine's line numbers need no other numbering. A row says what the line
 * is (a file's header, a hunk's header, an added line, …) and which file, which hunk and which lines of the old and the new
 * file it stands for.
 */

export type RowKind =
  | 'file' // the line that begins a file: `diff --git a/x b/x`, or the `---` line of a plain diff
  | 'meta' // any other line outside a hunk: `index`, modes, `rename`, `---`/`+++`, `Binary files`, text before the first file
  | 'hunk' // `@@ -a,b +c,d @@ heading`
  | 'context'
  | 'add'
  | 'del'
  | 'note' // `\ No newline at end of file`

export interface DiffRow {
  kind: RowKind
  /** The line's number in the old file: unchanged and removed lines. */
  oldNo: number | null
  /** The line's number in the new file: unchanged and added lines. */
  newNo: number | null
  /** Index into `files`; -1 for the text before the first file. */
  file: number
  /** The hunk's number, counted over the whole diff from 0; -1 outside a hunk. */
  hunk: number
}

export type FileStatus = 'modified' | 'added' | 'deleted' | 'renamed'

export interface DiffFile {
  /** The path as shown: the new one, or the old one of a deleted file; empty when the diff names none. */
  path: string
  oldPath: string | null
  newPath: string | null
  status: FileStatus
  binary: boolean
  /** The first and the last row of the file, as line numbers. */
  first: number
  last: number
  /** The language of `path`, which the lines of its hunks are coloured as. */
  language: string
}

export interface ParsedDiff {
  /** `rows[n - 1]` is line n. */
  rows: DiffRow[]
  files: DiffFile[]
  hunks: number
}

const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

/** What the first line of a text that is a diff is like, whatever may come before the diff proper (`git show`, `git format-patch`). */
const DIFF_START = /^(diff |Index: |--- |From [0-9a-f]{7,} |commit [0-9a-f]{7,})/

const isGitPath = (path: string, prefix: string): boolean => path.startsWith(prefix)

/** A path as the diff writes it: without the quotes git puts round a name with unusual characters, and without a trailing time. */
export function unquotePath(raw: string): string {
  if (!(raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"'))) return raw.split('\t')[0]
  const bytes: number[] = []
  const body = raw.slice(1, -1)
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (c !== '\\') {
      bytes.push(...new TextEncoder().encode(c))
      continue
    }
    const octal = /^[0-3][0-7]{2}/.exec(body.slice(i + 1))
    if (octal) {
      bytes.push(parseInt(octal[0], 8))
      i += 3
      continue
    }
    const next = body[++i]
    bytes.push(...new TextEncoder().encode(next === 't' ? '\t' : next === 'n' ? '\n' : next))
  }
  return new TextDecoder().decode(new Uint8Array(bytes))
}

/** What is known of a file while its header is read. */
interface Builder {
  git: boolean
  first: number
  headerLine: string
  minus: string | null
  plus: string | null
  renameFrom: string | null
  renameTo: string | null
  added: boolean
  deleted: boolean
  binary: boolean
}

const newBuilder = (git: boolean, first: number, headerLine: string): Builder => ({
  git,
  first,
  headerLine,
  minus: null,
  plus: null,
  renameFrom: null,
  renameTo: null,
  added: false,
  deleted: false,
  binary: false,
})

/** The two paths of a `diff --git a/x b/y` line, which is all there is to go on for a change that has no `---` and `+++` lines. */
function pathsOfGitLine(rest: string): [string, string] {
  // With no rename both paths are the same, so the line is two equal halves round a space.
  const mid = (rest.length - 1) / 2
  if (Number.isInteger(mid) && rest[mid] === ' ') {
    const [a, b] = [rest.slice(0, mid), rest.slice(mid + 1)]
    if (a.slice(2) === b.slice(2)) return [a, b]
  }
  const m = /^(\S+) (\S+)$/.exec(rest)
  return m ? [m[1], m[2]] : [rest, rest]
}

function finish(b: Builder, last: number): DiffFile {
  const strip = (path: string, prefix: string): string | null => {
    const plain = unquotePath(path)
    if (plain === '/dev/null') return null
    return b.git && isGitPath(plain, prefix) ? plain.slice(prefix.length) : plain
  }
  let oldPath: string | null
  let newPath: string | null
  if (b.minus !== null && b.plus !== null) {
    oldPath = strip(b.minus, 'a/')
    newPath = strip(b.plus, 'b/')
  } else if (b.renameFrom !== null && b.renameTo !== null) {
    oldPath = b.renameFrom
    newPath = b.renameTo
  } else {
    // A change with no `---` and `+++` lines (a mode, a binary file) is named only by the first line, and a bare hunk by nothing.
    const named = b.headerLine.startsWith('diff --git ') ? pathsOfGitLine(b.headerLine.slice('diff --git '.length)) : null
    oldPath = named === null || b.added ? null : strip(named[0], 'a/')
    newPath = named === null || b.deleted ? null : strip(named[1], 'b/')
  }
  // Two different names in a plain diff are two files that are compared, not a rename; only git says that a file was renamed.
  const renamed = b.git && oldPath !== newPath
  const status: FileStatus = oldPath === null && newPath === null ? 'modified' : oldPath === null ? 'added' : newPath === null ? 'deleted' : renamed ? 'renamed' : 'modified'
  const path = newPath ?? oldPath ?? ''
  return { path, oldPath, newPath, status, binary: b.binary, first: b.first, last, language: path === '' ? PLAIN_TEXT : detectLanguage(path) }
}

/** The rows of a unified diff, or `null` when the text has no hunk in it. */
export function parseDiff(lines: readonly string[]): ParsedDiff | null {
  const rows: DiffRow[] = []
  const builders: Builder[] = []
  let hunk = -1
  let oldLeft = 0
  let newLeft = 0
  let oldNo = 0
  let newNo = 0
  let header = false // between a file's first line and its first hunk

  const current = (): Builder | undefined => builders[builders.length - 1]
  const push = (kind: RowKind, o: number | null = null, n: number | null = null): void => {
    rows.push({ kind, oldNo: o, newNo: n, file: builders.length - 1, hunk: kind === 'meta' || kind === 'file' ? -1 : hunk })
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const first = line[0]
    const previous = rows[rows.length - 1]?.kind

    // The note that a line has no newline at its end comes after that line, in the hunk or just after the end of it.
    if (first === '\\' && (previous === 'context' || previous === 'add' || previous === 'del')) {
      push('note')
      continue
    }

    // Inside a hunk the counts in its header say where it ends, so a removed line that begins `--` is not a header.
    if (oldLeft > 0 || newLeft > 0) {
      if ((first === ' ' || first === undefined) && oldLeft > 0 && newLeft > 0) {
        push('context', oldNo++, newNo++)
        oldLeft--
        newLeft--
        continue
      }
      if (first === '+' && newLeft > 0) {
        push('add', null, newNo++)
        newLeft--
        continue
      }
      if (first === '-' && oldLeft > 0) {
        push('del', oldNo++, null)
        oldLeft--
        continue
      }
      oldLeft = 0 // not a line of the hunk, so the hunk is shorter than its header says
      newLeft = 0
    }

    const hunkHeader = HUNK.exec(line)
    if (hunkHeader) {
      if (!current()) builders.push(newBuilder(false, i + 1, ''))
      header = false
      hunk++
      oldNo = Number(hunkHeader[1])
      newNo = Number(hunkHeader[3])
      oldLeft = hunkHeader[2] === undefined ? 1 : Number(hunkHeader[2])
      newLeft = hunkHeader[4] === undefined ? 1 : Number(hunkHeader[4])
      push('hunk')
      continue
    }

    if (line.startsWith('diff --git ')) {
      builders.push(newBuilder(true, i + 1, line))
      header = true
      push('file')
      continue
    }

    if (line.startsWith('--- ') && (lines[i + 1] ?? '').startsWith('+++ ')) {
      const b = current()
      if (header && b && b.minus === null) {
        b.minus = line.slice(4)
        push('meta')
      } else {
        const fresh = newBuilder(false, i + 1, '')
        fresh.minus = line.slice(4)
        builders.push(fresh)
        header = true
        push('file')
      }
      continue
    }

    const b = current()
    if (header && b) {
      if (line.startsWith('+++ ') && b.minus !== null && b.plus === null) b.plus = line.slice(4)
      else if (line.startsWith('new file mode')) b.added = true
      else if (line.startsWith('deleted file mode')) b.deleted = true
      else if (line.startsWith('rename from ')) b.renameFrom = line.slice('rename from '.length)
      else if (line.startsWith('rename to ')) b.renameTo = line.slice('rename to '.length)
      else if (line.startsWith('Binary files ') || line.startsWith('GIT binary patch')) b.binary = true
    }
    push('meta')
  }

  if (hunk < 0) return null
  const files = builders.map((b, k) => finish(b, k + 1 < builders.length ? builders[k + 1].first - 1 : lines.length))
  return { rows, files, hunks: hunk + 1 }
}

/** Whether a text is a diff by what it begins with and what it holds, for a text whose name gives no language. */
export function looksLikeDiff(lines: readonly string[]): boolean {
  return DIFF_START.test(lines[0] ?? '') && parseDiff(lines) !== null
}

const parsed = new WeakMap<readonly string[], ParsedDiff | null>()

/** The diff that the lines of a text of this language are, or `null` when the text is not shown as one. Kept for as long as the array of lines is. */
export function diffOf(language: string, lines: readonly string[]): ParsedDiff | null {
  if (language !== DIFF_LANGUAGE) return null
  if (!parsed.has(lines)) parsed.set(lines, parseDiff(lines))
  return parsed.get(lines)!
}

/** A line of a hunk without the `+`, `-` or space that begins it: the code itself. Other lines are as written. */
export function bodyOf(line: string, kind: RowKind): string {
  return kind === 'context' || kind === 'add' || kind === 'del' ? line.slice(1) : line
}

/** The sign a row is drawn with in front of its code. */
export function signOf(kind: RowKind): string {
  return kind === 'add' ? '+' : kind === 'del' ? '−' : ''
}

// ---- where a comment is ------------------------------------------------------------------------------------------------------

/** The first and the last row of the file that row `row` is in, or of the text before the first file. */
export function fileBounds(diff: ParsedDiff, row: number): LineRange {
  const index = diff.rows[row - 1]?.file ?? -1
  if (index >= 0) return { start: diff.files[index].first, end: diff.files[index].last }
  return { start: 1, end: diff.files[0].first - 1 }
}

/** Whether rows `start` to `end` are all in one file, which a comment must be. */
export function inOneFile(diff: ParsedDiff, start: number, end: number): boolean {
  return diff.rows[start - 1]?.file === diff.rows[end - 1]?.file
}

/** A selection whose end has been dragged or extended into another file, taken back to the last row of the file it began in. */
export function clampToFile(diff: ParsedDiff, selection: LineSelection): LineSelection {
  if (!diff.rows[selection.anchor - 1]) return selection
  const { start, end } = fileBounds(diff, selection.anchor)
  const focus = clamp(selection.focus, start, end)
  return focus === selection.focus ? selection : { anchor: selection.anchor, focus }
}

const span = (numbers: number[]): LineRange | null => (numbers.length === 0 ? null : { start: Math.min(...numbers), end: Math.max(...numbers) })

/**
 * The file and the lines of the old and the new file that rows `range` stand for. Only the side the rows are on is given: added
 * lines (with unchanged ones among them) give the new file's lines, removed ones the old file's, both kinds give both, and
 * unchanged lines alone give the new file's, as the hosting sites do. Headers alone give no lines. `null` for rows outside the
 * diff, or in more than one file.
 */
export function placeOf(diff: ParsedDiff, range: LineRange): DiffPlace | null {
  const chosen = diff.rows.slice(range.start - 1, range.end)
  if (chosen.length === 0 || !inOneFile(diff, range.start, range.end)) return null
  const has = (kind: RowKind): boolean => chosen.some((r) => r.kind === kind)
  const oldRows = chosen.filter((r) => r.kind === 'del' || r.kind === 'context')
  const newRows = chosen.filter((r) => r.kind === 'add' || r.kind === 'context')
  const withOld = has('del')
  const withNew = has('add') || !withOld
  const index = chosen[0].file
  return {
    path: index >= 0 ? diff.files[index].path : '',
    old: withOld ? span(oldRows.map((r) => r.oldNo!)) : null,
    new: withNew ? span(newRows.map((r) => r.newNo!)) : null,
  }
}

const linesText = (word: string, r: LineRange | null): string | null =>
  r === null ? null : r.start === r.end ? `${word} line ${r.start}` : `${word} lines ${r.start}–${r.end}`

/** A place in two parts, for a reader to lay out: the path, and which lines (`header` for rows with no lines of a file). */
export function placeParts(place: DiffPlace): { path: string; where: string } {
  const where = [linesText('old', place.old), linesText('new', place.new)].filter((part) => part !== null).join(', ')
  return { path: place.path, where: where === '' ? 'header' : where }
}

export function placeLabel(place: DiffPlace): string {
  const { path, where } = placeParts(place)
  return path === '' ? where : `${path} · ${where}`
}

/** What a row is called to someone who cannot see it: for the name of its button. */
export function rowName(row: Pick<DiffRow, 'kind' | 'oldNo' | 'newNo'>): string {
  switch (row.kind) {
    case 'add':
      return `added line ${row.newNo}`
    case 'del':
      return `removed line ${row.oldNo}`
    case 'context':
      return `line ${row.newNo}`
    case 'hunk':
      return 'the hunk header'
    case 'file':
      return 'the file header'
    default:
      return 'this line'
  }
}

/** What a file's header row says: its path, and for a renamed file both of its paths. */
export function fileTitle(file: DiffFile): string {
  if (file.status === 'renamed') return `${file.oldPath} → ${file.newPath}`
  return file.path === '' ? 'Changes' : file.path
}

/** A word for what happened to a file, when it is not just changed. */
export function fileBadge(file: DiffFile): string | null {
  if (file.binary) return 'binary'
  return file.status === 'added' ? 'new file' : file.status === 'deleted' ? 'deleted' : file.status === 'renamed' ? 'renamed' : null
}

// ---- colouring ----------------------------------------------------------------------------------------------------------------

/**
 * One piece of a diff to colour as code of its own: one side of one hunk. The new side is the hunk's unchanged and added rows, the
 * old side its unchanged and removed rows. A hunk shows only part of its file, so a piece is coloured alone, as the language of
 * the file, and is wrong only where the hunk begins inside something that began above it.
 */
export interface HighlightJob {
  language: string
  side: 'old' | 'new'
  text: string
  /** The row (as a line number) that each line of `text` belongs to. */
  rows: number[]
}

export function highlightJobs(diff: ParsedDiff, lines: readonly string[]): HighlightJob[] {
  const byHunk = new Map<number, number[]>()
  diff.rows.forEach((row, i) => {
    if (row.kind !== 'context' && row.kind !== 'add' && row.kind !== 'del') return
    const rows = byHunk.get(row.hunk)
    if (rows) rows.push(i + 1)
    else byHunk.set(row.hunk, [i + 1])
  })

  const jobs: HighlightJob[] = []
  for (const hunkRows of byHunk.values()) {
    const language = diff.files[diff.rows[hunkRows[0] - 1].file].language
    if (language === PLAIN_TEXT) continue
    for (const side of ['new', 'old'] as const) {
      const other = side === 'new' ? 'del' : 'add'
      // With nothing removed the old side is the unchanged rows again, which the new side has already.
      if (side === 'old' && !hunkRows.some((n) => diff.rows[n - 1].kind === 'del')) continue
      const rows = hunkRows.filter((n) => diff.rows[n - 1].kind !== other)
      if (rows.length === 0) continue
      jobs.push({ language, side, text: rows.map((n) => bodyOf(lines[n - 1], diff.rows[n - 1].kind)).join('\n'), rows })
    }
  }
  return jobs
}

/** The colours of each row, put back from what the jobs gave: unchanged and added rows take the new side's, removed rows the old side's. `null` where a job failed or none was made. */
export function tokensByRow(
  diff: ParsedDiff,
  jobs: readonly HighlightJob[],
  results: ReadonlyArray<LineTokens[] | null>,
): Array<LineTokens | null> {
  const out: Array<LineTokens | null> = diff.rows.map(() => null)
  jobs.forEach((job, j) => {
    const tokens = results[j]
    if (!tokens) return
    job.rows.forEach((n, i) => {
      if (job.side === 'old' && diff.rows[n - 1].kind !== 'del') return
      out[n - 1] = tokens[i] ?? null
    })
  })
  return out
}

/**
 * Tab and Shift+Tab in a field of code: what the indentation of the text is, and the edit that a press of the key makes. The functions are pure: the
 * field reads its text and selection, asks for an edit, and applies it itself.
 */

/** A change to the text of a field: the characters from `from` to `to` are replaced by `insert`, and then `start` to `end` of the new text is selected. */
export interface TextEdit {
  from: number
  to: number
  insert: string
  start: number
  end: number
}

/** The unit that is used when nothing is indented in the text that was measured. */
export const DEFAULT_UNIT = '  '

/** The widest step that is taken for one level of indentation: a line that is indented by more is a block of its own and not a unit. */
const MAX_UNIT = 8

/** What the lines are indented by: how many start with a tab, how many with spaces, and the distinct widths of those spaces, least first. */
function measure(lines: readonly string[]): { tabs: number; spaced: number; widths: number[] } {
  let tabs = 0
  let spaced = 0
  const widths = new Set<number>()
  for (const line of lines) {
    if (line.trim() === '') continue
    if (line[0] === '\t') {
      tabs += 1
      continue
    }
    const spaces = line.length - line.trimStart().length
    // The star of a comment that goes on, as in " * a line", is aligned with the one above it and is not a level of indentation.
    if (spaces > 0 && line.trimStart()[0] !== '*') {
      spaced += 1
      widths.add(spaces)
    }
  }
  return { tabs, spaced, widths: [...widths].sort((a, b) => a - b) }
}

/** The unit that a measure shows, or `null` when it shows none: a tab, or the smallest step between the widths, from no indentation and between each two next to each other. */
function unitOf({ tabs, spaced, widths }: ReturnType<typeof measure>, levels: number): string | null {
  if (tabs > 0 && tabs >= spaced) return '\t'
  if (widths.length < levels || widths.length === 0) return null
  let step = widths[0]
  for (let i = 1; i < widths.length; i++) step = Math.min(step, widths[i] - widths[i - 1])
  return ' '.repeat(Math.min(step, MAX_UNIT))
}

/**
 * The unit of indentation of a text: a tab when more of its lines start with a tab than with spaces; else the smallest step between the widths of the
 * spaces its lines start with, so that lines at 4, 8 and 12 are a unit of 4 and lines at 2 and 6 are a unit of 2. Blank lines and the stars of a comment that goes
 * on are not counted. The `lines` being replaced decide when they show a unit by themselves (a tab, or two levels at least); a block at one level does not, so the
 * `fallback` (the lines of the whole file) decides next, then the one level of `lines`, and `DEFAULT_UNIT` when none of them is indented.
 */
export function indentUnit(lines: readonly string[], fallback: readonly string[] = []): string {
  const own = measure(lines)
  return unitOf(own, 2) ?? unitOf(measure(fallback), 1) ?? unitOf(own, 1) ?? DEFAULT_UNIT
}

const lineStart = (value: string, at: number): number => value.lastIndexOf('\n', at - 1) + 1

const lineEnd = (value: string, at: number): number => {
  const found = value.indexOf('\n', at)
  return found === -1 ? value.length : found
}

/** Whether the selection takes in more than one line. */
const spansLines = (value: string, start: number, end: number): boolean => value.slice(start, end).includes('\n')

/**
 * The lines that a press touches, as a range of the text from the start of the first to the end of the last. A selection that ends at the very start of
 * a line does not touch that line, as in an editor of code.
 */
function touched(value: string, start: number, end: number): { first: number; last: number } {
  const stop = end > start && value[end - 1] === '\n' ? end - 1 : end
  return { first: lineStart(value, start), last: lineEnd(value, stop) }
}

/**
 * Tab: a caret, or a selection inside one line, gets one unit where it is (the selection is replaced by it); a selection over several lines puts one unit
 * at the start of each line that it touches, leaves the blank ones alone, and keeps those lines selected.
 */
export function indentEdit(value: string, start: number, end: number, unit: string): TextEdit {
  if (!spansLines(value, start, end)) return { from: start, to: end, insert: unit, start: start + unit.length, end: start + unit.length }
  const { first, last } = touched(value, start, end)
  const insert = value
    .slice(first, last)
    .split('\n')
    .map((line) => (line.trim() === '' ? line : unit + line))
    .join('\n')
  return { from: first, to: last, insert, start: first, end: first + insert.length }
}

/** How much of the start of a line one press of Shift+Tab takes off: a tab, or the spaces of one unit (four where the unit is a tab). */
function removable(line: string, unit: string): number {
  if (line[0] === '\t') return 1
  const spaces = line.length - line.trimStart().length
  return Math.min(spaces, unit === '\t' ? 4 : unit.length)
}

/**
 * Shift+Tab: one unit off the start of the line that has the caret, or of each line that the selection touches, as far as there is one to take off.
 * `null` when there is nothing to take off, so that the press changes nothing.
 */
export function outdentEdit(value: string, start: number, end: number, unit: string): TextEdit | null {
  const { first, last } = touched(value, start, end)
  const lines = value.slice(first, last).split('\n')
  const taken = lines.map((line) => removable(line, unit))
  if (taken.every((n) => n === 0)) return null
  const insert = lines.map((line, i) => line.slice(taken[i])).join('\n')
  if (spansLines(value, start, end)) return { from: first, to: last, insert, start: first, end: first + insert.length }
  return { from: first, to: last, insert, start: Math.max(first, start - taken[0]), end: Math.max(first, end - taken[0]) }
}

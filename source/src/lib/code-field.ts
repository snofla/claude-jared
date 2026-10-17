import { isTooLongToHighlight, type LineTokens } from './highlight.ts'

/**
 * What a field for code is drawn from, as pure functions of text: the rows of the colours that are drawn under the text area while the code is typed, and the
 * bracket that pairs with the one at the caret. The text area keeps the text and the caret; nothing here touches the page.
 */

/** One line of the drawing under the field: its text, and its colours, or null when the line is drawn plain. */
export interface OverlayRow {
  text: string
  tokens: LineTokens | null
}

/** A text that was coloured, with the colours of each of its lines, as `tokenize` gives them. */
export interface Coloured {
  text: string
  tokens: LineTokens[]
}

/**
 * The rows of the drawing: one for each line of `text`, so that the drawing is as tall as the text area's text; a text that ends with a newline gives an empty
 * last row. Colours come from `coloured`, the last text that was coloured, and only for a line that is unchanged: the lines that `text` and `coloured.text` have
 * in common at the top, and then at the bottom, keep their colours, and the changed lines between them are plain until new colours come. So a line that is
 * inserted does not take the colours off the lines below it. A line that is too long to be coloured is plain. With no coloured text every row is plain.
 *
 * `overlayRows('a(\nb', { text: 'a(\nb\nc', tokens: [ta, tb, tc] })` is `[{ text: 'a(', tokens: ta }, { text: 'b', tokens: tb }]`, and
 * `overlayRows('a(\nx\nb', { text: 'a(\nb', tokens: [ta, tb] })` is `[{ text: 'a(', tokens: ta }, { text: 'x', tokens: null }, { text: 'b', tokens: tb }]`.
 */
export function overlayRows(text: string, coloured: Coloured | null): OverlayRow[] {
  const lines = text.split('\n')
  const before = coloured ? coloured.text.split('\n') : []
  // The lines that are the same at the top, and then at the bottom of what is left, in the two texts.
  const shared = Math.min(lines.length, before.length)
  let top = 0
  while (top < shared && lines[top] === before[top]) top++
  let bottom = 0
  while (bottom < shared - top && lines[lines.length - 1 - bottom] === before[before.length - 1 - bottom]) bottom++
  return lines.map((line, row) => {
    const old = row < top ? row : row >= lines.length - bottom ? before.length - (lines.length - row) : -1
    return { text: line, tokens: old >= 0 && !isTooLongToHighlight(line) ? (coloured!.tokens[old] ?? null) : null }
  })
}

/** A bracket of the text and the one that pairs with it, as offsets into the text. */
export interface BracketPair {
  at: number
  match: number
}

/**
 * The bracket just before the caret, or, when that has no partner, the one just after it, of `()`, `[]` and `{}`, and its partner: found by counting the
 * nesting of the same pair, forwards from an opener and backwards from a closer. `caret` is an offset between two characters, `0` to `text.length`. A bracket
 * inside quotes (`'`, `"` or a backtick, closed on the same line) is no bracket, and a quote that is not closed on its line runs to the end of that line. It
 * gives null when there is no bracket at the caret or it has no partner. A bracket in a comment, in a regular expression or in a string over several lines
 * can pair wrongly: the text is not read as a language. Linear in the length of the text.
 *
 * `matchingBracket('f(a, [b])', 9)` is `{ at: 8, match: 1 }` (the `)` before the caret and its `(`), `matchingBracket('f(a, [b])', 1)` is `{ at: 1, match: 8 }`,
 * and `matchingBracket('f(")")', 2)` is `{ at: 1, match: 5 }`: the `)` in the string is skipped, so the `(` pairs with the last one.
 */
export function matchingBracket(text: string, caret: number): BracketPair | null {
  for (const at of [caret - 1, caret]) {
    const match = partnerOf(text, at)
    if (match !== null) return { at, match }
  }
  return null
}

const CLOSER: Record<string, string> = { '(': ')', '[': ']', '{': '}' }
const OPENER: Record<string, string> = { ')': '(', ']': '[', '}': '{' }
const QUOTES = `'"\``

/** For each character of a line, whether it is a quote or inside quotes: from a quote to the same quote, a backslash making the next character part of the string. */
function quoted(line: string): boolean[] {
  const mask: boolean[] = new Array(line.length).fill(false)
  let open = ''
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (open) {
      mask[i] = true
      if (c === '\\') mask[++i] = true
      else if (c === open) open = ''
    } else if (QUOTES.includes(c)) {
      open = c
      mask[i] = true
    }
  }
  return mask
}

/** The offset of the bracket that pairs with the one at `at`, or null: no bracket there, one inside quotes, or none that pairs. */
function partnerOf(text: string, at: number): number | null {
  const bracket = text[at]
  const forwards = CLOSER[bracket] !== undefined
  if (!forwards && OPENER[bracket] === undefined) return null
  const mine = bracket
  const other = forwards ? CLOSER[bracket] : OPENER[bracket]
  const lineStart = text.lastIndexOf('\n', at - 1) + 1
  const lineEnd = text.indexOf('\n', at)
  let depth = 0
  // Line by line, each line's quotes found once, from the line of the bracket outwards.
  let start = lineStart
  let end = lineEnd < 0 ? text.length : lineEnd
  while (true) {
    const mask = quoted(text.slice(start, end))
    if (start === lineStart && mask[at - start]) return null
    const from = start === lineStart ? at - start + (forwards ? 1 : -1) : forwards ? 0 : end - start - 1
    for (let i = from; i >= 0 && i < end - start; i += forwards ? 1 : -1) {
      if (mask[i]) continue
      const c = text[start + i]
      if (c === mine) depth++
      else if (c === other && depth-- === 0) return start + i
    }
    if (forwards) {
      if (end >= text.length) return null
      start = end + 1
      const next = text.indexOf('\n', start)
      end = next < 0 ? text.length : next
    } else {
      if (start === 0) return null
      end = start - 1
      start = end === 0 ? 0 : text.lastIndexOf('\n', end - 1) + 1
    }
  }
}

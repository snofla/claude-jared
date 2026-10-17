import type { LineTokens } from './highlight'

/** A piece of a line that a field for code draws under its letters: the letters, the custom properties that colour them, and whether it is marked. */
export interface DrawnPart {
  text: string
  style?: Record<string, string>
  mark?: boolean
}

/** A line of the field's text with its tokens, or `null` when it is drawn plain: what `overlayRows` gives. */
export interface DrawnRow {
  text: string
  tokens: LineTokens | null
}

/** The parts made for each array of tokens, with the text that they were made for: a row that did not change keeps its tokens, and so its parts, which are then the same objects from one drawing to the next. */
const madeFrom = new WeakMap<LineTokens, { text: string; parts: DrawnPart[] }>()

/** The parts of one row: its tokens when they spell its text, else the text as one plain part; an empty row has no parts. */
function partsOf(row: DrawnRow): DrawnPart[] {
  if (row.text === '') return []
  const tokens = row.tokens
  const made = tokens ? madeFrom.get(tokens) : undefined
  if (made && made.text === row.text) return made.parts
  if (tokens && tokens.map((token) => token.content).join('') === row.text) {
    const parts = tokens
      .filter((token) => token.content !== '')
      .map((token) => (typeof token.htmlStyle === 'object' ? { text: token.content, style: token.htmlStyle as Record<string, string> } : { text: token.content }))
    madeFrom.set(tokens, { text: row.text, parts })
    return parts
  }
  return [{ text: row.text }]
}

/** `parts` with the letter at each of `columns` (offsets in the row) made a part of its own and marked. */
function marked(parts: DrawnPart[], columns: readonly number[]): DrawnPart[] {
  if (columns.length === 0) return parts
  const out: DrawnPart[] = []
  let start = 0
  for (const part of parts) {
    const end = start + part.text.length
    let from = 0
    for (const column of columns) {
      if (column < start || column >= end) continue
      const at = column - start
      if (at < from) continue // the same offset twice
      if (at > from) out.push({ ...part, text: part.text.slice(from, at) })
      out.push({ ...part, text: part.text[at], mark: true })
      from = at + 1
    }
    if (from < part.text.length) out.push(from === 0 ? part : { ...part, text: part.text.slice(from) })
    start = end
  }
  return out
}

/**
 * The lines that a field for code draws under its letters, one for each row: the row's tokens as parts, or its text as one plain part, with the letter at
 * each of `marks` (offsets in the whole text, as `matchingBracket` gives them) a part of its own that is marked. An offset at the end of a line, where its
 * newline is, or outside the text, marks nothing.
 */
export function drawnLines(rows: readonly DrawnRow[], marks: readonly number[]): DrawnPart[][] {
  const sorted = [...marks].sort((a, b) => a - b)
  let offset = 0
  return rows.map((row) => {
    const start = offset
    offset += row.text.length + 1
    const columns = sorted.filter((mark) => mark >= start && mark < start + row.text.length).map((mark) => mark - start)
    return marked(partsOf(row), columns)
  })
}

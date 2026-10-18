import type { Common, DiffEngine } from './diff-engine.ts'
import type { LineTokens } from './highlight.ts'
import { myers } from './myers.ts'

/**
 * A diff of two lists of lines, as rows for a card to draw: which lines are the same, which are removed and which are added, which of the unchanged lines to
 * hide, and which words of a changed line changed. Pure. The caller splits its texts into lines (`text.split('\n')`, as the card does today: a text that ends
 * with a newline has an empty last line, in both texts or the diff shows an added empty line), and the engine that finds the common lines is a parameter.
 */

/**
 * How much work the engine may do, as the number of edits it may look for times the length of the two lists between the lines that they share at the top and the
 * bottom: the lists may differ in `DIFF_BUDGET / (their lengths)` edits, so a long pair of lists that differ in many places is given up on sooner than a short one.
 */
export const DIFF_BUDGET = 4_000_000
/** A removed line is paired with the most alike of the next `PAIR_WINDOW` added lines after the one paired before it, when the share of their characters that is unchanged (twice those, over the length of both lines) is at least `PAIR_SHARE`. */
export const PAIR_SHARE = 0.5
export const PAIR_WINDOW = 10
/** A line of this many characters or more gets no words, and one call of `lineDiff` makes at most `WORD_DIFFS_PER_CALL` diffs of words. */
export const WORD_LINE_LIMIT = 500
export const WORD_DIFFS_PER_CALL = 2_000

/** A part of a line, for the words that changed in it: the spans of a line join to the line. */
export interface WordSpan {
  text: string
  changed: boolean
}

/** One row of the diff, in reading order. */
export interface LineRow {
  kind: 'same' | 'del' | 'add'
  text: string
  /** The line's index in the old lines: a same or removed row (the file's tokens of that line); null for an added row. */
  oldIndex: number | null
  /** The line's index in the new lines: a same or added row (the suggestion's tokens of that line); null for a removed row. */
  newIndex: number | null
  /** For a removed or added line that has a partner in its change: its words, the changed ones with `changed: true`. Null for any other row. */
  words: WordSpan[] | null
}

export interface LineDiff {
  /** The rows in reading order: the removed lines of a change before its added ones. Nothing is hidden. */
  rows: LineRow[]
  /**
   * False when the engine gave up because the lines between those that the lists share at the top and the bottom have too many edits and share some lines: those
   * lines are then all removed, then all added, with no words, and the shared lines stay the same. True otherwise, and also for lists with nothing in common,
   * whose diff is all removed and all added.
   */
  exact: boolean
}

/**
 * The diff of `oldLines` and `newLines`, with the engine that finds their common lines (Myers' by default). The lines that the lists share at the top and at the
 * bottom are kept the same without the engine, which gets the lines between, with a number of edits it may look for that gets smaller as the lists get longer.
 *
 * `lineDiff(['a', 'b', 'c'], ['a', 'x', 'c']).rows` is the rows `same a` (old 0, new 0), `del b` (old 1), `add x` (new 1) and `same c` (old 2, new 2).
 */
export function lineDiff(oldLines: readonly string[], newLines: readonly string[], engine: DiffEngine = myers): LineDiff {
  const { runs, exact } = commonRuns(oldLines, newLines, engine)
  const rows: LineRow[] = []
  const spent = { diffs: 0 }
  let i = 0
  let j = 0
  // The removed lines of a change, then its added ones; the lines of a pair get their words.
  const change = (toI: number, toJ: number): void => {
    const delFrom = rows.length
    for (; i < toI; i++) rows.push({ kind: 'del', text: oldLines[i], oldIndex: i, newIndex: null, words: null })
    const addFrom = rows.length
    for (; j < toJ; j++) rows.push({ kind: 'add', text: newLines[j], oldIndex: null, newIndex: j, words: null })
    if (exact) pairWords(rows, delFrom, addFrom - delFrom, addFrom, rows.length - addFrom, engine, spent)
  }
  for (const run of runs) {
    change(run.a, run.b)
    for (let t = 0; t < run.length; t++) rows.push({ kind: 'same', text: newLines[run.b + t], oldIndex: run.a + t, newIndex: run.b + t, words: null })
    i = run.a + run.length
    j = run.b + run.length
  }
  change(oldLines.length, newLines.length)
  return { rows, exact }
}

/**
 * The runs of items that two lists have in common, found by the engine only for the items between those that the lists share at the top and the bottom; and not
 * at all when they have no item in common (which is so when one of them is empty), for the diff is then all removed and all added. `exact` is false when the
 * engine gave up: the runs are then the shared top and bottom only.
 */
function commonRuns(a: readonly string[], b: readonly string[], engine: DiffEngine): { runs: Common[]; exact: boolean } {
  const shared = Math.min(a.length, b.length)
  let top = 0
  while (top < shared && a[top] === b[top]) top++
  let bottom = 0
  while (bottom < shared - top && a[a.length - 1 - bottom] === b[b.length - 1 - bottom]) bottom++
  const runs: Common[] = top > 0 ? [{ a: 0, b: 0, length: top }] : []
  const middleA = a.slice(top, a.length - bottom)
  const middleB = b.slice(top, b.length - bottom)
  let exact = true
  const inA = new Set(middleA)
  if (middleB.some((item) => inA.has(item))) {
    const found = engine.common(middleA, middleB, Math.floor(DIFF_BUDGET / (middleA.length + middleB.length)))
    if (found) for (const run of found) runs.push({ a: run.a + top, b: run.b + top, length: run.length })
    else exact = false
  }
  if (bottom > 0) runs.push({ a: a.length - bottom, b: b.length - bottom, length: bottom })
  return { runs, exact }
}

/** How alike two lines are, by their words: twice the characters that are unchanged, over the length of the two lines together (1 for equal lines, 0 for none in common). */
function unchangedShare(spans: { old: WordSpan[]; new: WordSpan[] }, oldLine: string, newLine: string): number {
  const total = oldLine.length + newLine.length
  if (total === 0) return 0
  return (2 * spans.old.reduce((sum, span) => (span.changed ? sum : sum + span.text.length), 0)) / total
}

/** Gives the words to the lines of a change that have a partner: each removed line, in order, and the most similar of the next few added lines after the one paired before. */
function pairWords(rows: LineRow[], delFrom: number, delCount: number, addFrom: number, addCount: number, engine: DiffEngine, spent: { diffs: number }): void {
  let next = 0
  for (let r = 0; r < delCount && next < addCount; r++) {
    const del = rows[delFrom + r]
    if (del.text.length >= WORD_LINE_LIMIT) continue
    let best = -1
    let bestShare = 0
    let bestSpans: { old: WordSpan[]; new: WordSpan[] } | null = null
    for (let c = next; c < Math.min(addCount, next + PAIR_WINDOW); c++) {
      const add = rows[addFrom + c]
      if (add.text.length >= WORD_LINE_LIMIT) continue
      if (spent.diffs >= WORD_DIFFS_PER_CALL) return
      spent.diffs++
      const spans = wordSpans(del.text, add.text, engine)
      const share = unchangedShare(spans, del.text, add.text)
      if (share > bestShare) {
        best = c
        bestShare = share
        bestSpans = spans
      }
    }
    if (best >= 0 && bestSpans && bestShare >= PAIR_SHARE) {
      del.words = bestSpans.old
      rows[addFrom + best].words = bestSpans.new
      next = best + 1
    }
  }
}

/** A run of unchanged rows that a card hides: `rows[from..to)`, so `to - from` is the "N unchanged lines". */
export interface Fold {
  from: number
  to: number
}

/**
 * The runs of unchanged rows to hide: a run of more than `over` unchanged rows is hidden except `context` rows next to each change. An inside run of 9 keeps 3 and
 * 3 and hides 3; a run before the first change, or after the last, keeps 3 next to the change and hides the rest (a run of 14 at the top hides 11). Rows that
 * have no change at all hide nothing. The card keeps which folds are open, and draws `rows.slice(from, to)` for an open one.
 */
export function foldRanges(rows: readonly LineRow[], context = 3, over = 8): Fold[] {
  const folds: Fold[] = []
  let at = 0
  while (at < rows.length) {
    if (rows[at].kind !== 'same') {
      at++
      continue
    }
    let end = at
    while (end < rows.length && rows[end].kind === 'same') end++
    const length = end - at
    // A run that touches no change at all (the whole diff) is not hidden: there is nothing to show but it.
    if (length > over && !(at === 0 && end === rows.length)) {
      const from = at === 0 ? at : at + context
      const to = end === rows.length ? end : end - context
      if (to > from) folds.push({ from, to })
    }
    at = end
  }
  return folds
}

/**
 * The words that changed between a removed line and an added one, as the spans of each: a word is a run of letters, digits and `_`, a run of blanks, or a run of
 * other signs, and neighbours that are both changed or both unchanged are one span.
 *
 * `wordSpans('let a = 1', 'let a = 2')` is `{ old: [{ text: 'let a = ', changed: false }, { text: '1', changed: true }], new: [{ text: 'let a = ', changed: false }, { text: '2', changed: true }] }`.
 */
export function wordSpans(oldLine: string, newLine: string, engine: DiffEngine = myers): { old: WordSpan[]; new: WordSpan[] } {
  const oldWords = wordsOf(oldLine)
  const newWords = wordsOf(newLine)
  const { runs } = commonRuns(oldWords, newWords, engine)
  const kept = (words: string[], at: (run: Common) => number): WordSpan[] => {
    const same = new Uint8Array(words.length)
    for (const run of runs) same.fill(1, at(run), at(run) + run.length)
    const spans: WordSpan[] = []
    words.forEach((text, i) => {
      const changed = same[i] === 0
      const last = spans[spans.length - 1]
      if (last && last.changed === changed) last.text += text
      else spans.push({ text, changed })
    })
    return spans
  }
  return { old: kept(oldWords, (run) => run.a), new: kept(newWords, (run) => run.b) }
}

/** The words of a line: a run of letters, digits and `_`, a run of blanks, or a run of other signs. They join to the line. */
function wordsOf(line: string): string[] {
  return line.match(/[\p{L}\p{N}_]+|\s+|[^\p{L}\p{N}_\s]+/gu) ?? []
}

/** A piece of a line to draw: the letters, the custom properties that colour them (a token's `htmlStyle`), and whether they are in a changed word. */
export interface TokenPart {
  text: string
  style?: Record<string, string>
  changed: boolean
}

/**
 * The parts of a line to draw: its tokens, cut where a span begins or ends, so that a coloured token can be partly in a changed word. Tokens that do not spell
 * the line, or none, give the line as plain parts cut at the spans; spans that are null or that do not join to the line give the tokens as parts with `changed`
 * false; an empty line has no parts.
 *
 * With one token `foo(bar)` and the spans `foo(` unchanged, `bar` changed, `)` unchanged, the parts are `foo(`, `bar` and `)`, each with the token's style.
 */
export function splitTokens(tokens: LineTokens | null, line: string, spans: readonly WordSpan[] | null): TokenPart[] {
  if (line === '') return []
  const pieces: Array<{ text: string; style?: Record<string, string> }> =
    tokens && tokens.map((token) => token.content).join('') === line
      ? tokens.filter((token) => token.content !== '').map((token) => (typeof token.htmlStyle === 'object' ? { text: token.content, style: token.htmlStyle as Record<string, string> } : { text: token.content }))
      : [{ text: line }]
  if (!spans || spans.map((span) => span.text).join('') !== line) return pieces.map((piece) => ({ ...piece, changed: false }))
  const parts: TokenPart[] = []
  let span = 0 // the span that holds `at`
  let spanStart = 0
  let at = 0
  for (const piece of pieces) {
    for (let from = 0; from < piece.text.length; ) {
      while (spanStart + spans[span].text.length <= at) spanStart += spans[span++].text.length
      const take = Math.min(piece.text.length - from, spanStart + spans[span].text.length - at)
      parts.push({ ...piece, text: piece.text.slice(from, from + take), changed: spans[span].changed })
      from += take
      at += take
    }
  }
  return parts
}

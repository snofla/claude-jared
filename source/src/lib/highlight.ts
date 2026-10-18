import type { BundledLanguage, GrammarState, SpecialLanguage, ThemedToken } from 'shiki'
import { highlightJobs, tokensByRow, type ParsedDiff } from './diff.ts'

export type LineTokens = ThemedToken[]

export const THEMES = { light: 'github-light', dark: 'github-dark' } as const

/**
 * Colours of the themes that are under 4.5:1 on the rows that last, laid over the code background of `src/styles.css`: a plain row, an
 * added and a deleted row of a diff, each with or without the reviewed mark (measured on 2026-10-04). Not the selection,
 * the hover or the flash, which are brief. Each hex is moved along its own hue and saturation until the
 * worst of the six rows reaches 4.6:1: the light comment grey (3.9), green (3.75), red (3.7) and orange (2.83), and the dark comment grey
 * (2.62). Shiki replaces a colour in one theme only when the replacement is given under that theme's name, and it replaces every scope of
 * that theme that uses the hex (the light orange is `variable`, markdown list punctuation and `markup.changed`). The keys come from
 * `THEMES`, so that a different theme cannot leave a replacement that does nothing, and a test reads the themes' own
 * colours and requires all of them, replaced, to pass, so that a Shiki upgrade that adds a failing colour fails a test.
 */
export const COLOR_REPLACEMENTS = {
  [THEMES.light]: { '#6a737d': '#5e666f', '#22863a': '#1e7633', '#d73a49': '#c32836', '#e36209': '#a84907' },
  [THEMES.dark]: { '#6a737d': '#969da6' },
} as const

/**
 * A line this long, or longer, is not coloured: Shiki stops at a time limit that depends on the machine, so the
 * same line came out coloured for its first few characters on one machine and further on another, and the page
 * froze for seconds meanwhile. Shiki's own limit (`tokenizeMaxLineLength`) is what enforces this.
 */
export const MAX_HIGHLIGHT_LINE_LENGTH = 10_000

/** Whether `tokenize` leaves this line uncoloured, so the reader can be told. */
export function isTooLongToHighlight(line: string): boolean {
  return line.length >= MAX_HIGHLIGHT_LINE_LENGTH
}
const CACHE_SIZE = 12
const cache = new Map<string, Promise<LineTokens[] | null>>()

/**
 * A text of more lines than this is coloured in slices of this many lines, with the page given a turn between them: Shiki colours a whole text in one task, which took
 * about 340 ms for 2,000 lines in a production build (measured on 2026-10-17) and froze the page that long, when a file was opened, a suggestion was typed or a
 * comment with a long suggestion was saved. A slice of 100 lines takes under 30 ms there. The colours are the same as those of one pass.
 */
export const COLOUR_SLICE_LINES = 100

/** Gives the page a turn (its input, its drawing) before the next slice is coloured. */
const yieldToPage = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

/**
 * The colours of `code`, one array per line, made in slices of `sliceLines` lines, each starting with the state that the grammar was left in by the one before, so
 * that a comment or a string over several lines goes on across the edge of a slice; and what one pass over the whole text gives, offsets included. Shiki is loaded on
 * the first call. Throws what Shiki throws for a language that it does not know.
 */
export async function colourInSlices(code: string, lang: string, sliceLines: number): Promise<LineTokens[]> {
  // Loaded on demand so the grammar engine and language chunks stay out of the first paint.
  const { codeToTokens } = await import('shiki')
  const options = {
    lang: lang as BundledLanguage | SpecialLanguage,
    themes: THEMES,
    colorReplacements: COLOR_REPLACEMENTS,
    defaultColor: false,
    tokenizeMaxLineLength: MAX_HIGHLIGHT_LINE_LENGTH,
  } as const
  const lines = code.split('\n')
  if (lines.length <= sliceLines) return (await codeToTokens(code, options)).tokens
  const colours: LineTokens[] = []
  let state: GrammarState | undefined
  let offset = 0
  for (let at = 0; at < lines.length; at += sliceLines) {
    if (at > 0) await yieldToPage()
    const slice = lines.slice(at, at + sliceLines).join('\n')
    const result = await codeToTokens(slice, state ? { ...options, grammarState: state } : options)
    for (const line of result.tokens) {
      for (const token of line) token.offset += offset
      colours.push(line)
    }
    state = result.grammarState
    offset += slice.length + 1
  }
  return colours
}

/**
 * Tokenise `code` into one token array per line. Each token carries both theme colours as CSS
 * variables (`--shiki-light` / `--shiki-dark`), so light/dark switching is pure CSS. A long text is coloured in slices (`COLOUR_SLICE_LINES`) so that
 * the page is not stopped while it is.
 * Resolves to `null` if highlighting fails; callers then show plain text.
 */
export function tokenize(code: string, lang: string): Promise<LineTokens[] | null> {
  const key = `${lang}\0${code}`
  const hit = cache.get(key)
  if (hit) return hit

  const pending = (async () => {
    try {
      return await colourInSlices(code, lang, COLOUR_SLICE_LINES)
    } catch {
      cache.delete(key)
      return null
    }
  })()

  cache.set(key, pending)
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!)
  return pending
}

/**
 * The colours of every row of a diff, one array per row (`null` for a row that has none: a header, or code in a language that is not
 * known). Each side of each hunk is coloured as a text of its own, as the language of its file; see `highlightJobs`.
 */
export async function tokenizeDiff(diff: ParsedDiff, lines: readonly string[]): Promise<Array<LineTokens | null>> {
  const jobs = highlightJobs(diff, lines)
  const results = await Promise.all(jobs.map((job) => tokenize(job.text, job.language)))
  return tokensByRow(diff, jobs, results)
}

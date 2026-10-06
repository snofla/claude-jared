import type { BundledLanguage, SpecialLanguage, ThemedToken } from 'shiki'
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
 * Tokenise `code` into one token array per line. Each token carries both theme colours as CSS
 * variables (`--shiki-light` / `--shiki-dark`), so light/dark switching is pure CSS.
 * Resolves to `null` if highlighting fails; callers then show plain text.
 */
export function tokenize(code: string, lang: string): Promise<LineTokens[] | null> {
  const key = `${lang}\0${code}`
  const hit = cache.get(key)
  if (hit) return hit

  const pending = (async () => {
    try {
      // Loaded on demand so the grammar engine and language chunks stay out of the first paint.
      const { codeToTokens } = await import('shiki')
      const { tokens } = await codeToTokens(code, {
        lang: lang as BundledLanguage | SpecialLanguage,
        themes: THEMES,
        colorReplacements: COLOR_REPLACEMENTS,
        defaultColor: false,
        tokenizeMaxLineLength: MAX_HIGHLIGHT_LINE_LENGTH,
      })
      return tokens
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

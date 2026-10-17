import { useEffect, useRef, useState } from 'react'
import type { ParsedDiff } from '../lib/diff'
import type { SetLayout } from '../lib/set-view'
import { tokenize, tokenizeDiff, type LineTokens } from '../lib/highlight'

/**
 * Syntax-highlighted tokens for `code`, one array per line.
 * Returns `null` until highlighting finishes (or if it fails), so callers can render plain text first.
 */
export function useTokens(code: string | null, lang: string): LineTokens[] | null {
  const [result, setResult] = useState<{ code: string; lang: string; tokens: LineTokens[] } | null>(null)

  useEffect(() => {
    if (code === null) return
    let cancelled = false
    void tokenize(code, lang).then((tokens) => {
      if (!cancelled && tokens) setResult({ code, lang, tokens })
    })
    return () => {
      cancelled = true
    }
  }, [code, lang])

  return code !== null && result?.code === code && result.lang === lang ? result.tokens : null
}

/** The colours of every row of a diff, `null` until they are ready (the rows are drawn plain first), and for a row that has none. */
export function useDiffTokens(diff: ParsedDiff | null, lines: readonly string[]): Array<LineTokens | null> | null {
  const [result, setResult] = useState<{ diff: ParsedDiff; tokens: Array<LineTokens | null> } | null>(null)

  useEffect(() => {
    if (!diff) return
    let cancelled = false
    void tokenizeDiff(diff, lines).then((tokens) => {
      if (!cancelled) setResult({ diff, tokens })
    })
    return () => {
      cancelled = true
    }
  }, [diff, lines])

  return diff && result?.diff === diff ? result.tokens : null
}

/**
 * The colours of every row of a set of files, each file coloured as its own language: one entry for each row, `null` for a header, until they
 * are ready (the rows are drawn plain first), and `null` for the whole while they are not.
 */
export function useSetTokens(layout: SetLayout | null): Array<LineTokens | null> | null {
  const [result, setResult] = useState<{ layout: SetLayout; tokens: Array<LineTokens | null> } | null>(null)

  useEffect(() => {
    if (!layout) return
    let cancelled = false
    void Promise.all(layout.texts.map((text) => tokenize(text.lines.join('\n'), text.language))).then((perFile) => {
      if (cancelled) return
      const tokens: Array<LineTokens | null> = []
      perFile.forEach((fileTokens, file) => {
        tokens.push(null)
        layout.texts[file].lines.forEach((_, line) => tokens.push(fileTokens?.[line] ?? null))
      })
      setResult({ layout, tokens })
    })
    return () => {
      cancelled = true
    }
  }, [layout])

  return layout && result?.layout === layout ? result.tokens : null
}

/**
 * How long the text of a field for code must stay as it is before it is coloured again: colouring takes time in proportion to the text (about 310 ms for
 * 2,000 lines in a production build, under 50 ms below 300), so a short text is coloured after a short pause, and a long one only once the typing stops.
 */
export const COLOUR_PAUSE_MS = 200
export const LONG_TEXT_LINES = 300
export const LONG_TEXT_PAUSE_MS = 1000

/** The pause before a text of this many lines is coloured again. */
export const colourPause = (lines: number): number => (lines > LONG_TEXT_LINES ? LONG_TEXT_PAUSE_MS : COLOUR_PAUSE_MS)

const lineCount = (text: string): number => {
  let n = 1
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) n++
  return n
}

/**
 * The last text of a field for code that was coloured, with its tokens, as a field that is typed in needs them: the first text in a language is coloured at
 * once, and later ones when the text has not changed for `colourPause` of its lines, so that each key does not colour the whole text again; a result that comes
 * after a newer one is dropped, and the last one is kept meanwhile, so that the lines that did not change keep their colours. `null` until the first text
 * in this language is coloured, and when colouring fails.
 */
export function useLastColoured(code: string | null, lang: string): { text: string; tokens: LineTokens[] } | null {
  const [last, setLast] = useState<{ text: string; lang: string; tokens: LineTokens[] } | null>(null)
  const asked = useRef(0)
  const shown = useRef(0)
  const colouredLang = useRef<string | null>(null)

  useEffect(() => {
    if (code === null) return
    const colour = () => {
      const ask = ++asked.current
      void tokenize(code, lang).then((tokens) => {
        if (!tokens || ask < shown.current) return
        shown.current = ask
        setLast({ text: code, lang, tokens })
      })
    }
    if (colouredLang.current !== lang) {
      colouredLang.current = lang // the next keys wait for a pause, while this first colouring is made
      return colour()
    }
    const timer = setTimeout(colour, colourPause(lineCount(code)))
    return () => clearTimeout(timer)
  }, [code, lang])

  return last && last.lang === lang ? last : null
}

/** Always-current ref to a value, for event handlers that must stay referentially stable. */
export function useLatest<T>(value: T) {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  })
  return ref
}

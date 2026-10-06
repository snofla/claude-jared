import { useEffect, useRef, useState } from 'react'
import type { ParsedDiff } from '../lib/diff'
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

/** Always-current ref to a value, for event handlers that must stay referentially stable. */
export function useLatest<T>(value: T) {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  })
  return ref
}

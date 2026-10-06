import type { CSSProperties } from 'react'
import type { LineTokens } from '../lib/highlight'

/** One highlighted line. Colours come from `--shiki-light` / `--shiki-dark` set per token. */
export function Tokens({ tokens, fallback }: { tokens: LineTokens | null | undefined; fallback: string }) {
  if (!tokens) return <>{fallback}</>
  return (
    <>
      {tokens.map((token, i) => (
        <span key={i} style={typeof token.htmlStyle === 'object' ? (token.htmlStyle as CSSProperties) : undefined}>
          {token.content}
        </span>
      ))}
    </>
  )
}

import type { LineTokens } from '../lib/highlight'
import { Tokens } from './Tokens'

function Block({ kind, text, tokens }: { kind: 'add' | 'del'; text: string; tokens: Array<LineTokens | null> | null }) {
  return (
    <div className={`diff-block ${kind}`}>
      {text.split('\n').map((line, i) => (
        <div className="diff-line" key={i}>
          <span className="diff-sign" aria-hidden="true">
            {kind === 'add' ? '+' : '−'}
          </span>
          <span className="diff-code">
            <Tokens tokens={tokens?.[i]} fallback={line} />
          </span>
        </div>
      ))}
    </div>
  )
}

/** Original lines (red) above the suggested replacement (green). */
export function DiffBlock(props: {
  removed: string
  removedTokens: Array<LineTokens | null> | null
  added: string
  addedTokens: Array<LineTokens | null> | null
}) {
  return (
    <div className="diff" role="group" aria-label="Suggested change">
      <Block kind="del" text={props.removed} tokens={props.removedTokens} />
      <Block kind="add" text={props.added} tokens={props.addedTokens} />
    </div>
  )
}

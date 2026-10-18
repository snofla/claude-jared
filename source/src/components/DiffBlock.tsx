import { memo, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { COPY } from '../lib/copy'
import type { LineTokens } from '../lib/highlight'
import { foldRanges, lineDiff, splitTokens, type LineRow } from '../lib/line-diff'
import { VisuallyHidden } from '../ui'

const SIGN = { same: '', del: '−', add: '+' } as const

/**
 * One row of the diff: no sign and no tint for a line that the suggestion keeps, `−` on red for a removed line and `+` on green for an added one; the words that
 * changed in a pair get a stronger tint. A screen reader hears whether a line is removed or added, as the sign is drawn and not read. Drawn again only when its row or its tokens change, so that a page that draws itself again does not draw every row of a long
 * suggestion again.
 */
const Row = memo(function Row({ row, tokens }: { row: LineRow; tokens: LineTokens | null }) {
  return (
    <div className={`diff-line ${row.kind}`}>
      <span className="diff-sign">
        <span aria-hidden="true">{SIGN[row.kind]}</span>
        {row.kind !== 'same' && <VisuallyHidden>{row.kind === 'del' ? COPY.diffRemoved : COPY.diffAdded}</VisuallyHidden>}
      </span>
      <span className="diff-code">
        {splitTokens(tokens, row.text, row.words).map((part, i) => (
          <span key={i} className={part.changed ? 'diff-word' : undefined} style={part.style as CSSProperties | undefined}>
            {part.text}
          </span>
        ))}
      </span>
    </div>
  )
})

/**
 * The selected lines against the suggested replacement, as a diff of the lines that change: the lines that the suggestion keeps once, as context, and only
 * the lines that differ as removed or added. A long run of kept lines is folded into one row that opens on a click. A removed line is coloured with the
 * file's tokens of its own line, an added or a kept one with the suggestion's.
 */
export function DiffBlock(props: {
  removed: string
  removedTokens: Array<LineTokens | null> | null
  added: string
  addedTokens: Array<LineTokens | null> | null
}) {
  const diff = useMemo(() => lineDiff(props.removed.split('\n'), props.added.split('\n')), [props.removed, props.added])
  const folds = useMemo(() => foldRanges(diff.rows), [diff])
  const [opened, setOpened] = useState<readonly number[]>([])
  const group = useRef<HTMLDivElement>(null)

  const tokensOf = (row: LineRow): LineTokens | null =>
    (row.kind === 'del' ? props.removedTokens?.[row.oldIndex ?? -1] : props.addedTokens?.[row.newIndex ?? -1]) ?? null

  const out: ReactNode[] = []
  for (let i = 0; i < diff.rows.length; i++) {
    const fold = folds.find((f) => f.from === i && !opened.includes(f.from))
    if (fold) {
      const hidden = fold.to - fold.from
      out.push(
        <button
          key={`fold-${fold.from}`}
          type="button"
          className="diff-fold"
          aria-label={COPY.showUnchanged(hidden)}
          onClick={() => {
            setOpened([...opened, fold.from])
            group.current?.focus() // the button goes away: the keyboard stays in the diff
          }}
        >
          {COPY.unchangedLines(hidden)}
        </button>,
      )
      i = fold.to - 1
      continue
    }
    out.push(<Row key={i} row={diff.rows[i]} tokens={tokensOf(diff.rows[i])} />)
  }

  return (
    <div className="diff" role="group" aria-label="Suggested change" tabIndex={0} ref={group}>
      <div className="diff-rows">{out}</div>
    </div>
  )
}

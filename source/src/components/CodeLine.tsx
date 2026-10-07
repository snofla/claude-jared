import { memo, type PointerEvent } from 'react'
import type { LineTokens } from '../lib/highlight'
import { cx } from '../lib/util'
import { IconPlus } from '../ui'
import { Tokens } from './Tokens'

interface Props {
  n: number
  text: string
  tokens: LineTokens | null
  /** The line is too long to colour; a note says so. */
  uncoloured: boolean
  selected: boolean
  reviewed: boolean
  /** The lanes that have a comment bar on this line, as bits (`laneMasks`); 0 for none. */
  lanes: number
  hovered: boolean
  flash: boolean
  onGutterPointerDown: (e: PointerEvent<HTMLElement>) => void
  onGutterPointerMove: (e: PointerEvent<HTMLElement>) => void
  onGutterPointerLeave: () => void
  onAdd: (line: number) => void
}

const LONG_LINE_NOTE = 'Not highlighted: this line is too long'

/** One source line. Memoised on booleans so a selection change only re-renders the lines it touches. */
export const CodeLine = memo(function CodeLine({
  n,
  text,
  tokens,
  uncoloured,
  selected,
  reviewed,
  lanes,
  hovered,
  flash,
  onGutterPointerDown,
  onGutterPointerMove,
  onGutterPointerLeave,
  onAdd,
}: Props) {
  return (
    <div
      className={cx('row', selected && 'is-selected', reviewed && 'is-reviewed', lanes > 0 && `lanes-${lanes}`, hovered && 'is-hovered', flash && 'is-flash')}
      data-line={n}
    >
      <div className="gutter" onPointerDown={onGutterPointerDown} onPointerMove={onGutterPointerMove} onPointerLeave={onGutterPointerLeave}>
        <button
          type="button"
          className="gutter-add"
          tabIndex={-1}
          aria-label={`Comment on line ${n}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onAdd(n)}
        >
          <IconPlus />
        </button>
        <span className="num">{n}</span>
      </div>
      <div className="code" data-note={uncoloured ? LONG_LINE_NOTE : undefined}>
        <Tokens tokens={tokens} fallback={text} />
      </div>
    </div>
  )
})

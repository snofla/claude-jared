import { memo, type PointerEvent } from 'react'
import { bodyOf, rowName, signOf, type RowKind } from '../lib/diff'
import type { LineTokens } from '../lib/highlight'
import { cx } from '../lib/util'
import { IconPlus } from './icons'
import { Tokens } from './Tokens'

interface Props {
  n: number
  kind: RowKind
  oldNo: number | null
  newNo: number | null
  /** The row as written in the diff, sign and all. */
  text: string
  tokens: LineTokens | null
  /** For a file's header row: what it says, and a word for what happened to the file. */
  title: string | null
  badge: string | null
  /** The code is too long to colour; a note says so. */
  uncoloured: boolean
  selected: boolean
  reviewed: boolean
  /** The lanes that have a comment bar on this row, as bits (`laneMasks`); 0 for none. */
  lanes: number
  hovered: boolean
  flash: boolean
  onGutterPointerDown: (e: PointerEvent<HTMLElement>) => void
  onGutterPointerMove: (e: PointerEvent<HTMLElement>) => void
  onGutterPointerLeave: () => void
  onAdd: (line: number) => void
}

const LONG_LINE_NOTE = 'Not highlighted: this line is too long'

/** One row of a diff, drawn like a source line: the numbers of the old and the new file in the gutter, then the sign, then the code. */
export const DiffLine = memo(function DiffLine({
  n,
  kind,
  oldNo,
  newNo,
  text,
  tokens,
  title,
  badge,
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
  const isCode = kind === 'context' || kind === 'add' || kind === 'del'
  return (
    <div
      className={cx('row', `is-${kind}`, selected && 'is-selected', reviewed && 'is-reviewed', lanes > 0 && `lanes-${lanes}`, hovered && 'is-hovered', flash && 'is-flash')}
      data-line={n}
    >
      <div className="gutter" onPointerDown={onGutterPointerDown} onPointerMove={onGutterPointerMove} onPointerLeave={onGutterPointerLeave}>
        <button
          type="button"
          className="gutter-add"
          tabIndex={-1}
          aria-label={`Comment on ${rowName({ kind, oldNo, newNo })}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onAdd(n)}
        >
          <IconPlus />
        </button>
        <span className="num">{oldNo}</span>
        <span className="num">{newNo}</span>
      </div>
      <div className="sign" aria-hidden="true">
        {signOf(kind)}
      </div>
      <div className="code" data-note={uncoloured ? LONG_LINE_NOTE : undefined}>
        {kind === 'file' ? (
          <>
            <span className="file-path">{title}</span>
            {badge && <span className="chip">{badge}</span>}
          </>
        ) : isCode ? (
          <Tokens tokens={tokens} fallback={bodyOf(text, kind)} />
        ) : (
          text
        )}
      </div>
    </div>
  )
})

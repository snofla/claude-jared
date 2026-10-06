import type { CSSProperties } from 'react'
import { commentBarTitle } from '../lib/review'
import type { LineRange, ReviewComment } from '../types'

interface Props {
  total: number
  comments: ReviewComment[]
  /** The lane of each comment's bar (`commentLanes`) when any two comments overlap, so that their ticks stand side by side; else `null`, and every tick has the width it always had. */
  lanes: ReadonlyMap<string, number> | null
  selection: LineRange | null
  onJump: (line: number) => void
}

/** The width of the ruler's column divided by the lanes: a tick in a lane is this many pixels from the one before, and one pixel narrower. */
const TICK_LANE = 4

/** Thin overview strip beside the scrollbar: where in the file the comments (and the selection) are. */
export function Ruler({ total, comments, lanes, selection, onJump }: Props) {
  const place = (start: number, end: number): CSSProperties => ({
    top: `${((start - 1) / total) * 100}%`,
    height: `max(3px, ${((end - start + 1) / total) * 100}%)`,
  })

  return (
    // The ticks repeat what the cards and the comments panel say, and the keyboard cannot reach them: they are for the mouse, so a screen reader is not shown them.
    <div className="ruler" aria-hidden="true">
      {comments.map((c) => (
        <button
          key={c.id}
          type="button"
          tabIndex={-1}
          className="tick"
          style={{ ...place(c.startLine, c.endLine), ...(lanes ? { left: `${(lanes.get(c.id) ?? 0) * TICK_LANE}px`, right: 'auto', width: `${TICK_LANE - 1}px` } : {}) }}
          title={commentBarTitle(c)}
          onClick={() => onJump(c.startLine)}
        />
      ))}
      {selection && <span className="tick tick-selection" style={place(selection.start, selection.end)} />}
    </div>
  )
}

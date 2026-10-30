import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { dragWidth, splitterKey, type SplitterSide } from './splitter-keys.ts'
import './splitter.css'

export interface SplitterProps {
  /** Which panel the edge sizes, in the caller's words: the edge's name for a screen reader. */
  label: string
  /** What the edge says under the pointer, in the caller's words. */
  title?: string
  /** The panel's width now, in px, which the edge reports as its value. */
  width: number
  /** The least and the most width of the panel, which the edge reports, and which Home and End ask for. */
  min: number
  max: number
  /** Which side of the edge the panel is on: `left` grows as the edge moves right, `right` as it moves left. */
  side: SplitterSide
  /** A width asked for while the edge is dragged, and by a key: not clamped, so that the owner clamps it and snaps it. */
  onResize: (width: number) => void
  /** The drag is let go, or a key was pressed, at this width: where the owner closes a panel or snaps it to a rail. A press that did not move asks for nothing. */
  onRelease: (width: number) => void
  /** A double-click: the owner gives the panel its usual width back. */
  onReset: () => void
  /** Layout only. Never the look. */
  className?: string
}

/** A drag under way: the pointer that holds the edge, where it was pressed, the width then, and the last width asked for. */
interface Drag {
  pointer: number
  x: number
  width: number
  last: number
}

/**
 * The edge between two panels, which a pointer or a finger drags, the keys move and a double-click resets. It holds no width of its own: it is given the
 * panel's width, its least and most, and the side that the panel is on, and it tells its owner only what is asked for, so that the owner clamps and snaps.
 * It takes no room in the row; its line shows in the accent colour under the pointer, while it is dragged and when the keys have it, over a hit area wider
 * than the line. The pointer is captured for the drag, so the drag goes on outside the edge, and the cursor stays the edge's; Escape during the drag asks
 * for the width at the press again and lets nothing go.
 */
export function Splitter({ label, title, width, min, max, side, onResize, onRelease, onReset, className }: SplitterProps) {
  const drag = useRef<Drag | null>(null)
  const [dragging, setDragging] = useState(false)

  const press = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return // the main button of a mouse, a finger or a pen
    if (drag.current) return // a second finger does not take over the drag: the first one lets it go
    event.preventDefault() // no text is selected while the edge is dragged; it also keeps the browser from giving the edge the focus, so the edge takes it here, for Escape to reach it
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointer: event.pointerId, x: event.clientX, width, last: width }
    setDragging(true)
  }
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const held = drag.current
    if (!held || event.pointerId !== held.pointer) return
    const asked = dragWidth(held.width, held.x, event.clientX, side)
    if (asked === held.last) return
    held.last = asked
    onResize(asked)
  }
  const letGo = (event: PointerEvent<HTMLDivElement>) => {
    const held = drag.current
    if (!held || event.pointerId !== held.pointer) return
    drag.current = null
    setDragging(false)
    if (held.last !== held.width) onRelease(held.last)
  }
  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    const held = drag.current
    if (held && event.key === 'Escape') {
      // Escape while the edge is dragged: back to the width at the press, and nothing let go, so that the owner keeps nothing of the drag.
      event.preventDefault()
      drag.current = null
      setDragging(false)
      if (event.currentTarget.hasPointerCapture(held.pointer)) event.currentTarget.releasePointerCapture(held.pointer)
      if (held.last !== held.width) onResize(held.width)
      return
    }
    if (held) return // the keys wait until the drag is let go
    if (event.altKey || event.ctrlKey || event.metaKey) return // the browser's own keys (Back and Forward, the top of the page) stay the browser's
    const asked = splitterKey(event.key, event.shiftKey, width, min, max, side)
    if (asked === null) return
    event.preventDefault()
    onResize(asked)
    onRelease(asked)
  }

  return (
    <div
      className={['jared-splitter', className].filter(Boolean).join(' ')}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(width)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title={title}
      data-dragging={dragging || undefined}
      onPointerDown={press}
      onPointerMove={move}
      onPointerUp={letGo}
      onPointerCancel={letGo}
      onLostPointerCapture={letGo}
      onDoubleClick={onReset}
      onKeyDown={key}
    />
  )
}

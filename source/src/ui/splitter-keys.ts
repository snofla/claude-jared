/** Which side of the edge the panel is on: `left`, a panel that grows as the edge moves right; `right`, one that grows as the edge moves left. */
export type SplitterSide = 'left' | 'right'

/** How far an arrow key moves the edge, in px, and how far with Shift. */
export const SPLITTER_STEP = 16
export const SPLITTER_STEP_SHIFT = 64

/** +1 when the panel grows as the edge moves right, -1 when it grows as the edge moves left. */
const growth = (side: SplitterSide): number => (side === 'left' ? 1 : -1)

/**
 * The width that a key asks of the edge of a panel: the arrow keys move the edge by `SPLITTER_STEP`, or `SPLITTER_STEP_SHIFT` with Shift, in their direction,
 * so that the arrow towards the panel narrows it; Home asks for the least width and End for the most. What is asked is not clamped: the owner clamps it and
 * snaps it. `null` for any other key.
 */
export function splitterKey(key: string, shift: boolean, width: number, min: number, max: number, side: SplitterSide): number | null {
  const step = shift ? SPLITTER_STEP_SHIFT : SPLITTER_STEP
  if (key === 'ArrowRight') return width + growth(side) * step
  if (key === 'ArrowLeft') return width - growth(side) * step
  if (key === 'Home') return min
  if (key === 'End') return max
  return null
}

/** The width that a drag asks for: the width at the press, and the way that the pointer has gone since, along the edge's direction of growth. Not clamped. */
export const dragWidth = (startWidth: number, startX: number, x: number, side: SplitterSide): number => startWidth + growth(side) * (x - startX)

import type { LineSelection } from '../types.ts'
import { rangeOf } from './review.ts'
import { clamp } from './util.ts'

/**
 * The rules by which the code viewer turns what the reviewer does (a key, a click, a highlight, a drag) into a selection of
 * lines. They take plain values and give plain values: reading the browser's DOM selection and the pointer's position is left
 * to the component (`CodeViewer`), which hands the result of reading to these.
 */

/** Whether line `n` is inside `start`..`end`, both ends included. */
export const within = (n: number, start: number, end: number): boolean => n >= start && n <= end

/** How many lines Page Up and Page Down move the selection. */
export const PAGE_STEP = 20

/** The number of lines a key moves the selection by, or `null` for a key that does not move it. */
export function selectionKeyDelta(key: string): number | null {
  switch (key) {
    case 'ArrowDown':
      return 1
    case 'ArrowUp':
      return -1
    case 'PageDown':
      return PAGE_STEP
    case 'PageUp':
      return -PAGE_STEP
    default:
      return null
  }
}

/**
 * The selection after a move of `delta` lines from where the focus is, kept inside the file. With nothing selected the
 * move starts above the first line, so a first Down selects line 1. With `extend` the anchor stays; without it the
 * selection is the one line it lands on.
 */
export function moveSelection(current: LineSelection | null, delta: number, extend: boolean, lineCount: number): LineSelection {
  const focus = clamp((current?.focus ?? 0) + delta, 1, lineCount)
  return { anchor: extend && current ? current.anchor : focus, focus }
}

/**
 * The selection when the pointer goes down on line `n`, in the gutter or on the text: that line, or with `extend` (Shift) from
 * where the current selection started, if there is one.
 */
export function selectionAtPress(current: LineSelection | null, n: number, extend: boolean): LineSelection {
  return { anchor: extend && current ? current.anchor : n, focus: n }
}

/** The text that the browser has highlighted, as the line each end is on (`null`: not on a line) and whether the end is at the very start of its line. */
export interface HighlightedText {
  first: number | null
  last: number | null
  endAtLineStart: boolean
}

/**
 * The selection when the mouse button is released inside the code, or `null` to leave the selection as it is. `downLine` is
 * the line the button went down on, and `text` is what the browser has highlighted, or `null` if nothing is: that was a click
 * and acts as a press. A highlight selects the lines it touches, except the last when it only reaches the very start of it,
 * as a triple-click does, which ends at the start of the next line. A highlight with an end outside the lines selects nothing.
 */
export function selectionFromMouseUp(
  current: LineSelection | null,
  downLine: number,
  extend: boolean,
  text: HighlightedText | null,
): LineSelection | null {
  if (text === null) return selectionAtPress(current, downLine, extend)
  const { first, last, endAtLineStart } = text
  if (first === null || last === null) return null
  return { anchor: first, focus: last > first && endAtLineStart ? last - 1 : last }
}

/** The selection to make when the + beside line `n` is pressed, or `null` to keep it: it is kept when it already contains `n`. */
export function selectionForAdd(current: LineSelection | null, n: number): LineSelection | null {
  const range = current ? rangeOf(current) : null
  return range && within(n, range.start, range.end) ? null : { anchor: n, focus: n }
}

/**
 * How far to scroll for a pointer at `y` while a drag is in progress, in pixels, negative for up: nothing in the middle of
 * the viewport (`top` to `bottom`), and in the `edge` pixels at the top or the bottom a third of how far inside the edge the
 * pointer is, rounded up, so that it speeds up as the pointer goes further.
 */
export function autoscrollDelta(y: number, top: number, bottom: number, edge: number): number {
  if (y < top + edge) return -Math.ceil((top + edge - y) / 3)
  if (y > bottom - edge) return Math.ceil((y - (bottom - edge)) / 3)
  return 0
}

/** A rectangle on the screen. */
export interface Box {
  left: number
  right: number
  top: number
  bottom: number
}

/** The point nearest `x`, `y` that is inside `box`, one pixel from its edges: where to look for the line that a dragged pointer is over. */
export function pointInside(x: number, y: number, box: Box): { x: number; y: number } {
  return { x: clamp(x, box.left + 1, box.right - 1), y: clamp(y, box.top + 1, box.bottom - 1) }
}

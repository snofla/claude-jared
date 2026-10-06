import type { ReviewComment } from '../types.ts'

/** What the code viewer draws its rows from. Plain functions of the comments and the lines of the file. */

/** How many lanes of comment bars the gutter draws side by side. A fourth comment that overlaps the others shares the last lane. */
export const LANES = 3
/** The width of one comment bar in pixels, and the distance between the left edges of two lanes: the CSS of `.row.lanes-N` says the same. */
export const LANE_WIDTH = 3
export const LANE_STEP = 6

/**
 * The order that comments are given lanes in: by first line, the longer range first, then by the time they were made. Not the order of
 * `sortComments`, which the review keeps and a reader follows: that one puts the shorter range first.
 */
function laneOrder(comments: readonly ReviewComment[]): ReviewComment[] {
  return [...comments].sort((a, b) => a.startLine - b.startLine || b.endLine - a.endLine || a.createdAt.localeCompare(b.createdAt))
}

/**
 * The lane (0 to `LANES` - 1) that the bar of each comment is drawn in, by comment id. Each comment takes the lowest lane that is free
 * over its lines, so a review in which no two comments overlap has every bar in the first lane, where the one bar always was.
 */
export function commentLanes(comments: readonly ReviewComment[]): Map<string, number> {
  const lanes = new Map<string, number>()
  const busyUntil: number[] = [] // the last line that a comment in each lane covers
  for (const c of laneOrder(comments)) {
    let lane = busyUntil.findIndex((end) => end < c.startLine)
    if (lane < 0) lane = Math.min(busyUntil.length, LANES - 1)
    busyUntil[lane] = c.endLine // in the shared last lane this may shrink, and then no comment gets another lane for it: the answer there is the last lane either way
    lanes.set(c.id, lane)
  }
  return lanes
}

/** Whether any two comments overlap, which is when a second lane is in use. */
export function hasOverlap(lanes: ReadonlyMap<string, number>): boolean {
  return [...lanes.values()].some((lane) => lane > 0)
}

/**
 * For each line, the lanes that have a bar on it, as bits (lane 0 is 1, lane 1 is 2, lane 2 is 4), indexed by line number from 1 (index 0
 * is not used). 0 is a line that no comment covers. A comment is cut off at the last line.
 */
export function laneMasks(comments: readonly ReviewComment[], lineCount: number, lanes: ReadonlyMap<string, number> = commentLanes(comments)): Uint8Array {
  const masks = new Uint8Array(lineCount + 1)
  for (const c of comments) {
    const bit = 1 << (lanes.get(c.id) ?? 0)
    for (let l = c.startLine; l <= Math.min(c.endLine, lineCount); l++) masks[l] |= bit
  }
  return masks
}

/**
 * Whether a press on the gutter may be a press on a comment bar: a mouse or a pen, with no modifier key. A finger is too wide for the bars (the
 * comments panel is its way), and Shift, Ctrl and Meta on the gutter extend or move a selection of lines, as they did before there were bars.
 */
export function pressesBar(press: { pointerType: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): boolean {
  return (press.pointerType === 'mouse' || press.pointerType === 'pen') && !press.shiftKey && !press.ctrlKey && !press.metaKey
}

/** The lane under a pointer that is `x` pixels from the left edge of the gutter, or `null` when it is not over a lane. A lane's column is `LANE_STEP` wide, wider than its bar. */
export function laneAtOffset(x: number): number | null {
  return x >= 0 && x < LANES * LANE_STEP ? Math.floor(x / LANE_STEP) : null
}

/** The comment whose bar is in `lane` on `line`: of several in a shared lane, the first in the order that lanes are given. */
export function commentAtLane(comments: readonly ReviewComment[], line: number, lane: number): ReviewComment | undefined {
  const lanes = commentLanes(comments)
  return laneOrder(comments).find((c) => lanes.get(c.id) === lane && c.startLine <= line && line <= c.endLine)
}

/** The comments that end on each line, in the order they were given: a comment is drawn below the last line it covers. */
export function commentsByEnd(comments: readonly ReviewComment[]): Map<number, ReviewComment[]> {
  const byEnd = new Map<number, ReviewComment[]>()
  for (const c of comments) {
    const list = byEnd.get(c.endLine)
    if (list) list.push(c)
    else byEnd.set(c.endLine, [c])
  }
  return byEnd
}

/**
 * The width of the widest line in characters, for the width of the scrolling area: rows are drawn lazily, so it cannot be read
 * from the page. A tab counts as four characters.
 */
export function maxColumns(lines: readonly string[]): number {
  let max = 0
  for (const line of lines) {
    const tabs = line.includes('\t') ? line.split('\t').length - 1 : 0
    max = Math.max(max, line.length + tabs * 3)
  }
  return max
}

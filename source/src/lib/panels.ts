import type { FilesMode } from './files.ts'
import { COMMENTS_WIDTH, FILES_WIDTH, type WidthRange } from './settings.ts'

/**
 * The widths of the two panels beside the code in a wide window: the list of files on the left and the comments panel on the right. The reviewer's widths are
 * a preference, and what the page draws is worked out from it and the room at each draw, so that a window that grows back shows the preference again. The code
 * keeps `CODE_ROOM` between them; when both panels do not fit their preferences, each gives up room in proportion to what it has above its least width.
 */

/** The least width that the code keeps between the panels, in px. */
export const CODE_ROOM = 400

/** The width of the list of files as its rail, in px, which the stylesheet draws it at too. */
export const RAIL_WIDTH = 60

/** Where an edge that is let go snaps: the list to its rail under `FILES_TO_RAIL` and closed under `FILES_TO_CLOSED`, the comments panel closed under `COMMENTS_TO_CLOSED`. */
export const FILES_TO_RAIL = 130
export const FILES_TO_CLOSED = 40
export const COMMENTS_TO_CLOSED = 160

/** What the page has of a panel: shown or not (the list also as its rail), and the width that the reviewer kept for it. */
export interface PanelsAsked {
  files: { mode: FilesMode; width: number }
  comments: { open: boolean; width: number }
}

/** The widths to draw, in whole px: 0 for a panel that is not shown, `RAIL_WIDTH` for the rail. */
export interface PanelWidths {
  files: number
  comments: number
}

const clamp = (value: number, range: WidthRange): number => Math.min(range.max, Math.max(range.min, value))

/** The widths to draw in a row of `room` px: each panel at its kept width within its range, and both made narrower, down to their least, when the code would have less than `CODE_ROOM`. */
export function shownWidths(room: number, asked: PanelsAsked): PanelWidths {
  const rail = asked.files.mode === 'rail'
  const files = asked.files.mode === 'open' ? clamp(asked.files.width, FILES_WIDTH) : 0
  const comments = asked.comments.open ? clamp(asked.comments.width, COMMENTS_WIDTH) : 0
  const spare = room - CODE_ROOM - (rail ? RAIL_WIDTH : 0)
  const over = files + comments - spare
  const given = (width: number, range: WidthRange, give: number): number => (width === 0 ? 0 : Math.max(range.min, Math.floor(width - give)))
  if (over <= 0) return { files: rail ? RAIL_WIDTH : files, comments }
  // What each can give is what it has above its least; each gives its share of what is over, and no more than it can.
  const canFiles = files === 0 ? 0 : files - FILES_WIDTH.min
  const canComments = comments === 0 ? 0 : comments - COMMENTS_WIDTH.min
  const can = canFiles + canComments
  const share = can === 0 ? 0 : Math.min(1, over / can)
  return { files: rail ? RAIL_WIDTH : given(files, FILES_WIDTH, canFiles * share), comments: given(comments, COMMENTS_WIDTH, canComments * share) }
}

/** The width that a dragged edge shows while it is held: what the drag asks, no wider than the panel's most, and never below 0. */
export const heldWidth = (asked: number, range: WidthRange): number => Math.round(Math.min(range.max, Math.max(0, asked)))

/** What the list of files becomes when its edge is let go at `asked` px: closed, its rail, or open at a width in its range (so 130 to 199 px opens it at 200). */
export function filesLetGo(asked: number): { mode: 'closed' } | { mode: 'rail' } | { mode: 'open'; width: number } {
  if (asked < FILES_TO_CLOSED) return { mode: 'closed' }
  if (asked < FILES_TO_RAIL) return { mode: 'rail' }
  return { mode: 'open', width: Math.round(clamp(asked, FILES_WIDTH)) }
}

/** What the comments panel becomes when its edge is let go at `asked` px: closed, or open at a width in its range (so 160 to 259 px opens it at 260). */
export function commentsLetGo(asked: number): { open: false } | { open: true; width: number } {
  if (asked < COMMENTS_TO_CLOSED) return { open: false }
  return { open: true, width: Math.round(clamp(asked, COMMENTS_WIDTH)) }
}

import type { FilesMode } from './files.ts'
import { parseTheme, type Theme } from './theme.ts'

/**
 * What the reviewer keeps about how Jared looks, as one record: the colour scheme and the layout of the page. The page keeps its own copy in `localStorage` and,
 * when it knows a place that keeps it for every window (the Jared service, a receiver), asks that place too. A record that is not right is the usual one, a field at
 * a time, so that an old or edited record never stops the page from drawing: nothing here throws.
 */

/** The version of the record. A record of another version is read as the usual one and is overwritten by the next write. */
export const SETTINGS_VERSION = 1

/** The least, the most and the usual width of a panel in px, which no stored width is outside of. */
export interface WidthRange {
  min: number
  max: number
  usual: number
}

export const FILES_WIDTH: WidthRange = { min: 200, max: 520, usual: 252 }
export const COMMENTS_WIDTH: WidthRange = { min: 260, max: 560, usual: 320 }

/** The list of files: its width, and how it is shown when the reviewer chose (`null`: not chosen, so that the window decides). */
export interface FilesLayout {
  width: number
  mode: FilesMode | null
}

/** The comments panel: its width, and whether it is open when the reviewer chose (`null`: not chosen, so that the window decides). */
export interface CommentsLayout {
  width: number
  open: boolean | null
}

export interface Layout {
  files: FilesLayout
  comments: CommentsLayout
}

export interface Settings {
  v: typeof SETTINGS_VERSION
  theme: Theme
  layout: Layout
}

/** The usual layout and settings, new each time, so that a caller that changes what it was given changes nothing else. */
export const usualLayout = (): Layout => ({ files: { width: FILES_WIDTH.usual, mode: null }, comments: { width: COMMENTS_WIDTH.usual, open: null } })

export const usualSettings = (): Settings => ({ v: SETTINGS_VERSION, theme: 'system', layout: usualLayout() })

const FILES_MODES: readonly FilesMode[] = ['open', 'rail', 'closed']

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** A width that is a whole number in the range, as the service holds it to, and the usual one for anything else (a fraction, `NaN`, a string); it is not clamped, since a stored width outside the range is a wrong one. */
export function parseWidth(value: unknown, range: WidthRange): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= range.min && value <= range.max ? value : range.usual
}

/** The layout in a stored value (`{ files, comments }`, without a version: the caller checks that), the usual one for every field that is not right. */
export function parseLayout(value: unknown): Layout {
  const files = isRecord(value) && isRecord(value.files) ? value.files : {}
  const comments = isRecord(value) && isRecord(value.comments) ? value.comments : {}
  return {
    files: { width: parseWidth(files.width, FILES_WIDTH), mode: FILES_MODES.includes(files.mode as FilesMode) ? (files.mode as FilesMode) : null },
    comments: { width: parseWidth(comments.width, COMMENTS_WIDTH), open: typeof comments.open === 'boolean' ? comments.open : null },
  }
}

/** Whether a value is a settings record of this version, which is what a record from a place that keeps them has to be before it is taken over what the page has. */
export const isSettings = (value: unknown): boolean => isRecord(value) && value.v === SETTINGS_VERSION

/** The settings in a stored value, or the usual ones for anything that is not a record of this version; a field that is not right is the usual one. */
export function parseSettings(value: unknown): Settings {
  if (!isRecord(value) || value.v !== SETTINGS_VERSION) return usualSettings()
  return { v: SETTINGS_VERSION, theme: parseTheme(value.theme), layout: parseLayout(value.layout) }
}

/** One change to one part of the settings: the scheme, or some fields of one panel. Only that part is written, so that two windows lose only a change to the same part at the same time. */
export type SettingsChange = { theme: Theme } | { files: Partial<FilesLayout> } | { comments: Partial<CommentsLayout> }

/** A width that a drag asked for, as a whole number: the record holds whole numbers, and a pointer's position may not be one. */
const whole = (width: number | undefined): number | undefined => (width === undefined ? undefined : Math.round(width))

/**
 * The stored value with the change in it: read as settings, so that a record that is not right is mended by the write, and the other parts are what they were.
 * A width in the change is rounded to a whole number first; one that is out of its range is then the usual width.
 */
export function withChange(stored: unknown, change: SettingsChange): Settings {
  const settings = parseSettings(stored)
  const files = 'files' in change ? { ...settings.layout.files, ...change.files, width: whole(change.files.width) ?? settings.layout.files.width } : settings.layout.files
  const comments = 'comments' in change ? { ...settings.layout.comments, ...change.comments, width: whole(change.comments.width) ?? settings.layout.comments.width } : settings.layout.comments
  return { v: SETTINGS_VERSION, theme: 'theme' in change ? parseTheme(change.theme) : settings.theme, layout: parseLayout({ files, comments }) }
}

/** The layout as the page keeps its own copy of it (`localStorage`, `jared:layout`): `{ v, files, comments }`. */
export const layoutRecord = (layout: Layout): Record<string, unknown> => ({ v: SETTINGS_VERSION, files: layout.files, comments: layout.comments })

/** The layout in the page's own copy: the usual one for another version, and for anything that is not a record. */
export const parseLayoutRecord = (value: unknown): Layout => (isRecord(value) && value.v === SETTINGS_VERSION ? parseLayout(value) : usualLayout())

/** The settings as the service takes them for *Reset layout*: the scheme and no layout, which is a record of its own (a reset of the layout is not a reset of the scheme). */
export const settingsRecordWithoutLayout = (settings: Settings): Record<string, unknown> => ({ v: SETTINGS_VERSION, theme: settings.theme })

/** The settings as the service takes them (the contract of `PUT /<secret>/settings`): the fields that were chosen, and none that the record does not name, so a mode or an open that was never chosen is left out. */
export function settingsRecord(settings: Settings): Record<string, unknown> {
  const { files, comments } = settings.layout
  return {
    v: SETTINGS_VERSION,
    theme: settings.theme,
    layout: {
      files: { width: files.width, ...(files.mode === null ? {} : { mode: files.mode }) },
      comments: { width: comments.width, ...(comments.open === null ? {} : { open: comments.open }) },
    },
  }
}

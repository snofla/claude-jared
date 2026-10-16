import { COPY } from './copy'
import { MAX_SCANNED, pathOfEntry, skippedInFolder, usableBytes, type ReadFile, type ReadMany } from './set-pick'
import type { TextEdit } from './indent'
import { MAX_BYTES, MAX_SET_BYTES, prepareSource, tooBig, type OpenResult } from './source'
import { themeAttribute, type Theme } from './theme'

/** What only a browser page can do: read a file that the reviewer picked, save a review as a file, put it on the clipboard. Not part of the engine. */

/** Read a picked or dropped file, and say what it holds or why it cannot be opened. */
export async function readPickedFile(file: File): Promise<OpenResult> {
  // Checked before reading, so that a file over the limit is never read into memory.
  if (file.size > MAX_BYTES) return { ok: false, error: tooBig(file.name, file.size) }
  let raw: string
  try {
    raw = await file.text()
  } catch {
    return { ok: false, error: COPY.couldNotRead(file.name) }
  }
  return prepareSource(file.name, raw)
}

/** What a drop held, taken in the drop event itself: a browser empties the list of items afterwards. `entries` are the files and folders, when the browser has them. */
export interface Capture {
  files: File[]
  entries: FileSystemEntry[]
}

export function captureDrop(drop: DataTransfer): Capture {
  const entries: FileSystemEntry[] = []
  for (const item of Array.from(drop.items ?? [])) {
    const entry = item.kind === 'file' ? item.webkitGetAsEntry?.() : null
    if (entry) entries.push(entry)
  }
  return { files: Array.from(drop.files ?? []), entries }
}

/** How many files are read at once. */
const BATCH = 25

type Found = { name: string; file: File | null }

/** The files below a dropped folder, or the file itself: named by their path from the dropped folder, and without what starts with a dot or is node_modules. */
async function collect(entry: FileSystemEntry, found: Found[], unreadFolders: string[]): Promise<void> {
  if (found.length > MAX_SCANNED) return
  if (entry.isFile) {
    const file = await new Promise<File | null>((resolve) => (entry as FileSystemFileEntry).file(resolve, () => resolve(null)))
    found.push({ name: pathOfEntry(entry.fullPath), file })
    return
  }
  const reader = (entry as FileSystemDirectoryEntry).createReader()
  // A directory is read in batches, and an empty batch is the end of it. A batch that cannot be read is not the end: the folder is said to be unread (Chrome
  // does that on a page opened from a file), what its earlier batches gave is kept, and the rest of the drop is read.
  for (;;) {
    const batch = await new Promise<FileSystemEntry[] | null>((resolve) => reader.readEntries(resolve, () => resolve(null)))
    if (batch === null) {
      unreadFolders.push(pathOfEntry(entry.fullPath))
      return
    }
    if (batch.length === 0) return
    for (const child of batch) if (!skippedInFolder(child.name)) await collect(child, found, unreadFolders)
  }
}

async function readFound({ name, file }: Found): Promise<ReadFile> {
  if (!file) return { name, size: 0, text: null }
  // Checked before reading, as for one file: a file over the limit is never read into memory.
  if (file.size > MAX_BYTES) return { name, size: file.size, text: null }
  try {
    return { name, size: file.size, text: await file.text() }
  } catch {
    return { name, size: file.size, text: null }
  }
}

/** Read what was picked (a list of files) or dropped (files, or folders and files): every file with its name, size and text; at most `MAX_SCANNED` are looked at. */
export async function readMany(picked: File[] | Capture): Promise<ReadMany> {
  const found: Found[] = []
  const unreadFolders: string[] = []
  if (Array.isArray(picked)) for (const file of picked) found.push({ name: file.name, file })
  else if (picked.entries.some((entry) => entry.isDirectory)) for (const entry of picked.entries) await collect(entry, found, unreadFolders)
  else for (const file of picked.files) found.push({ name: file.name, file })
  // Read a few at a time, and stop when the text that can be opened is more than a review holds: the plan is then too much whatever the rest is, and the
  // rest is not read into memory (a folder of a thousand files of 300 KB is 300 MB).
  const files: ReadFile[] = []
  const counted = new Set<string>()
  let bytes = 0
  const scanned = found.slice(0, MAX_SCANNED)
  for (let at = 0; at < scanned.length && bytes <= MAX_SET_BYTES; at += BATCH) {
    for (const file of await Promise.all(scanned.slice(at, at + BATCH).map(readFound))) {
      files.push(file)
      if (!counted.has(file.name)) bytes += usableBytes(file)
      counted.add(file.name)
    }
  }
  return { files, unread: found.length - files.length, ...(unreadFolders.length > 0 ? { unreadFolders } : {}) }
}

export function downloadText(filename: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Copy by selecting the text in a temporary field, for a browser that refuses the clipboard API (an embedded one, or a
 * page without permission). The field goes inside the open dialog, if there is one, because what is outside a modal dialog
 * cannot be selected.
 */
function copyBySelection(text: string): boolean {
  let field: HTMLTextAreaElement | undefined
  try {
    field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.opacity = '0'
    const host = (document.activeElement as HTMLElement | null)?.closest('dialog') ?? document.body
    host.append(field)
    field.select()
    return document.execCommand('copy')
  } catch {
    return false // no page to select in, or a browser that does not allow it
  } finally {
    field?.remove()
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return copyBySelection(text)
  }
}

/** Show the page in the reviewer's colour scheme: light or dark set `data-theme` on `<html>`, which the CSS selects on, and system takes it off. */
export function applyTheme(theme: Theme): void {
  const attribute = themeAttribute(theme)
  if (attribute === null) delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = attribute
}


/**
 * Puts an edit into a text area as a typed change, so that the browser's own undo takes it back in one step, and then selects what the edit says. When the
 * browser will not insert text that way, the range is replaced directly and an `input` event tells the page.
 */
export function editField(field: HTMLTextAreaElement, edit: TextEdit): void {
  field.setSelectionRange(edit.from, edit.to)
  if (!document.execCommand('insertText', false, edit.insert)) {
    field.setRangeText(edit.insert, edit.from, edit.to, 'end')
    field.dispatchEvent(new Event('input', { bubbles: true }))
  }
  field.setSelectionRange(edit.start, edit.end)
}

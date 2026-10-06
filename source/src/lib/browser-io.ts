import { MAX_BYTES, prepareSource, tooBig, type OpenResult } from './source'
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
    return { ok: false, error: `Couldn't read ${file.name}.` }
  }
  return prepareSource(file.name, raw)
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


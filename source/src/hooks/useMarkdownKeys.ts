import { useCallback, useMemo, type KeyboardEvent } from 'react'
import { continueList, insertLink, isApple, toggleEmphasis } from '../lib/markdown-keys'
import type { TextEdit } from '../lib/indent'
import { usePlatform } from './usePlatform'

/**
 * The editing aids of a field of Markdown: ⌘B (Ctrl+B elsewhere) and ⌘I for bold and italic, ⌘K for a link, and Enter at the end of a list item for the next
 * item. Each is an edit of the field made through the platform, so that the browser's own undo takes it back. Every other key, and these with Shift or Alt, does what
 * it always does, and so does Enter with ⌘ or Ctrl, which the form uses to save.
 */
export function useMarkdownKeys() {
  const { fields } = usePlatform()
  const apple = useMemo(() => isApple(typeof navigator === 'undefined' ? '' : (navigator.platform ?? '')), [])

  return useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.nativeEvent.isComposing) return
      const field = e.currentTarget
      const { value, selectionStart: start, selectionEnd: end } = field
      let edit: TextEdit | null = null
      const shortcut = apple ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey
      if (shortcut && !e.altKey && !e.shiftKey) {
        const key = e.key.toLowerCase()
        if (key === 'b') edit = toggleEmphasis(value, start, end, '**')
        else if (key === 'i') edit = toggleEmphasis(value, start, end, '*')
        else if (key === 'k') edit = insertLink(value, start, end)
      } else if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
        edit = continueList(value, start, end)
      }
      if (edit) {
        e.preventDefault()
        fields.edit(field, edit)
      }
    },
    [apple, fields],
  )
}

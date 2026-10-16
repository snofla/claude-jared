import { useCallback, useRef, type KeyboardEvent } from 'react'
import { indentEdit, outdentEdit } from '../lib/indent'
import { usePlatform } from './usePlatform'

const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'])

/**
 * Tab and Shift+Tab in a field of code: they indent and outdent the lines that the caret or the selection touches, by `unit`. A field that takes Tab has to give the key
 * back, so the first Escape in it is taken (the form around it does not hear it) and the next Tab, or Shift+Tab, moves on as it always does; any other key, or leaving the
 * field, takes the Escape back, and an Escape that comes after an Escape is not taken, so that it reaches the form as before.
 */
export function useTabIndent(unit: string) {
  const { fields } = usePlatform()
  const leaving = useRef(false)

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.nativeEvent.isComposing) return
      if (e.key === 'Escape') {
        if (leaving.current) return
        leaving.current = true
        e.preventDefault()
        e.stopPropagation()
        return
      }
      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (leaving.current) {
          leaving.current = false
          return
        }
        e.preventDefault()
        const field = e.currentTarget
        const edit = e.shiftKey
          ? outdentEdit(field.value, field.selectionStart, field.selectionEnd, unit)
          : indentEdit(field.value, field.selectionStart, field.selectionEnd, unit)
        if (edit) fields.edit(field, edit)
        return
      }
      if (!MODIFIERS.has(e.key)) leaving.current = false
    },
    [unit, fields],
  )

  const onBlur = useCallback(() => {
    leaving.current = false
  }, [])

  return { onKeyDown, onBlur }
}

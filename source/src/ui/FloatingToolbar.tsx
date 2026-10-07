import type { ComponentPropsWithoutRef } from 'react'
import './floating-toolbar.css'

export type FloatingToolbarProps = Omit<ComponentPropsWithoutRef<'div'>, 'className' | 'role' | 'aria-label'> & {
  /** What the toolbar is for, in the caller's words: its accessible name. */
  label: string
  /** Where it floats, and how wide it may be: layout, which the toolbar does not choose. Never the look. */
  className?: string
}

/**
 * A row of controls in a pill with a border and a shadow, for a bar that floats over something. It is a `toolbar` and is named by `label`. It does
 * not position itself: the caller says where it floats, with a layout class. The controls are its children, and their words are the caller's.
 */
export function FloatingToolbar({ label, className, ...rest }: FloatingToolbarProps) {
  return <div {...rest} role="toolbar" aria-label={label} className={['jared-floating-toolbar', className].filter(Boolean).join(' ')} />
}

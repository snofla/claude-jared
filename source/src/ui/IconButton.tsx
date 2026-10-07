import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import './icon-button.css'

/** What a `<button>` takes, less what IconButton decides itself: the look (`className` is for layout), the icon as its only content, and the name. */
type NativeProps = Omit<ComponentPropsWithoutRef<'button'>, 'className' | 'children' | 'aria-label'>

export type IconButtonProps = NativeProps & {
  /** What the button does, in the caller's words: its accessible name. The icon is decorative and there is no text, so without this the button has no name. */
  label: string
  /** The icon, one of the library's. */
  icon: ReactNode
  /** Layout only, such as a place in a row or in a bar. Never the look. */
  className?: string
}

/**
 * A flat icon button, for a bar or the head of a card: no border or background until the pointer is over it, 28 px square, and 44 px where the pointer is a
 * finger. For an icon button that stands among bordered buttons, use `Button` with `iconOnly`. `type` is `button` unless it is given. Every string is the caller's.
 */
export function IconButton({ label, icon, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button {...rest} type={type} className={['jared-icon-btn', className].filter(Boolean).join(' ')} aria-label={label}>
      {icon}
    </button>
  )
}

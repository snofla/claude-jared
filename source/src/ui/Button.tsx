import type { ComponentPropsWithRef, ReactNode } from 'react'
import './button.css'

export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger'
export type ButtonSize = 'md' | 'sm'

/** What a `<button>` takes, less what Button decides itself: the look (`className` is for layout), the children and the two states it draws and announces. */
type NativeProps = Omit<ComponentPropsWithRef<'button'>, 'className' | 'children' | 'aria-pressed' | 'aria-disabled'>

interface CommonProps extends NativeProps {
  variant?: ButtonVariant
  size?: ButtonSize
  /** A toggle: `true` or `false` is drawn and announced (`aria-pressed`); leave it out for a button that is not a toggle. */
  pressed?: boolean
  /** The action it started is under way. The button stays focusable (`aria-disabled`, not `disabled`, so that the keyboard stays on it) and ignores a click. */
  busy?: boolean
  /** Layout only, such as a place in a row or a container query. Never the look: the look is the variant and the size. */
  className?: string
}

export type ButtonProps = CommonProps &
  (
    | {
        iconOnly?: false
        /** A decorative icon before the label. */
        icon?: ReactNode
        /** The label: its text is the accessible name. */
        children: ReactNode
      }
    | {
        /** Only an icon, in a square. It has no text, so its accessible name is required. The default variant or the ghost one: the icon takes the muted colour of its own rule, which would not read on the others. */
        iconOnly: true
        variant?: 'default' | 'ghost'
        icon: ReactNode
        children?: never
        'aria-label': string
      }
  )

/**
 * The library's button. `type` is `button` unless it is given, so that a button inside a form does not submit it by accident. Every string is the
 * caller's: the library holds no English.
 */
export function Button({ variant = 'default', size = 'md', pressed, busy = false, iconOnly = false, icon, className, type = 'button', onClick, children, ...rest }: ButtonProps) {
  const classes = ['jared-btn', variant !== 'default' && `jared-btn-${variant}`, size === 'sm' && 'jared-btn-sm', iconOnly && 'jared-btn-icon', className].filter(Boolean).join(' ')
  return (
    <button
      {...rest}
      type={type}
      className={classes}
      aria-pressed={pressed}
      aria-disabled={busy || undefined}
      onClick={(event) => {
        // A submit button would otherwise still submit its form when the keyboard presses it.
        if (busy) event.preventDefault()
        else onClick?.(event)
      }}
    >
      {icon}
      {children}
    </button>
  )
}

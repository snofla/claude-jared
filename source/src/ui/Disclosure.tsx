import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import './disclosure.css'

export type DisclosureProps = Omit<ComponentPropsWithoutRef<'details'>, 'className' | 'children' | 'onToggle'> & {
  /** The words that are always there and open it: in the caller's words. */
  summary: ReactNode
  /** Told whether it is open after it was opened or closed, by the reader or by the caller's `open`. */
  onToggle?: (open: boolean) => void
  /** Layout only. Never the look. */
  className?: string
  children?: ReactNode
}

/**
 * A group of controls that is closed until it is needed, kept quiet under a hairline: the browser's own `<details>`, with `open` and `onToggle` for a
 * caller that opens it by itself, as a group of alternatives does when the first choice has failed. Its contents are laid out in a row that wraps.
 */
export function Disclosure({ summary, onToggle, className, children, ...rest }: DisclosureProps) {
  return (
    <details {...rest} className={['jared-disclosure', className].filter(Boolean).join(' ')} onToggle={(event) => onToggle?.(event.currentTarget.open)}>
      <summary>{summary}</summary>
      <div className="jared-disclosure-body">{children}</div>
    </details>
  )
}

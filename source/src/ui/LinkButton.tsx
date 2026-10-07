import type { ComponentPropsWithRef } from 'react'
import './link-button.css'

type LinkButtonProps = Omit<ComponentPropsWithRef<'button'>, 'className'> & {
  /** Layout only, such as a place in a line of text. */
  className?: string
}

/**
 * An action that reads as a link inside a line of text: the words, underlined, in the accent colour. It is a button (it does something on this page and does
 * not go to another page), so `type` is `button` unless it is given. The caller gives the words as children.
 */
export function LinkButton({ className, type = 'button', ...rest }: LinkButtonProps) {
  return <button {...rest} type={type} className={['jared-link', className].filter(Boolean).join(' ')} />
}

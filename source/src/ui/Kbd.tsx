import type { ComponentPropsWithoutRef } from 'react'
import './kbd.css'

/** The name of a key, as a hint: a short label in a box, such as `C` or `Esc`. `className` is for layout. */
export function Kbd({ className, ...rest }: ComponentPropsWithoutRef<'kbd'>) {
  return <kbd {...rest} className={['jared-kbd', className].filter(Boolean).join(' ')} />
}

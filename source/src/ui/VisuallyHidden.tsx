import type { ReactNode } from 'react'
import './visually-hidden.css'

/** Words that a screen reader reads and the page does not draw, such as what a link does that its text does not say. `className` is for layout only, as for every component. */
export function VisuallyHidden({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={['jared-visually-hidden', className].filter(Boolean).join(' ')}>{children}</span>
}

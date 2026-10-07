import type { ComponentPropsWithRef } from 'react'
import './select.css'
import './visually-hidden.css'

type SelectProps = Omit<ComponentPropsWithRef<'select'>, 'className'> & {
  /** The accessible name of the choice: always given, and drawn above it unless `labelHidden` says that the page already names it. */
  label: string
  /** Keep the label for a screen reader and do not draw it. */
  labelHidden?: boolean
  /** Layout only, such as the width that the page allows it. It is given to the `select` itself. */
  className?: string
}

/** A native `select`, drawn with the library's field look, in a label of its own. The options are its children, as `option` elements. */
export function Select({ label, labelHidden = false, className, ...rest }: SelectProps) {
  return (
    <label className="jared-select-group">
      <span className={labelHidden ? 'jared-visually-hidden' : 'jared-select-label'}>{label}</span>
      <select {...rest} className={['jared-select', className].filter(Boolean).join(' ')} />
    </label>
  )
}

import { useId, type ComponentPropsWithRef } from 'react'
import './text-field.css'

type TextFieldBase = Omit<ComponentPropsWithRef<'textarea'>, 'className' | 'id' | 'aria-label'> & {
  /** The accessible name of the field: always given. It is drawn above the field unless `labelHidden` says that the page already names it. */
  label: string
  /** `code` is for text that is code: the monospace font, no wrapping and a scroll bar. */
  variant?: 'text' | 'code'
  /** Layout only, such as a margin in a card. It is given to the box around the label and the field. */
  className?: string
}

export type TextFieldProps = TextFieldBase &
  (
    | {
        labelHidden?: false
        /** A few words after the label, in the quiet style, that say what the text will do. */
        hint?: string
      }
    | {
        /** Keep the label for a screen reader and do not draw it, for a field that the page already names to the eye. */
        labelHidden: true
        hint?: never
      }
  )

/**
 * A field for several lines of text: a label, a text area and, if there is one, a hint. Its id comes from `useId`, so two fields on a page do not share one and
 * the label is tied to its own. `ref` and the rest of the props go to the text area.
 */
export function TextField({ label, labelHidden = false, hint, variant = 'text', className, ...rest }: TextFieldProps) {
  const id = useId()
  return (
    <div className={['jared-field-group', className].filter(Boolean).join(' ')}>
      {!labelHidden && (
        <label className="jared-field-label" htmlFor={id}>
          {hint === undefined ? label : `${label} `}
          {hint !== undefined && <span className="jared-field-hint">{hint}</span>}
        </label>
      )}
      <textarea {...rest} id={id} aria-label={labelHidden ? label : undefined} className={['jared-field', variant === 'code' && 'jared-field-code'].filter(Boolean).join(' ')} />
    </div>
  )
}

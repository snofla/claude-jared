import { useId } from 'react'
import './segmented-control.css'
import './visually-hidden.css'

export interface SegmentedOption<T extends string> {
  value: T
  /** The words of the choice, in the caller's words. */
  label: string
}

export interface SegmentedControlProps<T extends string> {
  /** What is being chosen, in the caller's words: the name of the group for a screen reader. */
  label: string
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Layout only. Never the look. */
  className?: string
}

/**
 * A choice of a few, one at a time, drawn as a row of words in a box. It is a radio group, whose controls are visually hidden: the arrow keys move
 * the choice, the choice that is on is drawn from the radio's own checked state, and the option that has the focus shows it with a ring. The name that ties the radios
 * together comes from `useId`, so two controls on a page do not share it.
 */
export function SegmentedControl<T extends string>({ label, options, value, onChange, className }: SegmentedControlProps<T>) {
  const name = useId()
  return (
    <div className={['jared-segmented', className].filter(Boolean).join(' ')} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <label key={option.value} className="jared-segmented-option">
          <input type="radio" name={name} className="jared-visually-hidden" value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
          {option.label}
        </label>
      ))}
    </div>
  )
}

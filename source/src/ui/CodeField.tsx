import { memo, useId, useRef, type ComponentPropsWithRef, type CSSProperties, type UIEvent } from 'react'
import './text-field.css'
import './code-field.css'

/** A piece of a line of the drawing: its letters, the style that colours them (custom properties of a colour per scheme), and whether it is marked. */
export interface CodePart {
  text: string
  style?: CSSProperties
  mark?: boolean
}

export type CodeFieldProps = Omit<ComponentPropsWithRef<'textarea'>, 'className' | 'id' | 'aria-label' | 'children'> & {
  /** The accessible name of the field, drawn above it. */
  label: string
  /** A few words after the label, in the quiet style. */
  hint?: string
  /** Layout only, such as a margin in a card. It is given to the box around the label and the field. */
  className?: string
  /** What is drawn under the letters of the text area: one array of parts for each line of its value, with the same letters. */
  lines: ReadonlyArray<ReadonlyArray<CodePart>>
}

/** Whether two lines of the drawing have the same parts: the same letters, marks and style objects, so that a line that did not change is not drawn again. */
function sameParts(a: ReadonlyArray<CodePart>, b: ReadonlyArray<CodePart>): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  return a.every((part, i) => part.text === b[i].text && part.mark === b[i].mark && part.style === b[i].style)
}

/** One line of the drawing, drawn again only when its parts change: a key or a move of the caret in a long text draws the lines it touches, not all of them. */
const Line = memo(
  function Line({ parts }: { parts: ReadonlyArray<CodePart> }) {
    return (
      <div className="jared-code-field-line">
        {parts.length === 0
          ? ' '
          : parts.map((part, j) => (
              <span key={j} className={part.mark ? 'jared-code-field-mark' : undefined} style={part.style}>
                {part.text}
              </span>
            ))}
      </div>
    )
  },
  (before, after) => sameParts(before.parts, after.parts),
)

/**
 * A field for code that is coloured while it is typed: the text area of a field, with letters that cannot be seen and a caret and a selection that can, laid
 * over a drawing of its lines in their colours. The drawing moves with the text area's scroll and is hidden from a screen reader, which hears the text area
 * as it hears any field; in the system's forced colours the text area shows its own letters and the drawing is not shown.
 */
export function CodeField({ label, hint, className, lines, onScroll, ...rest }: CodeFieldProps) {
  const id = useId()
  const drawing = useRef<HTMLPreElement>(null)
  const follow = (e: UIEvent<HTMLTextAreaElement>) => {
    const pre = drawing.current
    if (pre) pre.style.transform = `translate(${-e.currentTarget.scrollLeft}px, ${-e.currentTarget.scrollTop}px)`
    onScroll?.(e)
  }
  return (
    <div className={['jared-field-group', className].filter(Boolean).join(' ')}>
      <label className="jared-field-label" htmlFor={id}>
        {hint === undefined ? label : `${label} `}
        {hint !== undefined && <span className="jared-field-hint">{hint}</span>}
      </label>
      <div className="jared-code-field">
        <div className="jared-code-field-drawing" aria-hidden="true">
          <pre ref={drawing}>
            {lines.map((parts, i) => (
              <Line key={i} parts={parts} />
            ))}
          </pre>
        </div>
        <textarea {...rest} id={id} spellCheck={false} className="jared-field jared-field-code jared-code-field-input" onScroll={follow} />
      </div>
    </div>
  )
}

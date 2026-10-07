import { useEffect, useId, useImperativeHandle, useRef, type ComponentPropsWithoutRef, type MouseEvent, type ReactNode, type Ref } from 'react'
import { IconButton } from './IconButton.tsx'
import { IconX } from './icons.tsx'
import './dialog.css'

type NativeProps = Omit<ComponentPropsWithoutRef<'dialog'>, 'className' | 'children' | 'title' | 'open' | 'aria-labelledby' | 'aria-label'>

export type DialogProps = NativeProps & {
  /** The element, for a caller that has to close the dialog itself: `ref.current.close()` ends in the dialog's own `close` event, as every other way out does. */
  ref?: Ref<HTMLDialogElement>
  /** The heading: the dialog's name, and the first thing that takes the focus. */
  title: ReactNode
  /** A line of quiet words under the heading. */
  subtitle?: ReactNode
  /** What the cross does, in the caller's words: its accessible name. */
  closeLabel: string
  /** The cross's tooltip, if the caller has one: a bonus for the mouse. */
  closeTitle?: string
  /** Shown as a modal when it appears, which is what a dialog is. `false` leaves it open in the flow of the page, for the gallery and nothing else. */
  modal?: boolean
  /** Layout only, such as where it sits when it is not a modal. Never the look. */
  className?: string
  children?: ReactNode
}

/**
 * A modal dialog, on the browser's own `<dialog>`: a heading, a cross, and the caller's content under them. It is shown the moment it is drawn, so
 * the caller draws it when it is wanted and stops drawing it when it is gone. Every way out (Escape, the cross, a press on the backdrop, and the caller's
 * own `ref.current.close()`) ends in the dialog's `close` event, which is `onClose`; the browser then puts the focus back on what
 * opened it. The focus goes to the heading and not to the first field, so that a phone does not raise its keyboard over words that have not been read.
 */
export function Dialog({ ref, title, subtitle, closeLabel, closeTitle, modal = true, className, children, onClick, ...rest }: DialogProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  useImperativeHandle(ref, () => dialogRef.current as HTMLDialogElement, []) // the element never changes

  useEffect(() => {
    const dialog = dialogRef.current
    if (!modal || !dialog) return // one left open in the flow of the page takes nothing from the page
    if (!dialog.open) dialog.showModal()
    headingRef.current?.focus({ preventScroll: true })
  }, [modal])

  const close = () => dialogRef.current?.close()
  const onPress = (event: MouseEvent<HTMLDialogElement>) => {
    onClick?.(event)
    if (event.target === event.currentTarget) close() // a press on the backdrop is a press on the dialog itself
  }

  return (
    <dialog
      {...rest}
      ref={dialogRef}
      open={modal ? undefined : true}
      className={['jared-dialog', className].filter(Boolean).join(' ')}
      aria-labelledby={titleId}
      onClick={onPress}
    >
      <div className="jared-dialog-body">
        <header>
          <div className="jared-dialog-title">
            <h2 id={titleId} ref={headingRef} tabIndex={-1}>
              {title}
            </h2>
            <IconButton label={closeLabel} title={closeTitle} icon={<IconX />} onClick={close} />
          </div>
          {subtitle !== undefined && <p className="jared-dialog-subtitle">{subtitle}</p>}
        </header>
        {children}
      </div>
    </dialog>
  )
}

/**
 * The foot of a dialog: a row for a status and the buttons, which stays at the bottom of the dialog under a hairline when the content is taller than
 * the screen, so that the main button is never out of reach.
 */
export function DialogFoot({ className, ...rest }: Omit<ComponentPropsWithoutRef<'footer'>, 'className'> & { className?: string }) {
  return <footer {...rest} className={['jared-dialog-foot', className].filter(Boolean).join(' ')} />
}

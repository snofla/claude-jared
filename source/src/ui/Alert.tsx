import type { ReactNode } from 'react'
import { IconButton } from './IconButton.tsx'
import { IconX } from './icons.tsx'
import './alert.css'

export type AlertTone = 'warn' | 'error' | 'ok'

type Dismissal =
  | {
      /** Puts a cross at the end that takes the message away. The cross is outside the live region, so it is not read with the message. */
      onDismiss: () => void
      /** What the cross does, in the caller's words: its accessible name. */
      dismissLabel: string
    }
  | { onDismiss?: undefined; dismissLabel?: undefined }

export type AlertProps = Dismissal & {
  tone: AlertTone
  /** The words, as children. With none (`null`, `false` or nothing) the alert draws nothing, and its live region stays in the page, empty. */
  children?: ReactNode
  /** A decorative icon before the words. */
  icon?: ReactNode
  /** The live region's role. By default `status` (polite) for `ok` and `alert` (assertive) for the other tones. */
  role?: 'status' | 'alert'
  /** Layout only, such as a margin. Never the look. */
  className?: string
}

/**
 * A message across the page that is announced as it arrives. The live region holds the words, and it is in the page and empty before there is
 * anything to say, because a region that arrives already holding its text is not always announced: keep rendering the `Alert`, and put the words
 * in its children when there are some. The words are the caller's.
 */
export function Alert({ tone, children, icon, role = tone === 'ok' ? 'status' : 'alert', onDismiss, dismissLabel, className }: AlertProps) {
  const drawn = children !== undefined && children !== null && children !== false
  return (
    <div className={drawn ? ['jared-alert', `jared-alert-${tone}`, className].filter(Boolean).join(' ') : undefined}>
      <span className="jared-alert-text" role={role}>
        {drawn && icon}
        {drawn && <span>{children}</span>}
      </span>
      {drawn && onDismiss && <IconButton label={dismissLabel} icon={<IconX />} onClick={onDismiss} />}
    </div>
  )
}

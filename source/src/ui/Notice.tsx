import type { ComponentPropsWithoutRef } from 'react'
import './notice.css'

export type NoticeTone = 'info' | 'warn'

type NoticeProps = Omit<ComponentPropsWithoutRef<'p'>, 'className'> & {
  /** What kind of message it is: `info` for something to know, `warn` for something to look at. Both are drawn in the warning colours. */
  tone: NoticeTone
  /** Layout only, such as a margin in a card. */
  className?: string
}

/**
 * A message in the page, in a box. It has no role of its own, so it is not announced when it appears: put it in a `LiveStatus` for that, or use an
 * `Alert` (not in the library yet) for something that must be heard at once. The words are the caller's, as children.
 */
export function Notice({ tone, className, ...rest }: NoticeProps) {
  return <p {...rest} className={['jared-notice', `jared-notice-${tone}`, className].filter(Boolean).join(' ')} />
}

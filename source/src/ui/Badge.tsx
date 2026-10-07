import type { ComponentPropsWithoutRef } from 'react'
import './badge.css'

type Variants =
  | {
      /** A label, such as the lines that a comment is on or a word like "suggestion", in a pill; one that is too long for the room takes a second line. The default. `neutral` is quiet, `accent` marks the thing being worked on, `ok` is for an addition. */
      variant?: 'chip'
      tone?: 'neutral' | 'accent' | 'ok'
    }
  | {
      /** A status, in a pill of one height; a text that is too long for the room ends in an ellipsis: `neutral` for the plain state, `ok` for done, `warn` for something to look at. */
      variant: 'status'
      tone?: 'neutral' | 'ok' | 'warn'
    }
  | {
      /** A number, in a pill that grows with its digits. It has no tone. */
      variant: 'count'
      tone?: never
    }

export type BadgeProps = Omit<ComponentPropsWithoutRef<'span'>, 'className'> &
  Variants & {
    /** Layout only, such as a margin. Never the look. */
    className?: string
  }

/**
 * A small label in a pill: what something is, how it stands, or how many. It has no role of its own, and its words are the caller's, as children. Do not
 * tell a state by its tone alone: the words say it.
 */
export function Badge({ variant = 'chip', tone = 'neutral', className, ...rest }: BadgeProps) {
  return <span {...rest} className={['jared-badge', `jared-badge-${variant}`, tone !== 'neutral' && `jared-badge-${tone}`, className].filter(Boolean).join(' ')} />
}

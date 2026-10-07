import type { ComponentPropsWithoutRef } from 'react'
import './card.css'

type Shared = {
  /** Layout only, such as a place in a panel or a flash when the card is pointed at. Never the look. */
  className?: string
}

export type CardProps =
  | (Omit<ComponentPropsWithoutRef<'article'>, 'className'> & Shared & { as?: 'article' })
  | (Omit<ComponentPropsWithoutRef<'form'>, 'className'> & Shared & { as: 'form' })

/**
 * A card: a box with a border and a soft shadow that holds a head, words and a foot. It is an `article`, or a `form` when it is told to be (`as="form"`):
 * use a form for a card that is written in. The head, the words and the foot are `CardHead`, `CardBody` and `CardFoot`, in that order; each is optional.
 */
export function Card({ as = 'article', className, ...rest }: CardProps) {
  const classes = ['jared-card', className].filter(Boolean).join(' ')
  return as === 'form' ? (
    <form {...(rest as ComponentPropsWithoutRef<'form'>)} className={classes} />
  ) : (
    <article {...(rest as ComponentPropsWithoutRef<'article'>)} className={classes} />
  )
}

type Part<T extends 'header' | 'p' | 'footer'> = Omit<ComponentPropsWithoutRef<T>, 'className'> & Shared

/** The top of a card: a row with its contents centred across, in the small type, and less room on the right for a button. */
export function CardHead({ className, ...rest }: Part<'header'>) {
  return <header {...rest} className={['jared-card-head', className].filter(Boolean).join(' ')} />
}

/** The words of a card: a paragraph that keeps the line breaks of what was written and breaks a word that is longer than the card. */
export function CardBody({ className, ...rest }: Part<'p'>) {
  return <p {...rest} className={['jared-card-body', className].filter(Boolean).join(' ')} />
}

/** The bottom of a card: a row of buttons. What it does when the room is short is the caller's, as a layout class. */
export function CardFoot({ className, ...rest }: Part<'footer'>) {
  return <footer {...rest} className={['jared-card-foot', className].filter(Boolean).join(' ')} />
}

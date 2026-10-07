import type { ComponentPropsWithoutRef } from 'react'

/**
 * A region that is announced politely when its content changes (`role="status"`). It must be in the page, and empty, before the words are put in it: a region
 * that arrives already holding its text is not always announced. So render it always, and put the text in its children when there is some to say.
 */
export function LiveStatus(props: Omit<ComponentPropsWithoutRef<'div'>, 'role'>) {
  return <div {...props} role="status" />
}

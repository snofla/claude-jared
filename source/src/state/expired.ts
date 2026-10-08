import { COPY } from '../lib/copy'

/**
 * The words for the banner of a page that was opened for a review that has expired. `restored` is whether the page shows a review that it kept
 * from an earlier visit: then the words warn that it may not be the one that was meant, and when the page shows none they leave the warning out. Pure.
 */
export const expiredNotice = (restored: boolean): string => (restored ? COPY.bootExpired : COPY.bootExpiredEmpty)

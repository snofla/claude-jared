import { useEffect, useState } from 'react'
import { isLateFor, lateDelayMs } from '../lib/delivery'

/**
 * Whether the review that was handed over to a program at `waitingSince` (`null`: none is) has been with it, not taken, for too long (`NOBODY_YET_MS`).
 * The strip under the header and the dialog both say so, so it is known here, once, and not in either of them: a dialog that is opened again
 * meanwhile is told at once what the page has known all along.
 */
export function useLate(waitingSince: number | null): boolean {
  const [lateFor, setLateFor] = useState<number | null>(null)
  useEffect(() => {
    if (waitingSince === null) return
    const timer = setTimeout(() => setLateFor(waitingSince), lateDelayMs(waitingSince, Date.now()))
    return () => clearTimeout(timer)
  }, [waitingSince])
  return isLateFor(lateFor, waitingSince)
}

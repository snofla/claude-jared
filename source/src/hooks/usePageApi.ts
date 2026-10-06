import { useCallback, useEffect, useRef, type Dispatch } from 'react'
import { useLatest } from './useTokens'
import type { Outbox } from '../engine/outbox'
import { handleAppMessage, waitForSubmit } from '../engine/page-host'
import { PROTOCOL_VERSION, type Reply, type SubmittedEvent } from '../engine/protocol'
import { usePlatform } from './usePlatform'
import { reducer, type Action, type AppState } from '../state/reducer'
import type { SourceFile } from '../types'

/** What a script on the page sees as `window.jared`: the protocol of the engine, spoken to the page. */
export interface PageApi {
  protocol: typeof PROTOCOL_VERSION
  /** Send a request as plain JSON and get its replies, as `Engine.handleMessage` does. */
  handleMessage(value: unknown): Reply[]
  /**
   * Take the review that the reviewer hands over, waiting up to `timeoutMs` (default 40 s, at most 10 minutes): the `submitted`
   * message, or `{ type: "timeout" }`. A review handed over before the call is kept for it.
   */
  waitForSubmit(timeoutMs?: number): Promise<SubmittedEvent | { type: 'timeout' }>
}

declare global {
  interface Window {
    jared?: PageApi
  }
}

/**
 * Offer the protocol to scripts on the page (a browser tool, a test, the console) as `window.jared`. All the rules are in
 * `handleAppMessage`; this keeps a copy of the page's state that a call replaces at once, so that two calls in one script
 * see each other, and gives what a call changes to the page. `onAdopted` says what the page also does for a file that a
 * request has opened or closed: the file, or `null`, and whether it is another file than before.
 *
 * It returns the function behind `window.jared.handleMessage`, which the page's own code may also call with `discard`: the
 * request is then run as if no reviewer were at work, for when the reviewer has just agreed to give that work up.
 */
export function usePageApi(
  state: AppState,
  dispatch: Dispatch<Action>,
  onAdopted: (file: SourceFile | null, another: boolean) => void,
  outbox: Outbox<SubmittedEvent>,
): (value: unknown, discard?: boolean) => Reply[] {
  const { reviews } = usePlatform()
  const mirror = useRef(state)
  useEffect(() => {
    mirror.current = state // whatever the reviewer has done is what a call sees next
  }, [state])
  const adopted = useLatest(onAdopted)

  const apply = useCallback(
    (value: unknown, discard = false): Reply[] => {
      const session = discard ? { file: null, review: null, draft: null } : mirror.current
      const outcome = handleAppMessage(session, value, reviews.review)
      if (outcome.adopt) {
        const action: Action = { type: 'adopt', ...outcome.adopt }
        const another = outcome.adopt.file?.hash !== mirror.current.file?.hash
        mirror.current = reducer(mirror.current, action)
        dispatch(action)
        adopted.current(outcome.adopt.file, another)
      }
      return outcome.replies
    },
    [dispatch, adopted, reviews.review],
  )

  useEffect(() => {
    const api: PageApi = { protocol: PROTOCOL_VERSION, handleMessage: (value) => apply(value), waitForSubmit: (timeoutMs) => waitForSubmit(outbox, timeoutMs) }
    window.jared = api
    return () => {
      if (window.jared === api) delete window.jared
    }
  }, [apply, outbox])

  return apply
}

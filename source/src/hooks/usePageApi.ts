import { useCallback, useEffect, useRef, type Dispatch } from 'react'
import { useLatest } from './useTokens'
import type { Outbox } from '../engine/outbox'
import { handleAppMessage, waitForSubmit } from '../engine/page-host'
import { PROTOCOL_VERSION, type Event, type Reply } from '../engine/protocol'
import { usePlatform } from './usePlatform'
import { declinedNotice } from '../state/declined'
import { reducer, type Action, type AppState } from '../state/reducer'
import type { SourceFile } from '../types'

/** What a script on the page sees as `window.jared`: the protocol of the engine, spoken to the page. */
export interface PageApi {
  protocol: typeof PROTOCOL_VERSION
  /** Send a request as plain JSON and get its replies, as `Engine.handleMessage` does. */
  handleMessage(value: unknown): Reply[]
  /**
   * Take what the page has for the script, waiting up to `timeoutMs` (default 40 s, at most 10 minutes): the `submitted` message when the
   * reviewer hands the review over, the `cancelled` message when the reviewer gives it up, or `{ type: "timeout" }`. An event that came
   * before the call is kept for it.
   */
  waitForSubmit(timeoutMs?: number): Promise<Event | { type: 'timeout' }>
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
 * request has opened or closed: the file, or `null`, and whether it is another file than before. `onDeclined` is given the words for
 * the reviewer when a script's `open` or `close` through `window.jared.handleMessage` is declined: the script gets the reply, and the
 * reviewer would be told nothing. A request that the page's own code applies is not told this way, as that code asks the reviewer itself.
 *
 * It returns the function behind `window.jared.handleMessage`, which the page's own code may also call with `discard`: the
 * request is then run as if no reviewer were at work, for when the reviewer has just agreed to give that work up.
 */
export function usePageApi(
  state: AppState,
  dispatch: Dispatch<Action>,
  onAdopted: (file: SourceFile | null, another: boolean) => void,
  outbox: Outbox<Event>,
  onDeclined: (text: string) => void,
): (value: unknown, discard?: boolean) => Reply[] {
  const { reviews } = usePlatform()
  const mirror = useRef(state)
  useEffect(() => {
    mirror.current = state // whatever the reviewer has done is what a call sees next
  }, [state])
  const adopted = useLatest(onAdopted)
  const declined = useLatest(onDeclined)

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
    const handleMessage = (value: unknown): Reply[] => {
      const page = { fileName: mirror.current.file?.name ?? null, submitTarget: mirror.current.submitTarget }
      const replies = apply(value)
      const text = declinedNotice(value, replies, page)
      if (text !== null) declined.current(text)
      return replies
    }
    const api: PageApi = { protocol: PROTOCOL_VERSION, handleMessage, waitForSubmit: (timeoutMs) => waitForSubmit(outbox, timeoutMs) }
    window.jared = api
    return () => {
      if (window.jared === api) delete window.jared
    }
  }, [apply, outbox, declined])

  return apply
}

/**
 * Messages that the page has for a caller that drives it by script, and the caller that asks for them. The page puts a message in
 * with `post`; the caller takes the oldest that it wants with `next`, which waits when there is none, for as long as it is told. A message
 * that is posted before anybody asks is kept, so that none is lost between two calls of a caller that asks in turns. Pure but for the
 * timers, which are given.
 *
 * Two rules, both optional, say how the outbox treats its messages: whether a newer message takes the place of one that is kept (`replaces`), and
 * whether a message stays after a call has returned it (`retained`), to be returned again to a call that has not seen it. A message that
 * is not retained is emptied by the call that takes it.
 */
export interface Timers {
  set(fn: () => void, ms: number): unknown
  clear(handle: unknown): void
}

const realTimers: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>) }

/** What became of a message that was posted: a call returned it, `clear` dropped it, or a newer message took its place before any call took it. */
export type PostResult = 'taken' | 'dropped' | 'replaced'

export interface OutboxRules<T> {
  /** Whether `incoming` takes the place of `kept`, which is then removed: its poster hears `'replaced'` if no call had taken it. */
  replaces?(incoming: T, kept: T): boolean
  /** Whether a message stays in the outbox after a call returned it, until `clear` removes it or a newer message replaces it. */
  retained?(message: T): boolean
}

export interface Outbox<T> {
  /** Put a message in. The result resolves when a call has taken it (`'taken'`), when `clear` dropped it (`'dropped'`) or when a newer message replaced it (`'replaced'`). */
  post(message: T): Promise<PostResult>
  /** Take the oldest message that `wants` says yes to (any, when it is not given), waiting up to `timeoutMs` for one; `null` when none came in time. */
  next(timeoutMs: number, wants?: (message: T) => boolean): Promise<T | null>
  /**
   * Drop what is kept, so that whoever posted it hears `'dropped'`; a caller that is waiting goes on waiting for the next message. A message
   * that `keep` says yes to stays, in its place in the order.
   */
  clear(keep?: (message: T) => boolean): void
  /** How many messages are kept. */
  size(): number
}

export function createOutbox<T>(rules: OutboxRules<T> = {}, timers: Timers = realTimers): Outbox<T> {
  const kept: Array<{ message: T; settle: ((result: PostResult) => void) | null }> = []
  const waiting: Array<{ wants: (message: T) => boolean; resolve: (message: T | null) => void; handle: unknown }> = []
  const stays = (message: T): boolean => rules.retained?.(message) ?? false

  return {
    post(message) {
      for (let i = kept.length - 1; i >= 0; i--) {
        if (rules.replaces?.(message, kept[i]!.message)) kept.splice(i, 1)[0]!.settle?.('replaced')
      }
      // A message that stays goes to every call that is waiting for it, so that one whose caller is gone does not take it from the live one;
      // a message that is emptied goes to the first.
      const callers = waiting.filter((caller) => caller.wants(message))
      const takers = stays(message) ? callers : callers.slice(0, 1)
      for (const caller of takers) {
        waiting.splice(waiting.indexOf(caller), 1)
        timers.clear(caller.handle)
        caller.resolve(message)
      }
      if (takers.length > 0) {
        if (stays(message)) kept.push({ message, settle: null })
        return Promise.resolve('taken')
      }
      return new Promise<PostResult>((resolve) => {
        kept.push({ message, settle: resolve })
      })
    },
    next(timeoutMs, wants = () => true) {
      const index = kept.findIndex((entry) => wants(entry.message))
      if (index >= 0) {
        const entry = kept[index]!
        if (!stays(entry.message)) kept.splice(index, 1)
        entry.settle?.('taken')
        entry.settle = null
        return Promise.resolve(entry.message)
      }
      return new Promise<T | null>((resolve) => {
        const entry = { wants, resolve, handle: undefined as unknown }
        entry.handle = timers.set(() => {
          waiting.splice(waiting.indexOf(entry), 1)
          resolve(null)
        }, timeoutMs)
        waiting.push(entry)
      })
    },
    clear(keep) {
      const stay: typeof kept = []
      for (const entry of kept.splice(0)) {
        if (keep?.(entry.message)) stay.push(entry)
        else entry.settle?.('dropped')
      }
      kept.push(...stay)
    },
    size: () => kept.length,
  }
}

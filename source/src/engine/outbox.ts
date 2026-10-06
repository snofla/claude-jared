/**
 * Messages that the page has for a caller that drives it by script, and the caller that asks for them. The page puts a message in
 * with `post`; the caller takes the oldest with `next`, which waits when there is none, for as long as it is told. A message that
 * is posted before anybody asks is kept, so that none is lost between two calls of a caller that asks in turns. Pure but for the
 * timers, which are given.
 */
export interface Timers {
  set(fn: () => void, ms: number): unknown
  clear(handle: unknown): void
}

const realTimers: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>) }

export interface Outbox<T> {
  /** Put a message in. The result resolves with `true` when a caller has taken it, and with `false` when it was dropped by `clear`. */
  post(message: T): Promise<boolean>
  /** Take the oldest message, waiting up to `timeoutMs` for one; `null` when none came in time. */
  next(timeoutMs: number): Promise<T | null>
  /** Drop what is kept, so that whoever posted it hears `false`; a caller that is waiting goes on waiting for the next message. */
  clear(): void
  /** How many messages are kept. */
  size(): number
}

export function createOutbox<T>(timers: Timers = realTimers): Outbox<T> {
  const kept: Array<{ message: T; taken: (value: boolean) => void }> = []
  const waiting: Array<{ resolve: (message: T | null) => void; handle: unknown }> = []

  return {
    post(message) {
      return new Promise<boolean>((resolve) => {
        const caller = waiting.shift()
        if (caller) {
          timers.clear(caller.handle)
          caller.resolve(message)
          resolve(true)
        } else {
          kept.push({ message, taken: resolve })
        }
      })
    },
    next(timeoutMs) {
      const first = kept.shift()
      if (first) {
        first.taken(true)
        return Promise.resolve(first.message)
      }
      return new Promise<T | null>((resolve) => {
        const entry = { resolve, handle: undefined as unknown }
        entry.handle = timers.set(() => {
          waiting.splice(waiting.indexOf(entry), 1)
          resolve(null)
        }, timeoutMs)
        waiting.push(entry)
      })
    },
    clear() {
      for (const { taken } of kept.splice(0)) taken(false)
    },
    size: () => kept.length,
  }
}

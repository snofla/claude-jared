import type { Engine } from './engine.ts'
import { isReply, PROTOCOL_VERSION, type Message, type Reply, type Request } from './protocol.ts'

/**
 * What carries messages between two peers, and nothing else. A direct call, a `postMessage`, lines on a pipe, a folder
 * of files and a socket can all be a `Transport`, and the engine and its callers do not know which one they have.
 *
 * What arrives is `unknown`, because it came from outside: whoever receives it checks it before using it.
 */
export interface Transport {
  /** Deliver one message to the peer. Messages sent one after another arrive in that order. */
  send(message: Message): void | Promise<void>
  /** Be told of each message that arrives from the peer. Returns the function that stops it. */
  onMessage(handler: (value: unknown) => void): () => void
  close(): void
}

/**
 * Two connected ends in one process. Each message is copied through JSON on the way, so that a payload that could not
 * cross a real transport fails here too, and arrives on a later turn of the event loop, as it would from a pipe.
 */
export function memoryPair(): [Transport, Transport] {
  const ends = [new Set<(value: unknown) => void>(), new Set<(value: unknown) => void>()]
  const closed = [false, false]

  const end = (me: 0 | 1): Transport => {
    const peer = (1 - me) as 0 | 1
    return {
      send(message) {
        const copy: unknown = JSON.parse(JSON.stringify(message))
        queueMicrotask(() => {
          if (closed[peer]) return
          for (const handler of [...ends[peer]]) handler(copy)
        })
      },
      onMessage(handler) {
        ends[me].add(handler)
        return () => ends[me].delete(handler)
      },
      close() {
        closed[me] = true
      },
    }
  }
  return [end(0), end(1)]
}

export interface ServeOptions {
  /** Told when a reply could not be sent. */
  onError?: (error: unknown) => void
}

/** Answer every request that arrives on `transport` with `engine`, in order. Returns the function that stops it. */
export function serve(engine: Engine, transport: Transport, options: ServeOptions = {}): () => void {
  let chain: Promise<void> = Promise.resolve()
  return transport.onMessage((value) => {
    const replies = engine.handleMessage(value)
    chain = chain
      .then(async () => {
        for (const reply of replies) await transport.send(reply)
      })
      .catch((error: unknown) => options.onError?.(error))
  })
}

/** What a caller gives to `request`: a request without the envelope, which the client fills in. */
export type RequestInput = Request extends infer R ? (R extends Request ? Omit<R, 'protocol' | 'id'> : never) : never

export interface ClientOptions {
  /** How long to wait for a reply before giving up. Default: wait for ever. */
  timeoutMs?: number
}

export interface Client {
  request(input: RequestInput): Promise<Reply>
  close(): void
}

/** Send requests over `transport` and get each reply back as the result of its `request`. */
export function createClient(transport: Transport, options: ClientOptions = {}): Client {
  let counter = 0
  const pending = new Map<string, { resolve: (reply: Reply) => void; reject: (error: Error) => void; timer?: ReturnType<typeof setTimeout> }>()

  const stop = transport.onMessage((value) => {
    if (!isReply(value) || value.replyTo === null) return
    const waiting = pending.get(value.replyTo)
    if (!waiting) return
    pending.delete(value.replyTo)
    clearTimeout(waiting.timer)
    waiting.resolve(value)
  })

  const fail = (id: string, error: Error): void => {
    const waiting = pending.get(id)
    pending.delete(id)
    clearTimeout(waiting?.timer)
    waiting?.reject(error)
  }

  return {
    request(input) {
      const id = `c${++counter}`
      const message = { protocol: PROTOCOL_VERSION, id, ...input } as Request
      return new Promise<Reply>((resolve, reject) => {
        const timer =
          options.timeoutMs === undefined ? undefined : setTimeout(() => fail(id, new Error(`No reply to "${input.type}" within ${options.timeoutMs} ms.`)), options.timeoutMs)
        pending.set(id, { resolve, reject, timer })
        Promise.resolve(transport.send(message)).catch((error: unknown) => fail(id, error instanceof Error ? error : new Error(String(error))))
      })
    },
    close() {
      stop()
      for (const id of [...pending.keys()]) fail(id, new Error('The client was closed.'))
    },
  }
}

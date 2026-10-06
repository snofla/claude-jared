import type { Message } from './protocol.ts'
import type { Transport } from './transport.ts'

/**
 * Reads a stream of server-sent events and calls `onData` with the data of each event. Text may arrive in any pieces.
 * Only `data:` fields are used; several of them in one event are joined with a newline, and comments are ignored.
 */
export function sseParser(onData: (data: string) => void): (chunk: string) => void {
  let buffer = ''
  let data: string[] = []

  const field = (line: string): void => {
    if (line === '') {
      if (data.length > 0) onData(data.join('\n'))
      data = []
    } else if (line.startsWith('data:')) {
      data.push(line.slice(5).replace(/^ /, ''))
    }
  }

  return (chunk) => {
    buffer += chunk
    let end = buffer.search(/\r\n|\n|\r(?!\n)/)
    while (end !== -1) {
      const length = buffer.startsWith('\r\n', end) ? 2 : 1
      field(buffer.slice(0, end))
      buffer = buffer.slice(end + length)
      end = buffer.search(/\r\n|\n|\r(?!\n)/)
    }
  }
}

export interface HttpClientOptions {
  /** The `fetch` to use. Default: the global one, which a browser tab and Node both have. */
  fetch?: typeof fetch
  /** Told when the connection for incoming messages fails or ends badly. It is not opened again. */
  onError?: (error: unknown) => void
}

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

/**
 * A transport to a Jared engine that listens on a port: messages go out as `POST <base>/message`, and the engine's
 * messages come back on a server-sent event stream, `GET <base>/events`, opened when the first listener appears.
 * `baseUrl` is what the server printed, with its token in it. Needs nothing but `fetch`, so a page can use it.
 *
 * A message is not sent while the stream that a listener asked for is still being opened. Otherwise the engine could
 * answer before any stream is there, and a server keeps such an answer for the first stream that opens, which may be
 * another client's.
 */
export function httpClientTransport(baseUrl: string, options: HttpClientOptions = {}): Transport {
  const base = baseUrl.replace(/\/+$/, '')
  const fetcher = options.fetch ?? fetch
  const handlers = new Set<(value: unknown) => void>()
  let controller: AbortController | undefined
  let ready: Promise<void> | undefined
  let closed = false

  /** `opened` is called once the answer to the request for the stream has come, or the request has failed. */
  const listen = async (signal: AbortSignal, opened: () => void): Promise<void> => {
    try {
      const response = await fetcher(`${base}/events`, { signal, headers: { accept: 'text/event-stream' } })
      opened()
      if (!response.ok) throw new Error(`The engine answered ${response.status} to the request for its messages.`)
      if (!response.body) throw new Error('The engine sent no stream of messages.')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      const feed = sseParser((data) => {
        const value = parse(data)
        for (const handler of [...handlers]) handler(value)
      })
      for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) feed(decoder.decode(chunk.value, { stream: true }))
      throw new Error('The engine closed the connection for its messages.')
    } catch (error) {
      opened()
      if (!signal.aborted) options.onError?.(error) // closing the stream on purpose is not a failure
    }
  }

  const stop = (): void => {
    controller?.abort()
    controller = undefined
    ready = undefined
  }

  return {
    async send(message: Message) {
      await ready // a stream that fails to open is told to onError, and the message goes out all the same
      const response = await fetcher(`${base}/message`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(message),
      })
      if (!response.ok) throw new Error(`The engine answered ${response.status} to a message.`)
    },
    onMessage(handler) {
      handlers.add(handler)
      if (!closed && controller === undefined) {
        controller = new AbortController()
        const signal = controller.signal
        ready = new Promise<void>((opened) => void listen(signal, opened))
      }
      return () => {
        handlers.delete(handler)
        if (handlers.size === 0) stop()
      }
    },
    close() {
      closed = true
      handlers.clear()
      stop()
    },
  }
}

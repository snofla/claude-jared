/**
 * The calls to the place that keeps the settings for every window: the Jared service, or a receiver (`GET` and `PUT` of `<address>`: the record in, the record out). The
 * page asks and tells and never waits for it: a call that fails, because nothing answers, the answer is not the one in the contract or it takes too long, is a
 * result and not an error, and nothing here throws.
 */

export interface SettingsRemoteOptions {
  /** The `fetch` to use. Default: the global one. */
  fetch?: typeof fetch
  /** How long to wait for an answer before the call counts as failed. Default 5 seconds. */
  timeoutMs?: number
}

/** What a read gave: the record that the place holds (`null` for none, which is a `204`), or that the call failed. */
export type RemoteRead = { ok: true; record: unknown } | { ok: false }

export interface SettingsRemote {
  read(): Promise<RemoteRead>
  /** Writes a record whole; whether the place took it (a `204`). */
  write(record: Record<string, unknown>): Promise<boolean>
}

const TIMEOUT_MS = 5000

/** What came back of a call: the status, and the body of a 200 as text; the body is read inside the time limit, so that a body that never ends counts as a call that failed. */
interface Answer {
  status: number
  text: string
}

export function settingsRemote(address: string, options: SettingsRemoteOptions = {}): SettingsRemote {
  const call = async (init: RequestInit): Promise<Answer | null> => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const late = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        controller.abort()
        resolve(null)
      }, options.timeoutMs ?? TIMEOUT_MS)
    })
    const answered = (async (): Promise<Answer | null> => {
      try {
        const response = await (options.fetch ?? fetch)(address, { ...init, signal: controller.signal })
        return { status: response.status, text: response.status === 200 ? await response.text() : '' }
      } catch {
        return null
      }
    })()
    try {
      return await Promise.race([answered, late])
    } finally {
      clearTimeout(timer)
    }
  }
  return {
    read: async () => {
      const answer = await call({ method: 'GET' })
      if (!answer) return { ok: false }
      if (answer.status === 204) return { ok: true, record: null }
      if (answer.status !== 200) return { ok: false }
      try {
        return { ok: true, record: JSON.parse(answer.text) as unknown }
      } catch {
        return { ok: false }
      }
    },
    write: async (record) => (await call({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record) }))?.status === 204,
  }
}

import type { Review, SourceFile } from '../types.ts'
import type { Platform, KeptSession } from './platform.ts'
import { buildSource, prepareSource } from './source.ts'
import type { RecentEntry } from './storage.ts'
import { parseTheme, type Theme } from './theme.ts'

/** What `memoryPlatform` takes as a picked file: a name and its text. */
export interface MemoryPicked {
  name: string
  text: string
}

export interface MemoryPlatformOptions {
  /** The answers to `prompts.confirm`, one for each question, in order; a question after the last answer is answered yes. */
  answers?: boolean[]
  /** Whether the store is full: saving then fails, and `reviews.failed()` says so. */
  full?: boolean
  /** Whether the clipboard works. Default true. */
  clipboard?: boolean
  /** The time at which the clock starts, as an ISO 8601 string. Each call of `now()` is one second later. */
  start?: string
}

/** A platform that keeps everything in memory and records what it was asked, for tests: the same services as a browser tab, with no browser. */
export interface MemoryPlatform extends Platform {
  /** The questions that were asked, in order. */
  asked: string[]
  downloads: Array<{ filename: string; text: string; mime: string }>
  copied: string[]
  /** The colour scheme as it was last applied. */
  applied: Theme[]
}

export function memoryPlatform(options: MemoryPlatformOptions = {}): MemoryPlatform {
  const sources = new Map<string, { name: string; content: string }>()
  const reviews = new Map<string, Review>()
  let index: RecentEntry[] = []
  let last: string | null = null
  let theme: Theme = 'system'
  let failed = false
  let ticks = 0
  let ids = 0
  const listeners = new Set<() => void>()
  const answers = [...(options.answers ?? [])]
  const start = Date.parse(options.start ?? '2026-01-01T00:00:00.000Z')

  const setFailed = (value: boolean) => {
    if (failed === value) return
    failed = value
    listeners.forEach((notify) => notify())
  }
  const keep = <T>(save: () => T): void => {
    if (options.full) setFailed(true)
    else {
      save()
      setFailed(false)
    }
  }
  const session = (hash: string): KeptSession | null => {
    const source = sources.get(hash)
    const review = reviews.get(hash)
    return source && review ? { file: buildSource(source.name, source.content, review.file.language), review } : null
  }

  const platform: MemoryPlatform = {
    asked: [],
    downloads: [],
    copied: [],
    applied: [],
    reviews: {
      last: () => (last ? session(last) : null),
      recent: () => index.filter((entry) => sources.has(entry.hash)),
      review: (hash) => reviews.get(hash) ?? null,
      session,
      saveSource: (file: SourceFile) => keep(() => sources.set(file.hash, { name: file.name, content: file.content })),
      saveReview: (review) =>
        keep(() => {
          const { hash, name, lineCount } = review.file
          reviews.set(hash, review)
          index = [{ hash, name, lineCount, comments: review.comments.length, updatedAt: review.updatedAt, submittedAt: review.submittedAt }, ...index.filter((e) => e.hash !== hash)]
        }),
      setLast: (hash) => {
        last = hash
      },
      forget: (hash) => {
        sources.delete(hash)
        reviews.delete(hash)
        index = index.filter((entry) => entry.hash !== hash)
      },
      failed: () => failed,
      subscribe: (listener) => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
    },
    theme: {
      load: () => theme,
      save: (value) => {
        theme = parseTheme(value)
      },
      apply: (value) => {
        platform.applied.push(value)
      },
    },
    input: {
      read: async (picked) => {
        const { name, text } = picked as MemoryPicked
        return prepareSource(name, text)
      },
    },
    submit: {
      download: (filename, text, mime) => {
        platform.downloads.push({ filename, text, mime })
      },
      copy: async (text) => {
        if (options.clipboard === false) return false
        platform.copied.push(text)
        return true
      },
    },
    prompts: {
      confirm: (message) => {
        platform.asked.push(message)
        return answers.shift() ?? true
      },
    },
    environment: {
      now: () => new Date(start + 1000 * ticks++).toISOString(),
      uid: () => `id-${++ids}`,
    },
  }
  return platform
}

import type { Review, SetReview, SourceFile } from '../types.ts'
import { setHashOf } from './hash.ts'
import type { Platform, KeptSession, KeptSet } from './platform.ts'
import { buildSource, prepareSource } from './source.ts'
import type { RecentEntry } from './storage.ts'
import { parseTheme, type Theme } from './theme.ts'

/** What `memoryPlatform` takes as a picked file: a name and its text. */
export interface MemoryPicked {
  name: string
  text: string
}

/** What it takes as a pick of several files, or a drop of them: the files, and how many more were seen and not read. */
export interface MemoryPickedMany {
  files: MemoryPicked[]
  unread?: number
  /** The folders of the pick that the browser would not read, as `ReadMany` has them. */
  unreadFolders?: string[]
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
  const viewed = new Map<string, string[]>()
  /** The sets that are kept, by the hash of the set: the review, whose files name the texts in `sources` by their own hashes. */
  const sets = new Map<string, SetReview>()
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

  /** The index entry of a set, as the browser keeps it. */
  const setEntry = (setHash: string, review: SetReview): RecentEntry => ({
    hash: setHash,
    name: review.files[0].name,
    lineCount: review.files.reduce((total, file) => total + file.lineCount, 0),
    comments: review.comments.length,
    updatedAt: review.updatedAt,
    submittedAt: review.submittedAt,
    files: review.files.length,
    names: review.files.slice(0, 3).map((file) => file.name),
  })
  const storeSetReview = (review: SetReview): void => {
    const setHash = setHashOf(review.files)
    sets.set(setHash, review)
    index = [setEntry(setHash, review), ...index.filter((e) => e.hash !== setHash)]
  }
  const savedSet = (setHash: string): KeptSet | null => {
    const review = sets.get(setHash)
    const files = review?.files.map((entry) => {
      const source = sources.get(entry.hash)
      return source ? buildSource(source.name, source.content, entry.language) : null
    })
    return review && files && files.every((file) => file !== null) ? { files: files as SourceFile[], review } : null
  }
  /** Whether a review that is kept still has the file with this hash, alone or in a set. */
  const referenced = (fileHash: string): boolean => index.some((entry) => (entry.files === undefined ? entry.hash === fileHash : !!sets.get(entry.hash)?.files.some((file) => file.hash === fileHash)))

  const platform: MemoryPlatform = {
    asked: [],
    downloads: [],
    copied: [],
    applied: [],
    reviews: {
      last: () => (last ? session(last) : null),
      recent: () => index.filter((entry) => (entry.files === undefined ? sources.has(entry.hash) : savedSet(entry.hash) !== null)),
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
      lastSet: () => (last ? savedSet(last) : null),
      setReview: (setHash) => sets.get(setHash) ?? null,
      savedSet,
      saveSet: (files, review) =>
        keep(() => {
          for (const file of files) sources.set(file.hash, { name: file.name, content: file.content })
          storeSetReview(review)
        }),
      saveSetReview: (review) => keep(() => storeSetReview(review)),
      forget: (hash) => {
        const files = sets.get(hash)?.files ?? [{ hash }]
        sets.delete(hash)
        reviews.delete(hash)
        viewed.delete(hash)
        index = index.filter((entry) => entry.hash !== hash)
        for (const file of files) if (!referenced(file.hash)) sources.delete(file.hash)
      },
      viewed: (hash) => viewed.get(hash) ?? [],
      setViewed: (hash, ids) => {
        viewed.set(hash, [...ids])
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
      capture: (drop) => drop,
      readMany: async (picked) => {
        const { files, unread, unreadFolders } = picked as MemoryPickedMany
        return { unread: unread ?? 0, files: files.map(({ name, text }) => ({ name, text, size: new TextEncoder().encode(text).length })), ...(unreadFolders?.length ? { unreadFolders } : {}) }
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

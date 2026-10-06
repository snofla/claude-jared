import type { Review, SourceFile } from '../types'
import { buildSource } from './source'
import { parseTheme, THEME_KEY, type Theme } from './theme'

/**
 * Persistence is plain localStorage, keyed by a hash of the file name + content:
 *
 *   jared:index          [{ hash, name, ... }]   most recently used first
 *   jared:last           hash of the file to reopen on load
 *   jared:src:<hash>     { name, content }       written once when a file is opened
 *   jared:review:<hash>  Review                  small; rewritten on every change
 *   jared:theme          'system' | 'light' | 'dark'   the colour scheme the reviewer chose
 *
 * Splitting source from review keeps the frequent writes tiny.
 */

const INDEX = 'jared:index'
const LAST = 'jared:last'
const srcKey = (hash: string) => `jared:src:${hash}`
const reviewKey = (hash: string) => `jared:review:${hash}`

export interface RecentEntry {
  hash: string
  name: string
  lineCount: number
  comments: number
  updatedAt: string
  submittedAt: string | null
}

/** Whether the last attempt to persist failed (quota or blocked storage), observable from React. */
let sourceFailed = false
let reviewFailed = false
const listeners = new Set<() => void>()

function report(kind: 'source' | 'review', ok: boolean): boolean {
  const before = sourceFailed || reviewFailed
  if (kind === 'source') sourceFailed = !ok
  else reviewFailed = !ok
  if (before !== (sourceFailed || reviewFailed)) listeners.forEach((notify) => notify())
  return ok
}

export function subscribeStorageStatus(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const storageFailed = (): boolean => sourceFailed || reviewFailed

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? null : (JSON.parse(raw) as T)
  } catch {
    return null
  }
}

function readIndex(): RecentEntry[] {
  const index = read<RecentEntry[]>(INDEX)
  return Array.isArray(index) ? index : []
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* storage unavailable */
  }
}

/** Write; if the quota is hit, evict the least recently used other files and retry. */
function write(key: string, value: unknown, keepHash: string): boolean {
  const json = JSON.stringify(value)
  for (;;) {
    try {
      localStorage.setItem(key, json)
      return true
    } catch {
      const victim = readIndex()
        .reverse()
        .find((entry) => entry.hash !== keepHash)
      if (!victim) return false
      forget(victim.hash)
    }
  }
}

export function saveSource(file: SourceFile): boolean {
  return report('source', write(srcKey(file.hash), { name: file.name, content: file.content }, file.hash))
}

export function saveReview(review: Review): boolean {
  const { hash, name, lineCount } = review.file
  const entry: RecentEntry = {
    hash,
    name,
    lineCount,
    comments: review.comments.length,
    updatedAt: review.updatedAt,
    submittedAt: review.submittedAt,
  }
  const index = [entry, ...readIndex().filter((e) => e.hash !== hash)]
  return report('review', write(reviewKey(hash), review, hash) && write(INDEX, index, hash))
}

function isReview(value: unknown): value is Review {
  const r = value as Review | null
  return !!r && r.version === 1 && Array.isArray(r.comments) && typeof r.file?.hash === 'string'
}

export function loadReview(hash: string): Review | null {
  const review = read<Review>(reviewKey(hash))
  return isReview(review) ? review : null
}

export function loadSession(hash: string): { file: SourceFile; review: Review } | null {
  const src = read<{ name: string; content: string }>(srcKey(hash))
  const review = loadReview(hash)
  if (!src || !review || typeof src.content !== 'string') return null
  return { file: buildSource(src.name, src.content, review.file.language), review }
}

/** The colour scheme the reviewer chose, or `system` when none is stored or the storage cannot be read. */
export function loadTheme(): Theme {
  try {
    return parseTheme(localStorage.getItem(THEME_KEY))
  } catch {
    return 'system'
  }
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* storage unavailable: the choice holds until the page is closed */
  }
}

export function setLast(hash: string | null): void {
  if (hash === null) remove(LAST)
  else
    try {
      localStorage.setItem(LAST, hash)
    } catch {
      /* storage unavailable */
    }
}

export function loadLast(): { file: SourceFile; review: Review } | null {
  try {
    const hash = localStorage.getItem(LAST)
    return hash ? loadSession(hash) : null
  } catch {
    return null
  }
}

export function listRecent(): RecentEntry[] {
  return readIndex().filter((entry) => localStorage.getItem(srcKey(entry.hash)) !== null)
}

export function forget(hash: string): void {
  remove(srcKey(hash))
  remove(reviewKey(hash))
  try {
    localStorage.setItem(INDEX, JSON.stringify(readIndex().filter((e) => e.hash !== hash)))
  } catch {
    /* storage unavailable */
  }
}

import type { Review, SetReview, SourceFile } from '../types'
import { setHashOf } from './hash'
import { parseSetReview } from './review'
import { buildSource } from './source'
import { parseTheme, THEME_KEY, type Theme } from './theme'

/**
 * Persistence is plain localStorage, keyed by a hash of the file name + content:
 *
 *   jared:index          [{ hash, name, ... }]   most recently used first
 *   jared:last           hash of the file to reopen on load
 *   jared:src:<hash>     { name, content }       written once when a file is opened
 *   jared:review:<hash>  Review                  small; rewritten on every change
 *   jared:set:<hash>     { files: [{ id, name, hash }] }   a review of several files: the hash is the set's (`setHashOf`), the
 *                        review is `jared:review:<hash>` as a version-2 review, and the text of each file is the `jared:src` of its own
 *                        hash, shared with any other review that has the same file
 *   jared:theme          'system' | 'light' | 'dark'   the colour scheme the reviewer chose
 *
 * Splitting source from review keeps the frequent writes tiny.
 */

const INDEX = 'jared:index'
const LAST = 'jared:last'
const srcKey = (hash: string) => `jared:src:${hash}`
const reviewKey = (hash: string) => `jared:review:${hash}`
const viewedKey = (hash: string) => `jared:viewed:${hash}`
const setKey = (hash: string) => `jared:set:${hash}`

export interface RecentEntry {
  hash: string
  name: string
  lineCount: number
  comments: number
  updatedAt: string
  submittedAt: string | null
  /** For a review of several files only: how many, and the names of the first three in the review's order. The hash is then the set's. */
  files?: number
  names?: string[]
}

/** The files of a review of several files as they are kept: the ids and the hashes, in the review's order. */
interface SetRecord {
  files: Array<{ id: string; name: string; hash: string }>
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
  // A file is tried once: when forgetting it cannot take it out of the list (the store takes no write at all), it would come up again for ever.
  const tried = new Set<string>()
  for (;;) {
    try {
      localStorage.setItem(key, json)
      return true
    } catch {
      const victim = readIndex()
        .reverse()
        .find((entry) => entry.hash !== keepHash && !tried.has(entry.hash))
      if (!victim) return false
      tried.add(victim.hash)
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

function setEntry(setHash: string, review: SetReview): RecentEntry {
  return {
    hash: setHash,
    name: review.files[0].name,
    lineCount: review.files.reduce((total, file) => total + file.lineCount, 0),
    comments: review.comments.length,
    updatedAt: review.updatedAt,
    submittedAt: review.submittedAt,
    files: review.files.length,
    names: review.files.slice(0, 3).map((file) => file.name),
  }
}

/**
 * Keep the files of a review of several files and the review: the text of each file under its own hash, the record of which files the set has
 * and their ids, and the review. `files` are in the order of `review.files`. A file whose text is already kept is written again, as `saveSource` does.
 */
export function saveSet(files: readonly SourceFile[], review: SetReview): boolean {
  const setHash = setHashOf(files)
  pinned = new Set(files.map((file) => file.hash))
  try {
    const sources = files.every((file) => write(srcKey(file.hash), { name: file.name, content: file.content }, setHash))
    const record: SetRecord = { files: review.files.map(({ id, name, hash }) => ({ id, name, hash })) }
    report('source', sources && write(setKey(setHash), record, setHash))
    return saveSetReview(review)
  } finally {
    pinned = new Set()
  }
}

/** Keep the review of a set again after a change; the files and the record are kept already. */
export function saveSetReview(review: SetReview): boolean {
  const setHash = setHashOf(review.files)
  const index = [setEntry(setHash, review), ...readIndex().filter((e) => e.hash !== setHash)]
  return report('review', write(reviewKey(setHash), review, setHash) && write(INDEX, index, setHash))
}

/** The review of the set with this hash, if it is kept and is a review of version 2. */
export function loadSetReview(setHash: string): SetReview | null {
  return parseSetReview(read<unknown>(reviewKey(setHash)))
}

/** The files of the set with this hash, in the order of its review, and the review; none unless all of them are kept. */
export function loadSet(setHash: string): { files: SourceFile[]; review: SetReview } | null {
  const record = readSet(setHash)
  const review = loadSetReview(setHash)
  if (!record || !review || record.files.length !== review.files.length) return null
  const files: SourceFile[] = []
  for (const [i, entry] of review.files.entries()) {
    const kept = record.files[i]
    const src = read<{ name: string; content: string }>(srcKey(entry.hash))
    if (kept.id !== entry.id || kept.hash !== entry.hash || !src || typeof src.content !== 'string') return null
    files.push(buildSource(src.name, src.content, entry.language))
  }
  return { files, review }
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

/** The set that was open at the last visit, with its review: `null` when the last was a single file or none. */
export function loadLastSet(): { files: SourceFile[]; review: SetReview } | null {
  try {
    const hash = localStorage.getItem(LAST)
    return hash ? loadSet(hash) : null
  } catch {
    return null
  }
}

/** The files of a review that the reviewer has marked as viewed, by the ids that name them. Not part of the review: they are the reviewer's own place in it. */
export function loadViewed(hash: string): string[] {
  const ids = read<unknown>(viewedKey(hash))
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
}

export function saveViewed(hash: string, ids: readonly string[]): void {
  if (ids.length === 0) return remove(viewedKey(hash))
  try {
    localStorage.setItem(viewedKey(hash), JSON.stringify(ids))
  } catch {
    /* storage unavailable or full: the marks are lost, which costs the reviewer a few clicks and nothing else */
  }
}

/** Whether the text of every file of the set is kept, as it is for one file. */
const setKept = (hash: string): boolean => !!readSet(hash)?.files.every((file) => localStorage.getItem(srcKey(file.hash)) !== null)

export function listRecent(): RecentEntry[] {
  return readIndex().filter((entry) => (entry.files === undefined ? localStorage.getItem(srcKey(entry.hash)) !== null : setKept(entry.hash)))
}

/** The files that a save in progress needs: their texts stay even when the entry that named them is forgotten to make room. */
let pinned: ReadonlySet<string> = new Set()

/** The record of a set, if it is one: a list of entries. What is in an entry is compared with the review's before it is used, so it is not checked here. */
function readSet(hash: string): SetRecord | null {
  const record = read<SetRecord>(setKey(hash))
  return !!record && Array.isArray(record.files) && record.files.every((file) => !!file) ? record : null
}

/** Whether something that is kept, or is being saved, still needs the text of the file with this hash. */
function referenced(fileHash: string): boolean {
  if (pinned.has(fileHash)) return true
  return readIndex().some((entry) => (entry.files === undefined ? entry.hash === fileHash : !!readSet(entry.hash)?.files.some((file) => file.hash === fileHash)))
}

function dropFromIndex(hash: string): void {
  try {
    localStorage.setItem(INDEX, JSON.stringify(readIndex().filter((e) => e.hash !== hash)))
  } catch {
    /* storage unavailable */
  }
}

/**
 * Forget a file, or a review of several files (by the hash of the set): the review, its place in the list and, for a file, its text. The text of
 * a file stays while another review that is kept has the same file, which is how a file can be in a set and be reviewed on its own.
 */
export function forget(hash: string): void {
  const files = readSet(hash)?.files ?? [{ id: 'f1', name: '', hash }]
  remove(setKey(hash))
  remove(reviewKey(hash))
  remove(viewedKey(hash))
  dropFromIndex(hash)
  for (const file of files) if (!referenced(file.hash)) remove(srcKey(file.hash))
}

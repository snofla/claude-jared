import { MAX_SET_FILES } from './review.ts'
import { MAX_BYTES, MAX_SET_BYTES, looksBinary } from './source.ts'

/**
 * Turning what the reviewer picked or dropped into a review of one file or of several: which files are text, which are left out and why, in what
 * order the set is read, and when it is too much to open. Pure: the browser reads the files (`browser-io.ts`), this decides.
 */

/** The most files that one review holds: the number that the engine and a review read from outside use too. */
export { MAX_SET_FILES }

/** The most files that are looked at in a dropped folder: a folder with more has no 100 files of text in it that could be opened, whatever they are. */
export const MAX_SCANNED = 1000

/** One file as the platform read it: its name (a path, below a dropped folder), its size in bytes, and its text, or null when it was not read. */
export interface ReadFile {
  name: string
  size: number
  text: string | null
}

/**
 * What the platform read of a pick: the files, and how many more it saw and did not read (a folder with too many files in it), and, when there are any,
 * the paths of the folders that the browser would not read (a browser may refuse to read a folder from a page that was opened from a file). The field is
 * left out when every folder read, so a folder that read fine and is empty can be told from one that did not read.
 */
export interface ReadMany {
  files: ReadFile[]
  unread: number
  unreadFolders?: string[]
}

export type LeftOutWhy = 'not-text' | 'too-big' | 'empty' | 'unreadable' | 'unreadable-folder' | 'same-name'

export interface LeftOut {
  name: string
  why: LeftOutWhy
}

export type SetRefusal = 'nothing' | 'folder' | 'too-many' | 'too-many-found' | 'too-big-together'

export type SetPlan =
  /** Two or more files that can be opened together, in path order without regard to case. */
  | { kind: 'set'; files: Array<{ name: string; text: string }>; leftOut: LeftOut[] }
  /** One file is left that can be opened, which is opened as a file. */
  | { kind: 'one'; file: { name: string; text: string }; leftOut: LeftOut[] }
  /** Nothing is opened, and why; `count` and `bytes` are those of the files that could have been opened. For `folder`, `leftOut` has the files only: the reason is the folders. */
  | { kind: 'refused'; reason: SetRefusal; count: number; bytes: number; leftOut: LeftOut[] }

/** Whether a file or a folder below a dropped folder is not read: its name starts with a dot, or it is node_modules. A file dropped by itself is always read. */
export const skippedInFolder = (name: string): boolean => name.startsWith('.') || name === 'node_modules'

/** The name of a file that was dropped: the path that the browser gives it, from the dropped folder, without its leading slash. */
export const pathOfEntry = (fullPath: string): string => fullPath.replace(/^\/+/, '')

/** Why a file cannot be opened, or null when it can. */
function whyNot(file: ReadFile): Exclude<LeftOutWhy, 'same-name' | 'unreadable-folder'> | null {
  if (file.size > MAX_BYTES) return 'too-big'
  if (file.text === null) return 'unreadable'
  if (looksBinary(file.text)) return 'not-text'
  if (file.text.trim() === '') return 'empty'
  return null
}

/** The bytes of a file that could be opened, or 0: what counts towards the most that a review holds. */
export const usableBytes = (file: ReadFile): number => (whyNot(file) === null ? file.size : 0)

const plain = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/**
 * The order of the files of a set: the whole path without regard to case, so that `badge.css` stands beside `Badge.tsx` and not after every capitalised name,
 * and, for two paths that differ only in case, the plain order, so that the order is the same whichever came first. A path is folded to small letters and
 * not to capitals, so that an underscore comes before a letter, as it does in plain order. The skill sorts the files of a pattern in the same way.
 */
const byName = (a: { name: string }, b: { name: string }): number => plain(a.name.toLowerCase(), b.name.toLowerCase()) || plain(a.name, b.name)

/**
 * What to open of what was read: the files that are text, in path order without regard to case, a name that came twice once, and the rest left out with the reason. Two or
 * more files are a set; one is opened as a file; none is a refusal. A set of more than 100 files, or of more text than one file may hold, is refused
 * whole and not cut: which of them to open is for the reviewer to say.
 */
export function planPicked(read: ReadMany): SetPlan {
  const seen = new Set<string>()
  const usable: Array<{ name: string; text: string; size: number }> = []
  const leftOut: LeftOut[] = []
  for (const file of read.files) {
    if (seen.has(file.name)) {
      leftOut.push({ name: file.name, why: 'same-name' })
      continue
    }
    seen.add(file.name)
    const why = whyNot(file)
    if (why) leftOut.push({ name: file.name, why })
    else usable.push({ name: file.name, text: file.text as string, size: file.size })
  }
  usable.sort(byName)
  leftOut.sort(byName)
  // A folder that the browser would not read is left out like a file, by its path: it is said of the files that opened, and is the reason when none did.
  const folders = (read.unreadFolders ?? []).map((name): LeftOut => ({ name, why: 'unreadable-folder' }))
  const everything = [...leftOut, ...folders].sort(byName)
  const bytes = usable.reduce((sum, file) => sum + file.size, 0)
  // Files that were seen and not read: the reading stopped because the text that was read is more than a review holds (and so is the whole, whatever
  // the rest is), or because a folder holds more files than were looked at. No guess is made of which to open.
  if (read.unread > 0) return { kind: 'refused', reason: bytes > MAX_SET_BYTES ? 'too-big-together' : 'too-many-found', count: usable.length + read.unread, bytes, leftOut: everything }
  const count = usable.length
  if (count === 0) return { kind: 'refused', reason: folders.length > 0 ? 'folder' : 'nothing', count, bytes, leftOut }
  if (count > MAX_SET_FILES) return { kind: 'refused', reason: 'too-many', count, bytes, leftOut: everything }
  if (bytes > MAX_SET_BYTES) return { kind: 'refused', reason: 'too-big-together', count, bytes, leftOut: everything }
  if (count === 1) return { kind: 'one', file: { name: usable[0].name, text: usable[0].text }, leftOut: everything }
  return { kind: 'set', files: usable.map(({ name, text }) => ({ name, text })), leftOut: everything }
}

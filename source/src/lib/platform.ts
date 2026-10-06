import type { Review, SourceFile } from '../types.ts'
import type { OpenResult } from './source.ts'
import type { RecentEntry } from './storage.ts'
import type { Theme } from './theme.ts'

/**
 * What Jared needs from the place it runs, as small services whose arguments and results are plain data. The interface and its
 * flows (`src/state/flows.ts`) ask the platform; they call no browser API themselves, so that a tab (`browserPlatform`), a test
 * (`memoryPlatform`), and later a webview or a native application are each one platform and no change to the app. The wording of a prompt
 * belongs to the app: the platform only shows the text it is given.
 */

/** A file that the reviewer picked or dropped, as the platform that handed it over knows it. The app passes it back to `input.read` and never looks inside. */
export type Picked = unknown

/** A file and the review of it, as kept between visits. */
export interface KeptSession {
  file: SourceFile
  review: Review
}

/** What is kept between visits: the reviews, the sources of the files, and which file was open last. */
export interface ReviewsService {
  /** The file that was open at the last visit, with its review. */
  last(): KeptSession | null
  /** The files that were reviewed, most recent first. */
  recent(): RecentEntry[]
  review(hash: string): Review | null
  session(hash: string): KeptSession | null
  saveSource(file: SourceFile): void
  saveReview(review: Review): void
  /** Which file is the last one open; `null` when none is. */
  setLast(hash: string | null): void
  forget(hash: string): void
  /** Whether the last attempt to keep something failed (a full or blocked store); `subscribe` tells when that changes. */
  failed(): boolean
  subscribe(listener: () => void): () => void
}

export interface Platform {
  reviews: ReviewsService
  /** The reviewer's choice of colour scheme: kept, and shown. */
  theme: {
    load(): Theme
    save(theme: Theme): void
    apply(theme: Theme): void
  }
  /** Getting a source file in: the platform reads what it picked, and gives its name and text, or why it cannot be opened. */
  input: {
    read(picked: Picked): Promise<OpenResult>
  }
  /** Getting a review out, as a file or as text on the clipboard; `copy` says whether it worked. */
  submit: {
    download(filename: string, text: string, mime: string): void
    copy(text: string): Promise<boolean>
  }
  /** Asking the reviewer a question that has two answers, with the words that the app gives it. */
  prompts: {
    confirm(message: string): boolean
  }
  /** What the app may not read for itself: the time, as an ISO 8601 string, and a new id. */
  environment: {
    now(): string
    uid(): string
  }
}

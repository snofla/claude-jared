/** 1-indexed, inclusive line range. */
export interface LineRange {
  start: number
  end: number
}

/** Pointer-style selection: `anchor` is where it started, `focus` is where it currently ends. */
export interface LineSelection {
  anchor: number
  focus: number
}

/**
 * Where a comment on a diff is, in the files the diff is about: the file's path, and the lines of the old and of the new file that
 * the selected rows stand for (`null` for a side the rows are not on). `startLine` and `endLine` are rows of the diff text.
 */
export interface DiffPlace {
  path: string
  old: LineRange | null
  new: LineRange | null
}

export interface ReviewComment {
  id: string
  startLine: number
  endLine: number
  /** Snapshot of the reviewed lines at the time the comment was written. */
  code: string
  comment: string
  /** Proposed replacement for `code`, if the reviewer wrote one. Never set on a diff. */
  suggestion: string | null
  /** Only on a comment on a diff. Absent on every comment of a file, and on one that was made before diffs were shown as such. */
  place?: DiffPlace
  /** Only in a review of several files (version 2): the id of the file of `files` that the lines are lines of. */
  file?: string
  createdAt: string
  updatedAt: string
}

/** The on-disk / exported review format. Plain JSON, no file content. */
export interface Review {
  version: 1
  file: {
    name: string
    /** Shiki language id, or "text". */
    language: string
    lineCount: number
    /** Fingerprint of the reviewed content, to tell file versions apart. */
    hash: string
  }
  summary: string
  comments: ReviewComment[]
  createdAt: string
  updatedAt: string
  submittedAt: string | null
}

/** One file of a review of several files: what version 1 has in `file`, with an id that a comment names. */
export interface ReviewFile {
  /** "f" and the file's position when the set was opened, from 1; it never changes for that review. */
  id: string
  name: string
  language: string
  lineCount: number
  hash: string
}

/**
 * The review of two or more files (version 2). A review of one file, plain or a diff, stays version 1. Each comment names its file in
 * `file`, and its lines are lines of that file's text; a file whose language is `diff` is a unified diff, and its comments carry `place`.
 */
export interface SetReview {
  version: 2
  files: ReviewFile[]
  summary: string
  comments: ReviewComment[]
  createdAt: string
  updatedAt: string
  submittedAt: string | null
}

/** A review of one file (version 1) or of several (version 2): what the page holds, and what is exported and sent. */
export type AnyReview = Review | SetReview

export interface SourceFile {
  name: string
  /** Normalised: no BOM, LF line endings, no trailing newline. */
  content: string
  lines: string[]
  language: string
  hash: string
}

/** A comment being written or edited. */
export interface Draft {
  /** Set when editing an existing comment. */
  id: string | null
  range: LineRange
  comment: string
  /** `null` means "no suggestion"; a string (possibly pre-filled) means the suggestion editor is open. */
  suggestion: string | null
  /** Whether the user has edited the suggestion (stops it being re-prefilled when the range changes). */
  suggestionDirty: boolean
}

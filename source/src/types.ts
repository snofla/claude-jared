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

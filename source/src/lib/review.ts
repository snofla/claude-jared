import type { DiffPlace, Draft, LineRange, LineSelection, Review, ReviewComment, SourceFile } from '../types.ts'
import { COPY } from './copy.ts'
import { diffOf, placeLabel, placeOf, type ParsedDiff } from './diff.ts'

export function newReview(file: Pick<SourceFile, 'name' | 'language' | 'hash' | 'lines'>, now: string): Review {
  return {
    version: 1,
    file: { name: file.name, language: file.language, lineCount: file.lines.length, hash: file.hash },
    summary: '',
    comments: [],
    createdAt: now,
    updatedAt: now,
    submittedAt: null,
  }
}

export function rangeOf(selection: LineSelection): LineRange {
  return {
    start: Math.min(selection.anchor, selection.focus),
    end: Math.max(selection.anchor, selection.focus),
  }
}

export function codeForRange(lines: string[], range: LineRange): string {
  return lines.slice(range.start - 1, range.end).join('\n')
}

export function rangeLabel(start: number, end: number): string {
  return start === end ? `Line ${start}` : `Lines ${start}–${end}`
}

/** What rows `start` to `end` are called: the file and lines they stand for in a diff, or else the numbers of the lines. */
export function labelOfRange(diff: ParsedDiff | null, start: number, end: number): string {
  const place = diff && placeOf(diff, { start, end })
  return place ? placeLabel(place) : rangeLabel(start, end)
}

/** What a comment is called: the file and lines it is about when it is on a diff, or else the numbers of its lines. */
export function commentLabel(comment: Pick<ReviewComment, 'startLine' | 'endLine' | 'place'>): string {
  return comment.place ? placeLabel(comment.place) : rangeLabel(comment.startLine, comment.endLine)
}

/**
 * What the bar of a comment, in the gutter or on the ruler, is called when the pointer rests on it: "Comment on" and the label of the
 * comment's card, so that a diff's bar names the file and the old and new lines and not lines that are not there. The label's first
 * letter is lower-cased only where it begins with "Line" or "Lines" and a number, which a range label always does and a file name does not.
 */
export function commentBarTitle(comment: Pick<ReviewComment, 'startLine' | 'endLine' | 'place'>): string {
  const label = commentLabel(comment)
  return `Comment on ${/^Lines? \d/.test(label) ? label.charAt(0).toLowerCase() + label.slice(1) : label}`
}

/** The other comments that have a suggestion over any of the lines of `range`: two suggestions over the same lines cannot both be applied. */
export function overlappingSuggestions(comments: readonly ReviewComment[], range: LineRange, id: string | null): ReviewComment[] {
  return comments.filter((c) => c.id !== id && c.suggestion !== null && c.startLine <= range.end && c.endLine >= range.start)
}

/**
 * What the composer says when the suggestion being written overlaps the suggestion of another comment, or `null`. A comment without a
 * suggestion never warns: Jared cannot read what its words ask for, so it warns only where it knows that both will change lines.
 * The list is built by `Intl.ListFormat`, so that "and" is right in any language once the rest is translated; British English until then, as the texts are.
 */
export function suggestionWarning(comments: readonly ReviewComment[], draft: Pick<Draft, 'id' | 'range' | 'suggestion'>): string | null {
  if (draft.suggestion === null) return null
  const others = overlappingSuggestions(comments, draft.range, draft.id)
  if (others.length === 0) return null
  const ranges = others.map((c) => {
    const label = rangeLabel(c.startLine, c.endLine)
    return label.charAt(0).toLowerCase() + label.slice(1)
  })
  return others.length === 1 ? COPY.suggestionOverlapsOne(ranges[0]) : COPY.suggestionOverlapsSeveral(new Intl.ListFormat('en-GB', { style: 'long', type: 'conjunction' }).format(ranges))
}

/** A suggestion identical to the original code is not a suggestion. */
export function effectiveSuggestionText(suggestion: string | null, original: string): string | null {
  if (!suggestion || suggestion.trim() === '') return null
  return suggestion.trimEnd() === original.trimEnd() ? null : suggestion.trimEnd()
}

export function effectiveSuggestion(draft: Draft, lines: string[]): string | null {
  return effectiveSuggestionText(draft.suggestion, codeForRange(lines, draft.range))
}

export function canSaveDraft(draft: Draft, lines: string[]): boolean {
  return draft.comment.trim() !== '' || effectiveSuggestion(draft, lines) !== null
}

export interface CommentInput {
  /** The id of the comment to replace, or a new id to add one. */
  id: string
  startLine: number
  endLine: number
  comment: string
  suggestion: string | null
}

/**
 * Add the comment, or replace the one that has the same id. `null` when there is nothing to save: no words, and no
 * suggestion that differs from the code. The lines are the file's, and the comment keeps a snapshot of its own.
 */
export function upsertComment(review: Review, lines: string[], input: CommentInput, now: string): Review | null {
  const diff = diffOf(review.file.language, lines)
  const code = codeForRange(lines, { start: input.startLine, end: input.endLine })
  const comment = input.comment.trim()
  // A suggestion replaces lines of a file; the rows of a diff are not lines of one, so a diff gets none.
  const suggestion = diff ? null : effectiveSuggestionText(input.suggestion, code)
  if (comment === '' && suggestion === null) return null

  const existing = review.comments.find((c) => c.id === input.id)
  const fields = { startLine: input.startLine, endLine: input.endLine, code, comment, suggestion }
  const made: ReviewComment = existing
    ? { ...existing, ...fields, updatedAt: now }
    : { id: input.id, ...fields, createdAt: now, updatedAt: now }
  const saved = withPlace(made, diff && placeOf(diff, { start: input.startLine, end: input.endLine }))
  const comments = existing ? review.comments.map((c) => (c.id === existing.id ? saved : c)) : [...review.comments, saved]
  return { ...review, comments: sortComments(comments), updatedAt: now }
}

/** The comment with this place, or with none: a comment that is no longer on a diff does not keep the place it had. */
function withPlace(comment: ReviewComment, place: DiffPlace | null): ReviewComment {
  const { place: _before, ...rest } = comment
  return place ? { ...rest, place } : rest
}

export function sortComments<T extends { startLine: number; endLine: number; createdAt: string }>(comments: T[]): T[] {
  return [...comments].sort(
    (a, b) => a.startLine - b.startLine || a.endLine - b.endLine || a.createdAt.localeCompare(b.createdAt),
  )
}

/** A draft with words or a suggestion in it is lost when the view is replaced. */
export function draftHasText(draft: Draft | null): boolean {
  return !!draft && (draft.comment.trim() !== '' || draft.suggestion !== null)
}

export type OpenPlan = { kind: 'open' } | { kind: 'ignore' } | { kind: 'ask'; message: string }

/**
 * What to do when `incoming` is opened over the current session. The same file again changes nothing, so it is
 * ignored. Otherwise the reviewer is asked only when something would be lost: saved comments (they stay on the
 * start page, under "Continue reviewing") or a draft in progress (it does not).
 */
export function planOpen(review: Review | null, draft: Draft | null, incoming: { name: string; hash: string }): OpenPlan {
  if (!review) return { kind: 'open' }
  if (review.file.hash === incoming.hash) return { kind: 'ignore' }
  const comments = review.comments.length
  const writing = draftHasText(draft)
  if (comments === 0 && !writing) return { kind: 'open' }

  const name = review.file.name
  const target = incoming.name === name ? 'a version of it that has different content' : `"${incoming.name}"`
  const lines = [`Replace "${name}" with ${target}?`, '']
  if (comments > 0) {
    const count = comments === 1 ? '1 comment' : `${comments} comments`
    lines.push(`"${name}" has ${count}. They stay under "Continue reviewing" on the start page; open "${name}" again to get them back.`)
  }
  if (writing) lines.push('The comment you are writing will be lost.')
  return { kind: 'ask', message: lines.join('\n') }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A whole number that is at least `min`. Anything else, including text and decimals, is not. */
const isWholeFrom = (value: unknown, min: number): value is number => Number.isInteger(value) && (value as number) >= min

const isRangeOrNull = (value: unknown): boolean =>
  value === null || (isRecord(value) && isWholeFrom(value.start, 1) && isWholeFrom(value.end, value.start as number))

const isPlace = (value: unknown): boolean => isRecord(value) && typeof value.path === 'string' && isRangeOrNull(value.old) && isRangeOrNull(value.new)

function isComment(value: unknown): value is ReviewComment {
  if (!isRecord(value)) return false
  const { startLine, endLine } = value
  return (
    typeof value.id === 'string' &&
    isWholeFrom(startLine, 1) &&
    isWholeFrom(endLine, startLine) &&
    typeof value.code === 'string' &&
    typeof value.comment === 'string' &&
    (typeof value.suggestion === 'string' || value.suggestion === null) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    (value.place === undefined || isPlace(value.place))
  )
}

/** A value that arrived from outside (a message, a file) as a review of version 1, or `null` if it is not one. */
export function parseReview(value: unknown): Review | null {
  if (!isRecord(value) || value.version !== 1) return null
  const file = value.file
  if (!isRecord(file)) return null
  if (typeof file.name !== 'string' || typeof file.language !== 'string' || typeof file.hash !== 'string') return null
  if (!isWholeFrom(file.lineCount, 1)) return null // a reviewed file has a line at least: the engine does not open an empty one
  if (typeof value.summary !== 'string' || !Array.isArray(value.comments) || !value.comments.every(isComment)) return null
  if (typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') return null
  if (!(typeof value.submittedAt === 'string' || value.submittedAt === null)) return null
  return value as unknown as Review
}

/** "Edited" means touched after the last export (`submittedAt`, which the interface calls exported: the name is kept so the stored format stays at version 1). */
export function hasUnsubmittedChanges(review: Review): boolean {
  return review.submittedAt === null || review.updatedAt > review.submittedAt
}

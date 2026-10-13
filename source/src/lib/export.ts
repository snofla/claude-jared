import type { Review, ReviewComment, SetReview } from '../types.ts'
import { placeParts } from './diff.ts'
import { rangeLabel } from './review.ts'

export function toJson(review: Review | SetReview): string {
  return JSON.stringify(review, null, 2)
}

/** A fence long enough that backticks inside the code can't close it early. */
function fenceFor(code: string): string {
  const longest = Math.max(0, ...(code.match(/`+/g) ?? []).map((run) => run.length))
  return '`'.repeat(Math.max(3, longest + 1))
}

function codeBlock(code: string, language: string): string {
  const fence = fenceFor(code)
  const info = language === 'text' ? '' : language
  return `${fence}${info}\n${code}\n${fence}`
}

/** What a comment is under: its lines, or the file and the lines of the old and the new file that it is on in a diff. */
function heading(comment: ReviewComment): string {
  if (!comment.place) return rangeLabel(comment.startLine, comment.endLine)
  const { path, where } = placeParts(comment.place)
  return path === '' ? where : `\`${path}\` · ${where}`
}

/** The comments of one file, numbered from 1, each under its lines or its place in a diff. */
function commentSections(comments: readonly ReviewComment[], language: string, level: string): string[] {
  const out: string[] = []
  comments.forEach((c, i) => {
    out.push(`${level} ${i + 1}. ${heading(c)}`, '')
    out.push(codeBlock(c.code, language), '')
    if (c.comment) out.push(c.comment, '')
    if (c.suggestion !== null) {
      out.push('**Suggested implementation**', '', codeBlock(c.suggestion, language), '')
    }
  })
  return out
}

/** A review of several files: the summary, then a heading for each file, in the order of the files, with its comments under it. */
function setToMarkdown(review: SetReview): string {
  const { files, comments } = review
  const out: string[] = []

  out.push(`# Code review: ${files.length} files`, '')
  out.push(`- **Comments:** ${comments.length}`)
  out.push('')

  if (review.summary.trim()) {
    out.push('## Summary', '', review.summary.trim(), '')
  }

  for (const file of files) {
    const mine = comments.filter((c) => c.file === file.id)
    out.push(`## \`${file.name}\``, '')
    out.push(`- **Language:** ${file.language}`)
    out.push(`- **Lines:** ${file.lineCount}`)
    out.push(`- **Comments:** ${mine.length}`)
    out.push('')
    if (mine.length === 0) out.push('_No comments._', '')
    else out.push(...commentSections(mine, file.language, '###'))
  }
  return out.join('\n').trimEnd() + '\n'
}

export function toMarkdown(review: Review | SetReview): string {
  if (review.version === 2) return setToMarkdown(review)
  const { file, comments } = review
  const out: string[] = []

  out.push(`# Code review: \`${file.name}\``, '')
  out.push(`- **Language:** ${file.language}`)
  out.push(`- **Lines:** ${file.lineCount}`)
  out.push(`- **Comments:** ${comments.length}`)
  out.push('')

  if (review.summary.trim()) {
    out.push('## Summary', '', review.summary.trim(), '')
  }

  if (comments.length === 0) {
    out.push('_No comments._', '')
  } else {
    out.push('## Comments', '')
    out.push(...commentSections(comments, file.language, '###'))
  }
  return out.join('\n').trimEnd() + '\n'
}

/** The name a saved review is given: its file's, and for a review of several files the number of them, since no file's name is theirs. */
export function reviewFileName(review: Review | SetReview, ext: 'json' | 'md'): string {
  return review.version === 2 ? `review-of-${review.files.length}-files.review.${ext}` : `${review.file.name}.review.${ext}`
}

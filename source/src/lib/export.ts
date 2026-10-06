import type { Review, ReviewComment } from '../types.ts'
import { placeParts } from './diff.ts'
import { rangeLabel } from './review.ts'

export function toJson(review: Review): string {
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

export function toMarkdown(review: Review): string {
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
    comments.forEach((c, i) => {
      out.push(`### ${i + 1}. ${heading(c)}`, '')
      out.push(codeBlock(c.code, file.language), '')
      if (c.comment) out.push(c.comment, '')
      if (c.suggestion !== null) {
        out.push('**Suggested implementation**', '', codeBlock(c.suggestion, file.language), '')
      }
    })
  }
  return out.join('\n').trimEnd() + '\n'
}

export function reviewFileName(review: Review, ext: 'json' | 'md'): string {
  return `${review.file.name}.review.${ext}`
}

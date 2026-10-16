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

/** The fence that a line opens, or null: at most three spaces in, three or more backticks or tildes, and for backticks none in what follows them. */
function fenceOpened(line: string): { indent: string; mark: string } | null {
  const found = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(line)
  if (!found) return null
  if (found[2][0] === '`' && found[3].includes('`')) return null
  return { indent: found[1], mark: found[2] }
}

/** Whether a line closes a fence that `mark` opened: the same kind of mark, at least as many, and nothing after them. */
function fenceClosed(line: string, mark: string): boolean {
  const found = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line)
  return found !== null && found[1][0] === mark[0] && found[1].length >= mark.length
}

/**
 * The kinds of HTML block that run to an end text and not to a blank line: a line at most three spaces in that starts one opens it, and the first line that
 * holds its end text, the opening one too, ends it. One that is never ended takes in the rest of a document. A tag name and its end are read in any case.
 */
const HTML_BLOCKS: ReadonlyArray<{ start: RegExp; end: (opened: RegExpExecArray) => string }> = [
  { start: /^( {0,3})<(script|pre|style|textarea)(?=[\s>]|$)/i, end: (opened) => `</${opened[2].toLowerCase()}>` },
  { start: /^( {0,3})<!--/, end: () => '-->' },
  { start: /^( {0,3})<\?/, end: () => '?>' },
  { start: /^( {0,3})<![A-Za-z]/, end: () => '>' },
  { start: /^( {0,3})<!\[CDATA\[/, end: () => ']]>' },
]

/** The HTML block that a line opens, with the indentation of the line and the text that ends the block, or null. */
function htmlOpened(line: string): { indent: string; end: string } | null {
  for (const kind of HTML_BLOCKS) {
    const opened = kind.start.exec(line)
    if (opened) return { indent: opened[1], end: kind.end(opened) }
  }
  return null
}

const endsHtml = (line: string, end: string): boolean => line.toLowerCase().includes(end)

/**
 * The words of a reviewer, written so that they cannot break the document they are in. A comment is Markdown by convention, and an export is read as one
 * document: a line that starts with `#` would be a heading of the document, a line of `=` or `-` under a line of text would make that line one, and a code
 * fence that the words open and never close would take in every comment after it, and so would raw HTML of a kind that runs to an end text, left open. So,
 * outside the fences and the blocks of HTML of the words, the first `#` of a heading line and the first character of such an underline get a backslash, which
 * Markdown shows as the mark itself; and a fence or a block of HTML that is still open at the end is closed, with a line of the same mark and length or with
 * the end text of the block, at the indentation of the line that opened it, which keeps one that is inside a list item inside that item. Lines inside a fence
 * or a block of HTML are left as they are.
 */
export function safeMarkdown(text: string): string {
  const out: string[] = []
  let open: { indent: string; mark: string } | null = null
  let html: { indent: string; end: string } | null = null
  let afterText = false
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (open) {
      if (fenceClosed(line, open.mark)) open = null
      afterText = false
      out.push(line)
      continue
    }
    if (html) {
      if (endsHtml(line, html.end)) html = null
      afterText = false
      out.push(line)
      continue
    }
    const fence = fenceOpened(line)
    if (fence) {
      open = fence
      afterText = false
      out.push(line)
      continue
    }
    const block = htmlOpened(line)
    if (block) {
      if (!endsHtml(line, block.end)) html = block
      afterText = false
      out.push(line)
      continue
    }
    if (/^ {0,3}#{1,6}(?=[ \t]|$)/.test(line)) out.push(line.replace('#', '\\#'))
    else if (afterText && /^ {0,3}(=+|-+)[ \t]*$/.test(line)) out.push(line.replace(/[=-]/, '\\$&'))
    else out.push(line)
    afterText = line.trim() !== ''
  }
  if (open) out.push(open.indent + open.mark)
  if (html) out.push(html.indent + html.end)
  return out.join('\n')
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
    if (c.comment) out.push(safeMarkdown(c.comment), '')
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
    out.push('## Summary', '', safeMarkdown(review.summary.trim()), '')
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
    out.push('## Summary', '', safeMarkdown(review.summary.trim()), '')
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

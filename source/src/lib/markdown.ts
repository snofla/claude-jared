/**
 * The Markdown of a comment, read into a small tree of data: what the page draws a comment from. It is pure, with no React and no HTML in it, so that it can be
 * tested on its own, and it never throws. The page turns each node into an element, makes a link open in a new tab with its address shown, and has a code block
 * coloured as code.
 *
 * What is read is a safe subset: paragraphs, **bold**, *italic* and _italic_, `code`, [links](https://example.com) with a scheme of http, https or mailto,
 * bullet and numbered lists, > quotes and fenced code. What is not read stays as typed text: raw HTML, images, headings (a `#` line is a line of text), a bare
 * address, and a link with any other scheme. A newline in a paragraph is a `break`.
 *
 * A review file may come from someone else, so the reading is linear in the length of the text on any text: a quote is read only up to `MAX_QUOTE_DEPTH` deep,
 * emphasis only up to `MAX_INLINE_DEPTH` deep, and what is deeper stays as typed.
 */

/** A piece of a line of a comment. */
export type MarkdownInline =
  | { kind: 'text'; text: string }
  /** A newline inside a paragraph or a list item. */
  | { kind: 'break' }
  | { kind: 'bold'; children: MarkdownInline[] }
  | { kind: 'italic'; children: MarkdownInline[] }
  /** Code in a line: its characters as typed, whatever they are. */
  | { kind: 'code'; text: string }
  /** A link: `url` begins with `http:`, `https:` or `mailto:`, and what is shown is `children`, which holds no other link. */
  | { kind: 'link'; url: string; children: MarkdownInline[] }

/** A part of a comment, from one blank line to the next, or a list, a quote or a fence. */
export type MarkdownBlock =
  | { kind: 'paragraph'; children: MarkdownInline[] }
  /** The items of a list, each the line or lines of one item; a numbered list begins at `start`. */
  | { kind: 'list'; ordered: false; items: MarkdownInline[][] }
  | { kind: 'list'; ordered: true; start: number; items: MarkdownInline[][] }
  /** The blocks of the lines of a quote, with their `>` taken off; a quote inside a quote is as deep as `MAX_QUOTE_DEPTH` allows. */
  | { kind: 'quote'; children: MarkdownBlock[] }
  /** A fenced block: the word after the fence if there is one (`ts`), and the lines of the block as typed, joined by newlines. A fence that is not closed runs to the end. */
  | { kind: 'code'; language: string | null; text: string }

/** How many quotes deep a `>` is read as a quote; beyond it the text stays as typed. */
export const MAX_QUOTE_DEPTH = 6

/** How many marks of emphasis and links deep a piece of a line is read; beyond it the marks stay as typed. */
export const MAX_INLINE_DEPTH = 6

/** The longest address that is read as the address of a link; a longer one stays as typed. */
export const MAX_URL_LENGTH = 2048

/** How many brackets `(` deep an address may go; a deeper one stays as typed. */
export const MAX_ADDRESS_NESTING = 32

const SCHEMES = /^(?:https?|mailto):[^\s`<>]+$/i

// --- Blocks

const isBlank = (line: string): boolean => line.trim() === ''

const OPENING_FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/
const CLOSING_FENCE = /^ {0,3}(`+|~+)[ \t]*$/
const QUOTE_LINE = /^ {0,3}>/
const BULLET = /^ {0,3}[-*+][ \t]+(\S.*)$/
const NUMBER = /^ {0,3}(\d{1,9})[.)][ \t]+(\S.*)$/
const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/
const INDENTED = /^(?: {2,}|\t)[ \t]*\S/

interface Fence {
  char: string
  length: number
  indent: number
  language: string | null
}

function openingFence(line: string): Fence | null {
  const found = OPENING_FENCE.exec(line)
  if (!found) return null
  const info = found[2].trim()
  // A fence of backticks has no backtick after it: "```code```" is code in a line.
  if (found[1][0] === '`' && info.includes('`')) return null
  const word = info.split(/\s+/)[0]
  return { char: found[1][0], length: found[1].length, indent: line.length - line.trimStart().length, language: /^[A-Za-z0-9_+#.-]{1,32}$/.test(word) ? word : null }
}

function closesFence(line: string, fence: Fence): boolean {
  const found = CLOSING_FENCE.exec(line)
  return found !== null && found[1][0] === fence.char && found[1].length >= fence.length
}

interface Marker {
  ordered: boolean
  start: number
  content: string
}

/** The marker that starts a list item on a line, and what follows it. A line of three or more `-`, `*` or `_` is not an item. */
function listMarker(line: string): Marker | null {
  if (THEMATIC_BREAK.test(line)) return null
  const bullet = BULLET.exec(line)
  if (bullet) return { ordered: false, start: 1, content: bullet[1] }
  const number = NUMBER.exec(line)
  return number ? { ordered: true, start: Number(number[1]), content: number[2] } : null
}

/** Whether a line starts a block, and so ends a paragraph before it: a fence, a quote, a bullet or the number 1. */
function startsBlock(line: string, depth: number): boolean {
  if (openingFence(line) !== null) return true
  if (depth < MAX_QUOTE_DEPTH && QUOTE_LINE.test(line)) return true
  const marker = listMarker(line)
  return marker !== null && (!marker.ordered || marker.start === 1)
}

function readBlocks(lines: string[], depth: number): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  let at = 0
  while (at < lines.length) {
    const line = lines[at]
    if (isBlank(line)) {
      at++
      continue
    }
    const fence = openingFence(line)
    if (fence) {
      const body: string[] = []
      at++
      while (at < lines.length && !closesFence(lines[at], fence)) {
        const indent = lines[at].length - lines[at].trimStart().length
        body.push(lines[at].slice(Math.min(fence.indent, indent)))
        at++
      }
      at++ // the closing fence, or the end
      blocks.push({ kind: 'code', language: fence.language, text: body.join('\n') })
      continue
    }
    if (depth < MAX_QUOTE_DEPTH && QUOTE_LINE.test(line)) {
      const inner: string[] = []
      while (at < lines.length && QUOTE_LINE.test(lines[at])) inner.push(lines[at++].replace(/^ {0,3}> ?/, ''))
      blocks.push({ kind: 'quote', children: readBlocks(inner, depth + 1) })
      continue
    }
    const marker = listMarker(line)
    if (marker) {
      const items: string[][] = []
      let next: Marker | null = marker
      while (next) {
        const item = [next.content]
        at++
        while (at < lines.length && INDENTED.test(lines[at]) && listMarker(lines[at]) === null && openingFence(lines[at]) === null) item.push(lines[at++].trim())
        items.push(item)
        // The next item follows at once or after blank lines, and is of the same kind; an item that is not is the start of another list.
        let look = at
        while (look < lines.length && isBlank(lines[look])) look++
        const following: Marker | null = look < lines.length ? listMarker(lines[look]) : null
        next = following && following.ordered === marker.ordered ? following : null
        if (next) at = look
      }
      const parsed = items.map((item) => readInline(item.join('\n'), MAX_INLINE_DEPTH, true))
      blocks.push(marker.ordered ? { kind: 'list', ordered: true, start: marker.start, items: parsed } : { kind: 'list', ordered: false, items: parsed })
      continue
    }
    const paragraph = [line.trim()]
    at++
    while (at < lines.length && !isBlank(lines[at]) && !startsBlock(lines[at], depth)) paragraph.push(lines[at++].trim())
    blocks.push({ kind: 'paragraph', children: readInline(paragraph.join('\n'), MAX_INLINE_DEPTH, true) })
  }
  return blocks
}

// --- Inline

const ASCII_PUNCTUATION = /[!-/:-@[-`{-~]/
const isSpace = (c: string | undefined): boolean => c === undefined || /\s/u.test(c)
const isPunctuation = (c: string | undefined): boolean => c !== undefined && /[\p{P}\p{S}]/u.test(c)
/** A backslash before a punctuation mark at `at`, which makes the mark itself a character. */
const escapes = (s: string, at: number): boolean => s[at] === '\\' && at + 1 < s.length && ASCII_PUNCTUATION.test(s[at + 1])

interface CodeSpan {
  start: number
  end: number
  text: string
}

/** The runs of backticks in a text that make code in a line: a run closes at the next run of the same length, and a run that nothing closes is only backticks. */
function findCodeSpans(s: string): CodeSpan[] {
  const runs: Array<{ at: number; length: number }> = []
  for (let i = 0; i < s.length; ) {
    if (escapes(s, i)) i += 2
    else if (s[i] === '`') {
      let end = i
      while (s[end] === '`') end++
      runs.push({ at: i, length: end - i })
      i = end
    } else i++
  }
  // The next run of the same length after each run, found from the end, so that no run looks further than once.
  const nextSame: number[] = new Array(runs.length).fill(-1)
  const lastOfLength = new Map<number, number>()
  for (let r = runs.length - 1; r >= 0; r--) {
    nextSame[r] = lastOfLength.get(runs[r].length) ?? -1
    lastOfLength.set(runs[r].length, r)
  }
  const spans: CodeSpan[] = []
  for (let r = 0; r < runs.length; r++) {
    const close = nextSame[r]
    if (close < 0) continue
    const inside = s.slice(runs[r].at + runs[r].length, runs[close].at).replace(/\n/g, ' ')
    const text = inside.startsWith(' ') && inside.endsWith(' ') && inside.trim() !== '' ? inside.slice(1, -1) : inside
    spans.push({ start: runs[r].at, end: runs[close].at + runs[close].length, text })
    r = close
  }
  return spans
}

interface Link {
  open: number
  close: number
  end: number
  url: string
}

/**
 * Where the `)` is that ends an address that begins at `from`, or -1: no space, backtick or angle bracket, brackets of `(` and `)` in pairs and at most
 * `MAX_ADDRESS_NESTING` deep, not longer than `MAX_URL_LENGTH`. The nesting is what keeps a text of many `](` and no `)` from being looked at again and again.
 */
function addressEnd(s: string, from: number): number {
  let depth = 1
  for (let i = from; i < s.length && i - from <= MAX_URL_LENGTH; i++) {
    const c = s[i]
    if (/[\s`<>]/.test(c)) return -1
    if (c === '(' && ++depth > MAX_ADDRESS_NESTING) return -1
    if (c === ')' && --depth === 0) return i
  }
  return -1
}

/** The links in a text, outside code: `[text](address)` with an address of the three schemes, a link inside a link left as typed, an image mark left as typed. */
function findLinks(s: string, spans: CodeSpan[]): Link[] {
  const links: Link[] = []
  const openers: Array<{ at: number; image: boolean }> = []
  // The openers below this place on the stack are not active: a link that was made closes them to links, and a barrier does it at once for all of them.
  let inactiveBelow = 0
  let span = 0
  let bang = -2
  for (let i = 0; i < s.length; ) {
    if (span < spans.length && spans[span].start === i) i = spans[span++].end
    else if (escapes(s, i)) i += 2
    else if (s[i] === '[') {
      openers.push({ at: i, image: bang === i - 1 })
      i++
    } else if (s[i] === ']' && openers.length > 0) {
      const opener = openers.pop()!
      const active = openers.length >= inactiveBelow
      inactiveBelow = Math.min(inactiveBelow, openers.length)
      const target = s[i + 1] === '(' ? addressEnd(s, i + 2) : -1
      const url = s.slice(i + 2, target)
      if (active && !opener.image && target >= 0 && SCHEMES.test(url) && s.slice(opener.at + 1, i).trim() !== '') {
        links.push({ open: opener.at, close: i, end: target + 1, url })
        inactiveBelow = openers.length
        i = target + 1
      } else i++
    } else {
      if (s[i] === '!') bang = i
      i++
    }
  }
  return links
}

/** A run of `*` or `_`, and where it can open and close emphasis (the rules of flanking runs of CommonMark). */
interface Delimiter {
  char: string
  length: number
  original: number
  open: boolean
  close: boolean
  active: boolean
}

function delimiterAt(s: string, at: number, length: number): Delimiter {
  const before = s[at - 1]
  const after = s[at + length]
  const leftFlanking = !isSpace(after) && (!isPunctuation(after) || isSpace(before) || isPunctuation(before))
  const rightFlanking = !isSpace(before) && (!isPunctuation(before) || isSpace(after) || isPunctuation(after))
  const char = s[at]
  return char === '*'
    ? { char, length, original: length, open: leftFlanking, close: rightFlanking, active: true }
    : { char, length, original: length, open: leftFlanking && (!rightFlanking || isPunctuation(before)), close: rightFlanking && (!leftFlanking || isPunctuation(after)), active: true }
}

/** A piece of a line that is read: a finished node, or a run of delimiters that is not yet; the cells are linked both ways so that a node can be put around some of them. */
interface Cell {
  seq: number
  prev: Cell
  next: Cell | null
  node: MarkdownInline | null
  depth: number
  delimiter: Delimiter | null
}

const depthOf = (nodes: MarkdownInline[]): number =>
  nodes.reduce((deepest, node) => (node.kind === 'bold' || node.kind === 'italic' || node.kind === 'link' ? Math.max(deepest, 1 + depthOf(node.children)) : deepest), 0)

/** The nodes of the cells from `cell` to `until`, with the marks that nothing closed as the text that was typed. */
function nodesOf(cell: Cell | null, until: Cell | null): MarkdownInline[] {
  const nodes: MarkdownInline[] = []
  const add = (text: string) => {
    const last = nodes[nodes.length - 1]
    if (last?.kind === 'text') last.text += text
    else nodes.push({ kind: 'text', text })
  }
  for (; cell && cell !== until; cell = cell.next) {
    if (cell.delimiter) add(cell.delimiter.char.repeat(cell.delimiter.length))
    else if (cell.node!.kind === 'text') add(cell.node!.text)
    else nodes.push(cell.node!)
  }
  return nodes
}

/** Whether a closing run and an opening run may not match because of the length of the two runs together, as in CommonMark ("the rule of 3"). */
const breaksRuleOfThree = (opening: Delimiter, closing: Delimiter): boolean =>
  (closing.open || opening.close) && (opening.original + closing.original) % 3 === 0 && !(opening.original % 3 === 0 && closing.original % 3 === 0)

/**
 * Put bold and italic nodes around the runs of delimiters that match, as CommonMark does, with its bound on where a closing run looks back for an opening one
 * (a run that found none lets the runs of its kind after it stop where it did), so that no cell is looked at again and again. It stops at the first node that
 * would be deeper than `room`: what is left stays as typed.
 */
function markEmphasis(head: Cell, room: number): void {
  const bottoms = new Map<string, number>()
  let closer = head.next
  while (closer) {
    const d: Delimiter | null = closer.delimiter
    if (!d || !d.active || !d.close) {
      closer = closer.next
      continue
    }
    const bottom = bottoms.get(`${d.char}${d.open ? 1 : 0}${d.original % 3}`) ?? -1
    let opener: Cell = closer.prev
    while (opener.seq > bottom && !(opener.delimiter && opener.delimiter.active && opener.delimiter.char === d.char && opener.delimiter.open && !breaksRuleOfThree(opener.delimiter, d))) {
      opener = opener.prev
    }
    if (opener.seq <= bottom) {
      bottoms.set(`${d.char}${d.open ? 1 : 0}${d.original % 3}`, closer.prev.seq)
      if (!d.open) d.active = false
      closer = closer.next
      continue
    }
    const o = opener.delimiter!
    const use = o.length >= 2 && d.length >= 2 ? 2 : 1
    let deepest = 0
    for (let c = opener.next; c && c !== closer; c = c.next) deepest = Math.max(deepest, c.depth)
    if (deepest + 1 > room) return
    const cell: Cell = { seq: opener.seq, prev: opener, next: closer, node: { kind: use === 2 ? 'bold' : 'italic', children: nodesOf(opener.next, closer) }, depth: deepest + 1, delimiter: null }
    opener.next = cell
    closer.prev = cell
    o.length -= use
    d.length -= use
    if (o.length === 0) {
      cell.prev = opener.prev
      opener.prev.next = cell
    }
    if (d.length === 0) {
      cell.next = closer.next
      if (closer.next) closer.next.prev = cell
      closer = cell.next
    }
  }
}

/**
 * Read a piece of a line. `room` is how many levels of marks may still be put around what is read, and `links` whether a link may be made (not inside a link).
 */
function readInline(s: string, room: number, links: boolean): MarkdownInline[] {
  const spans = findCodeSpans(s)
  const found = links ? findLinks(s, spans) : []
  const head: Cell = { seq: -1, prev: null as unknown as Cell, next: null, node: null, depth: 0, delimiter: null }
  let last = head
  const push = (node: MarkdownInline | null, depth: number, delimiter: Delimiter | null) => {
    const cell: Cell = { seq: last.seq + 1, prev: last, next: null, node, depth, delimiter }
    last.next = cell
    last = cell
  }
  let text = ''
  const flush = () => {
    if (text) push({ kind: 'text', text }, 0, null)
    text = ''
  }
  let span = 0
  let link = 0
  for (let i = 0; i < s.length; ) {
    while (span < spans.length && spans[span].start < i) span++
    if (span < spans.length && spans[span].start === i) {
      flush()
      push({ kind: 'code', text: spans[span].text }, 0, null)
      i = spans[span++].end
    } else if (link < found.length && found[link].open === i) {
      flush()
      const children = readInline(s.slice(i + 1, found[link].close), room - 1, false)
      push({ kind: 'link', url: found[link].url, children }, 1 + depthOf(children), null)
      i = found[link++].end
    } else if (s[i] === '\\' && s[i + 1] === '\n') {
      flush()
      push({ kind: 'break' }, 0, null)
      i += 2
    } else if (escapes(s, i)) {
      text += s[i + 1]
      i += 2
    } else if (s[i] === '\n') {
      flush()
      push({ kind: 'break' }, 0, null)
      i++
    } else if (s[i] === '*' || s[i] === '_') {
      let end = i
      while (s[end] === s[i]) end++
      flush()
      push(null, 0, delimiterAt(s, i, end - i))
      i = end
    } else {
      text += s[i]
      i++
    }
  }
  flush()
  markEmphasis(head, room)
  return nodesOf(head.next, null)
}

// --- The two functions

/**
 * Read the text of a comment.
 *
 * `renderMarkdown('Use `x` **now**.\n\n- [docs](https://a.b)\n- two\n\n> note')` is
 *
 *     [
 *       { kind: 'paragraph', children: [
 *         { kind: 'text', text: 'Use ' }, { kind: 'code', text: 'x' }, { kind: 'text', text: ' ' },
 *         { kind: 'bold', children: [{ kind: 'text', text: 'now' }] }, { kind: 'text', text: '.' },
 *       ] },
 *       { kind: 'list', ordered: false, items: [
 *         [{ kind: 'link', url: 'https://a.b', children: [{ kind: 'text', text: 'docs' }] }],
 *         [{ kind: 'text', text: 'two' }],
 *       ] },
 *       { kind: 'quote', children: [{ kind: 'paragraph', children: [{ kind: 'text', text: 'note' }] }] },
 *     ]
 */
export function renderMarkdown(text: string): MarkdownBlock[] {
  return readBlocks(text.replace(/\r\n?/g, '\n').split('\n'), 0)
}

const inlineText = (nodes: MarkdownInline[]): string =>
  nodes.map((node) => (node.kind === 'text' || node.kind === 'code' ? node.text : node.kind === 'break' ? ' ' : inlineText(node.children))).join('')

const blockText = (block: MarkdownBlock): string =>
  block.kind === 'paragraph' ? inlineText(block.children) : block.kind === 'list' ? block.items.map(inlineText).join(' ') : block.kind === 'quote' ? block.children.map(blockText).join(' ') : block.text

/**
 * The text of a comment for a line of a list: the marks taken out, the lines joined with one space, a link as its text, a code block as its code, a quote
 * without its marker. `plainExcerpt('Use `x` **now**.\n\n- [docs](https://a.b)')` is `'Use x now. docs'`.
 */
export function plainExcerpt(text: string): string {
  return renderMarkdown(text).map(blockText).join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * The editing aids of a field of Markdown, as pure functions: bold and italic around the selection, a link, and a list that goes on when Enter is pressed. The field
 * reads its text and selection, asks for an edit, and applies it itself, as the edits of Tab in a field of code are applied.
 */
import type { TextEdit } from './indent'

/** The marks that put words in bold and in italic: stars, which work inside a word too, where an underscore would not. */
export type EmphasisMark = '**' | '*'

/** How many stars there are just before `at`, and just from `at` on. */
const starsBefore = (value: string, at: number): number => {
  let n = 0
  while (at - n - 1 >= 0 && value[at - n - 1] === '*') n += 1
  return n
}
const starsAfter = (value: string, at: number): number => {
  let n = 0
  while (at + n < value.length && value[at + n] === '*') n += 1
  return n
}

/**
 * Whether `stars` on both sides of some words make them bold or italic: bold when there are two or more on each side, italic when the fewer of the two sides is
 * odd, so that `***words***` is both and the inner star of `**words**` is not taken for an italic mark.
 */
const hasMark = (stars: number, mark: EmphasisMark): boolean => (mark === '**' ? stars >= 2 : stars % 2 === 1)

/**
 * Bold or italic. A selection gets the marks around it, without the spaces at its ends, which stay outside; a selection that already has the mark just around it, or at
 * its own ends, loses it, so that a second press takes it off, and `***words***` keeps its other mark. With nothing selected the two marks go in with the caret between
 * them.
 */
export function toggleEmphasis(value: string, start: number, end: number, mark: EmphasisMark): TextEdit {
  const m = mark.length
  if (start === end) return { from: start, to: end, insert: mark + mark, start: start + m, end: start + m }
  const around = Math.min(starsBefore(value, start), starsAfter(value, end))
  if (hasMark(around, mark)) {
    return { from: start - m, to: end + m, insert: value.slice(start, end), start: start - m, end: end - m }
  }
  const selected = value.slice(start, end)
  const inside = Math.min(starsAfter(selected, 0), starsBefore(selected, selected.length))
  if (selected.length > 2 * inside && hasMark(inside, mark)) {
    const inner = selected.slice(m, selected.length - m)
    return { from: start, to: end, insert: inner, start, end: start + inner.length }
  }
  const lead = selected.length - selected.trimStart().length
  const core = selected.trim()
  if (core === '') return { from: start, to: end, insert: selected, start, end }
  const insert = selected.slice(0, lead) + mark + core + mark + selected.slice(lead + core.length)
  return { from: start, to: end, insert, start: start + lead + m, end: start + lead + m + core.length }
}

/** Whether a selection is an address that a link can have: http, https or mailto, and no space. */
const isAddress = (text: string): boolean => /^(https?:\/\/|mailto:)\S+$/.test(text)

/**
 * A link. With nothing selected, `[]()` with the caret in the brackets; a selection that is an address becomes the address of the link, with the caret where its text
 * goes; any other selection becomes the text of the link, with the caret where the address goes.
 */
export function insertLink(value: string, start: number, end: number): TextEdit {
  const selected = value.slice(start, end)
  if (selected === '') return { from: start, to: end, insert: '[]()', start: start + 1, end: start + 1 }
  if (isAddress(selected)) return { from: start, to: end, insert: `[](${selected})`, start: start + 1, end: start + 1 }
  const insert = `[${selected}]()`
  return { from: start, to: end, insert, start: start + insert.length - 1, end: start + insert.length - 1 }
}

/** A line that is an item of a list: its indentation, its marker (`-`, `*`, `+`, or a number and `.` or `)`), the space after it, and its words. */
const ITEM = /^([ \t]*)([-*+]|\d{1,9}[.)])([ \t]+)(.*)$/

const OPENING_FENCE = /^ {0,3}(`{3,}|~{3,})/
const CLOSING_FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/

/** Whether the lines before a line leave a fence open, by the rules of a fence: a line that closes one has the same mark, at least as many, and nothing after them. */
function insideFence(before: string): boolean {
  let open: string | null = null
  for (const line of before.split('\n')) {
    if (open === null) {
      const opened = OPENING_FENCE.exec(line)
      if (opened) open = opened[1]
    } else {
      const closed = CLOSING_FENCE.exec(line)
      if (closed && closed[1][0] === open[0] && closed[1].length >= open.length) open = null
    }
  }
  return open !== null
}

/**
 * Enter in a list, outside a fenced block. With the caret at the end of a line that is an item, the next line starts as the next item: the same marker, or the next number with the same
 * mark after it, at the same indentation. On an item that has no words yet the marker is taken away instead, which ends the list. `null` everywhere else (a
 * selection, a caret inside a line, a line that is no item), so that Enter does what it always does.
 */
export function continueList(value: string, start: number, end: number): TextEdit | null {
  if (start !== end) return null
  const newline = value.indexOf('\n', start)
  if ((newline === -1 ? value.length : newline) !== start) return null
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  if (insideFence(value.slice(0, lineStart))) return null
  const item = ITEM.exec(value.slice(lineStart, start))
  if (!item) return null
  const [, indent, marker, space, words] = item
  if (words.trim() === '') return { from: lineStart, to: start, insert: '', start: lineStart, end: lineStart }
  const number = /^\d+/.exec(marker)
  const next = number ? `${Number(number[0]) + 1}${marker.slice(number[0].length)}` : marker
  const insert = `\n${indent}${next}${space}`
  return { from: start, to: end, insert, start: start + insert.length, end: start + insert.length }
}

/**
 * Whether the keys of a computer are those of Apple's, from the name that the browser gives its platform: there the shortcuts are with ⌘, and elsewhere with Ctrl,
 * so that Ctrl+B and Ctrl+K keep what they do in a text field on a Mac (back a character, and delete to the end of the line).
 */
export const isApple = (platform: string): boolean => /mac|iphone|ipad|ipod/i.test(platform)

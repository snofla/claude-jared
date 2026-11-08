import type { SourceFile } from '../types.ts'
import { hashString } from './hash.ts'
import { looksLikeDiff } from './diff.ts'
import { DIFF_LANGUAGE, detectLanguage, PLAIN_TEXT } from './language.ts'
import { formatBytes } from './util.ts'

/**
 * The largest file that is opened. Measured in a production build: highlighting runs as one task, so the
 * page stops responding for about as long as it takes, 2.2 s at 512 KB, 5.8 s at 1 MB and 14 s at 2 MB, and selecting
 * a line takes under 85 ms at 512 KB and 256 to 388 ms at 2 MB.
 */
export const MAX_BYTES = 512 * 1024

/**
 * The most text that a review of several files holds, in all: the limit of one file. Measured in a production build: what costs is the bytes and
 * not the number of files, so 100 files of 5 KB settle as fast as one file of 500 KB.
 */
export const MAX_SET_BYTES = MAX_BYTES

/**
 * The most text that a review of the commits of a branch holds, in all: four times the limit of one file, each commit keeping that limit. The page draws one commit
 * at a time, so a press on a commit costs that commit's text and not the set's. Measured in a production build: 2 MB of 100 commits opens in about 125 ms, and a press
 * on a commit draws in about 100 ms; 8 MB in about 230 ms and 110 ms. What stops the rise is the browser's storage, which keeps the text of every file of a set: its
 * quota, about 5.2 million characters for an origin, is shared by every kept review, and a set that fills it pushes the texts of the others out. At 2 MB about 3 million
 * characters stay for them.
 */
export const MAX_COMMITS_BYTES = 4 * MAX_BYTES

export type OpenResult = { ok: true; file: SourceFile } | { ok: false; error: string }

/** Strip BOM, unify line endings, drop a single trailing newline (editors don't show an extra line). */
export function normalizeSource(raw: string): string {
  return raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n').replace(/\n$/, '')
}

export function looksBinary(raw: string): boolean {
  return raw.slice(0, 8000).includes('\0')
}

/** The language a text is opened as: the one its name or first line gives, or else diff when it is one. */
function languageOf(name: string, lines: string[]): string {
  const detected = detectLanguage(name, lines[0])
  return detected === PLAIN_TEXT && looksLikeDiff(lines) ? DIFF_LANGUAGE : detected
}

export function buildSource(name: string, raw: string, language?: string): SourceFile {
  const content = normalizeSource(raw)
  const lines = content.split('\n')
  return {
    name,
    content,
    lines,
    language: language ?? languageOf(name, lines),
    hash: hashString(`${name}\0${content}`),
  }
}

export const tooBig = (name: string, bytes: number): string =>
  `${name} is ${formatBytes(bytes)}. Files over ${formatBytes(MAX_BYTES)} are not supported.`

/** What a text has to be to be opened as a source file, whichever way it arrived: a browser file, a message, a path. */
export function prepareSource(name: string, raw: string): OpenResult {
  const bytes = new TextEncoder().encode(raw).length
  if (bytes > MAX_BYTES) return { ok: false, error: tooBig(name, bytes) }
  if (looksBinary(raw)) return { ok: false, error: `${name} looks like a binary file, not source code.` }
  if (raw.trim() === '') return { ok: false, error: `${name} is empty.` }
  return { ok: true, file: buildSource(name, raw) }
}

import { COPY } from './copy.ts'
import { setHashOf } from './hash.ts'
import { PLAIN_TEXT } from './language.ts'
import { setLayout, textOfRow, type SetLayout } from './set-view.ts'
import { buildSource } from './source.ts'
import type { SetReview, SourceFile } from '../types.ts'

/** What the page keeps of a set of files besides its review: the files, in the review's order, and the rows that they are drawn as. */
export interface OpenSet {
  files: SourceFile[]
  layout: SetLayout
}

/**
 * The page's view of a set that the engine holds. Besides the files and their layout it gives one `file` that stands for the whole, so that everything
 * on the page that treats what is open as a file keeps working: its name says how many files there are, its lines are the rows of the layout, and its
 * hash is the set's, which keeps the saved review, the viewed marks and what was handed over to a program.
 */
export function openSet(files: ReadonlyArray<{ id: string; name: string; content: string }>, review: SetReview): { file: SourceFile; set: OpenSet } {
  const built = files.map((f, i) => buildSource(f.name, f.content, review.files[i]?.language))
  const layout = setLayout(built.map((f, i) => ({ id: files[i].id, name: f.name, language: f.language, lines: f.lines })))
  const lines = layout.rows.map((_, i) => textOfRow(layout, i + 1))
  const file: SourceFile = { name: COPY.fileCount(built.length), content: lines.join('\n'), lines, language: PLAIN_TEXT, hash: setHashOf(built) }
  return { file, set: { files: built, layout } }
}

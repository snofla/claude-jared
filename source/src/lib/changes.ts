import type { ReviewChanges } from '../engine/protocol.ts'
import type { AnyReview } from '../types.ts'

/**
 * What changed in a review since a press, for the button that sends the changes and for the list that marks them. A press sends the whole review; this
 * keeps only what is needed to tell what differs from it later: the summary and the time each comment was last changed, by id, which is how a comment
 * is told to be edited (`updatedAt` moves with every edit, as the skill reads it too).
 */
export interface Snapshot {
  summary: string
  comments: Readonly<Record<string, string>>
}

export const snapshotOf = (review: AnyReview): Snapshot => ({ summary: review.summary, comments: Object.fromEntries(review.comments.map((c) => [c.id, c.updatedAt])) })

/** What differs from a snapshot: the ids of the comments that are new, edited or deleted, and whether the summary changed. */
export interface Delta {
  new: string[]
  edited: string[]
  deleted: string[]
  summary: boolean
}

/**
 * What differs between `before` and the review as it is. `before` is `null` when nothing was sent: then every comment is new, and the summary changed
 * if there is one. New and edited comments come in the order of the review, deleted ones in the order of what was sent.
 */
export function deltaSince(before: Snapshot | null, review: AnyReview): Delta {
  const was = before?.comments ?? {}
  const fresh: string[] = []
  const edited: string[] = []
  for (const comment of review.comments) {
    if (!(comment.id in was)) fresh.push(comment.id)
    else if (was[comment.id] !== comment.updatedAt) edited.push(comment.id)
  }
  const present = new Set(review.comments.map((c) => c.id))
  const deleted = Object.keys(was).filter((id) => !present.has(id))
  return { new: fresh, edited, deleted, summary: review.summary !== (before?.summary ?? '') }
}

/** How many changes there are to send: each comment added, edited or deleted, and the summary as one. */
export const changeCount = (delta: Delta): number => delta.new.length + delta.edited.length + delta.deleted.length + (delta.summary ? 1 : 0)

/**
 * The note that goes with a review the program is handed, `since` the revision of the review that a call took last (0 when none was taken). It leaves out
 * the summary, which the program reads again, and it only helps: the review is the truth.
 */
export const noteOf = (since: number, delta: Delta): ReviewChanges => ({ since, new: [...delta.new], edited: [...delta.edited], deleted: [...delta.deleted] })

export type Mark = 'new' | 'edited'

/** The comments that the next press will send, as the list marks them: new or edited. A deleted comment is not in the list, so it is in the count only. */
export function marksOf(delta: Delta): Map<string, Mark> {
  const marks = new Map<string, Mark>()
  for (const id of delta.new) marks.set(id, 'new')
  for (const id of delta.edited) marks.set(id, 'edited')
  return marks
}

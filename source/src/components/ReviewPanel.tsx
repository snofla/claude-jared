import { Fragment } from 'react'
import { COPY } from '../lib/copy'
import type { Mark } from '../lib/changes'
import { fileAt, type FileEntry } from '../lib/files'
import { plainExcerpt } from '../lib/markdown'
import { commentLabel } from '../lib/review'
import type { ReviewComment } from '../types'
import { Badge, IconButton, IconMessage, IconX, Kbd } from '../ui'

/** A commit of a review of a branch, as the panel names it over its comments. */
export interface PanelCommit {
  /** The id of the text that holds the commit: a comment is on it when its `file` is this. */
  id: string
  short: string
  subject: string
}

interface Props {
  comments: ReviewComment[]
  /** The comments that the next press will send: new, or edited since the last press. A comment already sent has none. */
  marks: ReadonlyMap<string, Mark>
  hoveredId: string | null
  onHover: (id: string | null) => void
  onJump: (comment: ReviewComment) => void
  onClose: () => void
  /** The files of the diff, when it has a list: the comments are then grouped under the file that each is on. */
  files?: readonly FileEntry[]
  /** The commits of a review of a branch, in the order that the list shows them: the comments are then grouped under the commit that each is on, in that order, and a commit with none has no heading. */
  commits?: readonly PanelCommit[]
}

export function ReviewPanel({ comments, marks, hoveredId, onHover, onJump, onClose, files = [], commits }: Props) {
  const grouped = files.length > 1
  // By commit: the comments in the order of the commits (the sort keeps the order of the review within a commit), each commit headed once.
  const rank = commits ? new Map(commits.map((commit, place) => [commit.id, place])) : null
  const listed = rank ? [...comments].sort((a, b) => (rank.get(a.file ?? '') ?? 0) - (rank.get(b.file ?? '') ?? 0)) : comments
  return (
    <aside className="side" aria-label="Review comments">
      <header className="side-head">
        <h2>
          Comments <Badge variant="count">{comments.length}</Badge>
        </h2>
        <IconButton className="side-close" label="Close panel" icon={<IconX />} onClick={onClose} />
      </header>

      {comments.length === 0 ? (
        <div className="side-empty">
          <IconMessage />
          <p>
            <strong>Nothing yet.</strong>
          </p>
          <p>
            Click a line number, drag across several, or shift-click to extend. Then press <Kbd>C</Kbd> to comment.
          </p>
        </div>
      ) : (
        <ol className="side-list">
          {listed.map((c, i) => {
            const file = grouped && !commits ? fileAt(files, c.startLine) : -1
            const heading = grouped && !commits && file >= 0 && (i === 0 || fileAt(files, listed[i - 1].startLine) !== file)
            const path = file >= 0 ? files[file].path : ''
            const slash = path.lastIndexOf('/') + 1
            const commit = commits?.find((one) => one.id === c.file)
            const commitHeading = commit !== undefined && (i === 0 || listed[i - 1].file !== c.file)
            return (
            <Fragment key={c.id}>
              {heading && (
                <li className="side-group">
                  <span>{path.slice(0, slash)}</span>
                  <span className="files-name">{path.slice(slash)}</span>
                </li>
              )}
              {commit && commitHeading && (
                <li className="side-group">
                  <code>{commit.short}</code>
                  <span className="files-name">{commit.subject || COPY.commitNoMessage}</span>
                </li>
              )}
              <li>
              <button
                type="button"
                className={c.id === hoveredId ? 'side-item is-active' : 'side-item'}
                onClick={() => onJump(c)}
                onMouseEnter={() => onHover(c.id)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(c.id)}
                onBlur={() => onHover(null)}
              >
                <span className="side-item-top">
                  <Badge>{commentLabel(c)}</Badge>
                  {c.suggestion !== null && <Badge tone="ok">± suggestion</Badge>}
                  {marks.has(c.id) && <Badge tone="accent">{marks.get(c.id) === 'new' ? COPY.markNew : COPY.markEdited}</Badge>}
                </span>
                <span className="side-item-text">{plainExcerpt(c.comment) || 'Suggested change'}</span>
              </button>
              </li>
            </Fragment>
            )
          })}
        </ol>
      )}
    </aside>
  )
}

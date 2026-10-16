import { Fragment } from 'react'
import { COPY } from '../lib/copy'
import type { Mark } from '../lib/changes'
import { fileAt, type FileEntry } from '../lib/files'
import { plainExcerpt } from '../lib/markdown'
import { commentLabel } from '../lib/review'
import type { ReviewComment } from '../types'
import { Badge, IconButton, IconMessage, IconX, Kbd } from '../ui'

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
}

export function ReviewPanel({ comments, marks, hoveredId, onHover, onJump, onClose, files = [] }: Props) {
  const grouped = files.length > 1
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
          {comments.map((c, i) => {
            const file = grouped ? fileAt(files, c.startLine) : -1
            const heading = grouped && file >= 0 && (i === 0 || fileAt(files, comments[i - 1].startLine) !== file)
            const path = file >= 0 ? files[file].path : ''
            const slash = path.lastIndexOf('/') + 1
            return (
            <Fragment key={c.id}>
              {heading && (
                <li className="side-group">
                  <span>{path.slice(0, slash)}</span>
                  <span className="files-name">{path.slice(slash)}</span>
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

import { commentLabel } from '../lib/review'
import type { ReviewComment } from '../types'
import { Badge, IconButton, IconMessage, IconX, Kbd } from '../ui'

interface Props {
  comments: ReviewComment[]
  hoveredId: string | null
  onHover: (id: string | null) => void
  onJump: (comment: ReviewComment) => void
  onClose: () => void
}

export function ReviewPanel({ comments, hoveredId, onHover, onJump, onClose }: Props) {
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
          {comments.map((c) => (
            <li key={c.id}>
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
                </span>
                <span className="side-item-text">{c.comment || 'Suggested change'}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}

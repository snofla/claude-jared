import { useState, type Dispatch } from 'react'
import { useTokens } from '../hooks/useTokens'
import type { LineTokens } from '../lib/highlight'
import { commentLabel } from '../lib/review'
import { usePlatform } from '../hooks/usePlatform'
import { formatTime } from '../lib/util'
import type { Action } from '../state/reducer'
import type { ReviewComment } from '../types'
import { DiffBlock } from './DiffBlock'
import { IconPencil, IconTrash } from './icons'

interface Props {
  comment: ReviewComment
  language: string
  fileTokens: Array<LineTokens | null> | null
  onHover: (id: string | null) => void
  /** The card is being pointed at, by a click on a comment bar or in the comments panel: it flashes. */
  flash: boolean
  dispatch: Dispatch<Action>
}

/** A saved review comment, shown inline under the last line it covers. */
export function ReviewCard({ comment, language, fileTokens, onHover, flash, dispatch }: Props) {
  const { environment } = usePlatform()
  const [confirming, setConfirming] = useState(false)
  const suggestionTokens = useTokens(comment.suggestion, language)
  const originalTokens = fileTokens ? fileTokens.slice(comment.startLine - 1, comment.endLine) : null

  return (
    <section
      className={flash ? 'panel is-flash' : 'panel'}
      data-comment={comment.id}
      onMouseEnter={() => onHover(comment.id)}
      onMouseLeave={() => onHover(null)}
    >
      <article className="card">
        <header className="card-head">
          <span className="chip">{commentLabel(comment)}</span>
          <time className="muted" dateTime={comment.updatedAt}>
            {formatTime(comment.updatedAt)}
          </time>
          <span className="spacer" />
          {confirming ? (
            <>
              <span className="muted">Delete this comment?</span>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                autoFocus
                onClick={() => dispatch({ type: 'deleteComment', id: comment.id, now: environment.now() })}
              >
                Delete
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setConfirming(false)}>
                Keep
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="icon-btn"
                title="Edit"
                aria-label="Edit comment"
                onClick={() => dispatch({ type: 'editComment', id: comment.id })}
              >
                <IconPencil />
              </button>
              <button
                type="button"
                className="icon-btn"
                title="Delete"
                aria-label="Delete comment"
                onClick={() => setConfirming(true)}
              >
                <IconTrash />
              </button>
            </>
          )}
        </header>

        {comment.comment && <p className="card-body">{comment.comment}</p>}

        {comment.suggestion !== null && (
          <div className="suggest">
            <div className="suggest-label">Suggested implementation</div>
            <DiffBlock
              removed={comment.code}
              removedTokens={originalTokens}
              added={comment.suggestion}
              addedTokens={suggestionTokens}
            />
          </div>
        )}
      </article>
    </section>
  )
}

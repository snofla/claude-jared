import { useState, type Dispatch } from 'react'
import { useTokens } from '../hooks/useTokens'
import type { LineTokens } from '../lib/highlight'
import { commentLabel } from '../lib/review'
import { usePlatform } from '../hooks/usePlatform'
import { formatTime } from '../lib/util'
import type { Action } from '../state/reducer'
import type { ReviewComment } from '../types'
import { Badge, Button, Card, CardBody, CardHead, IconButton, IconPencil, IconTrash } from '../ui'
import { DiffBlock } from './DiffBlock'

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
      <Card className="panel-card">
        <CardHead>
          <Badge>{commentLabel(comment)}</Badge>
          <time className="muted" dateTime={comment.updatedAt}>
            {formatTime(comment.updatedAt)}
          </time>
          <span className="spacer" />
          {confirming ? (
            <>
              <span className="muted">Delete this comment?</span>
              <Button
                size="sm"
                variant="danger"
                autoFocus
                onClick={() => dispatch({ type: 'deleteComment', id: comment.id, now: environment.now() })}
              >
                Delete
              </Button>
              <Button size="sm" onClick={() => setConfirming(false)}>
                Keep
              </Button>
            </>
          ) : (
            <>
              <IconButton
                title="Edit"
                label="Edit comment"
                icon={<IconPencil />}
                onClick={() => dispatch({ type: 'editComment', id: comment.id })}
              />
              <IconButton title="Delete" label="Delete comment" icon={<IconTrash />} onClick={() => setConfirming(true)} />
            </>
          )}
        </CardHead>

        {comment.comment && <CardBody>{comment.comment}</CardBody>}

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
      </Card>
    </section>
  )
}

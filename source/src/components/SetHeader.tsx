import { memo } from 'react'
import { COPY } from '../lib/copy'
import { Badge, Button, IconCheck } from '../ui'

interface Props {
  n: number
  name: string
  /** What kind of file it is, in a word: its language. */
  badge: string | null
  /** Whether the reviewer has marked the file as viewed, and the press that toggles it. Both are left out when the page has no list of files. */
  viewed?: boolean
  onViewed?: () => void
}

/** The header of a file in a set of files: its name, its language and a button that marks it as viewed. It has no line to comment on. */
export const SetHeader = memo(function SetHeader({ n, name, badge, viewed, onViewed }: Props) {
  return (
    <div className="row is-file" data-line={n}>
      <div className="gutter" />
      <div className="code">
        <span className="file-path">{name}</span>
        {badge && <Badge className="file-badge">{badge}</Badge>}
        {onViewed && (
          <Button
            size="sm"
            className="file-viewed"
            pressed={viewed}
            aria-label={COPY.viewedMark(name)}
            icon={<IconCheck />}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onViewed}
          >
            {COPY.viewed}
          </Button>
        )}
      </div>
    </div>
  )
})

import { Badge } from '../ui'

/**
 * What the header of a file says of it: the folders of its path, its name and its badge, as three parts of one box, so that each gives up room in its own turn when the box is narrower
 * than they are (the styles say the order): the folders first, cut at their start, then the badge, and only then the name. A path with no folder has no part for it.
 */
export function FileTitle({ path, badge }: { path: string; badge: string | null }) {
  const at = path.lastIndexOf('/') + 1
  const dir = path.slice(0, at)
  return (
    <span className="file-title">
      {dir && (
        <span className="file-dir">
          <bdi dir="ltr">{dir}</bdi>
        </span>
      )}
      <span className="file-name">{path.slice(at)}</span>
      {badge && (
        <span className="file-tag">
          <Badge className="file-badge" title={badge}>
            <span className="file-badge-text">{badge}</span>
          </Badge>
        </span>
      )}
    </span>
  )
}

import { COPY } from '../lib/copy'
import { cutFolder, matchingFiles, viewedCount, type FileEntry } from '../lib/files'
import { Badge, Button, IconCheck, IconX, Kbd, LiveStatus } from '../ui'

interface Props {
  entries: readonly FileEntry[]
  /** How many comments each entry has. */
  counts: readonly number[]
  viewed: ReadonlySet<string>
  /** The index of the file that is in view. */
  current: number
  /** The narrow form: a status, a count and a mark for each file, and no names. */
  rail: boolean
  /** Below the width at which the comments panel is a drawer, this is one too, and has a button that closes it. */
  drawer: boolean
  /** What the reviewer has typed in the filter: the list shows the files whose path holds it. The page keeps it, so that it outlives the rail, the closed list and the drawer. */
  query: string
  onQuery: (query: string) => void
  onPick: (index: number) => void
  onToggleViewed: (index: number) => void
  onRail: () => void
  onClose: () => void
}

const split = (path: string): { dir: string; name: string } => {
  const i = path.lastIndexOf('/')
  return { dir: path.slice(0, i + 1), name: path.slice(i + 1) }
}

/** What the letter stands for, in words; a file that is not in a diff has none. */
const statusWord = (entry: FileEntry): string | undefined => (entry.status ? COPY.fileStatus[entry.status] : undefined)

function StatusBadge({ entry }: { entry: FileEntry }) {
  if (!entry.status) return null
  return (
    <Badge variant="chip" tone={entry.status === 'A' ? 'ok' : 'neutral'} role="img" title={statusWord(entry)} aria-label={statusWord(entry)}>
      {entry.status}
    </Badge>
  )
}

/** A number of comments: the number is what is seen, and its name, for a screen reader, says what it counts. */
function CommentCount({ count }: { count: number }) {
  return (
    <span title={COPY.commentCount(count)}>
      <Badge variant="count" aria-hidden="true">
        {count}
      </Badge>
      <span className="sr-only">{COPY.commentCount(count)}</span>
    </span>
  )
}

function Tick({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className="files-tick" aria-pressed={on} aria-label={label} onClick={onClick}>
      {on ? <IconCheck /> : null}
    </button>
  )
}

/**
 * The files of a diff, beside the code: a row for each, with its mark for viewed, its status, its name and its comments. A press on a file goes to it in the
 * code, and the file that is in view is marked. Open it is a column, with a filter over the list; as a rail it keeps a mark, a status and a count for each file
 * and the names go into tooltips, and it shows every file; below the width of a drawer it slides over the code.
 */
export function FilesPane({ entries, counts, viewed, current, rail, drawer, query, onQuery, onPick, onToggleViewed, onRail, onClose }: Props) {
  const done = viewedCount(viewed, entries)
  const classes = ['files', rail && !drawer ? 'is-rail' : null, drawer ? 'is-drawer' : null].filter(Boolean).join(' ')
  const narrow = rail && !drawer
  const filtering = !narrow && query.trim() !== ''
  // The places of the files that the list draws: all of them in the rail, and in the column those that the filter leaves.
  const places = narrow ? entries.map((_, i) => i) : matchingFiles(entries, query)

  return (
    <aside className={classes} aria-label={COPY.files}>
      {narrow ? (
        <div className="files-rail-head">
          <Button size="sm" iconOnly icon={<span aria-hidden="true">»</span>} aria-label={COPY.filesExpand} title={COPY.filesExpand} onClick={onRail} />
          <span className="muted files-rail-progress" title={COPY.filesViewed(done, entries.length)}>
            <span aria-hidden="true">
              {done}/{entries.length}
            </span>
            <span className="sr-only">{COPY.filesViewed(done, entries.length)}</span>
          </span>
        </div>
      ) : (
        <>
          <header className="files-head">
            <h2>
              {COPY.files} <Badge variant="count">{entries.length}</Badge>
            </h2>
            <span className="muted files-progress-text">{COPY.filesViewed(done, entries.length)}</span>
            {drawer ? (
              <Button size="sm" iconOnly icon={<IconX />} aria-label={COPY.filesClose} onClick={onClose} />
            ) : (
              <Button size="sm" iconOnly icon={<span aria-hidden="true">«</span>} aria-label={COPY.filesCollapse} title={COPY.filesCollapse} onClick={onRail} />
            )}
          </header>
          <div className="files-progress" aria-hidden="true">
            <span style={{ width: `${entries.length === 0 ? 0 : (done / entries.length) * 100}%` }} />
          </div>
          <div className="files-filter-row">
            <input
              type="search"
              className="files-filter"
              placeholder={COPY.filesFilterPlaceholder}
              aria-label={COPY.filesFilterLabel}
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && query !== '') onQuery('')
              }}
            />
            {filtering && (
              <span className="muted files-filter-count" aria-hidden="true">
                {COPY.filesFilterCount(places.length, entries.length)}
              </span>
            )}
            <LiveStatus className="sr-only">{filtering ? COPY.filesFilterSpoken(places.length, entries.length) : null}</LiveStatus>
          </div>
        </>
      )}

      <ul className="files-list">
        {filtering && places.length === 0 && <li className="muted files-none">{COPY.filesFilterNone(query.trim())}</li>}
        {places.map((i) => {
          const entry = entries[i]
          const { dir, name } = split(entry.path)
          const cut = cutFolder(dir)
          const count = counts[i] ?? 0
          const on = viewed.has(entry.id)
          return (
            <li key={entry.id} className={i === current ? 'files-item is-current' : 'files-item'}>
              {narrow ? (
                <button type="button" className="files-rail-item" title={entry.path} aria-current={i === current ? 'true' : undefined} onClick={() => onPick(i)}>
                  <span className="sr-only">
                    {[entry.path, statusWord(entry), count > 0 ? COPY.commentCount(count) : null, on ? COPY.viewed : null].filter(Boolean).join(', ')}
                  </span>
                  <span className="files-tick" aria-hidden="true" data-on={on}>
                    {on ? <IconCheck /> : null}
                  </span>
                  <span aria-hidden="true" className="files-rail-marks">
                    {entry.status && (
                      <Badge variant="chip" tone={entry.status === 'A' ? 'ok' : 'neutral'}>
                        {entry.status}
                      </Badge>
                    )}
                    {count > 0 && <Badge variant="count">{count}</Badge>}
                  </span>
                </button>
              ) : (
                <>
                  <Tick on={on} label={COPY.viewedMark(entry.path)} onClick={() => onToggleViewed(i)} />
                  <button type="button" className="files-file" title={entry.path} aria-current={i === current ? 'true' : undefined} onClick={() => onPick(i)}>
                    <StatusBadge entry={entry} />
                    <span className="files-path">
                      <span className="files-name">{name}</span>
                      <span className="files-dir">
                        {cut === dir ? (
                          dir
                        ) : (
                          <>
                            <span aria-hidden="true">{cut}</span>
                            <span className="sr-only">{dir}</span>
                          </>
                        )}
                      </span>
                    </span>
                    {count > 0 && <CommentCount count={count} />}
                  </button>
                </>
              )}
            </li>
          )
        })}
      </ul>

      {!narrow && !drawer && (
        <div className="files-keys muted">
          <span>
            <Kbd>]</Kbd> {COPY.filesKeys.next}
          </span>
          <span>
            <Kbd>[</Kbd> {COPY.filesKeys.previous}
          </span>
          <span>
            <Kbd>V</Kbd> {COPY.filesKeys.viewed}
          </span>
        </div>
      )}
    </aside>
  )
}

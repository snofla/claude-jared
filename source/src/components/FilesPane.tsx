import { useEffect, useRef } from 'react'
import { COPY } from '../lib/copy'
import { cutFolder, matchingFiles, statusWord, viewedCount, type FileEntry } from '../lib/files'
import { Badge, IconCheck } from '../ui'
import { CommentCount, ListPane, StatusBadge, Tick, type ListWords } from './ListPane'

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
  /** A press of ], [ or V with the focus anywhere in the list but its filter's field: the next file, the previous one, or the file in view marked as viewed. */
  onKey?: (key: 'next' | 'previous' | 'viewed') => void
  onRail: () => void
  onClose: () => void
}

/** The words of the list of files, which are the sentences of the list's frame. */
const WORDS: ListWords = {
  name: COPY.files,
  expand: COPY.filesExpand,
  collapse: COPY.filesCollapse,
  close: COPY.filesClose,
  viewed: COPY.filesViewed,
  filterLabel: COPY.filesFilterLabel,
  filterPlaceholder: COPY.filesFilterPlaceholder,
  filterCount: COPY.filesFilterCount,
  filterSpoken: COPY.filesFilterSpoken,
  filterNone: COPY.filesFilterNone,
  keys: COPY.filesKeys,
}

const split = (path: string): { dir: string; name: string } => {
  const i = path.lastIndexOf('/')
  return { dir: path.slice(0, i + 1), name: path.slice(i + 1) }
}

/**
 * The files of a diff, beside the code: a row for each, with its mark for viewed, its status, its name and its comments. A press on a file goes to it in the
 * code, and the file that is in view is marked. Open it is a column, with a filter over the list; as a rail it keeps a mark, a status and a count for each file
 * and the names go into tooltips, and it shows every file; below the width of a drawer it slides over the code.
 */
export function FilesPane({ entries, counts, viewed, current, rail, drawer, query, onQuery, onPick, onToggleViewed, onKey, onRail, onClose }: Props) {
  const narrow = rail && !drawer
  // The places of the files that the list draws: all of them in the rail, and in the column those that the filter leaves.
  const places = narrow ? entries.map((_, i) => i) : matchingFiles(entries, query)

  // The focus follows the file in view when ] or [ is pressed in the list, so that V marks the file whose row has the focus and Enter goes to it. Only a key moves it: the file
  // in view changes when the code is scrolled too, and a scroll by the pointer or the wheel leaves the focus where it is. The effect runs after every draw, and the first one
  // after such a key is the one that follows it, so that a key that changes nothing (at the end of the list) puts the focus on the file in view all the same.
  const following = useRef(false)
  const currentRow = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!following.current) return
    following.current = false
    if (currentRow.current && document.activeElement !== currentRow.current) currentRow.current.focus()
  })
  const heard = onKey
    ? (key: 'next' | 'previous' | 'viewed') => {
        if (key !== 'viewed') following.current = true
        onKey(key)
      }
    : undefined

  return (
    <ListPane
      words={WORDS}
      total={entries.length}
      done={viewedCount(viewed, entries)}
      rail={rail}
      drawer={drawer}
      query={query}
      onQuery={onQuery}
      shown={places.length}
      onRail={onRail}
      onClose={onClose}
      onKey={heard}
    >
      {places.map((i) => {
        const entry = entries[i]
        const { dir, name } = split(entry.path)
        const cut = cutFolder(dir)
        const count = counts[i] ?? 0
        const on = viewed.has(entry.id)
        return (
          <li key={entry.id} className={i === current ? 'files-item is-current' : 'files-item'}>
            {narrow ? (
              <button type="button" className="files-rail-item" ref={i === current ? currentRow : undefined} title={entry.path} aria-current={i === current ? 'true' : undefined} onClick={() => onPick(i)}>
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
                <button type="button" className="files-file" ref={i === current ? currentRow : undefined} title={entry.path} aria-current={i === current ? 'true' : undefined} onClick={() => onPick(i)}>
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
    </ListPane>
  )
}

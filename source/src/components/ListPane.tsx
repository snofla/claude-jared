import type { ReactNode } from 'react'
import { COPY } from '../lib/copy'
import { statusWord, type FileEntry } from '../lib/files'
import { Badge, Button, IconCheck, IconX, Kbd, LiveStatus } from '../ui'

/** The words of a list beside the code, for what it lists: the same sentences for files and for commits. */
export interface ListWords {
  /** The pane's name, and the heading of its head. */
  name: string
  expand: string
  collapse: string
  close: string
  /** How many of the entries the reviewer has marked, and how many the list has. */
  viewed: (done: number, total: number) => string
  filterLabel: string
  filterPlaceholder: string
  /** Beside the field while it filters: how many entries the list shows, and how many it has; and what a screen reader is told of it. */
  filterCount: (shown: number, total: number) => string
  filterSpoken: (shown: number, total: number) => string
  filterNone: (query: string) => string
  keys: { next: string; previous: string; viewed: string }
}

export function StatusBadge({ entry }: { entry: FileEntry }) {
  if (!entry.status) return null
  return (
    <Badge variant="chip" tone={entry.status === 'A' ? 'ok' : 'neutral'} role="img" title={statusWord(entry)} aria-label={statusWord(entry)}>
      {entry.status}
    </Badge>
  )
}

/** A number of comments: the number is what is seen, and its name, for a screen reader, says what it counts. */
export function CommentCount({ count }: { count: number }) {
  return (
    <span title={COPY.commentCount(count)}>
      <Badge variant="count" aria-hidden="true">
        {count}
      </Badge>
      <span className="sr-only">{COPY.commentCount(count)}</span>
    </span>
  )
}

/** The mark for viewed: a button that is pressed when the entry is marked. */
export function Tick({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className="files-tick" aria-pressed={on} aria-label={label} onClick={onClick}>
      {on ? <IconCheck /> : null}
    </button>
  )
}

interface Props {
  words: ListWords
  /** How many entries the list has, and how many of them are marked as viewed. */
  total: number
  done: number
  /** The narrow form: a mark and a count for each entry, and no names. */
  rail: boolean
  /** Below the width at which the comments panel is a drawer, this is one too, and has a button that closes it. */
  drawer: boolean
  /** What the reviewer has typed in the filter: the list shows the entries that it matches. The page keeps it, so that it outlives the rail, the closed list and the drawer. */
  query: string
  onQuery: (query: string) => void
  /** How many entries the column draws, after the filter. */
  shown: number
  onRail: () => void
  onClose: () => void
  /** A control that the filter's row holds after the field, when the list has one. */
  filterControl?: ReactNode
  /**
   * The keys of the list, `]`, `[` and `V`, heard anywhere in the list but in a field, as the code hears them, so that they go on working after a press on a row has
   * left the focus there. Left out, the list does not hear them.
   */
  onKey?: (key: 'next' | 'previous' | 'viewed') => void
  /** The list's rows: one `li` for each entry that is drawn. */
  children: ReactNode
}

/**
 * What a list beside the code has whatever it lists: a head with a count and how many are viewed, a bar, a filter, the keys at the foot, the rail that keeps a mark
 * for each entry and the drawer that slides over the code. The rows are the list's own, and are given. A list of files and a list of commits are drawn in it.
 */
export function ListPane({ words, total, done, rail, drawer, query, onQuery, shown, onRail, onClose, filterControl, onKey, children }: Props) {
  const classes = ['files', rail && !drawer ? 'is-rail' : null, drawer ? 'is-drawer' : null].filter(Boolean).join(' ')
  const narrow = rail && !drawer
  const filtering = !narrow && query.trim() !== ''

  return (
    <aside
      className={classes}
      aria-label={words.name}
      onKeyDown={(e) => {
        if (!onKey || e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement).closest('input, textarea, [contenteditable="true"]')) return
        const key = e.key === ']' ? 'next' : e.key === '[' ? 'previous' : e.key === 'v' ? 'viewed' : null
        if (!key) return
        e.preventDefault()
        onKey(key)
      }}
    >
      {narrow ? (
        <div className="files-rail-head">
          <Button size="sm" iconOnly icon={<span aria-hidden="true">»</span>} aria-label={words.expand} title={words.expand} onClick={onRail} />
          <span className="muted files-rail-progress" title={words.viewed(done, total)}>
            <span aria-hidden="true">
              {done}/{total}
            </span>
            <span className="sr-only">{words.viewed(done, total)}</span>
          </span>
        </div>
      ) : (
        <>
          <header className="files-head">
            <h2>
              {words.name} <Badge variant="count">{total}</Badge>
            </h2>
            <span className="muted files-progress-text">{words.viewed(done, total)}</span>
            {drawer ? (
              <Button size="sm" iconOnly icon={<IconX />} aria-label={words.close} onClick={onClose} />
            ) : (
              <Button size="sm" iconOnly icon={<span aria-hidden="true">«</span>} aria-label={words.collapse} title={words.collapse} onClick={onRail} />
            )}
          </header>
          <div className="files-progress" aria-hidden="true">
            <span style={{ width: `${total === 0 ? 0 : (done / total) * 100}%` }} />
          </div>
          <div className="files-filter-row">
            <input
              type="search"
              className="files-filter"
              placeholder={words.filterPlaceholder}
              aria-label={words.filterLabel}
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && query !== '') onQuery('')
              }}
            />
            {filtering && (
              <span className="muted files-filter-count" aria-hidden="true">
                {words.filterCount(shown, total)}
              </span>
            )}
            <LiveStatus className="sr-only">{filtering ? words.filterSpoken(shown, total) : null}</LiveStatus>
            {filterControl}
          </div>
        </>
      )}

      <ul className="files-list">
        {filtering && shown === 0 && <li className="muted files-none">{words.filterNone(query.trim())}</li>}
        {children}
      </ul>

      {!narrow && !drawer && (
        <div className="files-keys muted">
          <span>
            <Kbd>]</Kbd> {words.keys.next}
          </span>
          <span>
            <Kbd>[</Kbd> {words.keys.previous}
          </span>
          <span>
            <Kbd>V</Kbd> {words.keys.viewed}
          </span>
        </div>
      )}
    </aside>
  )
}

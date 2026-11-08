import { useEffect, useRef } from 'react'
import { commitDay, commitPlaces, matchingCommits, shortHash, type Commit, type CommitOrder } from '../lib/commits'
import { COPY } from '../lib/copy'
import type { FileEntry } from '../lib/files'
import { Badge, Button, IconCheck } from '../ui'
import { CommentCount, ListPane, StatusBadge, Tick, type ListWords } from './ListPane'

/** A commit of the list: what the page reads from its text, the id of the text that holds it in the set, and how many comments of the review are on it. */
export interface CommitRow {
  id: string
  commit: Commit
  count: number
}

interface Props {
  /** The commits in the set's own order, which is the branch's. The list shows them in `order`, and every place below is a place in this list. */
  rows: readonly CommitRow[]
  /** The paths of the files of each commit, for the filter. */
  paths: readonly (readonly string[])[]
  order: CommitOrder
  onOrder: () => void
  /** The place of the commit that the middle shows. */
  chosen: number
  onChoose: (place: number) => void
  /** The ids that the reviewer has marked as viewed: a commit's own is its text's. */
  viewed: ReadonlySet<string>
  /** The ids of the commits that have a comment being written, open in the chosen one or put aside in another: each is marked, in the column and in the rail. */
  writing: ReadonlySet<string>
  onToggleViewed: (place: number) => void
  /** The files of the chosen commit, which are drawn under its row, and the index of the one that is in view. A press on one scrolls to it. */
  entries: readonly FileEntry[]
  current: number
  onPick: (index: number) => void
  /** The narrow form: a mark and a count for each commit, and no message. */
  rail: boolean
  drawer: boolean
  query: string
  onQuery: (query: string) => void
  onRail: () => void
  onClose: () => void
  /** The keys `]`, `[` and `V`, heard anywhere in the list but in its field: the next and the previous commit in the list's order, and the chosen one's mark. */
  onKey?: (key: 'next' | 'previous' | 'viewed') => void
}

/** The words of the list of commits, which are the sentences of the list's frame. */
const WORDS: ListWords = {
  name: COPY.commits,
  expand: COPY.commitsExpand,
  collapse: COPY.commitsCollapse,
  close: COPY.commitsClose,
  viewed: COPY.commitsViewed,
  filterLabel: COPY.commitsFilterLabel,
  filterPlaceholder: COPY.commitsFilterPlaceholder,
  filterCount: COPY.commitsFilterCount,
  filterSpoken: COPY.commitsFilterSpoken,
  filterNone: COPY.commitsFilterNone,
  keys: COPY.commitsKeys,
}

const nameOf = (file: FileEntry): string => file.path.slice(file.path.lastIndexOf('/') + 1)

/** The mark of a comment being written: a pencil, which is not read, and its name, which is. */
function WritingMark() {
  return (
    <span className="commit-writing" role="img" aria-label={COPY.commitWriting} title={COPY.commitWriting}>
      <span aria-hidden="true">✎</span>
    </span>
  )
}

/**
 * The commits of a branch, beside the code: a row for each, with its mark for viewed, its message, its short hash, its date and its author, and its comments. A press
 * on a commit chooses it, and the middle shows that commit alone; the chosen commit stays chosen until another is pressed, and its files are under its row, where a press
 * scrolls to a file, as it does in a list of files. The list is in the branch's order or the reverse of it, and the filter reads the message, the author, the hash from its
 * first characters and the paths. As a rail it keeps a mark and a count for each commit; below the width of a drawer it slides over the code.
 */
export function CommitsPane({ rows, paths, order, onOrder, chosen, onChoose, viewed, writing, onToggleViewed, entries, current, onPick, rail, drawer, query, onQuery, onRail, onClose, onKey }: Props) {
  const narrow = rail && !drawer
  // The places of the commits that the list draws, from the top: all of them in the rail, and in the column those that the filter leaves.
  const matching = new Set(matchingCommits(rows.map((row, place) => ({ commit: row.commit, paths: paths[place] ?? [] })), query))
  const places = commitPlaces(rows.length, order).filter((place) => narrow || matching.has(place))
  const done = rows.filter((row) => viewed.has(row.id)).length
  const control = COPY.commitsOrder(order === 'reverse')
  // The key that moves the choice (`]` or `[`) is heard with the focus on a row, a mark or a button of the list; the focus then goes to the chosen commit's row, so that the
  // ring and the choice agree. A choice that comes from elsewhere (the code's keys, a jump from the comments panel) leaves the focus where it is.
  const chosenRow = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const row = chosenRow.current
    if (row && row.closest('aside')?.contains(document.activeElement) && document.activeElement !== row) row.focus()
  }, [chosen])

  return (
    <ListPane
      words={WORDS}
      total={rows.length}
      done={done}
      rail={rail}
      drawer={drawer}
      query={query}
      onQuery={onQuery}
      shown={places.length}
      onRail={onRail}
      onClose={onClose}
      onKey={onKey}
      filterControl={<Button size="sm" iconOnly icon={<span aria-hidden="true">{order === 'reverse' ? '↑' : '↓'}</span>} aria-label={control} title={control} onClick={onOrder} />}
    >
      {places.map((place) => {
        const { id, commit, count } = rows[place]
        const subject = commit.subject || COPY.commitNoMessage
        const short = shortHash(commit.hash)
        const on = viewed.has(id)
        const drafted = writing.has(id)
        const isChosen = place === chosen
        if (narrow) {
          return (
            <li key={id} className={isChosen ? 'files-item is-current' : 'files-item'}>
              <button ref={isChosen ? chosenRow : undefined} type="button" className="files-rail-item" title={`${short} ${subject}`} aria-current={isChosen ? 'true' : undefined} onClick={() => onChoose(place)}>
                <span className="sr-only">
                  {[subject, short, count > 0 ? COPY.commentCount(count) : null, drafted ? COPY.commitWriting : null, on ? COPY.viewed : null].filter(Boolean).join(', ')}
                </span>
                <span className="files-tick" aria-hidden="true" data-on={on}>
                  {on ? <IconCheck /> : null}
                </span>
                <span aria-hidden="true" className="files-rail-marks">
                  {drafted && <span className="commit-writing">✎</span>}
                  {count > 0 && <Badge variant="count">{count}</Badge>}
                </span>
              </button>
            </li>
          )
        }
        return (
          <li key={id} className="commit">
            <div className={isChosen ? 'files-item is-current commit-row' : 'files-item commit-row'}>
              <Tick on={on} label={COPY.commitViewedMark(subject)} onClick={() => onToggleViewed(place)} />
              <button ref={isChosen ? chosenRow : undefined} type="button" className="files-file commit-file" title={subject} aria-current={isChosen ? 'true' : undefined} onClick={() => onChoose(place)}>
                <span className="commit-text">
                  <span className="commit-subject">{subject}</span>
                  <span className="muted commit-meta">
                    <code>{short}</code>
                    <span>{commitDay(commit.date)}</span>
                    <span className="commit-author">{commit.author}</span>
                  </span>
                </span>
                {drafted && <WritingMark />}
                {count > 0 && <CommentCount count={count} />}
              </button>
            </div>
            {isChosen && entries.length > 0 && (
              <ul className="commit-files" aria-label={COPY.commitFiles(short)}>
                {entries.map((file, index) => (
                  <li key={file.id} className={index === current ? 'commit-file-row is-in-view' : 'commit-file-row'}>
                    <button type="button" className="commit-file-button" title={file.path} aria-current={index === current ? 'true' : undefined} onClick={() => onPick(index)}>
                      <StatusBadge entry={file} />
                      <span className="commit-file-name">{nameOf(file)}</span>
                      <span aria-hidden="true" className="muted commit-file-lines">
                        +{file.added ?? 0} −{file.deleted ?? 0}
                      </span>
                      <span className="sr-only">{COPY.commitFileLines(file.added ?? 0, file.deleted ?? 0)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ListPane>
  )
}

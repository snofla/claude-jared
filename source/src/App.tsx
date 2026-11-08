import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, type ChangeEvent, type CSSProperties } from 'react'
import { CodeViewer } from './components/CodeViewer'
import { CommitsPane, type CommitRow } from './components/CommitsPane'
import { DeliveryStrip } from './components/DeliveryStrip'
import { FilesPane } from './components/FilesPane'
import { Header, STOP_IN_MENU_QUERY } from './components/Header'
import { Alert, IconCheck, Splitter } from './ui'
import { Landing } from './components/Landing'
import { ReviewPanel, type PanelCommit } from './components/ReviewPanel'
import { StopDialog } from './components/StopDialog'
import { SubmitDialog } from './components/SubmitDialog'
import { openHash } from './engine/page-host'
import { fetchSource } from './engine/receiver-client'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useWindowWidth } from './hooks/useWindowWidth'
import { usePlatform } from './hooks/usePlatform'
import { useHandover, type Notice } from './hooks/useHandover'
import { usePageApi } from './hooks/usePageApi'
import { useDiffTokens, useLatest, useSetTokens, useTokens } from './hooks/useTokens'
import { COPY } from './lib/copy'
import { afterSentSettings, closesAtPress, deliveryOf, mustTellProgram, programWaits, stopWords, takenAsItIs, tellsOfDiscard, toldOfCancel, waitingWords } from './lib/delivery'
import { commitPaths, commitPlaces, commitsOf, commitStats, otherOrder, shortHash, type CommitOrder } from './lib/commits'
import { diffOf } from './lib/diff'
import { setEntries, viewComments } from './lib/set-view'
import { autoFilesMode, commentCounts, fileEntries, hasFileList, stepFile, toggled, totals, type FilesMode } from './lib/files'
import { BOOT_EXPIRED_KEY, BOOT_KEY, bootExpired, readBoot, readFragment } from './lib/fragment-link'
import { SERVICE_KEY, hostFromSearch, serviceAddress } from './lib/host-link'
import type { Platform, Picked } from './lib/platform'
import { PLAIN_TEXT } from './lib/language'
import { CODE_ROOM, commentsLetGo, filesLetGo, heldWidth, RAIL_WIDTH, shownWidths } from './lib/panels'
import { diffEntries } from './lib/review-files'
import { writingCount } from './lib/review'
import { SAMPLE_CODE, SAMPLE_DIFF, SAMPLE_DIFF_NAME, SAMPLE_NAME } from './lib/sample'
import { COMMENTS_WIDTH, FILES_WIDTH } from './lib/settings'
import type { LayoutChange } from './lib/settings-service'
import { buildSource, prepareSource } from './lib/source'
import { nextTheme, type Theme } from './lib/theme'
import { cancelReview, closeFile, keepBeforeLeaving, keepOpen, keepReview, leftBehind, loadOpensFile, mayDiscard, mustAskBeforeCancel, openFile, openPicked, openPickedMany, openRecent, openText, replaceQuestion, restoreLast, type OpenOutcome } from './state/flows'
import { expiredNotice } from './state/expired'
import { emptyState, reducer, writingIds, type AppState } from './state/reducer'
import type { ReviewComment } from './types'

/** The width at which the comments panel stops being an overlay: the breakpoint of `.side` in styles.css. */
const WIDE_QUERY = '(min-width: 900px)'
/** The width from which the list of files is open as a column; from `WIDE_QUERY` it is a rail. */
const OPEN_FILES_QUERY = '(min-width: 1180px)'
const NO_LINES: string[] = [] // the same array each time, so that a hook that depends on it does not run again

const STORAGE_WARNING: Notice = {
  kind: 'warn',
  text: "This review can't be saved in your browser (storage is full or blocked). Export it before closing the tab so nothing is lost.",
}

function init({ platform, restore }: { platform: Platform; restore: boolean }): AppState {
  // What was open at the last visit, a file or a set of files, comes back through the engine, as it is opened.
  const last = restore ? restoreLast(platform) : null
  return last ? reducer(emptyState, last) : emptyState
}

/** What this page load brings, read once, before anything is drawn: whether it opens a file, what it leaves behind if so, and the file that the boot script is for. */
function readLoad(platform: Platform) {
  const boot = readBoot((window as unknown as Record<string, unknown>)[BOOT_KEY])
  const opens = loadOpensFile(readFragment(window.location.hash), boot, hostFromSearch(window.location.search))
  return { opens, behind: opens ? leftBehind(platform) : null, bootHash: boot?.ok ? openHash(boot.messages[0]) : null }
}

export default function App() {
  const services = usePlatform()
  const [load] = useState(() => readLoad(services))
  const [state, dispatch] = useReducer(reducer, { platform: services, restore: !load.opens }, init)
  const { file, review, selection, draft } = state

  // The layout that the reviewer kept, for a wide window: the widths of the two panels beside the code, the list's mode and whether the comments panel is open, each
  // `null` when it was never chosen, so that the window decides. It is written only by what the reviewer does, and a layout that the place which keeps it for every
  // window gives later is taken as it comes.
  const [kept, setKept] = useState(services.layout.load)
  useEffect(() => services.layout.subscribe(setKept), [services])
  const keepLayout = (change: LayoutChange) => {
    services.layout.save(change)
    setKept(services.layout.load())
  }
  // The comments panel follows the window width until the reviewer opens or closes it by hand; below the wide width it is a drawer that starts closed, and its
  // opening and closing there are not kept.
  const wide = useMediaQuery(WIDE_QUERY)
  const [panelDrawer, setPanelDrawer] = useState(false)
  const panelOpen = wide ? (kept.comments.open ?? true) : panelDrawer
  const [submitOpen, setSubmitOpen] = useState(false)
  // The one question of stopping a review: asked while a program waits for it, and when something would be lost.
  const [stopOpen, setStopOpen] = useState(false)
  // The button that stops the review is in the header's menu when the bar has no room for it.
  const stopInMenu = useMediaQuery(STOP_IN_MENU_QUERY)
  // The colour scheme: the choice is kept, and applied to the page as an attribute that the CSS selects on (`index.html` has
  // already applied the kept one before the first paint).
  const [theme, setTheme] = useState<Theme>(services.theme.load)
  useEffect(() => {
    services.theme.apply(theme)
    services.theme.save(theme)
  }, [theme, services])
  // The scheme that the place which keeps the settings for every window gives after the page is drawn, when it is not the one the page has.
  useEffect(() => services.theme.subscribe(setTheme), [services])
  const [linked, setLinked] = useState(false) // opened by a link that carries requests: the review can go to the clipboard
  // Opened from a link that a Claude session printed: the file comes from the receiver at this address, and the
  // review can be sent back to it. Only an address on this computer is ever used (see `receiverAddress`).
  const [givenHost] = useState(() => hostFromSearch(window.location.search))
  const [hostHash, setHostHash] = useState<string | null>(null) // the hash of the file that the receiver holds, once it has been read
  // Served by the Jared service for a review that comes back as a file: the script of the review gave the address of the review's folder
  // (`window.__JARED_SERVICE`). Only a folder at the service that served this page is ever used (see `serviceAddress`).
  const [givenService] = useState(() => serviceAddress((window as unknown as Record<string, unknown>)[SERVICE_KEY], window.location.origin))
  // Each of the two is for one file, the one that the page was opened for: with any other file open, a press or a stop reaches neither, and the review stays on this page.
  const host = file?.hash === hostHash ? givenHost : null
  const service = file?.hash === load.bootHash ? givenService : null
  // Where a review goes besides a script on the page: the receiver of the link, or the service that served the page. Either answers.
  const sendTo = host ?? service
  // The review goes to the service, which keeps it as a file: "sent" is all that is known, so the message says what to do if the program has not answered.
  const viaService = host === null && service !== null
  const [notice, setNotice] = useState<Notice | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [flashId, setFlashId] = useState<string | null>(null)
  const [scrollRequest, setScrollRequest] = useState<{ line: number; nonce: number; comment?: string; block?: 'start' | 'center' } | null>(null)
  const [recentRead, refreshRecent] = useReducer((n: number) => n + 1, 0) // read the recent list again after forgetting a file

  const inputRef = useRef<HTMLInputElement>(null)
  const flashTimer = useRef<number>(0)
  const draftRef = useLatest(draft)
  const stateRef = useLatest(state)
  const submitOpenRef = useLatest(submitOpen)

  // A text whose language is diff, and that has a hunk, is shown as a diff: then its colours come row by row, from the file each row is in.
  const diff = useMemo(() => (file ? diffOf(file.language, file.lines) : null), [file])
  // Several files open together are drawn as one list of rows, a header for each file and then its lines; the comments are then in those rows too. A set of
  // commits is drawn one commit at a time, as one diff: `file` is then the chosen commit's text, and its comments are those whose file is that commit.
  const commit = state.set && state.chosen !== null ? state.set.layout.texts[state.chosen] : null
  const layout = state.set && !commit ? state.set.layout : null
  const comments = useMemo(
    () => (review ? (layout ? viewComments(layout, review.comments) : commit ? review.comments.filter((c) => c.file === commit.id) : review.comments) : []),
    [review, layout, commit],
  )

  // The list of the files of a diff of two files or more: how it is shown follows the window width until the reviewer chooses, and below the width of the
  // comments panel it is a drawer, opened and closed by hand like that panel. The marks for the files that the reviewer has looked at are the page's own, kept by the review's hash.
  const entries = useMemo(() => (layout ? setEntries(layout) : commit ? (diff ? diffEntries(diff, commit.id) : []) : fileEntries(diff)), [layout, commit, diff])
  // A set of commits always has its list, of the commits, whatever the chosen one holds.
  const hasList = commit !== null || hasFileList(entries)
  // A set in which every text is a commit is a list of commits: the list beside the code lists them, and a press chooses the one that the middle shows. The ids are the
  // set's own, so that a mark for viewed and a comment keep their commit when the order changes.
  const commits = useMemo(() => (state.set ? commitsOf(state.set.files) : null), [state.set])
  const fileTotals = useMemo(() => totals(entries), [entries])
  const roomToOpen = useMediaQuery(OPEN_FILES_QUERY)
  const [filesDrawer, setFilesDrawer] = useState(false)
  const filesMode: FilesMode = kept.files.mode ?? autoFilesMode(roomToOpen, wide)
  const [fileInView, setFileInView] = useState(0)
  const [viewedState, setViewedState] = useState<{ hash: string; ids: ReadonlySet<string> } | null>(null)
  const hash = file?.hash ?? ''
  // What the reviewer has typed in the filter of the list: kept by the review's hash, and forgotten when the hash changes, whether another file or set is opened
  // or the file is closed, so that a file that comes back starts with a full list; a script that opens the same file again changes nothing. It is the page's, and
  // not the list's, so that it outlives the rail, the closed list and the drawer.
  const [filesFilter, setFilesFilter] = useState({ hash: '', text: '' })
  const filesQuery = filesFilter.hash === hash ? filesFilter.text : ''
  useEffect(() => {
    setFilesFilter((kept) => (kept.hash === hash ? kept : { hash: '', text: '' }))
  }, [hash])
  const viewed = useMemo(
    () => (viewedState && viewedState.hash === hash ? viewedState.ids : new Set(file ? services.reviews.viewed(hash) : [])),
    [viewedState, hash, file, services],
  )
  // The order that the list shows the commits in, kept for the review's hash and forgotten when it changes: the branch's own or its reverse, which starts as the
  // branch's and is not saved. The commit that is chosen is the page's state, `chosen`, by its place in the set.
  const [orderAt, setOrderAt] = useState<{ hash: string; order: CommitOrder }>({ hash: '', order: 'branch' })
  const commitOrder = orderAt.hash === hash ? orderAt.order : 'branch'
  const commitRows = useMemo<CommitRow[] | null>(() => {
    if (!commits || review?.version !== 2) return null
    return commits.map((commit, place) => {
      const id = review.files[place].id
      return { id, commit, count: review.comments.filter((c) => c.file === id).length }
    })
  }, [commits, review])
  const commitTotals = useMemo(
    () =>
      commits && state.set
        ? state.set.files.map((text) => commitStats(text.lines)).reduce((sum, stats) => ({ added: sum.added + stats.added, deleted: sum.deleted + stats.deleted }), { added: 0, deleted: 0 })
        : null,
    [commits, state.set],
  )
  // The commit that each text of a review of a branch is, by the id of its text, for the Markdown of the review.
  const commitHeadsById = useMemo(() => (commitRows ? new Map(commitRows.map((row) => [row.id, row.commit])) : undefined), [commitRows])
  // The commits as the panel names them over their comments, in the order that the list shows them.
  const panelCommits = useMemo<PanelCommit[] | undefined>(
    () => (commitRows ? commitPlaces(commitRows.length, commitOrder).map((place) => ({ id: commitRows[place].id, short: shortHash(commitRows[place].commit.hash), subject: commitRows[place].commit.subject })) : undefined),
    [commitRows, commitOrder],
  )
  const commitPathLists = useMemo(() => (commits && state.set ? state.set.files.map((text) => commitPaths(text.lines)) : null), [commits, state.set])
  // The commits that have a comment being written, open in the chosen one or put aside in another, which the list marks.
  const writing = useMemo(() => writingIds(state), [state])
  // By their place in the diff, for the header of each file in the code: the marks themselves are kept by the ids that name the files.
  const viewedFiles = useMemo(() => new Set(entries.flatMap((e, i) => (viewed.has(e.id) ? [i] : []))), [entries, viewed])
  const fileCounts = useMemo(() => commentCounts(entries, comments), [entries, comments])
  const fileTokens = useTokens(diff || layout || !file ? null : file.content, file?.language ?? PLAIN_TEXT)
  const diffTokens = useDiffTokens(diff, file?.lines ?? NO_LINES)
  const setTokens = useSetTokens(layout)
  const tokens = layout ? setTokens : diff ? diffTokens : fileTokens
  const delivery = deliveryOf(sendTo, state.submitLabel, state.submitTarget)
  const handover = useHandover({ services, state, stateRef, dispatch, addresses: { host, service, sendTo, viaService }, delivery, submitOpen, setSubmitOpen, setNotice })
  const { outbox, deliver, press, nothingNew, sentText, clearSent, forgetPresses, waitingSince, late, changes, marks, changedSincePress, update } = handover
  const unsaved = useSyncExternalStore(services.reviews.subscribe, services.reviews.failed)
  const banner = notice ?? (unsaved ? STORAGE_WARNING : null)
  // The stored list is read and parsed when the start page is reached or a file is forgotten, and not at every draw of the page.
  const recent = useMemo(() => {
    void recentRead // the key: forgetting a file counts it up, and the list is read again
    return file ? [] : services.reviews.recent()
  }, [file, recentRead, services.reviews])

  // Every change to the review is kept once it is drawn, and a set of files is kept whole the first time, with its texts, and then its review alone. A
  // request through the page that leaves the file keeps the review it leaves before the next is adopted (`keepBeforeLeaving`), since a change and a leave
  // that a script sends at once are drawn together, with no file left for this effect to keep.
  const keptSet = useRef<string | null>(null)
  useEffect(() => {
    keptSet.current = keepReview(services, { file, review, set: state.set }, keptSet.current)
  }, [review, file, state.set, services])

  // The protocol of the engine, for a script on the page: `window.jared.handleMessage(request)`.
  const applyRequest = usePageApi(
    state,
    dispatch,
    (adoptedFile, another, isSet, left) => {
      keptSet.current = keepBeforeLeaving(services, left, adoptedFile, keptSet.current)
      if (!adoptedFile) {
        closeFile(services)
        setSubmitOpen(false)
        clearSent()
        forgetPresses()
      } else if (another) {
        if (!isSet) keepOpen(services, adoptedFile) // as opening a file does; a set is kept by the effect that keeps the review
        setNotice(null)
        clearSent()
        forgetPresses()
        setHoveredId(null)
      }
    },
    outbox,
    handover.onDeclined,
  )

  useEffect(() => {
    document.title = file ? `${file.name} · Jared` : 'Jared · code review'
  }, [file])

  /** What a flow came to: the file opens (and what belonged to the last one is let go), or the reviewer is told why it did not. */
  const applyOutcome = useCallback((outcome: OpenOutcome | { kind: 'gone' }) => {
    if (outcome.kind === 'refused') setNotice({ kind: 'error', text: outcome.error })
    else if (outcome.kind === 'opened') {
      setNotice(outcome.note ? { kind: 'warn', text: outcome.note } : null)
      clearSent()
      forgetPresses()
      setHoveredId(null)
      dispatch(outcome.action)
    } else if (outcome.kind === 'gone') refreshRecent()
  }, [clearSent, forgetPresses])

  const openPickedFile = useCallback(
    async (picked: Picked) => applyOutcome(await openPicked(services, stateRef.current, picked)),
    [services, stateRef, applyOutcome],
  )
  // What was picked or dropped when it may be several files or a folder: one file opens as it always did.
  const openPickedSet = useCallback(
    async (picked: Picked) => applyOutcome(await openPickedMany(services, stateRef.current, picked)),
    [services, stateRef, applyOutcome],
  )
  const openSetRef = useLatest(openPickedSet)

  // A load that brings a file restored nothing; when the file does not open after all, the last review comes back, as it does on any other load.
  const restoreSkipped = useRef(load.opens)
  const restoreAfterFailure = useCallback(() => {
    if (!restoreSkipped.current) return
    restoreSkipped.current = false
    if (stateRef.current.file) return // another file was opened meanwhile: it stays, with what is being written in it
    const last = restoreLast(services)
    if (last) dispatch(last)
  }, [services, stateRef])
  // Once the load's file is open: a review that it left behind with comments that have not left the page is told of, unless it is that file.
  const tellLeftBehind = useCallback(
    (opened: string | null) => {
      restoreSkipped.current = false
      if (load.behind && load.behind.hash !== opened) setNotice({ kind: 'warn', text: COPY.keptBehind(load.behind.name, load.behind.comments, load.behind.changedSince) })
    },
    [load],
  )

  // Open the file that the receiver of the link holds, as a dropped file would be opened.
  useEffect(() => {
    if (!givenHost) return
    let cancelled = false
    void fetchSource(givenHost).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        restoreAfterFailure()
        return setNotice({ kind: 'error', text: result.error })
      }
      const prepared = prepareSource(result.name, result.text)
      if (prepared.ok) setHostHash(prepared.file.hash)
      const outcome = openText(services, stateRef.current, result.name, result.text)
      const words = { type: 'setDelivery', submitLabel: result.submitLabel, submitTarget: result.submitTarget, submitOptions: result.submitOptions } as const
      // The same file again, as on a second round or a reload, is left as it is; but it is the receiver's file, so it brings its words.
      if (outcome.kind === 'same') return dispatch(words)
      if (outcome.kind === 'refused') restoreAfterFailure()
      applyOutcome(outcome)
      // In the same batch as the file, so that the button never shows the default words first.
      if (outcome.kind === 'opened') {
        dispatch(words)
        tellLeftBehind(prepared.ok ? prepared.file.hash : null)
      }
    })
    return () => {
      cancelled = true
    }
  }, [givenHost, services, applyOutcome, stateRef, restoreAfterFailure, tellLeftBehind])

  // Requests in the address, `#jared=...`, as a Claude session makes them: done in order, and the
  // fragment is taken out of the address, so that the file in it is not left in the history. A request that would throw away
  // work is put to the reviewer, who is here, as a dropped file is. A page that is a file opened from a path has no fragment to
  // read: its requests are in `window.__JARED_BOOT`, put there by a script beside it, and taken once. All before the first paint, so
  // that a link or a boot script that brings a file never shows the start page first.
  useLayoutEffect(() => {
    const page = window as unknown as Record<string, unknown>
    const takeBoot = () => {
      const value = page[BOOT_KEY]
      delete page[BOOT_KEY]
      return readBoot(value)
    }
    const follow = () => {
      const fromAddress = readFragment(window.location.hash)
      if (fromAddress) window.history.replaceState(null, '', window.location.pathname + window.location.search)
      const fromScript = takeBoot()
      const expired = bootExpired(page[BOOT_EXPIRED_KEY])
      delete page[BOOT_EXPIRED_KEY]
      const link = fromAddress ?? fromScript
      if (!link) {
        if (expired) setNotice({ kind: 'warn', text: expiredNotice(stateRef.current.file !== null) }) // a page whose file the helper has taken back: the last session is not its answer
        return
      }
      if (!link.ok) return setNotice({ kind: 'error', text: link.error })
      const first = restoreSkipped.current // the link that the load brought: what the load left behind is told of once its file is open
      for (const message of link.messages) {
        let replies = applyRequest(message)
        const declined = replies.find((r) => r.type === 'error' && r.code === 'declined')
        if (declined && message.type === 'open' && typeof message.name === 'string' && typeof message.text === 'string') {
          const question = replaceQuestion(stateRef.current, message.name, message.text, (declined as { message: string }).message)
          if (!services.prompts.confirm(question)) return setNotice({ kind: 'warn', text: 'The link was not opened: your review was kept.' })
          replies = applyRequest(message, true)
        }
        const failed = replies.find((r) => r.type === 'error')
        if (failed) {
          restoreAfterFailure()
          return setNotice({ kind: 'error', text: (failed as { message: string }).message })
        }
        if (message.type === 'open') restoreSkipped.current = false // its file is open: a later request that fails leaves that file as it is
      }
      setLinked(true)
      if (first) tellLeftBehind(openHash(link.messages[0]))
    }
    follow()
    window.addEventListener('hashchange', follow)
    return () => window.removeEventListener('hashchange', follow)
  }, [applyRequest, stateRef, services, restoreAfterFailure, tellLeftBehind])

  const onPickerChange = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = '' // allow picking the same files again
    if (picked.length === 1) void openPickedFile(picked[0])
    else if (picked.length > 1) void openPickedSet(picked)
  }

  // Drop a file anywhere in the window.
  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files')
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e) || submitOpenRef.current) return
      depth++
      setDragActive(true)
    }
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragActive(false)
    }
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragActive(false)
      if (submitOpenRef.current) return // the dialog is modal: nothing behind it can be replaced
      // Taken now, in the event: a browser empties the drop once the event is over, and a folder is read after.
      if (e.dataTransfer?.files.length) void openSetRef.current(services.input.capture(e.dataTransfer))
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('dragover', onOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [openSetRef, services, submitOpenRef])

  const goHome = () => {
    // A program that waits for the review is not left waiting in silence: the question of stopping comes first.
    const { review: current, sentAt } = stateRef.current
    if (current && programWaits(delivery, sentAt)) return setStopOpen(true)
    if (!mayDiscard(services, draftRef.current, stateRef.current.aside)) return
    closeFile(services)
    setSubmitOpen(false)
    clearSent()
    forgetPresses()
    dispatch({ type: 'close' })
  }

  // Stop the review of the open file and keep it: the program that waits for it is told, the review is kept as Back to start keeps it, and the page goes back to the start. A script that
  // drives the page does not look at the page until it is asked, so the start page tells the reviewer to tell it; a receiver is told at once. The comment being written is not kept,
  // and the question has said so: no question of the browser's follows.
  const stopCurrent = () => {
    if (!file) return
    const { review: current, sentAt } = stateRef.current
    const told = current !== null && programWaits(delivery, sentAt)
    if (told) handover.tellOfSkip()
    handover.giveUp()
    closeFile(services)
    setStopOpen(false)
    setSubmitOpen(false)
    clearSent()
    forgetPresses()
    dispatch({ type: 'close' })
    refreshRecent()
    if (told && mustTellProgram(delivery)) setNotice({ kind: 'warn', text: COPY.skipTellProgram(delivery?.target ?? null) })
  }

  // Give the review of the open file up: the program that started it is told, it is forgotten as Forget does on the start page, and the page goes back to the start.
  const cancelCurrent = () => {
    if (!file) return
    const { review: current, sentAt } = stateRef.current
    const told = current !== null && toldOfCancel(delivery, current, sentAt) !== undefined
    if (told) handover.tellOfCancel()
    handover.giveUp()
    cancelReview(services, file.hash)
    handover.dropDeclined()
    setStopOpen(false)
    setSubmitOpen(false)
    clearSent()
    forgetPresses()
    dispatch({ type: 'close' })
    refreshRecent()
    if (told && mustTellProgram(delivery)) setNotice({ kind: 'warn', text: COPY.discardTellProgram(delivery?.target ?? null) })
  }

  // Asked for from the header, the foot of the send window and the strip: the question while a program waits for the review or something would be lost, and nothing to ask
  // otherwise: the file closes at once, with its review kept.
  const askToStop = () => (programWaits(delivery, stateRef.current.sentAt) || mustAskBeforeCancel(stateRef.current) ? setStopOpen(true) : stopCurrent())

  const openKept = (hash: string) => applyOutcome(openRecent(services, hash))
  const openSample = (name: string, text: string) => applyOutcome(openFile(services, stateRef.current, buildSource(name, text)))

  // The comments panel goes to the first line of a comment; a click on a comment bar in the gutter goes to its card, which is under its last line.
  // A press on a file in the list goes to it and closes the drawer; a key pressed in the list steps through the files and leaves the drawer open, with the focus in it.
  const goToFile = (index: number, keepDrawer = false) => {
    const entry = entries[index]
    if (!entry) return
    setScrollRequest({ line: entry.startRow, nonce: Date.now(), block: 'start' })
    setFileInView(index)
    if (!keepDrawer) setFilesDrawer(false)
  }
  const toggleViewed = (index: number) => {
    const entry = entries[index]
    if (!entry) return
    const ids = toggled(viewed, entry.id)
    setViewedState({ hash, ids })
    services.reviews.setViewed(hash, [...ids])
  }
  // Another commit is shown from its top, or where its comment being written is, which comes back with it; `at` is a place in it to go to instead.
  const chooseCommit = (place: number, at?: { line: number; comment?: string }) => {
    if (!state.set || state.chosen === null) return
    if (place !== state.chosen) {
      const back = state.aside[state.set.layout.texts[place]?.id ?? '']
      dispatch({ type: 'choose', place })
      setFileInView(0)
      if (!at) return setScrollRequest({ line: back?.range.start ?? 0, nonce: Date.now(), block: 'center' })
    }
    if (at) setScrollRequest({ line: at.line, nonce: Date.now(), ...(at.comment ? { comment: at.comment } : {}) })
  }
  const stepCommit = (delta: 1 | -1) => {
    if (!state.set || state.chosen === null) return
    const places = commitPlaces(state.set.files.length, commitOrder)
    chooseCommit(places[stepFile(places.length, places.indexOf(state.chosen), delta)])
  }
  const toggleCommitViewed = (place: number) => {
    if (!state.set) return
    const ids = toggled(viewed, state.set.layout.texts[place].id)
    setViewedState({ hash, ids })
    services.reviews.setViewed(hash, [...ids])
  }
  const onFileKey = (key: 'next' | 'previous' | 'viewed') => {
    if (state.chosen !== null) return key === 'viewed' ? toggleCommitViewed(state.chosen) : stepCommit(key === 'next' ? 1 : -1)
    return key === 'viewed' ? toggleViewed(fileInView) : goToFile(stepFile(entries.length, fileInView, key === 'next' ? 1 : -1))
  }
  const onListKey = (key: 'next' | 'previous' | 'viewed') =>
    key === 'viewed' ? toggleViewed(fileInView) : goToFile(stepFile(entries.length, fileInView, key === 'next' ? 1 : -1), true)
  const toggleFiles = () => {
    if (wide) return keepLayout({ files: { mode: filesMode === 'closed' ? 'open' : 'closed' } })
    setFilesDrawer(!filesDrawer)
    if (!filesDrawer) setPanelDrawer(false)
  }
  const filesShown = wide ? filesMode !== 'closed' : filesDrawer
  const togglePanel = () => {
    if (wide) return keepLayout({ comments: { open: !panelOpen } })
    if (!panelOpen) setFilesDrawer(false)
    setPanelDrawer(!panelOpen)
  }

  // The widths that the page draws in a wide window, worked out at each draw from the kept widths and the window, so that the code keeps its room and a window that
  // grows back shows the kept widths again. An edge that is held shows the width that its drag asks for, with the other panel as it was; it is let go into a snap.
  const room = useWindowWidth()
  const [held, setHeld] = useState<{ files?: number; comments?: number }>({})
  const fromKept = shownWidths(room, {
    files: { mode: hasList && filesShown ? filesMode : 'closed', width: kept.files.width },
    comments: { open: panelOpen, width: kept.comments.width },
  })
  const shown = {
    files: held.files === undefined ? fromKept.files : Math.min(held.files, Math.max(0, room - CODE_ROOM - fromKept.comments)),
    comments: held.comments === undefined ? fromKept.comments : Math.min(held.comments, Math.max(0, room - CODE_ROOM - fromKept.files)),
  }
  // A drag that Escape ends asks for the width at the press again and lets nothing go: that width is the kept one, so the edge holds nothing any more.
  const holdFiles = (width: number) => setHeld(Math.round(width) === fromKept.files ? {} : { files: heldWidth(width, FILES_WIDTH) })
  const holdComments = (width: number) => setHeld(Math.round(width) === fromKept.comments ? {} : { comments: heldWidth(width, COMMENTS_WIDTH) })
  const panelWidths = wide ? ({ '--files-w': `${shown.files}px`, '--comments-w': `${shown.comments}px` } as CSSProperties) : undefined
  const resetLayout = () => {
    services.layout.clear()
    setKept(services.layout.load())
    setHeld({})
  }

  const jumpTo = (comment: ReviewComment, toCard = false) => {
    const place = state.set && state.chosen !== null ? state.set.layout.texts.findIndex((text) => text.id === comment.file) : -1
    if (place >= 0 && place !== state.chosen) dispatch({ type: 'choose', place })
    if (place >= 0 && place !== state.chosen) setFileInView(0)
    setScrollRequest({ line: comment.startLine, nonce: Date.now(), ...(toCard ? { comment: comment.id } : {}) })
    setFlashId(comment.id)
    window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlashId(null), 1500)
  }

  return (
    <div className="app">
      {file && review ? (
        <>
          <Header
            file={file}
            review={review}
            panelOpen={panelOpen}
            onTogglePanel={togglePanel}
            files={
              hasList
                ? {
                    count: fileTotals.files,
                    added: layout ? null : fileTotals.added,
                    deleted: layout ? null : fileTotals.deleted,
                    lines: layout ? layout.texts.reduce((n, text) => n + text.lines.length, 0) : file.lines.length,
                    open: filesShown,
                    onToggle: toggleFiles,
                    commits: commitRows && commitTotals ? { count: commitRows.length, ...commitTotals, branch: state.set?.branch } : undefined,
                  }
                : null
            }
            onHome={goHome}
            onOpen={() => inputRef.current?.click()}
            onLanguage={(language) => dispatch({ type: 'setLanguage', language })}
            onSubmit={press}
            changes={changes}
            onReviewWindow={changes === null ? null : () => setSubmitOpen(true)}
            delivery={delivery}
            handedOver={waitingSince !== null}
            sentAt={state.sentAt}
            theme={theme}
            onTheme={setTheme}
            stop={{ inMenu: stopInMenu, onStop: askToStop }}
            onResetLayout={resetLayout}
          />
          {banner && <Banner notice={banner} onDismiss={() => setNotice(null)} />}
          <DeliveryStrip
            words={waitingWords(waitingSince !== null, late, delivery?.target ?? null, changedSincePress, update)}
            late={late}
            onStop={takenAsItIs(review, state.sentAt) ? null : askToStop}
            stopLabel={stopWords(delivery, state.sentAt, review, state.chosen !== null).label}
            stopTip={stopWords(delivery, state.sentAt, review, state.chosen !== null).tip}
            onOtherWays={() => setSubmitOpen(true)}
          />
          <SentBanner message={sentText} drawn={afterSentSettings(state.submitOptions).banner} onDismiss={clearSent} />
          <div className={held.files === undefined && held.comments === undefined ? 'main' : 'main is-resizing'} style={panelWidths}>
            {hasList && filesShown && commitRows && commitPathLists ? (
              <CommitsPane
                rows={commitRows}
                paths={commitPathLists}
                order={commitOrder}
                onOrder={() => setOrderAt({ hash, order: otherOrder(commitOrder) })}
                chosen={state.chosen ?? 0}
                onChoose={(place) => chooseCommit(place)}
                viewed={viewed}
                writing={writing}
                onToggleViewed={toggleCommitViewed}
                entries={entries}
                current={Math.min(fileInView, Math.max(entries.length - 1, 0))}
                onPick={goToFile}
                onKey={onFileKey}
                rail={wide && filesMode === 'rail'}
                drawer={!wide}
                query={filesQuery}
                onQuery={(text) => setFilesFilter({ hash, text })}
                onRail={() => keepLayout({ files: { mode: filesMode === 'rail' ? 'open' : 'rail' } })}
                onClose={() => setFilesDrawer(false)}
              />
            ) : (
              hasList &&
              filesShown && (
                <FilesPane
                  entries={entries}
                  counts={fileCounts}
                  viewed={viewed}
                  current={Math.min(fileInView, entries.length - 1)}
                  rail={wide && filesMode === 'rail'}
                  drawer={!wide}
                  query={filesQuery}
                  onQuery={(text) => setFilesFilter({ hash, text })}
                  onPick={goToFile}
                  onToggleViewed={toggleViewed}
                  onKey={onListKey}
                  onRail={() => keepLayout({ files: { mode: filesMode === 'rail' ? 'open' : 'rail' } })}
                  onClose={() => setFilesDrawer(false)}
                />
              )
            )}
            {wide && hasList && filesShown && (
              <Splitter
                label={commitRows ? COPY.commitsEdge : COPY.filesEdge}
                title={commitRows ? COPY.commitsEdgeTip : COPY.filesEdgeTip}
                width={shown.files}
                min={filesMode === 'rail' ? RAIL_WIDTH : FILES_WIDTH.min} // the rail's own width is its least, so that the edge's value is never below it
                max={FILES_WIDTH.max}
                side="left"
                onResize={holdFiles}
                onRelease={(width) => {
                  // A release that leaves the list as it is shown keeps only its width, so that a mode that the window chose stays the window's.
                  const next = filesLetGo(width)
                  setHeld({})
                  keepLayout({ files: next.mode !== filesMode ? next : next.mode === 'open' ? { width: next.width } : {} })
                }}
                onReset={() => keepLayout({ files: { width: FILES_WIDTH.usual } })}
              />
            )}
            <CodeViewer
              file={file}
              diff={diff}
              layout={layout}
              commit={
                commits && state.set && state.chosen !== null
                  ? {
                      short: shortHash(commits[state.chosen].hash),
                      subject: commits[state.chosen].subject || COPY.commitNoMessage,
                      viewed: viewed.has(state.set.layout.texts[state.chosen].id),
                      onViewed: () => toggleCommitViewed(state.chosen ?? 0),
                    }
                  : null
              }
              tokens={tokens}
              comments={comments}
              selection={selection}
              draft={draft}
              hoveredId={hoveredId}
              flashId={flashId}
              scrollRequest={scrollRequest}
              onFileInView={hasList ? setFileInView : undefined}
              onFileKey={hasList ? onFileKey : undefined}
              viewedFiles={hasList ? viewedFiles : undefined}
              onToggleViewed={hasList ? toggleViewed : undefined}
              onHover={setHoveredId}
              onReach={(id) => {
                const comment = comments.find((c) => c.id === id)
                if (comment) jumpTo(comment, true)
              }}
              dispatch={dispatch}
            />
            {wide && panelOpen && (
              <Splitter
                label={COPY.commentsEdge}
                title={COPY.commentsEdgeTip}
                width={shown.comments}
                min={COMMENTS_WIDTH.min}
                max={COMMENTS_WIDTH.max}
                side="right"
                onResize={holdComments}
                onRelease={(width) => {
                  const next = commentsLetGo(width)
                  setHeld({})
                  keepLayout({ comments: next.open ? { width: next.width } : next })
                }}
                onReset={() => keepLayout({ comments: { width: COMMENTS_WIDTH.usual } })}
              />
            )}
            {panelOpen && (
              <ReviewPanel
                comments={panelCommits ? review.comments : comments}
                marks={marks}
                hoveredId={hoveredId}
                onHover={setHoveredId}
                onJump={jumpTo}
                files={hasList ? entries : undefined}
                commits={panelCommits}
                onClose={() => (wide ? keepLayout({ comments: { open: false } }) : setPanelDrawer(false))}
              />
            )}
          </div>
          {submitOpen && (
            <SubmitDialog
              review={review}
              commits={commitHeadsById}
              writing={writing.size}
              onSummary={(summary) => dispatch({ type: 'setSummary', summary, now: services.environment.now() })}
              onSubmitted={() => dispatch({ type: 'markSubmitted', now: services.environment.now() })}
              delivery={delivery}
              to={host ? new URL(host).host : undefined}
              deliver={deliver}
              waitingSince={waitingSince}
              late={late}
              changedSincePress={changedSincePress}
              changes={changes}
              update={update}
              onNothingNew={nothingNew}
              closesAtPress={closesAtPress(delivery, afterSentSettings(state.submitOptions).closes)}
              sentAt={state.sentAt}
              forClaude={linked}
              linkTarget={state.submitTarget}
              onClose={() => setSubmitOpen(false)}
              onSentClosed={handover.onSentClosed}
              onStop={askToStop}
            />
          )}
          {stopOpen && (
            <StopDialog
              name={file.name}
              files={review.version === 2 ? review.files.length : 1}
              commits={state.chosen !== null}
              waiting={programWaits(delivery, state.sentAt) ? { target: delivery?.target ?? null } : null}
              discardTells={tellsOfDiscard(toldOfCancel(delivery, review, state.sentAt))}
              comments={review.comments.length}
              summary={review.summary.trim() !== ''}
              writing={writingCount(draft, state.aside)}
              onKeep={() => setStopOpen(false)}
              onStop={stopCurrent}
              onDiscard={cancelCurrent}
            />
          )}
        </>
      ) : (
        <>
          {banner && <Banner notice={banner} onDismiss={() => setNotice(null)} />}
          <Landing
            recent={recent}
            onPick={() => inputRef.current?.click()}
            onSample={() => openSample(SAMPLE_NAME, SAMPLE_CODE)}
            onSampleDiff={() => openSample(SAMPLE_DIFF_NAME, SAMPLE_DIFF)}
            onOpenRecent={openKept}
            onForget={(hash) => {
              services.reviews.forget(hash)
              refreshRecent()
            }}
            theme={theme}
            onTheme={() => setTheme(nextTheme)}
          />
        </>
      )}

      {dragActive && (
        <div className="drop-overlay" aria-hidden="true">
          <div className="drop-card">Drop files or a folder to review them</div>
        </div>
      )}

      <input ref={inputRef} type="file" multiple hidden onChange={onPickerChange} />
    </div>
  )
}

function Banner({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  return (
    <Alert tone={notice.kind} dismissLabel={COPY.dismiss} onDismiss={onDismiss}>
      {notice.text}
    </Alert>
  )
}

/**
 * The message that a review was sent, drawn as a banner in the ok tone unless the caller set `banner` to false. Its text is the live region (polite), which is in the page, and empty,
 * before the message is put in it, as a region that arrives holding its text is not always heard; the cross is outside it, so that it is not read with the message.
 */
function SentBanner({ message, drawn, onDismiss }: { message: string | null; drawn: boolean; onDismiss: () => void }) {
  // A caller that does not want the banner still has the message announced: the same region, filled with the same words, and not drawn.
  if (!drawn) {
    return (
      <span className="sr-only" role="status">
        {message}
      </span>
    )
  }
  return (
    <Alert tone="ok" icon={<IconCheck />} dismissLabel={COPY.dismiss} onDismiss={onDismiss}>
      {message}
    </Alert>
  )
}

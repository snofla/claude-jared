import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, type ChangeEvent } from 'react'
import { CodeViewer } from './components/CodeViewer'
import { CancelDialog } from './components/CancelDialog'
import { SkipDialog } from './components/SkipDialog'
import { DeliveryStrip } from './components/DeliveryStrip'
import { FilesPane } from './components/FilesPane'
import { Header } from './components/Header'
import { Alert, IconCheck } from './ui'
import { Landing } from './components/Landing'
import { ReviewPanel } from './components/ReviewPanel'
import { SubmitDialog } from './components/SubmitDialog'
import { fetchSource } from './engine/receiver-client'
import { useMediaQuery } from './hooks/useMediaQuery'
import { usePlatform } from './hooks/usePlatform'
import { useHandover, type Notice } from './hooks/useHandover'
import { usePageApi } from './hooks/usePageApi'
import { useDiffTokens, useLatest, useSetTokens, useTokens } from './hooks/useTokens'
import { COPY } from './lib/copy'
import { afterSentSettings, closesAtPress, deliveryOf, mustTellProgram, programWaits, takenAsItIs, toldOfCancel, waitingWords } from './lib/delivery'
import { diffOf } from './lib/diff'
import { setEntries, viewComments } from './lib/set-view'
import { autoFilesMode, commentCounts, fileEntries, hasFileList, stepFile, toggled, totals, type FilesMode } from './lib/files'
import { BOOT_EXPIRED_KEY, BOOT_KEY, bootExpired, readBoot, readFragment } from './lib/fragment-link'
import { SERVICE_KEY, hostFromSearch, serviceAddress } from './lib/host-link'
import type { Platform, Picked } from './lib/platform'
import { PLAIN_TEXT } from './lib/language'
import { draftHasText } from './lib/review'
import { SAMPLE_CODE, SAMPLE_DIFF, SAMPLE_DIFF_NAME, SAMPLE_NAME } from './lib/sample'
import { buildSource } from './lib/source'
import { nextTheme, type Theme } from './lib/theme'
import { cancelReview, closeFile, keepBeforeLeaving, keepOpen, keepReview, mayDiscard, mustAskBeforeCancel, openFile, openPicked, openPickedMany, openRecent, openText, replaceQuestion, restoreLast, type OpenOutcome } from './state/flows'
import { expiredNotice } from './state/expired'
import { emptyState, reducer, type AppState } from './state/reducer'
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

function init(platform: Platform): AppState {
  // What was open at the last visit, a file or a set of files, comes back through the engine, as it is opened.
  const last = restoreLast(platform)
  return last ? reducer(emptyState, last) : emptyState
}

export default function App() {
  const services = usePlatform()
  const [state, dispatch] = useReducer(reducer, services, init)
  const { file, review, selection, draft } = state

  // The comments panel follows the window width until the reviewer opens or closes it by hand.
  const wide = useMediaQuery(WIDE_QUERY)
  const [panelChoice, setPanelChoice] = useState<boolean | null>(null)
  const panelOpen = panelChoice ?? wide
  const [submitOpen, setSubmitOpen] = useState(false)
  // The question before a review is given up.
  const [cancelOpen, setCancelOpen] = useState(false)
  // The question of Back to start while a program waits for the review.
  const [skipOpen, setSkipOpen] = useState(false)
  // The colour scheme: the choice is kept, and applied to the page as an attribute that the CSS selects on (`index.html` has
  // already applied the kept one before the first paint).
  const [theme, setTheme] = useState<Theme>(services.theme.load)
  useEffect(() => {
    services.theme.apply(theme)
    services.theme.save(theme)
  }, [theme, services])
  const [linked, setLinked] = useState(false) // opened by a link that carries requests: the review can go to the clipboard
  // Opened from a link that a Claude session printed: the file comes from the receiver at this address, and the
  // review can be sent back to it. Only an address on this computer is ever used (see `receiverAddress`).
  const [host] = useState(() => hostFromSearch(window.location.search))
  // Served by the Jared service for a review that comes back as a file: the script of the review gave the address of the review's folder
  // (`window.__JARED_SERVICE`). Only a folder at the service that served this page is ever used (see `serviceAddress`).
  const [service] = useState(() => serviceAddress((window as unknown as Record<string, unknown>)[SERVICE_KEY], window.location.origin))
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
  // Several files open together are drawn as one list of rows, a header for each file and then its lines; the comments are then in those rows too.
  const layout = state.set?.layout ?? null
  const comments = useMemo(() => (review ? (layout ? viewComments(layout, review.comments) : review.comments) : []), [review, layout])

  // The list of the files of a diff of two files or more: how it is shown follows the window width until the reviewer chooses, and below the width of the
  // comments panel it is a drawer, opened and closed by hand like that panel. The marks for the files that the reviewer has looked at are the page's own, kept by the review's hash.
  const entries = useMemo(() => (layout ? setEntries(layout) : fileEntries(diff)), [layout, diff])
  const hasList = hasFileList(entries)
  const fileTotals = useMemo(() => totals(entries), [entries])
  const roomToOpen = useMediaQuery(OPEN_FILES_QUERY)
  const [filesChoice, setFilesChoice] = useState<FilesMode | null>(null)
  const [filesDrawer, setFilesDrawer] = useState(false)
  const filesMode = filesChoice ?? autoFilesMode(roomToOpen, wide)
  const [fileInView, setFileInView] = useState(0)
  const [viewedState, setViewedState] = useState<{ hash: string; ids: ReadonlySet<string> } | null>(null)
  const hash = file?.hash ?? ''
  const viewed = useMemo(
    () => (viewedState && viewedState.hash === hash ? viewedState.ids : new Set(file ? services.reviews.viewed(hash) : [])),
    [viewedState, hash, file, services],
  )
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

  // Open the file that the receiver of the link holds, as a dropped file would be opened.
  useEffect(() => {
    if (!host) return
    let cancelled = false
    void fetchSource(host).then((result) => {
      if (cancelled) return
      if (!result.ok) return setNotice({ kind: 'error', text: result.error })
      const outcome = openText(services, stateRef.current, result.name, result.text)
      const words = { type: 'setDelivery', submitLabel: result.submitLabel, submitTarget: result.submitTarget, submitOptions: result.submitOptions } as const
      // The same file again, as on a second round or a reload, is left as it is; but it is the receiver's file, so it brings its words.
      if (outcome.kind === 'same') return dispatch(words)
      applyOutcome(outcome)
      // In the same batch as the file, so that the button never shows the default words first.
      if (outcome.kind === 'opened') dispatch(words)
    })
    return () => {
      cancelled = true
    }
  }, [host, services, applyOutcome, stateRef])

  // Requests in the address, `#jared=...`, as a Claude session makes them: done in order, and the
  // fragment is taken out of the address, so that the file in it is not left in the history. A request that would throw away
  // work is put to the reviewer, who is here, as a dropped file is. A page that is a file opened from a path has no fragment to
  // read: its requests are in `window.__JARED_BOOT`, put there by a script beside it, and taken once.
  useEffect(() => {
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
      for (const message of link.messages) {
        let replies = applyRequest(message)
        const declined = replies.find((r) => r.type === 'error' && r.code === 'declined')
        if (declined && message.type === 'open' && typeof message.name === 'string' && typeof message.text === 'string') {
          const question = replaceQuestion(stateRef.current, message.name, message.text, (declined as { message: string }).message)
          if (!services.prompts.confirm(question)) return setNotice({ kind: 'warn', text: 'The link was not opened: your review was kept.' })
          replies = applyRequest(message, true)
        }
        const failed = replies.find((r) => r.type === 'error')
        if (failed) return setNotice({ kind: 'error', text: (failed as { message: string }).message })
      }
      setLinked(true)
    }
    follow()
    window.addEventListener('hashchange', follow)
    return () => window.removeEventListener('hashchange', follow)
  }, [applyRequest, stateRef, services])

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
    // A program that waits for the review is not left waiting in silence: the question comes first, and Skip review is its way out.
    const { review: current, sentAt } = stateRef.current
    if (current && programWaits(delivery, sentAt)) return setSkipOpen(true)
    if (!mayDiscard(services, draftRef.current)) return
    closeFile(services)
    setSubmitOpen(false)
    clearSent()
    forgetPresses()
    dispatch({ type: 'close' })
  }

  // Skip the review of the open file: the program that waits for it is told, the review is kept as Back to start keeps it, and the page goes back to the start. A script that
  // drives the page does not look at the page until it is asked, so the start page tells the reviewer to tell it; a receiver is told at once.
  const skipCurrent = () => {
    if (!file || !mayDiscard(services, draftRef.current)) return
    const { review: current, sentAt } = stateRef.current
    const told = current !== null && programWaits(delivery, sentAt)
    if (told) handover.tellOfSkip()
    handover.giveUp()
    closeFile(services)
    setSkipOpen(false)
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
    setCancelOpen(false)
    setSubmitOpen(false)
    clearSent()
    forgetPresses()
    dispatch({ type: 'close' })
    refreshRecent()
    if (told && mustTellProgram(delivery)) setNotice({ kind: 'warn', text: COPY.discardTellProgram(delivery?.target ?? null) })
  }

  // Asked for from the header and from the submit dialog: a question first when there is something to lose, and nothing to ask otherwise.
  const askToCancel = () => (mustAskBeforeCancel(stateRef.current) ? setCancelOpen(true) : cancelCurrent())
  // Skip review is offered while a program waits for the review: in the header's menu and the foot of the window.
  const onSkip = review && programWaits(delivery, state.sentAt) ? skipCurrent : null

  const openKept = (hash: string) => applyOutcome(openRecent(services, hash))
  const openSample = (name: string, text: string) => applyOutcome(openFile(services, stateRef.current, buildSource(name, text)))

  // The comments panel goes to the first line of a comment; a click on a comment bar in the gutter goes to its card, which is under its last line.
  const goToFile = (index: number) => {
    const entry = entries[index]
    if (!entry) return
    setScrollRequest({ line: entry.startRow, nonce: Date.now(), block: 'start' })
    setFileInView(index)
    setFilesDrawer(false)
  }
  const toggleViewed = (index: number) => {
    const entry = entries[index]
    if (!entry) return
    const ids = toggled(viewed, entry.id)
    setViewedState({ hash, ids })
    services.reviews.setViewed(hash, [...ids])
  }
  const onFileKey = (key: 'next' | 'previous' | 'viewed') =>
    key === 'viewed' ? toggleViewed(fileInView) : goToFile(stepFile(entries.length, fileInView, key === 'next' ? 1 : -1))
  const toggleFiles = () => {
    if (wide) return setFilesChoice(filesMode === 'closed' ? 'open' : 'closed')
    setFilesDrawer(!filesDrawer)
    if (!filesDrawer) setPanelChoice(false)
  }
  const filesShown = wide ? filesMode !== 'closed' : filesDrawer

  const jumpTo = (comment: ReviewComment, toCard = false) => {
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
            onTogglePanel={() => {
              if (!wide && !panelOpen) setFilesDrawer(false)
              setPanelChoice(!panelOpen)
            }}
            files={
              hasList
                ? {
                    count: fileTotals.files,
                    added: layout ? null : fileTotals.added,
                    deleted: layout ? null : fileTotals.deleted,
                    lines: layout ? layout.texts.reduce((n, text) => n + text.lines.length, 0) : file.lines.length,
                    open: filesShown,
                    onToggle: toggleFiles,
                  }
                : null
            }
            onHome={goHome}
            onOpen={() => inputRef.current?.click()}
            onLanguage={(language) => dispatch({ type: 'setLanguage', language })}
            onSubmit={press}
            changes={changes}
            onReviewWindow={changes === null ? null : () => setSubmitOpen(true)}
            onCancel={askToCancel}
            onSkip={onSkip}
            delivery={delivery}
            handedOver={waitingSince !== null}
            sentAt={state.sentAt}
            theme={theme}
            onTheme={setTheme}
          />
          {banner && <Banner notice={banner} onDismiss={() => setNotice(null)} />}
          <DeliveryStrip
            words={waitingWords(waitingSince !== null, late, delivery?.target ?? null, changedSincePress, update)}
            late={late}
            onCancel={takenAsItIs(review, state.sentAt) ? null : askToCancel}
            onOtherWays={() => setSubmitOpen(true)}
          />
          <SentBanner message={sentText} drawn={afterSentSettings(state.submitOptions).banner} onDismiss={clearSent} />
          <div className="main">
            {hasList && filesShown && (
              <FilesPane
                entries={entries}
                counts={fileCounts}
                viewed={viewed}
                current={Math.min(fileInView, entries.length - 1)}
                rail={wide && filesMode === 'rail'}
                drawer={!wide}
                onPick={goToFile}
                onToggleViewed={toggleViewed}
                onRail={() => setFilesChoice(filesMode === 'rail' ? 'open' : 'rail')}
                onClose={() => setFilesDrawer(false)}
              />
            )}
            <CodeViewer
              file={file}
              diff={diff}
              layout={layout}
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
            {panelOpen && (
              <ReviewPanel
                comments={comments}
                marks={marks}
                hoveredId={hoveredId}
                onHover={setHoveredId}
                onJump={jumpTo}
                files={hasList ? entries : undefined}
                onClose={() => setPanelChoice(false)}
              />
            )}
          </div>
          {submitOpen && (
            <SubmitDialog
              review={review}
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
              onCancel={askToCancel}
              onSkip={onSkip}
            />
          )}
          {skipOpen && <SkipDialog target={delivery?.target ?? null} onKeep={() => setSkipOpen(false)} onSkip={skipCurrent} />}
          {cancelOpen && (
            <CancelDialog
              comments={review.comments.length}
              summary={review.summary.trim() !== ''}
              writing={draftHasText(draft)}
              tells={toldOfCancel(delivery, review, state.sentAt)}
              fileName={file.name}
              onKeep={() => setCancelOpen(false)}
              onCancel={cancelCurrent}
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

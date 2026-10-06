import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, type ChangeEvent } from 'react'
import { CodeViewer } from './components/CodeViewer'
import { Header } from './components/Header'
import { IconCheck, IconX } from './components/icons'
import { Landing } from './components/Landing'
import { ReviewPanel } from './components/ReviewPanel'
import { SubmitDialog } from './components/SubmitDialog'
import { createOutbox } from './engine/outbox'
import { PROTOCOL_VERSION, type SubmittedEvent } from './engine/protocol'
import { fetchSource, sendReview } from './engine/receiver-client'
import { useMediaQuery } from './hooks/useMediaQuery'
import { usePlatform } from './hooks/usePlatform'
import { usePageApi } from './hooks/usePageApi'
import { useDiffTokens, useLatest, useTokens } from './hooks/useTokens'
import { COPY } from './lib/copy'
import { afterSent, afterSentSettings, canTryAgain, closeDelayMs, deliveryOf, sentMessage, sentUnchanged } from './lib/delivery'
import { diffOf } from './lib/diff'
import { BOOT_KEY, readBoot, readFragment } from './lib/fragment-link'
import { hostFromSearch } from './lib/host-link'
import type { Platform, Picked } from './lib/platform'
import { PLAIN_TEXT } from './lib/language'
import { SAMPLE_CODE, SAMPLE_DIFF, SAMPLE_DIFF_NAME, SAMPLE_NAME } from './lib/sample'
import { buildSource } from './lib/source'
import { nextTheme, type Theme } from './lib/theme'
import { closeFile, keepOpen, mayDiscard, openFile, openPicked, openRecent, openText, replaceQuestion, type OpenOutcome } from './state/flows'
import { emptyState, reducer, type AppState } from './state/reducer'
import type { ReviewComment } from './types'

interface Notice {
  kind: 'error' | 'warn'
  text: string
}

/** The width at which the comments panel stops being an overlay: the breakpoint of `.side` in styles.css. */
const WIDE_QUERY = '(min-width: 900px)'
const NO_LINES: string[] = [] // the same array each time, so that a hook that depends on it does not run again

const STORAGE_WARNING: Notice = {
  kind: 'warn',
  text: "This review can't be saved in your browser (storage is full or blocked). Export it before closing the tab so nothing is lost.",
}

function init(platform: Platform): AppState {
  const last = platform.reviews.last()
  // The file that was open at the last visit comes back through the engine, as any file is opened.
  return last ? reducer(emptyState, { type: 'open', name: last.file.name, text: last.file.content, review: last.review, now: platform.environment.now() }) : emptyState
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
  // Reviews that the reviewer has handed over to a script that drives the page, and that it has not taken yet.
  const outbox = useMemo(() => createOutbox<SubmittedEvent>(), [])
  const submitted = useRef(0)
  // When, and for which file (by its hash), the reviewer handed a review over to a script that has not taken it yet.
  const [handed, setHandedAt] = useState<{ at: number; hash: string } | null>(null)
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
  const [notice, setNotice] = useState<Notice | null>(null)
  // The message that says a review was sent, for when the dialog was not there to say it, and whether it is to be told once the dialog has closed.
  const [sentText, setSentText] = useState<string | null>(null)
  const tellOnClose = useRef(false)
  // The red banner of a send that failed after its dialog was closed: the next send takes it away, so that it is never beside the message that says it was sent.
  const failedSend = useRef<Notice | null>(null)
  const sentTimer = useRef(0)
  const [dragActive, setDragActive] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [flashId, setFlashId] = useState<string | null>(null)
  const [scrollRequest, setScrollRequest] = useState<{ line: number; nonce: number; comment?: string } | null>(null)
  const [, refreshRecent] = useReducer((n: number) => n + 1, 0) // re-read the recent list after forgetting a file

  const inputRef = useRef<HTMLInputElement>(null)
  const flashTimer = useRef<number>(0)
  const draftRef = useLatest(draft)
  const stateRef = useLatest(state)
  const submitOpenRef = useLatest(submitOpen)

  // A text whose language is diff, and that has a hunk, is shown as a diff: then its colours come row by row, from the file each row is in.
  const diff = useMemo(() => (file ? diffOf(file.language, file.lines) : null), [file])
  const fileTokens = useTokens(diff || !file ? null : file.content, file?.language ?? PLAIN_TEXT)
  const diffTokens = useDiffTokens(diff, file?.lines ?? NO_LINES)
  const tokens = diff ? diffTokens : fileTokens
  const delivery = deliveryOf(host, state.submitLabel, state.submitTarget)
  // The message is emptied before it is set, so that a second one with the same words is read again; and it goes when another file is
  // opened or the file is closed, and when the next send begins.
  const tellSent = useCallback((text: string) => {
    window.clearTimeout(sentTimer.current)
    setSentText(null)
    sentTimer.current = window.setTimeout(() => setSentText(text), 100)
  }, [])
  const clearSent = useCallback(() => {
    window.clearTimeout(sentTimer.current)
    setSentText(null)
    tellOnClose.current = false
  }, [])
  useEffect(() => {
    // The dialog closed by itself: what is outside a modal dialog is not heard while it is open, so the message waits until it has gone.
    if (submitOpen || !tellOnClose.current) return
    tellOnClose.current = false
    tellSent(sentMessage(state.submitTarget, afterSentSettings(state.submitOptions)))
  }, [submitOpen, tellSent, state.submitTarget, state.submitOptions])

  // Hand the review over: to the receiver, which answers, or to the script that drives the page, which asks for it. Either marks the
  // review sent once it has happened, so the status never says more than the page has seen. What follows depends on whether the dialog is
  // still open and on whether the reviewer changed anything since the press (`afterSent`): a failure that nobody is looking at is told in the banner.
  const deliver = useCallback(async (): Promise<{ ok: true; closeAfterMs: number | null } | { ok: false; error: string }> => {
    const current = stateRef.current.review
    if (!current) return { ok: false, error: COPY.nothingToSend }
    clearSent()
    const stale = failedSend.current
    failedSend.current = null
    if (stale) setNotice((shown) => (shown === stale ? null : shown))
    const now = services.environment.now()
    const hash = current.file.hash
    let outcome: { ok: true } | { ok: false; error: string }
    if (host) {
      outcome = await sendReview(host, current, now, { target: stateRef.current.submitTarget })
    } else {
      const event: SubmittedEvent = { protocol: PROTOCOL_VERSION, type: 'submitted', seq: ++submitted.current, review: { ...current, submittedAt: now } }
      setHandedAt({ at: Date.now(), hash })
      const taken = await outbox.post(event)
      setHandedAt(null)
      outcome = taken ? { ok: true } : { ok: false, error: COPY.fileChanged }
    }
    if (!outcome.ok) {
      if (!submitOpenRef.current) {
        failedSend.current = { kind: 'error', text: COPY.notSent(outcome.error, canTryAgain(outcome.error)) }
        setNotice(failedSend.current)
      }
      return outcome
    }
    dispatch({ type: 'markSent', now, hash })
    // Edits made while the review was on its way have moved `updatedAt` past the time of the press; the state read here is from before `markSent`, which does not move it.
    const latest = stateRef.current.review
    const unchanged = !!latest && latest.file.hash === hash && sentUnchanged(latest, now)
    const settings = afterSentSettings(stateRef.current.submitOptions)
    const next = afterSent({ dialogOpen: submitOpenRef.current, unchanged, closes: settings.closes })
    if (next === 'tells') tellSent(sentMessage(stateRef.current.submitTarget, settings))
    return { ok: true, closeAfterMs: next === 'closes' ? closeDelayMs(settings.closes) : null }
  }, [host, outbox, stateRef, services, submitOpenRef, clearSent, tellSent])
  // A review handed over for a file that is no longer open is of no use to whoever asks next, and is not waited for: whichever way the
  // file was replaced (the reviewer's, a script's, a link's).
  const fileHash = file?.hash
  useEffect(() => {
    outbox.clear()
  }, [fileHash, outbox])
  const waitingSince = handed !== null && handed.hash === fileHash ? handed.at : null
  const unsaved = useSyncExternalStore(services.reviews.subscribe, services.reviews.failed)
  const banner = notice ?? (unsaved ? STORAGE_WARNING : null)
  const recent = file ? [] : services.reviews.recent()

  // Every change to the review is persisted immediately.
  useEffect(() => {
    if (review) services.reviews.saveReview(review)
  }, [review, services])

  // The protocol of the engine, for a script on the page: `window.jared.handleMessage(request)`.
  const applyRequest = usePageApi(
    state,
    dispatch,
    (adoptedFile, another) => {
      if (!adoptedFile) {
        closeFile(services)
        setSubmitOpen(false)
        clearSent()
      } else if (another) {
        keepOpen(services, adoptedFile) // as opening a file does
        setNotice(null)
        clearSent()
        setHoveredId(null)
      }
    },
    outbox,
  )

  useEffect(() => {
    document.title = file ? `${file.name} · Jared` : 'Jared · code review'
  }, [file])

  /** What a flow came to: the file opens (and what belonged to the last one is let go), or the reviewer is told why it did not. */
  const applyOutcome = useCallback((outcome: OpenOutcome | { kind: 'gone' }) => {
    if (outcome.kind === 'refused') setNotice({ kind: 'error', text: outcome.error })
    else if (outcome.kind === 'opened') {
      setNotice(null)
      clearSent()
      setHoveredId(null)
      dispatch(outcome.action)
    } else if (outcome.kind === 'gone') refreshRecent()
  }, [clearSent])

  const openPickedFile = useCallback(
    async (picked: Picked) => applyOutcome(await openPicked(services, stateRef.current, picked)),
    [services, stateRef, applyOutcome],
  )
  const openFileRef = useLatest(openPickedFile)

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
    const takeBoot = () => {
      const page = window as unknown as Record<string, unknown>
      const value = page[BOOT_KEY]
      delete page[BOOT_KEY]
      return readBoot(value)
    }
    const follow = () => {
      const fromAddress = readFragment(window.location.hash)
      if (fromAddress) window.history.replaceState(null, '', window.location.pathname + window.location.search)
      const fromScript = takeBoot()
      const link = fromAddress ?? fromScript
      if (!link) return
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
    const picked = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again
    if (picked) void openPickedFile(picked)
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
      const dropped = e.dataTransfer?.files[0]
      if (dropped) void openFileRef.current(dropped)
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
  }, [openFileRef, submitOpenRef])

  const goHome = () => {
    if (!mayDiscard(services, draftRef.current)) return
    closeFile(services)
    setSubmitOpen(false)
    clearSent()
    dispatch({ type: 'close' })
  }

  const openKept = (hash: string) => applyOutcome(openRecent(services, hash))
  const openSample = (name: string, text: string) => applyOutcome(openFile(services, stateRef.current, buildSource(name, text)))

  // The comments panel goes to the first line of a comment; a click on a comment bar in the gutter goes to its card, which is under its last line.
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
            onTogglePanel={() => setPanelChoice(!panelOpen)}
            onHome={goHome}
            onOpen={() => inputRef.current?.click()}
            onLanguage={(language) => dispatch({ type: 'setLanguage', language })}
            onSubmit={() => setSubmitOpen(true)}
            delivery={delivery}
            handedOver={waitingSince !== null}
            sentAt={state.sentAt}
            theme={theme}
            onTheme={() => setTheme(nextTheme)}
          />
          {banner && <Banner notice={banner} onDismiss={() => setNotice(null)} />}
          <SentBanner message={sentText} drawn={afterSentSettings(state.submitOptions).banner} onDismiss={clearSent} />
          <div className="main">
            <CodeViewer
              file={file}
              diff={diff}
              tokens={tokens}
              comments={review.comments}
              selection={selection}
              draft={draft}
              hoveredId={hoveredId}
              flashId={flashId}
              scrollRequest={scrollRequest}
              onHover={setHoveredId}
              onReach={(id) => {
                const comment = review.comments.find((c) => c.id === id)
                if (comment) jumpTo(comment, true)
              }}
              dispatch={dispatch}
            />
            {panelOpen && (
              <ReviewPanel
                comments={review.comments}
                hoveredId={hoveredId}
                onHover={setHoveredId}
                onJump={jumpTo}
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
              sentAt={state.sentAt}
              forClaude={linked}
              linkTarget={state.submitTarget}
              onClose={() => setSubmitOpen(false)}
              onSentClosed={() => (tellOnClose.current = true)}
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
          <div className="drop-card">Drop a file to review it</div>
        </div>
      )}

      <input ref={inputRef} type="file" hidden onChange={onPickerChange} />
    </div>
  )
}

function Banner({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  return (
    <div className={`banner banner-${notice.kind}`} role="alert">
      <span>{notice.text}</span>
      <button type="button" className="icon-btn" aria-label={COPY.dismiss} onClick={onDismiss}>
        <IconX />
      </button>
    </div>
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
    <div className={message === null ? 'banner-slot' : 'banner banner-ok'}>
      <span className="banner-text" role="status">
        {message !== null && (
          <>
            <IconCheck />
            <span>{message}</span>
          </>
        )}
      </span>
      {message !== null && (
        <button type="button" className="icon-btn" aria-label={COPY.dismiss} onClick={onDismiss}>
          <IconX />
        </button>
      )}
    </div>
  )
}

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import { useLatest } from '../hooks/useTokens'
import { bodyOf, fileBadge, fileTitle, type ParsedDiff } from '../lib/diff'
import { isTooLongToHighlight, type LineTokens } from '../lib/highlight'
import { PLAIN_TEXT } from '../lib/language'
import { commentBarTitle, labelOfRange, rangeOf, suggestionWarning } from '../lib/review'
import {
  autoscrollDelta,
  pointInside,
  selectionAtPress,
  selectionForAdd,
  selectionFromMouseUp,
  selectionKeyDelta,
  within,
  type HighlightedText,
} from '../lib/selection'
import { commentAtLane, commentLanes, commentsByEnd, hasOverlap, laneAtOffset, laneMasks, maxColumns, pressesBar } from '../lib/viewer'
import type { Action } from '../state/reducer'
import type { Draft, LineSelection, ReviewComment, SourceFile } from '../types'
import { Button, Kbd } from '../ui'
import { CodeLine } from './CodeLine'
import { DiffLine } from './DiffLine'
import { IconMessage, IconX } from './icons'
import { ReviewCard } from './ReviewCard'
import { ReviewComposer } from './ReviewComposer'
import { Ruler } from './Ruler'

interface Props {
  file: SourceFile
  /** The file as a diff, when it is shown as one: then `tokens` has one entry for each row of it. */
  diff: ParsedDiff | null
  tokens: Array<LineTokens | null> | null
  comments: ReviewComment[]
  selection: LineSelection | null
  draft: Draft | null
  hoveredId: string | null
  flashId: string | null
  /** Bump `nonce` to scroll `line` into view, or, when `comment` is given, the card of that comment. */
  scrollRequest: { line: number; nonce: number; comment?: string } | null
  onHover: (id: string | null) => void
  /** A press on a comment bar in the gutter: go to that comment's card. */
  onReach: (id: string) => void
  dispatch: Dispatch<Action>
}

const AUTOSCROLL_EDGE = 40

function lineOfNode(node: Node | null): number | null {
  const el = node instanceof Element ? node : (node?.parentElement ?? null)
  const row = el?.closest<HTMLElement>('[data-line]')
  return row ? Number(row.dataset.line) : null
}

/** True if (node, offset) is at the very start of its line's text, e.g. after a triple-click. */
function atLineStart(node: Node, offset: number): boolean {
  const el = node instanceof Element ? node : node.parentElement
  const code = el?.closest('[data-line]')?.querySelector('.code')
  if (!code) return false
  const probe = document.createRange()
  probe.selectNodeContents(code)
  probe.setEnd(node, offset)
  return probe.toString() === ''
}

export function CodeViewer({
  file,
  diff,
  tokens,
  comments,
  selection,
  draft,
  hoveredId,
  flashId,
  scrollRequest,
  onHover,
  onReach,
  dispatch,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const dragAnchor = useRef(1)
  const lastFocus = useRef(1)
  const pointer = useRef({ x: 0, y: 0 })
  const mouseDownLine = useRef<number | null>(null)
  const scrollToFocus = useRef(false) // set by a key that moves the selection: the page scrolls once it has rendered the move

  const lineCount = file.lines.length
  const selectionRef = useLatest(selection)
  const draftRef = useLatest(draft)

  const sel = selection ? rangeOf(selection) : null
  const hover = hoveredId ? comments.find((c) => c.id === hoveredId) : undefined
  const flash = flashId ? comments.find((c) => c.id === flashId) : undefined

  // The lane of each comment's bar in the gutter, and for each line the lanes that have a bar on it: one number that the rows are memoised on.
  const lanes = useMemo(() => commentLanes(comments), [comments])
  const masks = useMemo(() => laneMasks(comments, lineCount, lanes), [comments, lineCount, lanes])
  const commentsRef = useLatest(comments)
  const onHoverRef = useLatest(onHover)
  const onReachRef = useLatest(onReach)
  const overBar = useRef(false) // the pointer is on a comment bar, and the hover that was set is that bar's
  const byEnd = useMemo(() => commentsByEnd(comments), [comments])

  // Rows are rendered lazily (content-visibility), so the scroll width can't come from the DOM.
  const columns = useMemo(() => maxColumns(file.lines), [file.lines])

  // ---- line selection by dragging the gutter ------------------------------------------------

  /** The comment whose bar the pointer is on, in the gutter of line `n`: the lanes are columns at the left edge, wider than their bars. */
  const barAt = useCallback(
    (e: PointerEvent<HTMLElement>, n: number): ReviewComment | undefined => {
      const lane = laneAtOffset(e.clientX - e.currentTarget.getBoundingClientRect().left)
      return lane === null ? undefined : commentAtLane(commentsRef.current, n, lane)
    },
    [commentsRef],
  )

  // The mouse resting on a bar shows which comment it is, and the lines it covers as a hovered card does. A finger cannot: the panel is its way.
  const onGutterPointerMove = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'touch' || e.buttons !== 0) return
      const row = e.currentTarget.closest<HTMLElement>('[data-line]')
      const bar = row ? barAt(e, Number(row.dataset.line)) : undefined
      const title = bar ? commentBarTitle(bar) : ''
      if (e.currentTarget.title !== title) e.currentTarget.title = title
      if (bar) onHoverRef.current(bar.id)
      else if (overBar.current) onHoverRef.current(null)
      overBar.current = !!bar
    },
    [barAt, onHoverRef],
  )

  const onGutterPointerLeave = useCallback(() => {
    if (overBar.current) onHoverRef.current(null)
    overBar.current = false
  }, [onHoverRef])

  const onGutterPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return
      const row = e.currentTarget.closest<HTMLElement>('[data-line]')
      if (!row) return
      const n = Number(row.dataset.line)
      e.preventDefault() // no text selection, no focus theft
      // A press on a comment bar goes to that comment and does not start a selection of lines; with Shift, Ctrl or Meta held it is a press on the line.
      const bar = pressesBar(e) ? barAt(e, n) : undefined
      if (bar) {
        onReachRef.current(bar.id)
        return
      }
      scrollToFocus.current = false
      innerRef.current?.focus({ preventScroll: true })
      const pressed = selectionAtPress(selectionRef.current, n, e.shiftKey)
      dragAnchor.current = pressed.anchor
      lastFocus.current = n
      pointer.current = { x: e.clientX, y: e.clientY }
      dispatch({ type: 'select', selection: pressed, commit: false })
      setDragging(true)
    },
    [barAt, dispatch, onReachRef, selectionRef],
  )

  useEffect(() => {
    if (!dragging) return
    const scroller = scrollerRef.current!
    let frame = 0

    const tick = () => {
      const rect = scroller.getBoundingClientRect()
      const { x, y } = pointer.current
      const scroll = autoscrollDelta(y, rect.top, rect.bottom, AUTOSCROLL_EDGE)
      if (scroll !== 0) scroller.scrollTop += scroll

      const at = pointInside(x, y, rect)
      const probe = document.elementFromPoint(at.x, at.y)
      const row = probe?.closest<HTMLElement>('[data-line]')
      const n = row ? Number(row.dataset.line) : null
      if (n !== null && n !== lastFocus.current) {
        lastFocus.current = n
        dispatch({ type: 'select', selection: { anchor: dragAnchor.current, focus: n }, commit: false })
      }
      frame = requestAnimationFrame(tick)
    }

    const onMove = (e: globalThis.PointerEvent) => {
      pointer.current = { x: e.clientX, y: e.clientY }
    }
    const onUp = () => {
      setDragging(false)
      dispatch({ type: 'commitSelection' })
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragging, dispatch])

  // ---- clicking / highlighting text in the code itself ----------------------------------------
  // Disabled while a comment is open so a stray click can't move the composer.

  const onMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    const row = target.closest<HTMLElement>('[data-line]')
    scrollToFocus.current = false
    mouseDownLine.current = row && !target.closest('.gutter') ? Number(row.dataset.line) : null
  }

  const onMouseUp = (e: MouseEvent<HTMLDivElement>) => {
    const downLine = mouseDownLine.current
    mouseDownLine.current = null
    if (draftRef.current || downLine === null || e.button !== 0) return

    // What the browser has highlighted, read as the lines its ends are on; the rule for what that selects is `selectionFromMouseUp`.
    const domSelection = window.getSelection()
    let text: HighlightedText | null = null
    if (domSelection && !domSelection.isCollapsed && domSelection.rangeCount > 0) {
      const range = domSelection.getRangeAt(0)
      text = {
        first: lineOfNode(range.startContainer),
        last: lineOfNode(range.endContainer),
        endAtLineStart: atLineStart(range.endContainer, range.endOffset),
      }
    }
    const next = selectionFromMouseUp(selectionRef.current, downLine, e.shiftKey, text)
    if (next) dispatch({ type: 'select', selection: next })
  }

  // ---- keyboard -------------------------------------------------------------------------------

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.altKey || e.ctrlKey || e.metaKey) return
    const current = selectionRef.current

    // The reducer works out where the move lands from the selection it holds, not from `current`, which is the one of the last
    // render: key events that arrive before a render (a held key) add up.
    const delta = selectionKeyDelta(e.key)
    if (delta !== null) {
      e.preventDefault()
      scrollToFocus.current = true
      dispatch({ type: 'moveSelection', delta, extend: e.shiftKey })
      return
    }

    switch (e.key) {
      case 'c':
      case 'Enter':
        if (current) {
          e.preventDefault()
          dispatch({ type: 'startDraft' })
        }
        return
      case 'Escape':
        dispatch(draftRef.current ? { type: 'cancelDraft' } : { type: 'select', selection: null })
    }
  }

  // Scroll to where the keys have taken the selection, once, after the render that has the final line.
  useEffect(() => {
    if (!scrollToFocus.current) return
    scrollToFocus.current = false
    if (selection) scrollerRef.current?.querySelector(`[data-line="${selection.focus}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [selection])

  const onAdd = useCallback(
    (n: number) => {
      const next = selectionForAdd(selectionRef.current, n)
      if (next) dispatch({ type: 'select', selection: next })
      dispatch({ type: 'startDraft' })
    },
    [dispatch, selectionRef],
  )

  // ---- scrolling, focus -----------------------------------------------------------------------

  useEffect(() => {
    if (!scrollRequest) return
    const scroller = scrollerRef.current
    const card = scrollRequest.comment ? scroller?.querySelector(`[data-comment="${CSS.escape(scrollRequest.comment)}"]`) : null
    const target = card ?? scroller?.querySelector(`[data-line="${scrollRequest.line}"]`)
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [scrollRequest])

  // After a comment is saved or cancelled, hand focus back to the code so the keyboard keeps working.
  const hadDraft = useRef(false)
  useEffect(() => {
    if (hadDraft.current && !draft && document.activeElement === document.body) {
      innerRef.current?.focus({ preventScroll: true })
    }
    hadDraft.current = draft !== null
  }, [draft])

  // ---- render ---------------------------------------------------------------------------------

  const innerStyle = { minWidth: `max(100%, calc(var(--gutter-w) + ${columns}ch + 40px))` } as CSSProperties

  return (
    <div className="viewer">
      <div className="viewer-main">
        <div className={dragging ? 'scroller is-dragging' : 'scroller'} ref={scrollerRef}>
          <div
            className={diff ? 'inner is-diff' : 'inner'}
            ref={innerRef}
            style={innerStyle}
            tabIndex={0}
            role="group"
            aria-label={`${diff ? 'Diff' : 'Source'} of ${file.name}. Arrow keys select lines, C adds a comment.`}
            onKeyDown={onKeyDown}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
          >
            {file.lines.map((text, i) => {
              const n = i + 1
              const cards = byEnd.get(n)
              const row = diff?.rows[i]
              const common = {
                n,
                text,
                tokens: tokens?.[i] ?? null,
                selected: !!sel && within(n, sel.start, sel.end),
                reviewed: masks[n] !== 0,
                lanes: masks[n],
                hovered: !!hover && within(n, hover.startLine, hover.endLine),
                flash: !!flash && within(n, flash.startLine, flash.endLine),
                onGutterPointerDown,
                onGutterPointerMove,
                onGutterPointerLeave,
                onAdd,
              }
              const owner = row && row.file >= 0 ? diff.files[row.file] : null
              return (
                <Fragment key={n}>
                  {row ? (
                    <DiffLine
                      {...common}
                      kind={row.kind}
                      oldNo={row.oldNo}
                      newNo={row.newNo}
                      title={row.kind === 'file' && owner ? fileTitle(owner) : null}
                      badge={row.kind === 'file' && owner ? fileBadge(owner) : null}
                      uncoloured={!!owner && owner.language !== PLAIN_TEXT && isTooLongToHighlight(bodyOf(text, row.kind))}
                    />
                  ) : (
                    <CodeLine {...common} uncoloured={file.language !== PLAIN_TEXT && isTooLongToHighlight(text)} />
                  )}
                  {cards?.map(
                    (c) =>
                      c.id !== draft?.id && (
                        <ReviewCard
                          key={c.id}
                          comment={c}
                          language={file.language}
                          fileTokens={tokens}
                          onHover={onHover}
                          flash={flashId === c.id}
                          dispatch={dispatch}
                        />
                      ),
                  )}
                  {draft && draft.range.end === n && (
                    <ReviewComposer
                      draft={draft}
                      lines={file.lines}
                      label={labelOfRange(diff, draft.range.start, draft.range.end)}
                      canSuggest={!diff}
                      warning={suggestionWarning(comments, draft)}
                      flash={draft.id !== null && flashId === draft.id}
                      dispatch={dispatch}
                    />
                  )}
                </Fragment>
              )
            })}
          </div>
        </div>

        {sel && !draft && (
          <div className="selbar" role="toolbar" aria-label="Selection actions">
            <span className="selbar-label">{labelOfRange(diff, sel.start, sel.end)}</span>
            <Button variant="primary" size="sm" icon={<IconMessage />} onClick={() => dispatch({ type: 'startDraft' })}>
              Comment <Kbd>C</Kbd>
            </Button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Clear selection"
              title="Clear selection (Esc)"
              onClick={() => dispatch({ type: 'select', selection: null })}
            >
              <IconX />
            </button>
          </div>
        )}
      </div>

      <Ruler
        total={lineCount}
        comments={comments}
        lanes={hasOverlap(lanes) ? lanes : null}
        selection={sel}
        onJump={(line) => scrollerRef.current?.querySelector(`[data-line="${line}"]`)?.scrollIntoView({ block: 'center' })}
      />
    </div>
  )
}

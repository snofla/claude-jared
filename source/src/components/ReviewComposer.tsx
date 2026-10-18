import { useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type KeyboardEvent } from 'react'
import { drawnLines } from '../lib/code-drawing'
import { fieldRows, matchingBracket, overlayRows } from '../lib/code-field'
import { COPY } from '../lib/copy'
import { indentUnit } from '../lib/indent'
import { isApple } from '../lib/markdown-keys'
import { canSaveDraft } from '../lib/review'
import { usePlatform } from '../hooks/usePlatform'
import { useMarkdownKeys } from '../hooks/useMarkdownKeys'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useTabIndent } from '../hooks/useTabIndent'
import { useLastColoured } from '../hooks/useTokens'
import type { Action } from '../state/reducer'
import type { Draft } from '../types'
import { Badge, Button, Card, CardFoot, CardHead, CodeField, LiveStatus, Notice, SegmentedControl, TextField } from '../ui'
import { Markdown } from './Markdown'

interface Props {
  draft: Draft
  lines: string[]
  /** The language of the file that the selected lines are in, for the keys of the suggestion field. */
  language: string
  /** What the selected lines are called: their numbers, or the file and lines they are in a diff. */
  label: string
  /** Whether a suggestion can be started: not on a diff, where there is no file to replace lines of. */
  canSuggest: boolean
  /** What to tell the reviewer when the suggestion overlaps another comment's suggestion (`suggestionWarning`), or `null`. */
  warning: string | null
  /** The comment being edited is pointed at, by a click on its comment bar: the composer takes the place of its card, and flashes as the card does. */
  flash: boolean
  dispatch: Dispatch<Action>
}

/** Inline editor for a new or existing comment, shown under the last selected line. */
export function ReviewComposer({ draft, lines, language, label, canSuggest, warning, flash, dispatch }: Props) {
  const { environment } = usePlatform()
  const rootRef = useRef<HTMLElement>(null)
  const commentRef = useRef<HTMLTextAreaElement>(null)
  const canSave = canSaveDraft(draft, lines)
  const suggestionRows = fieldRows(draft.suggestion)
  // Tab and Enter indent in the suggestion by the file's own unit, read from the lines that the suggestion replaces and then from the whole file.
  const unit = useMemo(() => indentUnit(lines.slice(draft.range.start - 1, draft.range.end), lines), [lines, draft.range.start, draft.range.end])
  const tabKeys = useTabIndent(unit, language)
  // The suggestion is coloured as the file's language while it is typed: the last text that was coloured lends its colours to the lines that did not change,
  // and the bracket that pairs with the one at the caret is marked while the caret is in the field and nothing is selected.
  const coloured = useLastColoured(draft.suggestion, language)
  const [caret, setCaret] = useState<number | null>(null)
  const suggestionLines = useMemo(() => {
    if (draft.suggestion === null) return []
    const pair = caret === null ? null : matchingBracket(draft.suggestion, caret)
    return drawnLines(overlayRows(draft.suggestion, coloured), pair ? [pair.at, pair.match] : [])
  }, [draft.suggestion, coloured, caret])
  const followCaret = (field: HTMLTextAreaElement) => setCaret(field.selectionStart === field.selectionEnd ? field.selectionStart : null)
  const markdownKeys = useMarkdownKeys()
  // No Tab on a touch screen: the keys are left out of the hint there.
  const touch = useMediaQuery('(pointer: coarse)')
  const suggestionHint = touch ? COPY.suggestionReplaces : `${COPY.suggestionReplaces} · ${COPY.suggestionKeys('Tab', 'Esc')}`
  // Write or Preview. The preview is at least as tall as the field it replaces, so that the buttons under it do not move when the view changes.
  const [view, setView] = useState<'write' | 'preview'>('write')
  const [fieldHeight, setFieldHeight] = useState<number | null>(null)
  const mod = useMemo(() => (isApple(typeof navigator === 'undefined' ? '' : (navigator.platform ?? '')) ? '⌘' : 'Ctrl+'), [])
  const showView = (next: 'write' | 'preview') => {
    if (next === 'preview' && commentRef.current) setFieldHeight(commentRef.current.offsetHeight)
    setView(next)
  }

  // Runs when the composer first appears and whenever it re-anchors to a new range.
  useEffect(() => {
    commentRef.current?.focus({ preventScroll: true })
    rootRef.current?.scrollIntoView({ block: 'nearest' })
  }, [])

  const save = () => {
    if (canSave) dispatch({ type: 'saveDraft', id: environment.uid(), now: environment.now() })
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    save()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      dispatch({ type: 'cancelDraft' })
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      save()
    }
  }

  return (
    // While a saved comment is edited its card is not drawn, and the composer is where a press on its comment bar goes (`data-comment`).
    <section className={flash ? 'panel is-flash' : 'panel'} data-comment={draft.id ?? undefined} ref={rootRef} onKeyDown={onKeyDown}>
      <Card as="form" className="composer panel-card" onSubmit={onSubmit}>
        <CardHead className="composer-head">
          <Badge tone="accent">{label}</Badge>
          <span className="muted">{draft.id ? 'Editing comment' : 'Select other lines to change the range'}</span>
        </CardHead>

        <div className="composer-views">
          <SegmentedControl
            label={COPY.commentViews}
            options={[
              { value: 'write', label: COPY.commentWrite },
              { value: 'preview', label: COPY.commentPreview },
            ]}
            value={view}
            onChange={showView}
          />
          <span className="spacer" />
          <span className="muted composer-markdown">{COPY.commentMarkdown}</span>
        </div>

        {/* The field stays in the page while the preview is shown, hidden, so that the browser's undo of what was typed is still there when the view comes back. */}
        <div hidden={view === 'preview'}>
          <TextField
            ref={commentRef}
            className="composer-field"
            label="Comment"
            labelHidden
            placeholder="Leave a comment on these lines…"
            rows={3}
            onKeyDown={markdownKeys}
            value={draft.comment}
            onChange={(e) => dispatch({ type: 'patchDraft', patch: { comment: e.target.value } })}
          />
          <p className="muted composer-caption">{touch ? COPY.writeCaption : `${COPY.writeCaption} ${COPY.writeKeys(mod)}`}</p>
        </div>
        {view === 'preview' && (
          <>
            <div className="composer-preview md" style={fieldHeight === null ? undefined : { minHeight: fieldHeight }}>
              {draft.comment.trim() === '' ? <span className="muted">{COPY.previewEmpty}</span> : <Markdown text={draft.comment} showAddresses />}
            </div>
            <p className="muted composer-caption">{COPY.previewCaption}</p>
          </>
        )}

        {draft.suggestion !== null && (
          <CodeField
            className="suggest"
            label="Suggested implementation"
            hint={suggestionHint}
            autoCorrect="off"
            autoCapitalize="off"
            rows={suggestionRows}
            lines={suggestionLines}
            onKeyDown={tabKeys.onKeyDown}
            onSelect={(e) => followCaret(e.currentTarget)}
            onBlur={() => {
              tabKeys.onBlur()
              setCaret(null)
            }}
            value={draft.suggestion}
            onChange={(e) => {
              dispatch({ type: 'patchDraft', patch: { suggestion: e.target.value } })
              followCaret(e.target)
            }}
          />
        )}

        {/* The live region is in the page and empty before the warning is put in it: a region that arrives holding its text is not always announced. */}
        <LiveStatus>{warning !== null && <Notice tone="warn" className="composer-notice">{warning}</Notice>}</LiveStatus>

        <CardFoot className="composer-foot">
          {(canSuggest || draft.suggestion !== null) && (
            <Button variant="ghost" className="suggestion-toggle" onClick={() => dispatch({ type: 'toggleSuggestion' })}>
              {draft.suggestion === null ? '± Suggest an implementation' : 'Remove suggestion'}
            </Button>
          )}
          <span className="spacer" />
          <span className="muted hint-keys">⌘↵ to save · Esc to cancel</span>
          <Button onClick={() => dispatch({ type: 'cancelDraft' })}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!canSave}>
            {draft.id ? 'Update' : 'Add comment'}
          </Button>
        </CardFoot>
      </Card>
    </section>
  )
}

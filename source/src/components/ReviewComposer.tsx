import { useEffect, useRef, type Dispatch, type FormEvent, type KeyboardEvent } from 'react'
import { canSaveDraft } from '../lib/review'
import { usePlatform } from '../hooks/usePlatform'
import type { Action } from '../state/reducer'
import type { Draft } from '../types'
import { Button } from '../ui'

interface Props {
  draft: Draft
  lines: string[]
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
export function ReviewComposer({ draft, lines, label, canSuggest, warning, flash, dispatch }: Props) {
  const { environment } = usePlatform()
  const rootRef = useRef<HTMLElement>(null)
  const commentRef = useRef<HTMLTextAreaElement>(null)
  const canSave = canSaveDraft(draft, lines)
  const suggestionRows = draft.suggestion === null ? 4 : Math.min(18, Math.max(4, draft.suggestion.split('\n').length + 1))

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
      <form className="card composer" onSubmit={onSubmit}>
        <header className="card-head">
          <span className="chip chip-accent">{label}</span>
          <span className="muted">{draft.id ? 'Editing comment' : 'Select other lines to change the range'}</span>
        </header>

        <textarea
          ref={commentRef}
          className="field"
          aria-label="Comment"
          placeholder="Leave a comment on these lines…"
          rows={3}
          value={draft.comment}
          onChange={(e) => dispatch({ type: 'patchDraft', patch: { comment: e.target.value } })}
        />

        {draft.suggestion !== null && (
          <div className="suggest">
            <label className="suggest-label" htmlFor="suggestion">
              Suggested implementation <span className="muted">replaces the selected lines</span>
            </label>
            <textarea
              id="suggestion"
              className="field field-code"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              rows={suggestionRows}
              value={draft.suggestion}
              onChange={(e) => dispatch({ type: 'patchDraft', patch: { suggestion: e.target.value } })}
            />
          </div>
        )}

        {/* The live region is in the page and empty before the warning is put in it: a region that arrives holding its text is not always announced. */}
        <div className="composer-status" role="status">
          {warning !== null && <p className="notice notice-warn">{warning}</p>}
        </div>

        <footer className="card-foot">
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
        </footer>
      </form>
    </section>
  )
}

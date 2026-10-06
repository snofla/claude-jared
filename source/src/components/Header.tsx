import { buttonLabel, statusOf, type Delivery } from '../lib/delivery'
import { LANGUAGE_OPTIONS } from '../lib/language'
import type { Review, SourceFile } from '../types'
import type { Theme } from '../lib/theme'
import { IconBrand, IconDownload, IconFile, IconPanel, IconSend, IconUpload } from './icons'
import { ThemeButton } from './ThemeButton'

interface Props {
  file: SourceFile
  review: Review
  panelOpen: boolean
  onTogglePanel: () => void
  onHome: () => void
  onOpen: () => void
  onLanguage: (language: string) => void
  /** Opens the dialog. What the button is called, and its icon, follow what takes the review (`delivery`); the default is Export. */
  onSubmit: () => void
  delivery: Delivery | null
  /** The review is with a script that drives the page, which has not taken it yet. */
  handedOver: boolean
  /** When the review was last sent to its delivery; `null` if never (it may still have been exported). */
  sentAt: string | null
  theme: Theme
  onTheme: () => void
}

export function Header({ file, review, panelOpen, onTogglePanel, onHome, onOpen, onLanguage, onSubmit, delivery, handedOver, sentAt, theme, onTheme }: Props) {
  const state = statusOf(review, delivery, handedOver, sentAt)
  const label = buttonLabel(delivery)
  const count = review.comments.length

  return (
    <header className="header">
      <button type="button" className="brand" onClick={onHome} title="Back to start. Your review is saved.">
        <IconBrand /> Jared
      </button>

      <div className="file">
        <IconFile />
        <span className="file-name" title={file.name}>
          {file.name}
        </span>
        <span className="muted file-lines">{file.lines.length.toLocaleString()} lines</span>
      </div>

      <label className="lang">
        <span className="sr-only">Language</span>
        <select value={file.language} onChange={(e) => onLanguage(e.target.value)}>
          {LANGUAGE_OPTIONS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>

      <span className="spacer" />

      <span className={`status-pill tone-${state.tone}`} title={state.text}>
        {state.text}
      </span>

      <button type="button" className="btn" onClick={onOpen}>
        <IconUpload /> <span className="btn-label">Open…</span>
      </button>
      <button
        type="button"
        className={panelOpen ? 'btn is-on' : 'btn'}
        aria-pressed={panelOpen}
        onClick={onTogglePanel}
        title="Toggle comment list"
      >
        <IconPanel /> <span className="count">{count}</span>
      </button>
      <ThemeButton theme={theme} onNext={onTheme} />
      <button type="button" className="btn btn-primary" onClick={onSubmit} title={label} aria-label={label}>
        {delivery ? <IconSend /> : <IconDownload />} <span className="submit-label">{label}</span>
      </button>
    </header>
  )
}

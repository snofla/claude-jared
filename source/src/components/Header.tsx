import { COPY } from '../lib/copy'
import { buttonLabel, statusOf, type Delivery } from '../lib/delivery'
import { LANGUAGE_OPTIONS } from '../lib/language'
import type { Review, SourceFile } from '../types'
import { THEMES, type Theme } from '../lib/theme'
import { Badge, Button, IconBrand, IconDownload, IconFile, IconMore, IconPanel, IconSend, IconUpload, IconX, Menu, MenuGroup, MenuItem, MenuRadioItem, MenuSeparator, Select } from '../ui'
import { Version } from './Version'

/** The tone of a status, as `statusOf` names it, in the words of `Badge`. */
const STATUS_TONE = { ok: 'ok', warn: 'warn', muted: 'neutral' } as const

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
  /** Called when the reviewer presses Cancel review; the page asks first when there is something to lose. */
  onCancel: () => void
  delivery: Delivery | null
  /** The review is with a script that drives the page, which has not taken it yet. */
  handedOver: boolean
  /** When the review was last sent to its delivery; `null` if never (it may still have been exported). */
  sentAt: string | null
  theme: Theme
  /** Called when the reviewer chooses a colour scheme in the menu. */
  onTheme: (theme: Theme) => void
}

export function Header({ file, review, panelOpen, onTogglePanel, onHome, onOpen, onLanguage, onSubmit, onCancel, delivery, handedOver, sentAt, theme, onTheme }: Props) {
  const state = statusOf(review, delivery, handedOver, sentAt)
  const label = buttonLabel(delivery)
  const count = review.comments.length

  return (
    <header className="header">
      <button type="button" className="brand" onClick={onHome} title="Back to start. Your review is saved.">
        <IconBrand /> Jared <Version />
      </button>

      <div className="file">
        <IconFile />
        <span className="file-name" title={file.name}>
          {file.name}
        </span>
        <span className="muted file-lines">{file.lines.length.toLocaleString()} lines</span>
      </div>

      <Select label="Language" labelHidden className="lang-select" value={file.language} onChange={(e) => onLanguage(e.target.value)}>
        {LANGUAGE_OPTIONS.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </Select>

      <span className="spacer" />

      <Badge variant="status" tone={STATUS_TONE[state.tone]} title={state.text}>
        {state.text}
      </Badge>

      <Button icon={<IconPanel />} pressed={panelOpen} onClick={onTogglePanel} title="Toggle comment list">
        <Badge variant="count">{count}</Badge>
      </Button>
      <Menu label={COPY.moreActions} icon={<IconMore />}>
        <MenuItem icon={<IconUpload />} onSelect={onOpen}>
          Open…
        </MenuItem>
        <MenuSeparator />
        <MenuGroup label={COPY.colourScheme}>
          {THEMES.map((choice) => (
            <MenuRadioItem key={choice} checked={theme === choice} onSelect={() => onTheme(choice)}>
              {COPY.themeChoice[choice]}
            </MenuRadioItem>
          ))}
        </MenuGroup>
        <MenuSeparator />
        <MenuItem icon={<IconX />} onSelect={onCancel}>
          {COPY.cancelReview}
        </MenuItem>
      </Menu>
      <Button variant="primary" icon={delivery ? <IconSend /> : <IconDownload />} onClick={onSubmit} title={label} aria-label={label}>
        <span className="submit-label">{label}</span>
      </Button>
    </header>
  )
}

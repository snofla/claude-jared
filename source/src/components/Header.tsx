import { COPY } from '../lib/copy'
import { sendLabel, statusOf, stopWords, type Delivery } from '../lib/delivery'
import { LANGUAGE_OPTIONS } from '../lib/language'
import type { AnyReview, SourceFile } from '../types'
import { THEMES, type Theme } from '../lib/theme'
import { Badge, Button, IconBrand, IconDownload, IconFile, IconMessage, IconMore, IconPanel, IconSend, IconUpload, Menu, MenuGroup, MenuItem, MenuRadioItem, MenuSeparator, Select } from '../ui'
import { Version } from './Version'

/** The width below which the button that stops a review is the first item of the menu of more actions, and not a button of the bar: the bar wraps and has no room for it. */
export const STOP_IN_MENU_QUERY = '(max-width: 599px)'

/** The tone of a status, as `statusOf` names it, in the words of `Badge`. */
const STATUS_TONE = { ok: 'ok', warn: 'warn', muted: 'neutral' } as const

interface Props {
  file: SourceFile
  review: AnyReview
  panelOpen: boolean
  onTogglePanel: () => void
  /**
   * The files of a diff of two files or more, or a set of files: their number, the lines added and removed (`null` for a set of files that is not a diff),
   * the lines in all, and whether the list is shown. `null` when there is no list.
   */
  files: { count: number; added: number | null; deleted: number | null; lines: number; open: boolean; onToggle: () => void } | null
  onHome: () => void
  onOpen: () => void
  onLanguage: (language: string) => void
  /** Presses the button: opens the dialog, or, after a first press, sends the changes at once. What the button is called, and its icon, follow what takes the review (`delivery`); the default is Export. */
  onSubmit: () => void
  /** How many changes the next press will send, once there was a press of a delivery that takes changes; `null` before that and for a delivery that cannot. */
  changes: number | null
  /** Opens the dialog of the summary and the preview, once the button sends at once; `null` when the button opens it itself. */
  onReviewWindow: (() => void) | null
  delivery: Delivery | null
  /** The review is with a script that drives the page, which has not taken it yet. */
  handedOver: boolean
  /** When the review was last sent to its delivery; `null` if never (it may still have been exported). */
  sentAt: string | null
  theme: Theme
  /** Called when the reviewer chooses a colour scheme in the menu. */
  onTheme: (theme: Theme) => void
  /**
   * The button that stops the review, left of the one that sends: "Stop reviewing" while a program waits for the review, "Close file" when nobody does. `inMenu` puts it
   * in the menu of more actions instead, as its first item (a narrow window, `STOP_IN_MENU_QUERY`). Left out, or `null`, the header has no such button.
   */
  stop?: { inMenu: boolean; onStop: () => void } | null
  /** *Reset layout*, the last item of the menu: the panels' usual widths again, and the window decides whether they are open. Left out, the menu has no such item. */
  onResetLayout?: () => void
}

export function Header({ file, review, panelOpen, onTogglePanel, files, onHome, onOpen, onLanguage, onSubmit, changes, onReviewWindow, delivery, handedOver, sentAt, theme, onTheme, stop, onResetLayout }: Props) {
  const state = statusOf(review, handedOver, sentAt)
  const label = sendLabel(delivery, changes)
  const count = review.comments.length
  const stopText = stopWords(delivery, sentAt, review)

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
        {files && files.added !== null && files.deleted !== null ? (
          <span className="muted file-lines" role="img" aria-label={COPY.filesChipName(files.count, files.added, files.deleted)} title={COPY.filesChipName(files.count, files.added, files.deleted)}>
            {COPY.filesChip(files.count, files.added, files.deleted)}
          </span>
        ) : (
          <span className="muted file-lines">{COPY.lineCount(files ? files.lines : file.lines.length)}</span>
        )}
      </div>

      {review.version === 1 && (
        <Select label="Language" labelHidden className="lang-select" value={file.language} onChange={(e) => onLanguage(e.target.value)}>
          {LANGUAGE_OPTIONS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      )}

      <span className="spacer" />

      <Badge variant="status" tone={STATUS_TONE[state.tone]} title={state.text}>
        {state.text}
      </Badge>

      {files && (
        <Button className="files-toggle" icon={<IconPanel />} pressed={files.open} onClick={files.onToggle} title={COPY.filesToggle} aria-label={COPY.files}>
          <span className="files-toggle-label">{COPY.files}</span>
        </Button>
      )}
      <Button icon={<IconPanel />} pressed={panelOpen} onClick={onTogglePanel} title="Toggle comment list">
        <Badge variant="count">{count}</Badge>
      </Button>
      <Menu label={COPY.moreActions} icon={<IconMore />}>
        {stop?.inMenu && (
          <>
            <MenuItem onSelect={stop.onStop}>{stopText.label}</MenuItem>
            <MenuSeparator />
          </>
        )}
        {onReviewWindow && (
          <MenuItem icon={<IconMessage />} onSelect={onReviewWindow}>
            {COPY.reviewWindow}
          </MenuItem>
        )}
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
        {onResetLayout && (
          <>
            <MenuSeparator />
            <MenuItem icon={<IconPanel />} onSelect={onResetLayout}>
              {COPY.resetLayout}
            </MenuItem>
          </>
        )}
      </Menu>
      {stop && !stop.inMenu && (
        <Button onClick={stop.onStop} title={stopText.tip}>
          {stopText.label}
        </Button>
      )}
      <Button variant={changes === 0 ? 'default' : 'primary'} icon={delivery ? <IconSend /> : <IconDownload />} onClick={onSubmit} title={label} aria-label={label}>
        <span className="submit-label">{label}</span>
      </Button>
    </header>
  )
}

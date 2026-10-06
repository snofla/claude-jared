import { themeLabel, type Theme } from '../lib/theme'
import { IconMonitor, IconMoon, IconSun } from './icons'

interface Props {
  theme: Theme
  /** Called when the button is pressed: the page then moves to the next choice (system, light, dark). */
  onNext: () => void
}

/** The colour scheme choice, as one button: its icon is the current choice, and a press gives the next. */
export function ThemeButton({ theme, onNext }: Props) {
  const label = themeLabel(theme)
  return (
    <button type="button" className="btn btn-icon" onClick={onNext} title={label} aria-label={label}>
      {theme === 'light' ? <IconSun /> : theme === 'dark' ? <IconMoon /> : <IconMonitor />}
    </button>
  )
}

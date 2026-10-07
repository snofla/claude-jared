import { themeLabel, type Theme } from '../lib/theme'
import { Button, IconMonitor, IconMoon, IconSun } from '../ui'

interface Props {
  theme: Theme
  /** Called when the button is pressed: the page then moves to the next choice (system, light, dark). */
  onNext: () => void
}

/** The colour scheme choice, as one button: its icon is the current choice, and a press gives the next. */
export function ThemeButton({ theme, onNext }: Props) {
  const label = themeLabel(theme)
  return (
    <Button iconOnly icon={theme === 'light' ? <IconSun /> : theme === 'dark' ? <IconMoon /> : <IconMonitor />} onClick={onNext} title={label} aria-label={label} />
  )
}

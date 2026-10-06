/**
 * The reviewer's choice of colour scheme: follow the system, or always light, or always dark. The colours are all in CSS
 * (`src/styles.css`); a choice of light or dark only sets `data-theme` on `<html>`, which the CSS selects on, and `system` leaves
 * it off so that `prefers-color-scheme` decides.
 */
export type Theme = 'system' | 'light' | 'dark'

export const THEMES: readonly Theme[] = ['system', 'light', 'dark']

/** The `localStorage` key of the choice. `index.html` reads the same key before the first paint, and a test keeps the two equal. */
export const THEME_KEY = 'jared:theme'

/** The stored choice, or `system` for anything else: nothing stored, an old value, one that somebody edited by hand. */
export function parseTheme(value: unknown): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : 'system'
}

/** The choice after the button is pressed: system, light, dark, and round again. */
export function nextTheme(theme: Theme): Theme {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]
}

/** The value of `data-theme` on `<html>` for a choice, or `null` for system, which has no attribute. */
export function themeAttribute(theme: Theme): 'light' | 'dark' | null {
  return theme === 'system' ? null : theme
}

/** What the button says about the choice, for its tooltip and its accessible name. */
export function themeLabel(theme: Theme): string {
  return `Colour scheme: ${theme}. Click for ${nextTheme(theme)}.`
}

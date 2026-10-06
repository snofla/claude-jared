/**
 * The component library's one entrance: the rest of the app imports from here and from nowhere else in this folder, and nothing in
 * this folder imports the rest of the app (the boundaries in `.oxlintrc.json`). What belongs here and how to add a component is in `README.md`.
 * The design tokens come with it: importing the library is what puts them on the page.
 */
import './tokens.css'

export { Button } from './Button.tsx'
export type { ButtonProps, ButtonSize, ButtonVariant } from './Button.tsx'

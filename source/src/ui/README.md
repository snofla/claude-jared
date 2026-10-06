# `src/ui`: the component library

The component library of Jared: the buttons, fields and dialogs that the interface is built from, and the design tokens they are drawn with. It is for the people who build Jared's interface, which today is this one app. It is not a package of its own: nothing outside this repository uses it, and it has no version of its own. Its classes start with `jared-`. Today it holds one component, `Button`, and the design tokens that are not about reviewing code.

Some of what this guide points to (the lint configuration, the tests and the gallery page) is in the repository where Jared is developed, and not in the published copy of the page's source.

This file answers, in order: what belongs here; how to add a component; what a component's interface is; what it promises about accessibility; which states it shows in the gallery; how it is styled; what things are called; what a change costs; how to see and check it; what is known not to work; `Button` as one complete example; and a note on logic.

## What belongs here, and what does not

A component belongs here when **it is used in more than one place, and says nothing about reviewing code.** A button, a field, a card, a dialog: yes. The code viewer, a line of code, the ruler, the comments panel, the header, the landing page: no, they are about reviewing code and stay in `src/components`. When in doubt, ask whether a second app that shows something else could use it as it is.

Four lint rules keep the folder apart from the app (`.oxlintrc.json`; `npm run lint` fails on a break):

- **Nothing in `src/ui` imports the rest of the app** (`lib`, `state`, `engine`, `components`, `hooks`, `types`, `App`, or the app's stylesheet). The message is *"src/ui is the component library: it may not import from the rest of the app"*. So no file here may be named `types*` or `styles*`, or sit in a folder called `lib`, `state`, `engine`, `components` or `hooks`: the rule matches names.
- **The app imports the library through `src/ui/index.ts` only**, as `from '../ui'` (or `'./ui'`), never `from '../ui/Button'`, never `from '../ui/index.ts'` and never from a folder inside it. The message is *"Import the component library through its one entrance"*. It covers `src/components` and `src/App.tsx`.
- **The layers below the components do not import the library**: `lib`, `state`, `engine`, `hooks` and `types.ts`. The message is *"The component library is below the components"*.
- **A script in `scripts/` imports none of the user interface**: no hook, state, component, library, `App`, `main` or stylesheet, and no React or part of it (`react-dom/client` too). It may still *read* them as text with `readFileSync`, as `scripts/theme.test.ts` does.

## Adding a component

1. `src/ui/<Name>.tsx`: a function component, props only.
2. `src/ui/<name>.css`, imported by the component, with the class family `jared-<short name>` (`jared-btn` for `Button`: the short name that the app has always used) and one class per variant, `jared-<short name>-<variant>`.
3. Export it, and its prop types, from `src/ui/index.ts`.
4. Add every state to `src/gallery.tsx` (see *States in the gallery*).
5. A test, `src/ui/<Name>.test.ts`, if the component has logic (a guard, a choice of class, a rule about its props). `Button.test.ts` calls the component as a function and reads the props of the element it returns; no browser is needed.
6. Move the uses of the old class family to the component (`git grep` for the class), taking the computed-style snapshot before and after (see *Seeing and checking it*).
7. If the structure changed (a layer, a boundary, a folder), update the description of how the app is put together, and record the change where the project records its work.

## What a component's interface is

- **Props only.** No engine, storage, `window` or `document` inside a component, and no import from the app (the lint rule above). A component that needs the clock, a file or the platform is not a library component.
- **Every string is a prop.** The library holds no English, so a component has no default text: the caller passes the label, the title, the accessible name. (This is also what makes localisation possible.)
- **A plural or a format is the caller's.** The caller builds "3 comments" or "10:42" (with `Intl`) and passes the finished string.
- **Ids and names come from `useId`**, never written in the markup, so that two instances do not collide.
- **`className` is for layout** (a place in a row, a container query) and never for the look: the look is a variant or a size.
- A button's `type` is `button` unless the caller says `submit`, so that a button in a form does not submit by accident.

## Accessibility

What follows can be checked, and each line says where. It is the least a component promises.

- **An accessible name.** A button's name is its text. An icon-only button has no text, so its type requires `aria-label` (`Button.test.ts` holds two lines that `tsc` must reject; `npm run build` runs `tsc`).
- **`aria-disabled`, not `disabled`, while an action is under way.** A disabled button drops the keyboard focus. A busy `Button` is `aria-disabled`, keeps the focus, ignores a click and the keys, and stops a submit (`busy`; tested in `Button.test.ts`, and shown in the gallery, where the counter of the busy buttons stays at 0). `disabled` is for a button that cannot be used yet.
- **Keys and focus.** The component is a native element, so it has its keys (Enter and Space for a button). A visible focus ring comes with `:focus-visible`: 2 px in `--accent`, 6.06:1 or more on the surface in both schemes.
- **Roles.** A native element where there is one. A toggle is `aria-pressed`, drawn from the attribute and from nothing else. A component invents no role.
- **Touch.** Under `(pointer: coarse)` every button is 44 px high, the icon-only square 44 px wide, written once in `button.css`. WCAG 2.5.8 asks for 24 px.
- **Contrast.** The label of every `Button` is 4.5:1 or more on its own background, resting, in light and in dark (each pair below is light, then dark): default 16.18 and 15.37, primary 6.29 and 6.49, ghost and icon-only 5.83 and 5.90, pressed 13.93 and 12.61. They are pinned in `scripts/theme.test.ts`, worked out from the design tokens, so a change to a design token that changes one fails the test. **One does not meet it, in dark:** the white label of the danger button on `--danger` is 2.52:1 in dark (5.36:1 in light), as it was before the library; a later change gives it a design token of its own. The edge of a default button, `--border-strong`, is 1.68:1 in light and 1.82:1 in dark on the surface: the label is what identifies the button, as the comment on `--field-border` in `tokens.css` says.
- **`Alert` and `Notice`** (not built yet) are two different things. An `Alert` is announced the moment it appears (`role="alert"`, with a dismiss button); a `Notice` is a message in the page that is not (no role). Take the one that says what the situation needs.

## States in the gallery

`gallery.html` shows every component in every state, the light scheme and the dark one side by side. It is a page of the dev server only: the production build does not include it. The states a component has, where it has them: **default, hover, focus-visible, active, disabled or busy, selected (on) and error**, in both schemes. Check it at 375 px as well. Hover, focus and press cannot be held still on a page, so the gallery has the real component to hover, tab to and press; the other states are shown.

## Styling

- **The prefix is `jared-`**, and each component has one family of classes: `jared-btn`, `jared-btn-primary`. The class is the component's own, not an API: a host does not write rules for it.
- **Colours are design tokens, and only design tokens**, each `light-dark(light, dark)` in `tokens.css`. A new colour needs both values (`scripts/theme.test.ts` reads every CSS file under `src` and fails without them). There is no `prefers-color-scheme` anywhere: the reviewer's switch sets `data-theme` on `<html>`, and `light-dark()` follows it.
- **Sizes are raw numbers today** (radii, font sizes, gaps, heights), and so is the white of the danger button: a scale for them is planned, and they move onto it when it is built.
- **No `!important`.**
- **A host changes the look with the design tokens**: set them on `:root` or on any ancestor. The library needs nothing else from the page: `index.ts` brings `tokens.css` with it, and a button sets its own box model, font, cursor and focus ring.

## Names

- **A component** is a PascalCase noun, `Button`, in `Button.tsx` with its rules in `button.css`.
- **Props** say what the caller means, not how it looks: `variant` (default, primary, ghost, danger), `size` (`md`, `sm`), `pressed` (a toggle that is on or off), `busy` (an action is under way), `icon`, `iconOnly`. A boolean is an adjective. A state is an ARIA attribute and never a class.
- **A design token** that is not a colour is named `--<kind>-<name>`, where the kind says what it holds (`--radius-md`, `--space-8`, `--font-size-md`, `--control-height-md`); a colour has no kind word and is named for its role (`--surface`, `--accent`). Five older design tokens keep their names, which do not follow this rule (`--mono`, `--sans`, `--gutter-w`, `--row-h`, `--shadow`). Today the sizes are still raw numbers, and a scale built on this rule is planned.
- **Glossary.** A **design token** is a named value that the interface takes its look from, written once as a CSS custom property (`--surface`). Always say *design token*, never *token* alone: a *syntax token* is a piece of code that Shiki colours, and a receiver has a secret that is also called a token. `Alert` and `Notice` are the two messages above.

## Changing a component

- **A breaking change** is one that makes a caller change what it writes (a prop renamed or removed, a variant, a changed default) or that changes how an existing use looks beyond what the change set out to do.
- **Who agrees:** whoever maintains the repository decides. A change is designed, its code is reviewed before it is merged, and it is recorded where the project records its work.
- **Find the users:** `git grep -n "<Button" -- src` for a component, `git grep -n "jared-btn" -- src` for its class.
- **Record it** where the project records its work, with the snapshot (below) and its expected differences.

## Seeing and checking it

- **The gallery:** `npm run dev`, then `http://localhost:5173/gallery.html`.
- **The lint boundary:** `npm run lint`.
- **The tests:** `npm test` runs `src/ui/*.test.ts` and `scripts/theme.test.ts`.
- **By hand, until components have tests:** a **computed-style snapshot** of every instance of a moved class (colour, background, border, radius, size, padding, font), taken in the browser before the move and after it, in both schemes and at 375 px, on `npm run dev` and on `npm run build` with `vite preview`, whose difference is empty or explained where the change is recorded. It was done for `Button`. And the tab order and the accessible names, read from the page.

## Known not to work

- **Only Chromium has seen it** (the browser pane). Safari and Firefox have not been tried.
- **The gallery is for the dev server only.** The production build rewrites `light-dark()` into custom-property toggles that are resolved once, on the root, so two columns could not show two schemes there, and the build does not include the gallery. On the dev server `light-dark()` needs a recent browser.
- **A toggle that is on looks like any hovered button while the mouse is over it:** the hover rule is more specific than the pressed one. It was so before the library.
- **The danger button's label in dark is under 4.5:1** (above).
- **`SubmitDialog` still draws its buttons with the old `btn` rules** in `src/styles.css`, until it moves to the library.

## `Button`, and why

`import { Button } from '../ui'`. A button with a label, an icon and a label, or an icon alone.

| Decision | Why |
|---|---|
| `variant` is `default`, `primary`, `ghost` or `danger`; `size` is `md` or `sm` | The five looks that the app drew with the `btn` family, as it used them. |
| `pressed` draws and announces a toggle through `aria-pressed`; the look is `.jared-btn[aria-pressed='true']` | The panel toggle in the header drew a class and an attribute separately. One source cannot drift from itself. |
| `busy` is `aria-disabled`, ignores the click, and prevents the default | A disabled button drops the focus, and a focusable button is still pressed by the keyboard, which `pointer-events: none` does not stop. The guard is here once, as `run()` had it in the dialog, and it stops a submit button too. |
| `type` is `button` unless given | A button in a form must not submit by accident. |
| `iconOnly` needs `aria-label`, and is `default` or `ghost` | No text, so no name unless the type asks. The icon takes the muted colour of its own rule, which would not read on the primary or the danger button. |
| `icon` comes before the label, and the space between them is `gap`, not text | The old markup put a space character between them, which a flex row does not draw. |
| `className` is added after the library's, for layout | The suggestion button in a narrow card takes the full width of the card; it says so with its own class and not with the library's. |
| The component imports no helper from the app, and joins its classes itself | The boundary: nothing here imports `lib`. |
| 44 px under `(pointer: coarse)`, in `button.css` | A finger needs about 44 px; written once. |
| Sizes and the white of the danger label are raw | A scale for them is planned. |

## Logic

A `.ts` file with logic in `src/ui` needs its folder in the coverage `include` list of `vite.config.ts`, in the same commit: a new file in a measured folder without tests fails the floor (`npm run coverage`). Logic that a library component should not have goes to `src/lib`, and the caller hands the library its result. `Button`'s guard is in `Button.tsx`, which is not measured, and `Button.test.ts` calls it.

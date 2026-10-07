# `src/ui`: the component library

The component library of Jared: the buttons, fields and dialogs that the interface is built from, and the design tokens they are drawn with. It is for the people who build Jared's interface, which today is this one app. It is not a package of its own: nothing outside this repository uses it, and it has no version of its own. Its classes start with `jared-`. Today it holds `Alert`, `Badge`, `Button`, `Card`, `Dialog`, `Disclosure`, `FloatingToolbar`, `IconButton`, `Kbd`, `LinkButton`, `LiveStatus`, `Notice`, `SegmentedControl`, `Select` and `TextField`, the sixteen icons, and the design tokens that are not about reviewing code.

Some of what this guide points to (the lint configuration, the tests and the gallery page) is in the repository where Jared is developed, and not in the published copy of the page's source.

This file answers, in order: what is in it; what belongs here; how to add a component; what a component's interface is; what it promises about accessibility; which states it shows in the gallery; how it is styled; the scale of sizes; what things are called; what a change costs; how to see and check it; what is known not to work; `Button` as one complete example; and a note on logic.

## What is in it

| Component | What it is | Its props, besides the native ones |
|---|---|---|
| `Alert` | A message across the page that is announced as it arrives, with an optional cross to dismiss it. | `tone` (`warn`, `error` or `ok`), `icon`, `role`, `onDismiss` with `dismissLabel` (the cross's name) |
| `Badge` | A small label in a pill: a chip, a status or a count. | `variant` (`chip`, `status` or `count`), `tone` (`neutral`, `accent` or `ok` for a chip; `neutral`, `ok` or `warn` for a status) |
| `Button` | A button: default, primary, ghost, danger, small, with an icon, or an icon alone; it can be a toggle, or busy. | `variant`, `size`, `pressed`, `busy`, `icon`, `iconOnly` (then `aria-label` is required) |
| `Card` | A box with a border and a soft shadow, in three optional parts: `CardHead`, `CardBody` (the words) and `CardFoot`. An article, or a form when it is told to be. | `as` (`article` or `form`) |
| `Dialog`, `DialogFoot` | A modal on the browser's own `dialog`: a heading, a cross, an optional line of quiet words under the heading, and the caller's content. `DialogFoot` is its foot, a row for a status and the buttons that stays at the bottom, under a hairline, when the content is taller than the screen. It is shown as a modal the moment it is drawn, and every way out ends in the dialog's `close` event. | `title` and `closeLabel` (required: its name, and the cross's name), `subtitle`, `closeTitle` (the cross's tooltip), `modal` (`false` leaves it open in the flow of the page, for the gallery), `ref` (the element) |
| `Disclosure` | A group of controls that is closed until it is needed, kept quiet under a hairline: the browser's own `details`. | `summary` (required), `onToggle` (told whether it is open), `open` |
| `FloatingToolbar` | A row of controls in a pill, for a bar that floats over something. It is a toolbar and is named by its label; where it floats is the caller's. | `label` (required: its accessible name) |
| `IconButton` | A flat icon button for a bar or the head of a card: 28 px square, and 44 px where the pointer is a finger. For a bordered icon button among other buttons, use `Button` with `iconOnly`. | `label` (required: its accessible name), `icon` |
| The icons | The sixteen icons of the app (`IconPlus`, `IconX`, `IconTrash` and the rest, all in the gallery), each a decorative `svg`. | `size` (only `IconUpload` takes it) |
| `Kbd` | The name of a key, drawn in a box, such as `C` or `Esc`. | none |
| `LinkButton` | An action that reads as a link in a line of text. It is a button: it does something on this page. | none |
| `LiveStatus` | A region that is announced politely when its text changes. | none |
| `Notice` | A message in the page, in a box, that is not announced by itself. | `tone` (`info` or `warn`; both are drawn the same today) |
| `SegmentedControl` | A choice of a few, one at a time, as a row of words in a box. A radio group, and the choice that is on is drawn from the radio's own checked state. | `label` (required: the group's name), `options` (each a `value` and a `label`), `value`, `onChange` |
| `Select` | A native select, with a label that names it. | `label` (required), `labelHidden` |
| `TextField` | A text area with a label and an optional hint, in a plain or a code variant. It makes its own `id`. | `label` (required), `labelHidden`, `labelStyle` (`caps`, the default, or `plain`: bold words in the text colour, with the hint at the end of the row, as in a dialog), `hint`, `variant` (`text` or `code`) |

Every component takes `className`, for layout only: the look is the component's. It goes to the one element the component draws, except for `TextField`, where it goes to the box around the label and the field, and `Select`, where it goes to the `select` inside its label.

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

- **An accessible name.** A button's name is its text. An icon-only button has no text, so its type requires a name: `aria-label` for `Button` with `iconOnly`, `label` for `IconButton`. A `FloatingToolbar` holds controls and has no text of its own, so its type requires a `label` too. (`Button.test.ts` holds two lines that `tsc` must reject; `npm run build` runs `tsc`.)
- **`aria-disabled`, not `disabled`, while an action is under way.** A disabled button drops the keyboard focus. A busy `Button` is `aria-disabled`, keeps the focus, ignores a click and the keys, and stops a submit (`busy`; tested in `Button.test.ts`, and shown in the gallery, where the counter of the busy buttons stays at 0). `disabled` is for a button that cannot be used yet.
- **A dialog is named, and takes the focus to its name.** A `Dialog` requires a `title`, which names the `dialog` (`aria-labelledby`), and a `closeLabel`, which names its cross. It opens as a modal, so the rest of the page is inert and Escape closes it, and the browser puts the focus back on what opened it. The focus goes to the heading, which can take the focus without being in the tab order, and not to the first field, so that a phone does not raise its keyboard over words that have not been read. A dialog left in the flow of the page (`modal={false}`) takes nothing from the page. (`primitives.test.tsx` holds the names and the attributes; the focus and the ways out are checked by hand, see *Known not to work*.)
- **A choice is a radio group.** `SegmentedControl` is a `radiogroup` named by its `label`, whose radios are visually hidden and not removed: the arrow keys move the choice, a screen reader reads each, and the radio that has the focus shows it with a ring on its word. The radios share a name that comes from `useId`.
- **A field is named.** `TextField` and `Select` require `label`: it is the field's name for a screen reader. It is drawn above the field, or, with `labelHidden`, not drawn, when the page already names the field to the eye. A hint is part of the label, so it is read with it.
- **A live region is in the page before its text.** `LiveStatus` is always rendered, empty when there is nothing to say, because a region that arrives already holding its text is not always announced. A `Notice` has no role of its own: put one in a `LiveStatus` when it must be heard.
- **Keys and focus.** The component is a native element, so it has its keys (Enter and Space for a button). A visible focus ring comes with `:focus-visible`: 2 px in `--accent`, 6.06:1 or more on the surface in both schemes.
- **Roles.** A native element where there is one. A toggle is `aria-pressed`, drawn from the attribute and from nothing else. A component invents no role: `Alert` (`alert` or `status`), `LiveStatus` (`status`), `FloatingToolbar` (`toolbar`) and `SegmentedControl` (`radiogroup`) set the standard roles of what they are, and `Dialog` and `Disclosure` are the browser's own `dialog` and `details`.
- **Touch.** Under `(pointer: coarse)` every button is 44 px high, the icon-only square 44 px wide, written once in `button.css`, and the `IconButton` is 44 px square, written once in `icon-button.css`; the cross of a `Dialog` is one. WCAG 2.5.8 asks for 24 px; a `SegmentedControl` and a `Disclosure` are the exceptions (see *Known not to work*).
- **Contrast.** The label of every `Button` is 4.5:1 or more on its own background, resting, in light and in dark (each pair below is light, then dark): default 16.18 and 15.37, primary 6.29 and 6.49, ghost and icon-only 5.83 and 5.90, pressed 13.93 and 12.61, danger 5.36 and 7.71 (its label is `--danger-fg`, which is dark in the dark scheme: white on that red would be 2.52:1). They are pinned in `scripts/theme.test.ts`, worked out from the design tokens, so a change to a design token that changes one fails the test. The edge of a default button, `--border-strong`, is 1.68:1 in light and 1.82:1 in dark on the surface: the label is what identifies the button, as the comment on `--field-border` in `tokens.css` says.
- **Contrast of the badges and alerts.** The words of every tone of `Badge` and `Alert` are 4.5:1 or more on the background each is drawn on, in light and in dark, and `scripts/theme.test.ts` pins both the ratios and the design tokens that `badge.css` and `alert.css` draw them with.
- **Contrast of the dialog and what is in it.** On the dialog's surface, in light and in dark: its heading and text 16.18 and 15.37, the quiet words (the subtitle, a disclosure's summary, a choice that is off and the hint of a plain label) 5.83 and 5.90, the choice that is on, in the accent on its soft tint, 5.41 and 4.97, and the ring that the keys draw round a choice, in the accent, 6.29 and 6.06 on the surface (WCAG 1.4.11 asks for 3:1 for the parts of a control). `scripts/theme.test.ts` pins both the ratios and the design tokens that `dialog.css`, `segmented-control.css`, `disclosure.css` and `text-field.css` draw them with.
- **`Alert` and `Notice`** are two different things. An `Alert` announces its words when they arrive (`role="alert"` for `warn` and `error`, `role="status"` for `ok`), in a region that is in the page before them, with a dismiss button outside the region, so that it is not read with the message; a `Notice` is a message in the page that is not (no role). Take the one that says what the situation needs.

## States in the gallery

`gallery.html` shows every component in every state, the light scheme and the dark one side by side. It is a page of the dev server only: the production build does not include it. The states a component has, where it has them: **default, hover, focus-visible, active, disabled or busy, selected (on) and error**, in both schemes. Check it at 375 px as well. Hover, focus and press cannot be held still on a page, so the gallery has the real component to hover, tab to and press; the other states are shown.

## Styling

- **The prefix is `jared-`**, and each component has one family of classes: `jared-btn`, `jared-btn-primary`. The class is the component's own, not an API: a host does not write rules for it.
- **Colours are design tokens, and only design tokens**, each `light-dark(light, dark)` in `tokens.css`. A new colour needs both values (`scripts/theme.test.ts` reads every CSS file under `src` and fails without them). There is no `prefers-color-scheme` anywhere: the reviewer's switch sets `data-theme` on `<html>`, and `light-dark()` follows it.
- **Sizes are steps of the scale** (radii, type sizes, space, heights), from `tokens.css`: see *The scale*. A raw size needs a reason on the same line, and a test refuses one without it.
- **No `!important`.**
- **The app's stylesheet is loaded after the library's.** A layout class that the app passes in (`composer-head`, `selbar`) wins over a rule of the component at the same specificity only because `src/main.tsx` and `src/gallery.tsx` import `./ui` before `./styles.css`. `scripts/theme.test.ts` fails if either file changes that order.
- **A host changes the look with the design tokens**: set them on `:root` or on any ancestor. The library needs nothing else from the page: `index.ts` brings `tokens.css` with it, and a button sets its own box model, font, cursor and focus ring.

## The scale

The sizes that a component draws with are design tokens too, in `tokens.css`. Use these steps and write no raw number. If none fits, add a step to the scale: never change an old one, because every component that uses it would change with it.

| Kind | Steps |
|---|---|
| Radius | `--radius-xs` 4, `-sm` 6, `-md` 8, `-lg` 10, `-xl` 14 and `--radius-pill` 999 px |
| Type size | `--font-size-xs` 12, `-sm` 13, `-md` 14 (the page's text), `-lg` 16 and `-xl` 18 px |
| Space (gap, padding, margin) | `--space-2`, `-4`, `-6`, `-8`, `-10`, `-12`, `-14`, `-16` and `-20`, each named for its length in px |
| Height of a control | `--control-height-sm` 28, `-md` 32 and `-lg` 44 px (`-lg` is the size for a finger, which a control takes under `(pointer: coarse)`) |
| Height of a badge | `--badge-height-sm` 20 and `-md` 24 px |

- **Arithmetic is written out:** `calc(var(--space-2) * 2)`. There is no step for a multiple.
- **A name with a kind word is a length** and has no light and dark value; every other name is a colour and has both, but for the five older names below. `scripts/theme.test.ts` checks both, and that `--space-8` is 8 px.
- **The guard.** In the CSS files of this folder, `scripts/theme.test.ts` fails a radius, type size, gap, height, padding or margin that is a number with a unit (`px`, `rem`, `em`, `vw`, `vh`, `ch` or `pt`) and is not inside `var(...)`. A raw size is allowed when a comment on its line begins `raw:` and gives the reason, as in `padding: 0 9px; /* raw: a layout number, not a step */`; a `raw:` comment with no reason fails too. What the guard cannot see is under *Known not to work*.
- **Not on the scale:** the families (`--mono`, `--sans`), the shadow (`--shadow`) and the two sizes of the code viewer (`--gutter-w`, `--row-h`) keep their older names.

## Names

- **A component** is a PascalCase noun, `Button`, in `Button.tsx` with its rules in `button.css`.
- **Props** say what the caller means, not how it looks: `variant` (default, primary, ghost, danger for a button; chip, status, count for a badge), `size` (`md`, `sm`), `pressed` (a toggle that is on or off), `busy` (an action is under way), `icon`, `iconOnly`, `tone` (the kind of a label or a message: `neutral`, `accent`, `info`, `ok`, `warn` or `error`; each component takes some of them), `label` (an icon button's accessible name). A boolean is an adjective. A state is an ARIA attribute and never a class.
- **A design token** that is not a colour is named `--<kind>-<name>`, where the kind says what it holds (`--radius-md`, `--space-8`, `--font-size-md`, `--control-height-md`); a colour has no kind word and is named for its role (`--surface`, `--accent`). Five older design tokens keep their names, which do not follow this rule (`--mono`, `--sans`, `--gutter-w`, `--row-h`, `--shadow`).
- **Glossary.** A **design token** is a named value that the interface takes its look from, written once as a CSS custom property. The kind word in a design token's name says what it holds (`--radius-md` a radius, `--font-size-md` a type size, `--space-8` a space of 8 px); a colour has no kind word (`--accent`, `--text`). Always say *design token*, never *token* alone: a *syntax token* is a piece of code that Shiki colours, and a receiver has a secret that is also called a token. `Alert` and `Notice` are the two messages above.

## Changing a component

- **A breaking change** is one that makes a caller change what it writes (a prop renamed or removed, a variant, a changed default) or that changes how an existing use looks beyond what the change set out to do.
- **Who agrees:** whoever maintains the repository decides. A change is designed, its code is reviewed before it is merged, and it is recorded where the project records its work.
- **Find the users:** `git grep -n "<Button" -- src` for a component, `git grep -n "jared-btn" -- src` for its class.
- **Record it** where the project records its work, with the snapshot (below) and its expected differences.

## Seeing and checking it

- **The gallery:** `npm run dev`, then `http://localhost:5173/gallery.html`.
- **The lint boundary:** `npm run lint`.
- **The tests:** `npm test` runs `src/ui/*.test.ts` and `scripts/theme.test.ts`.
- **By hand, until components have tests:** a **computed-style snapshot** of every instance of a moved class (colour, background, border, radius, size, padding, font), taken in the browser before the move and after it, in both schemes and at 375 px, on `npm run dev` and on `npm run build` with `vite preview`, whose difference is empty or explained where the change is recorded. It was done for `Button`, and for the dialog when it moved to the library (every state of it, both schemes, 800 px and 375 px: the only difference is the cross, 44 px under a finger as every icon button is, which makes the dialog 16 px taller on touch). And the tab order and the accessible names, read from the page.

## Known not to work

- **Only Chromium has seen it** (the browser pane). Safari and Firefox have not been tried.
- **The gallery is for the dev server only.** The production build rewrites `light-dark()` into custom-property toggles that are resolved once, on the root, so two columns could not show two schemes there, and the build does not include the gallery. On the dev server `light-dark()` needs a recent browser.
- **The focus and the ways out of a `Dialog` have no unit test.** That it is shown as a modal, that the focus goes to the heading, and that Escape, the cross, a press on the backdrop and the caller's own `close()` each end in the dialog's `close` event: they are done in an effect and by the browser's `dialog`, and the library has no test that draws a DOM yet (whether components get tests is an open question). They were checked by hand in the browser pane, and the gallery has a modal to try them on.
- **The choice that is on in a `SegmentedControl` is drawn with `:has()`**, from the checked radio, so it needs Chrome 105, Safari 15.4 or Firefox 121 (December 2023), or later. A caller cannot set the look by a class: the choice that is on is the `value`.
- **A choice of a `SegmentedControl` and the summary of a `Disclosure` are under 24 px high under a finger**, at 23.5 px and 19.5 px (measured at 375 px wide). WCAG 2.5.8 asks for 24 px, so neither meets it; `Button` and `IconButton` grow to 44 px there, and these two do not. Nothing makes them larger under a finger yet.
- **There are two icon-only buttons.** The flat `IconButton` (bars, the heads of cards, a list) and the bordered `Button` with `iconOnly` (the colour scheme switch) are two looks that the app already had. Whether they should be one look is a design question that is still open.
- **No field shows an error yet.** Nothing in the app shows one, so `TextField` and `Select` have no invalid state; the first field that needs one adds it, with its place in the gallery.
- **Both tones of `Notice` look the same.** `info` and `warn` are both drawn in the warning colours, as the old `notice` rule was, until the design gives `info` a look of its own.
- **A `FloatingToolbar` has the role `toolbar` and not the arrow-key movement of that pattern:** its controls are all in the tab order. It was so for the selection bar before the library.
- **The guard against raw sizes reads one line at a time.** It wants one declaration to a line and the braces of a rule on lines of their own (`.a { height: 32px; }` fails for that reason alone), it does not see a raw fallback inside `var()`, as in `var(--space-6, 8px)`, and it looks only at radius, type size, gap, height, padding and margin: a `width` or a `border` can still be raw.

## `Button`, and why

`import { Button } from '../ui'`. A button with a label, an icon and a label, or an icon alone.

| Decision | Why |
|---|---|
| `variant` is `default`, `primary`, `ghost` or `danger`; `size` is `md` or `sm` | The five looks that the app drew with the `btn` family, as it used them. |
| `pressed` draws and announces a toggle through `aria-pressed`; the look is `.jared-btn[aria-pressed='true']` | The panel toggle in the header drew a class and an attribute separately. One source cannot drift from itself. A toggle that is on keeps its look under the pointer, and only its border thickens (`.jared-btn[aria-pressed='true']:hover:not(:disabled)`). |
| `busy` is `aria-disabled`, ignores the click, and prevents the default | A disabled button drops the focus, and a focusable button is still pressed by the keyboard, which `pointer-events: none` does not stop. The guard is here once, as `run()` had it in the dialog, and it stops a submit button too. |
| `type` is `button` unless given | A button in a form must not submit by accident. |
| `iconOnly` needs `aria-label`, and is `default` or `ghost` | No text, so no name unless the type asks. The icon takes the muted colour of its own rule, which would not read on the primary or the danger button. |
| `icon` comes before the label, and the space between them is `gap`, not text | The old markup put a space character between them, which a flex row does not draw. |
| `className` is added after the library's, for layout | The suggestion button in a narrow card takes the full width of the card; it says so with its own class and not with the library's. |
| The component imports no helper from the app, and joins its classes itself | The boundary: nothing here imports `lib`. |
| `--control-height-lg` under `(pointer: coarse)`, in `button.css` | A finger needs about 44 px; written once. |
| Sizes are steps of the scale; the small button's padding of 9 px is raw, with its reason on the line | 9 px is a layout number that is not a step. It shows the guard on a real component. |
| The danger label is `--danger-fg` | White on the dark red is 2.52:1, so the label is dark in the dark scheme (7.71:1) and white in the light one (5.36:1). |

## Logic

A `.ts` file with logic in `src/ui` needs its folder in the coverage `include` list of `vite.config.ts`, in the same commit: a new file in a measured folder without tests fails the floor (`npm run coverage`). Logic that a library component should not have goes to `src/lib`, and the caller hands the library its result. `Button`'s guard is in `Button.tsx`, which is not measured, and `Button.test.ts` calls it.

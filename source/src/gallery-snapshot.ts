/**
 * The gallery's snapshot view, for the tests of the interface that run on request. `gallery.html?only=<group>` draws one group of the gallery, in both
 * schemes, for its picture; `gallery.html?snapshot=styles` writes the computed styles of every element of every group that is drawn into the page, as JSON,
 * where a headless browser reads them (`--dump-dom`). A group is named by its component and the first words of its title, as `button-variants`.
 *
 * Each element is one line: its place in the group, its tag and classes and its own words, and what it looks like (its size, colour, background, border,
 * radius, padding, font, shadow and opacity). A value that is the property's initial one is left out, and so are the colour and the font when they are
 * the parent's, so that a change shows on the element that it was made to and not on every element that inherits it.
 */

const TITLE_WORDS = 4

/** A name for a URL and a file: lower case, words joined by `-`. */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** The name of a group: its component and the first words of its title. */
export function groupName(component: string, title: string): string {
  return slug(`${component} ${title.split(/\s+/).slice(0, TITLE_WORDS).join(' ')}`)
}

interface Group {
  name: string
  heading: HTMLElement | null
  section: HTMLElement
}

/** The groups of one scheme's column, in order, each with the heading of its component; a name that comes twice gets `-2`, `-3`. */
function groupsOf(column: Element): Group[] {
  const groups: Group[] = []
  const seen = new Map<string, number>()
  let heading: HTMLElement | null = null
  for (const child of Array.from(column.children)) {
    if (!(child instanceof HTMLElement)) continue
    if (child.matches('h3.gallery-component')) heading = child
    if (!child.matches('section.gallery-group')) continue
    const base = groupName(heading?.textContent ?? '', child.querySelector('h3')?.textContent ?? '')
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    groups.push({ name: count === 1 ? base : `${base}-${count}`, heading, section: child })
  }
  return groups
}

const INITIAL: Record<string, string> = {
  'background-color': 'rgba(0, 0, 0, 0)',
  'border-radius': '0px',
  padding: '0px',
  'box-shadow': 'none',
  opacity: '1',
}

const INHERITED = ['color', 'font-family', 'font-size', 'font-weight', 'line-height']

const SIDES = ['top', 'right', 'bottom', 'left'] as const

function px(value: number): string {
  return String(Math.round(value * 10) / 10)
}

/** The border as one value when its four sides are the same, else each side; nothing when there is none. */
function border(style: CSSStyleDeclaration): string[] {
  const sides = SIDES.map((side) => {
    const width = style.getPropertyValue(`border-${side}-width`)
    const kind = style.getPropertyValue(`border-${side}-style`)
    return kind === 'none' || width === '0px' ? 'none' : `${width} ${kind} ${style.getPropertyValue(`border-${side}-color`)}`
  })
  if (sides.every((side) => side === sides[0])) return sides[0] === 'none' ? [] : [`border: ${sides[0]}`]
  return SIDES.flatMap((side, i) => (sides[i] === 'none' ? [] : [`border-${side}: ${sides[i]}`]))
}

/** What one element looks like, as `name: value` pairs. */
function looks(element: Element, parent: Element | null): string {
  const style = getComputedStyle(element)
  const above = parent ? getComputedStyle(parent) : null
  const box = element.getBoundingClientRect()
  if (element.getClientRects().length === 0) return 'not drawn'
  const parts = [`size: ${px(box.width)}×${px(box.height)}`]
  for (const name of INHERITED) {
    const value = style.getPropertyValue(name)
    if (!above || above.getPropertyValue(name) !== value) parts.push(`${name}: ${value}`)
  }
  parts.push(...border(style))
  for (const [name, initial] of Object.entries(INITIAL)) {
    const value = style.getPropertyValue(name)
    if (value !== initial) parts.push(`${name}: ${value}`)
  }
  return parts.join('; ')
}

/** The element's own words, the text directly in it, cut short. */
function ownWords(element: Element): string {
  const words = Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  return words.length > 40 ? `${words.slice(0, 39)}…` : words
}

function label(element: Element, place: string): string {
  const classes = Array.from(element.classList).map((name) => `.${name}`).join('')
  const words = ownWords(element)
  return `${place} ${element.tagName.toLowerCase()}${classes}${words ? ` “${words}”` : ''}`
}

/** Every element under the group's row, an SVG as one element, keyed by its place, as `2.1` for the first child of the second. */
function stylesOf(section: Element): Record<string, string> {
  const out: Record<string, string> = {}
  const row = section.querySelector(':scope > .gallery-row')
  if (!row) return out
  const walk = (parent: Element, prefix: string) => {
    Array.from(parent.children).forEach((child, i) => {
      const place = prefix ? `${prefix}.${i + 1}` : String(i + 1)
      out[label(child, place)] = looks(child, parent)
      if (!(child instanceof SVGElement)) walk(child, place)
    })
  }
  walk(row, '')
  return out
}

export interface Snapshot {
  width: number
  groups: Record<string, { light: Record<string, string>; dark: Record<string, string> }>
}

/** The styles of every group that is drawn, in both schemes. */
export function snapshot(root: Document): Snapshot {
  const light = root.querySelector('.gallery-scheme[data-scheme="light"]')
  const dark = root.querySelector('.gallery-scheme[data-scheme="dark"]')
  const groups: Snapshot['groups'] = {}
  if (!light || !dark) return { width: window.innerWidth, groups }
  const darkGroups = new Map(groupsOf(dark).map((group) => [group.name, group]))
  for (const group of groupsOf(light)) {
    if (group.section.hidden) continue
    const other = darkGroups.get(group.name)
    groups[group.name] = { light: stylesOf(group.section), dark: other ? stylesOf(other.section) : {} }
  }
  return { width: window.innerWidth, groups }
}

/** Draws only the group of that name, with the heading of its component, in each scheme; the page's head is hidden. False when there is no such group. */
export function showOnly(root: Document, name: string): boolean {
  let found = false
  for (const column of Array.from(root.querySelectorAll('.gallery-scheme'))) {
    const groups = groupsOf(column)
    const kept = groups.find((group) => group.name === name)
    if (kept) found = true
    for (const child of Array.from(column.children)) {
      if (!(child instanceof HTMLElement) || child.tagName === 'H2') continue
      child.hidden = child !== kept?.section && child !== kept?.heading
    }
  }
  const head = root.querySelector<HTMLElement>('.gallery-head')
  if (head) head.hidden = true
  return found
}

/** Draws every group again, and the page's head, after `showOnly`. */
export function showAll(root: Document): void {
  for (const child of Array.from(root.querySelectorAll<HTMLElement>('.gallery-scheme > *, .gallery-head'))) child.hidden = false
}

/**
 * How tall the gallery is with only that group drawn, for each group: the height of its picture at this width. The page keeps the window's height, so that
 * what follows the window's height (a dialog's) is drawn as it is in the styles, and the picture ends where the group does.
 */
export function heights(root: Document, names: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {}
  const gallery = root.querySelector<HTMLElement>('.gallery')
  for (const name of names) {
    showOnly(root, name)
    out[name] = Math.ceil(gallery?.getBoundingClientRect().height ?? 0)
  }
  showAll(root)
  return out
}

/** The names of the groups, in order. */
export function groupNames(root: Document): string[] {
  const light = root.querySelector('.gallery-scheme[data-scheme="light"]')
  return light ? groupsOf(light).map((group) => group.name) : []
}

const frame = () => new Promise((done) => requestAnimationFrame(() => done(undefined)))

/**
 * Applies the view that the address asks for, once the gallery is drawn and its fonts are loaded, and marks the page `data-snapshot="ready"` (or
 * `"no-such-group"`). With `snapshot=styles`, the styles go into `<script type="application/json" id="gallery-snapshot">`, with the names of all the groups
 * and, when every group is drawn, the height of each one's picture at this width.
 */
export async function applySnapshotView(root: Document): Promise<void> {
  const query = new URLSearchParams(root.location.search)
  const only = query.get('only')
  if (!only && !query.has('snapshot')) return
  root.documentElement.dataset.snapshot = 'drawing' // the page is as tall as what it draws (gallery.css)
  await root.fonts.ready
  await frame()
  await frame()
  const names = groupNames(root)
  if (only && !showOnly(root, only)) {
    root.documentElement.dataset.snapshot = 'no-such-group'
    return
  }
  if (query.get('snapshot') === 'styles') {
    const script = root.createElement('script')
    script.type = 'application/json'
    script.id = 'gallery-snapshot'
    const styles = snapshot(root)
    script.textContent = JSON.stringify({ names, ...styles, heights: only ? {} : heights(root, names) }).replace(/</g, '\\u003c') // no `</script>` can end it early
    root.body.append(script)
  }
  root.documentElement.dataset.snapshot = 'ready'
}

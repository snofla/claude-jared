/**
 * Jared as one file. A build of Jared is a page that loads a script, a stylesheet and an icon from beside it; this puts those
 * into the page itself, so that one file opens from a path (`file://`) with no server, as measured in Chrome and in Safari.
 * Pure: it is given the page's text and a way to read what the page names, and gives back the text of the one file.
 */

/** The name of the script beside the one-file page that carries a request in: it sets `window.__JARED_BOOT` (`src/lib/fragment-link.ts`). */
export const BOOT_FILE = 'jared-boot.js'

/** The tags that load something: a script with a `src`, a `link` with an `href`. */
const LOADERS = /<script\b[^>]*\bsrc="([^"]*)"[^>]*><\/script>|<link\b[^>]*\bhref="([^"]*)"[^>]*>/g
/** Every `src` and `href` of the page, which must each have been one of those tags. */
const REFERENCES = /\b(?:src|href)="([^"]*)"/g

const attribute = (tag: string, name: string): string | null => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? null

/** A build of Jared names its files from the page's own folder (`./assets/a.js`, since `base` is `./`), and nothing else is one of them. */
const isBesidePage = (reference: string): boolean => reference.startsWith('./')

/** Text for the inside of a `script` or a `style`, which ends at the first `</script` or `</style` whatever it is inside. */
const inside = (text: string, element: 'script' | 'style'): string =>
  text.replace(new RegExp(`</${element}`, 'gi'), (found) => `<\\/${found.slice(2)}`)

const refusal = (reference: string) => new Error(`The page refers to "${reference}", which this does not put into the page.`)

/**
 * The page with its script, its stylesheet and its icon inside it. `read` gives the text of a file by its path from the page's own
 * folder (`assets/index-x.js`). Refuses, naming it, a page that names anything else to load, since the result would not be one file.
 * A script that the page loads as a module is put in as a module, and the boot script (`BOOT_FILE`) goes in front of the first.
 */
export function inlinePage(html: string, read: (path: string) => string): string {
  const handled = new Set<string>()
  let booted = false
  const text = (reference: string) => read(reference.slice(2))

  const page = html.replace(LOADERS, (tag, script: string | undefined, link: string | undefined) => {
    if (script !== undefined) {
      if (!isBesidePage(script) || attribute(tag, 'type') !== 'module') throw refusal(script)
      handled.add(script)
      const boot = booted ? '' : `<script src="./${BOOT_FILE}"></script>\n    `
      booted = true
      return `${boot}<script type="module">${inside(text(script), 'script')}</script>`
    }
    const rel = attribute(tag, 'rel')
    if (!isBesidePage(link!)) return tag
    handled.add(link!)
    if (rel === 'stylesheet') return `<style>${inside(text(link!), 'style')}</style>`
    if (rel === 'icon' && link!.endsWith('.svg')) return `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(text(link!))}" />`
    throw refusal(link!)
  })

  for (const reference of html.matchAll(REFERENCES)) {
    if (!handled.has(reference[1]) && !reference[1].startsWith('data:')) throw refusal(reference[1])
  }
  return page
}

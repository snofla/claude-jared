import { isSettings, parseSettings, settingsRecord, settingsRecordWithoutLayout, usualLayout, usualSettings, withChange, type CommentsLayout, type FilesLayout, type Layout, type Settings, type SettingsChange } from './settings.ts'
import type { SettingsRemote } from './settings-remote.ts'
import type { Theme } from './theme.ts'

/**
 * What the reviewer keeps about how Jared looks, as the page uses it: the colour scheme and the layout, from one record. The page has its own copy of it (`local`,
 * which is `localStorage` in a browser) and, when it knows a place that keeps it for every window (`remote`), asks that place too. The page is never made to wait:
 * it draws what it has, and a record that comes later (a `subscribe`d listener hears of it) or a call that fails changes nothing but what it says. A change goes to
 * the page's copy at once and to the place after, merged into the record that the place holds at that moment, so that a window that changes one part does not
 * overwrite what another window changed in another.
 */

/** The page's own copy: the scheme and the layout, each in a place of its own, since `index.html` reads the scheme before the first paint. */
export interface LocalSettings {
  loadTheme(): Theme
  saveTheme(theme: Theme): void
  loadLayout(): Layout
  saveLayout(layout: Layout): void
  clearLayout(): void
}

export interface SettingsServiceOptions {
  local: LocalSettings
  /** The place that keeps the settings for every window; `null` when the page knows none. */
  remote: SettingsRemote | null
  /** The record that the place had when the script of the page was written (`null`: none, or nothing was written). It is the place's record, so it is read over the page's own copy. */
  boot: unknown
}

/** A change to one panel of the layout. */
export type LayoutChange = { files: Partial<FilesLayout> } | { comments: Partial<CommentsLayout> }

export interface SettingsService {
  theme: {
    load(): Theme
    save(theme: Theme): void
    /** Tells when a record that came from the place has another scheme than the page has; gives a way to stop listening. */
    subscribe(listener: (theme: Theme) => void): () => void
  }
  layout: {
    load(): Layout
    save(change: LayoutChange): void
    /** *Reset layout*: forgets the layout, here and at the place, and leaves the scheme. */
    clear(): void
    subscribe(listener: (layout: Layout) => void): () => void
  }
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

export function createSettingsService({ local, remote, boot }: SettingsServiceOptions): SettingsService {
  const themeListeners = new Set<(theme: Theme) => void>()
  const layoutListeners = new Set<(layout: Layout) => void>()
  const booted = isSettings(boot)
  let current: Settings = booted ? parseSettings(boot) : { ...usualSettings(), theme: local.loadTheme(), layout: local.loadLayout() }

  /** Keeps the record's two parts in the page's own copy, where `index.html` and the next load read them. */
  const keep = (settings: Settings) => {
    local.saveTheme(settings.theme)
    local.saveLayout(settings.layout)
  }
  if (booted) keep(current)

  // The record that a change is merged into: the one that the place holds, or, when it holds none of this version (the first write after an update, a file that was
  // lost), what the page has, so that the scheme and the layout that the page's own copy holds are not thrown away by the first change.
  const base = (held: unknown): unknown => (isSettings(held) ? held : current)

  // One call at a time to the place, so that a change cannot cross the one before it: each reads the record that the place holds and writes it back with its own change.
  let queue: Promise<void> = Promise.resolve()
  const tell = (change: (held: unknown) => Record<string, unknown>) => {
    if (!remote) return
    queue = queue
      .then(async () => {
        const held = await remote.read()
        if (held.ok) await remote.write(change(held.record))
      })
      .catch(() => {})
  }

  // A page that was not given the record asks for it; what comes replaces what the page has, and its listeners hear of it. A change that the reviewer made before
  // it came is put on it again, so that the record does not undo the change in the page while the place is given it.
  let asking = remote !== null && !booted
  const meanwhile: SettingsChange[] = []
  const noted = (change: SettingsChange) => {
    if (asking) meanwhile.push(change)
  }
  if (remote && !booted) {
    queue = queue
      .then(async () => {
        const held = await remote.read()
        asking = false
        const changes = meanwhile.splice(0)
        if (!held.ok || !isSettings(held.record)) return
        let next = parseSettings(held.record)
        for (const change of changes) next = withChange(next, change)
        const before = current
        current = next
        keep(next)
        if (before.theme !== next.theme) themeListeners.forEach((listener) => listener(next.theme))
        if (!same(before.layout, next.layout)) layoutListeners.forEach((listener) => listener(structuredClone(next.layout)))
      })
      .catch(() => {})
  }

  const subscribe = <T>(listeners: Set<(value: T) => void>, listener: (value: T) => void) => {
    listeners.add(listener)
    return () => void listeners.delete(listener)
  }

  return {
    theme: {
      load: () => current.theme,
      save: (theme) => {
        if (theme === current.theme) return
        current = withChange(current, { theme })
        noted({ theme })
        local.saveTheme(current.theme)
        tell((held) => settingsRecord(withChange(base(held), { theme })))
      },
      subscribe: (listener) => subscribe(themeListeners, listener),
    },
    layout: {
      load: () => structuredClone(current.layout),
      save: (change) => {
        // Merged into what the page's own copy holds now, which another window of this browser may have changed in the other panel; a copy that holds nothing
        // (or cannot be read) is the usual layout, and then it is what the page has that is merged.
        const kept = local.loadLayout()
        const stored = withChange({ ...current, layout: same(kept, usualLayout()) ? current.layout : kept }, change)
        if (same(stored.layout, current.layout)) return
        current = { ...current, layout: stored.layout }
        noted(change)
        local.saveLayout(stored.layout)
        tell((held) => settingsRecord(withChange(base(held), change)))
      },
      clear: () => {
        current = { ...current, layout: usualLayout() }
        noted({ files: usualLayout().files })
        noted({ comments: usualLayout().comments })
        local.clearLayout()
        tell((held) => settingsRecordWithoutLayout(parseSettings(base(held))))
      },
      subscribe: (listener) => subscribe(layoutListeners, listener),
    },
  }
}

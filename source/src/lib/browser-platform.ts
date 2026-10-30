import type { Platform } from './platform.ts'
import { hostFromSearch, receiverSettingsAddress, SETTINGS_KEY, settingsBoot } from './host-link.ts'
import { createSettingsService, type SettingsService } from './settings-service.ts'
import { settingsRemote } from './settings-remote.ts'
import { applyTheme, captureDrop, copyText, downloadText, editField, readMany, readPickedFile, type Capture } from './browser-io.ts'
import {
  clearLayout,
  forget,
  listRecent,
  loadLast,
  loadLayout,
  loadLastSet,
  loadReview,
  loadSession,
  loadSet,
  loadSetReview,
  loadTheme,
  loadViewed,
  saveLayout,
  saveReview,
  saveSet,
  saveSetReview,
  saveSource,
  saveTheme,
  saveViewed,
  setLast,
  storageFailed,
  subscribeStorageStatus,
} from './storage.ts'
import { nowIso, uid } from './util.ts'

/**
 * The settings of a tab: the page's own copy in `localStorage`, and, when the page knows a place that keeps them for every window, that place: the Jared service
 * that served the page, whose script says where (`window.__JARED_SETTINGS`), or a receiver (`?host=`). A page opened from a path has neither.
 */
function browserSettings(): SettingsService {
  const page = typeof window === 'undefined' ? null : window
  const boot = page ? settingsBoot((page as unknown as Record<string, unknown>)[SETTINGS_KEY], page.location.origin) : { url: null, record: null }
  const address = boot.url ?? (page ? receiverSettingsAddress(hostFromSearch(page.location.search)) : null)
  return createSettingsService({ local: { loadTheme, saveTheme, loadLayout, saveLayout, clearLayout }, remote: address ? settingsRemote(address) : null, boot: boot.record })
}

/**
 * The platform of a browser tab: what the app does itself, behind the services. Together with `storage.ts` and `browser-io.ts`
 * it is the only code that touches `localStorage`, a `File`, a `Blob`, the clipboard or `window.confirm`
 * (a test checks that), so that anything that is not a browser tab is another platform. The page has one, `browserPlatform`; its settings are made on
 * first use, so that a module that only imports it reads no `window`, and a test makes a platform of its own with `createBrowserPlatform`.
 */
export function createBrowserPlatform(): Platform {
  let settings: SettingsService | null = null
  const settingsService = (): SettingsService => (settings ??= browserSettings())
  return {
    reviews: {
      last: loadLast,
      recent: listRecent,
      review: loadReview,
      session: loadSession,
      saveSource: (file) => void saveSource(file),
      saveReview: (review) => void saveReview(review),
      lastSet: loadLastSet,
      setReview: loadSetReview,
      savedSet: loadSet,
      saveSet: (files, review) => void saveSet(files, review),
      saveSetReview: (review) => void saveSetReview(review),
      setLast,
      forget,
      viewed: loadViewed,
      setViewed: saveViewed,
      failed: storageFailed,
      subscribe: subscribeStorageStatus,
    },
    theme: {
      load: () => settingsService().theme.load(),
      save: (theme) => settingsService().theme.save(theme),
      apply: applyTheme,
      subscribe: (listener) => settingsService().theme.subscribe(listener),
    },
    layout: {
      load: () => settingsService().layout.load(),
      save: (change) => settingsService().layout.save(change),
      clear: () => settingsService().layout.clear(),
      subscribe: (listener) => settingsService().layout.subscribe(listener),
    },
    input: {
      read: (picked) => readPickedFile(picked as File),
      capture: (drop) => captureDrop(drop as DataTransfer),
      readMany: (picked) => readMany(picked as File[] | Capture),
    },
    fields: { edit: (field, edit) => editField(field as HTMLTextAreaElement, edit) },
    submit: { download: downloadText, copy: copyText },
    prompts: { confirm: (message) => window.confirm(message) },
    environment: { now: nowIso, uid },
  }
}

export const browserPlatform: Platform = createBrowserPlatform()

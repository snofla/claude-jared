import type { Platform } from './platform.ts'
import { applyTheme, copyText, downloadText, readPickedFile } from './browser-io.ts'
import { forget, listRecent, loadLast, loadReview, loadSession, loadTheme, saveReview, saveSource, saveTheme, setLast, storageFailed, subscribeStorageStatus } from './storage.ts'
import { nowIso, uid } from './util.ts'

/**
 * The platform of a browser tab: what the app does itself, behind the services. Together with `storage.ts` and `browser-io.ts`
 * it is the only code that touches `localStorage`, a `File`, a `Blob`, the clipboard or `window.confirm`
 * (a test checks that), so that anything that is not a browser tab is another platform.
 */
export const browserPlatform: Platform = {
  reviews: {
    last: loadLast,
    recent: listRecent,
    review: loadReview,
    session: loadSession,
    saveSource: (file) => void saveSource(file),
    saveReview: (review) => void saveReview(review),
    setLast,
    forget,
    failed: storageFailed,
    subscribe: subscribeStorageStatus,
  },
  theme: { load: loadTheme, save: saveTheme, apply: applyTheme },
  input: { read: (picked) => readPickedFile(picked as File) },
  submit: { download: downloadText, copy: copyText },
  prompts: { confirm: (message) => window.confirm(message) },
  environment: { now: nowIso, uid },
}

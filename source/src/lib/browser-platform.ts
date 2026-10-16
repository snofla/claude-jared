import type { Platform } from './platform.ts'
import { applyTheme, captureDrop, copyText, downloadText, editField, readMany, readPickedFile, type Capture } from './browser-io.ts'
import {
  forget,
  listRecent,
  loadLast,
  loadLastSet,
  loadReview,
  loadSession,
  loadSet,
  loadSetReview,
  loadTheme,
  loadViewed,
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
  theme: { load: loadTheme, save: saveTheme, apply: applyTheme },
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

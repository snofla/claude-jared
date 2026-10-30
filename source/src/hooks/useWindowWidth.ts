import { useSyncExternalStore } from 'react'

const subscribe = (notify: () => void) => {
  window.addEventListener('resize', notify)
  return () => window.removeEventListener('resize', notify)
}

/** The width of the window in px now; re-renders when the window is resized. */
export function useWindowWidth(): number {
  return useSyncExternalStore(subscribe, () => window.innerWidth)
}

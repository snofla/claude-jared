import { createContext, useContext } from 'react'
import type { Platform } from '../lib/platform'
import { browserPlatform } from '../lib/browser-platform'

/** The platform that the interface runs in. A page that gives none runs in the browser tab it is in. */
export const PlatformContext = createContext<Platform>(browserPlatform)

export const usePlatform = (): Platform => useContext(PlatformContext)

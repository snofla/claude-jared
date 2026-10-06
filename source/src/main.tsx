import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { PlatformContext } from './hooks/usePlatform.ts'
import { browserPlatform } from './lib/browser-platform.ts'
import './ui'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlatformContext value={browserPlatform}>
      <App />
    </PlatformContext>
  </StrictMode>,
)

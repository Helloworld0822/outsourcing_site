import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

try {
  const storedColorMode = localStorage.getItem('colorMode')
  const colorMode = storedColorMode === 'night' || storedColorMode === 'day' ? storedColorMode : 'day'
  document.documentElement.setAttribute('data-color-mode', colorMode)
} catch {
  document.documentElement.setAttribute('data-color-mode', 'day')
}

// Global error overlay to surface runtime errors in the page
window.addEventListener('error', (ev) => {
  const existing = document.getElementById('global-error-overlay')
  if (existing) existing.remove()
  const d = document.createElement('div')
  d.id = 'global-error-overlay'
  d.style.position = 'fixed'
  d.style.left = '0'
  d.style.top = '0'
  d.style.right = '0'
  d.style.background = 'white'
  d.style.color = 'black'
  d.style.zIndex = '99999'
  d.style.padding = '16px'
  d.style.borderBottom = '1px solid #ddd'
  d.innerText = `Error: ${ev.message} at ${ev.filename}:${ev.lineno}:${ev.colno}`
  document.body.prepend(d)
})
window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
  const existing = document.getElementById('global-error-overlay')
  if (existing) existing.remove()
  const d = document.createElement('div')
  d.id = 'global-error-overlay'
  d.style.position = 'fixed'
  d.style.left = '0'
  d.style.top = '0'
  d.style.right = '0'
  d.style.background = 'white'
  d.style.color = 'black'
  d.style.zIndex = '99999'
  d.style.padding = '16px'
  d.style.borderBottom = '1px solid #ddd'
  d.innerText = `Unhandled Rejection: ${ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason)}`
  document.body.prepend(d)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

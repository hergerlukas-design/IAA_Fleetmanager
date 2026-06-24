import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { registerSW } from 'virtual:pwa-register'
import './i18n/index'
import './index.css'
import App from './App'

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Neue Version verfügbar. Jetzt aktualisieren?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {},
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

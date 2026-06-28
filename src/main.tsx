import { StrictMode, useState, useCallback, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { registerSW } from 'virtual:pwa-register'
import UpdateBanner from './components/UpdateBanner'
import './i18n/index'
import './index.css'
import App from './App'

function Root() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [updateSW, setUpdateSW] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    const update = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true)
      },
      onOfflineReady() {},
    })
    setUpdateSW(() => update)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        update(true)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  const handleUpdate = useCallback(() => {
    updateSW?.(true).then(() => window.location.reload())
  }, [updateSW])

  return (
    <StrictMode>
      <BrowserRouter>
        <AuthProvider>
          {needRefresh && <UpdateBanner onUpdate={handleUpdate} />}
          <App />
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>
  )
}

createRoot(document.getElementById('root')!).render(<Root />)

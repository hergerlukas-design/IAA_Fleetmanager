import { useState, useCallback, useEffect, useRef } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { registerSW } from 'virtual:pwa-register'
import UpdateBanner from './components/UpdateBanner'
import App from './App'

export default function Root() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const updateSWRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    const update = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true)
      },
      onOfflineReady() {},
    })
    updateSWRef.current = update

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        update(true)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  const handleUpdate = useCallback(() => {
    updateSWRef.current?.(true).then(() => window.location.reload())
  }, [])

  return (
    <BrowserRouter>
      <AuthProvider>
        {needRefresh && <UpdateBanner onUpdate={handleUpdate} />}
        <App />
      </AuthProvider>
    </BrowserRouter>
  )
}

import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { checkPin } from '@/lib/auth'
import { useAuth } from '@/contexts/AuthContext'
import LanguageToggle from '@/components/LanguageToggle'

export default function Login() {
  const { t }        = useTranslation()
  const { login }    = useAuth()
  const navigate     = useNavigate()
  const [name, setName]   = useState('')
  const [pin, setPin]     = useState('')
  const [error, setError] = useState<string | null>(null)
  const pinRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError(t('login.name_required'))
      return
    }

    const level = checkPin(pin)
    if (level === 'none') {
      setError(t('login.wrong_pin'))
      setPin('')
      pinRef.current?.focus()
      return
    }

    login(level, name.trim())
    navigate('/fleets', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-blue-900 to-blue-700 flex flex-col items-center justify-center px-6">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>

      <div className="w-full max-w-sm">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🚗</span>
          </div>
          <h1 className="text-2xl font-bold text-white">{t('login.title')}</h1>
          <p className="text-blue-200 text-sm mt-1">{t('login.subtitle')}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-blue-100 text-sm font-medium mb-1">
              {t('login.name_label')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('login.name_placeholder')}
              autoComplete="name"
              className="w-full px-4 py-3 rounded-xl bg-white/15 text-white placeholder-blue-300 border border-white/20 focus:outline-none focus:border-white/60 backdrop-blur-sm"
            />
          </div>

          <div>
            <label className="block text-blue-100 text-sm font-medium mb-1">
              {t('login.pin_label')}
            </label>
            <input
              ref={pinRef}
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder={t('login.pin_placeholder')}
              autoComplete="current-password"
              className="w-full px-4 py-3 rounded-xl bg-white/15 text-white placeholder-blue-300 border border-white/20 focus:outline-none focus:border-white/60 backdrop-blur-sm text-center text-xl tracking-widest"
            />
          </div>

          {error && (
            <p className="text-red-300 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-white text-blue-800 font-bold text-base hover:bg-blue-50 active:scale-[0.98] transition-all"
          >
            {t('login.login_btn')}
          </button>
        </form>
      </div>
    </div>
  )
}

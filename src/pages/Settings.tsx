import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Globe, Download, Layers, Plus, Pencil, Trash2, X, Check, MessageSquare, ChevronDown, RefreshCw } from 'lucide-react'
import Layout from '@/components/Layout'
import Modal from '@/components/Modal'
import { useAuth } from '@/contexts/useAuth'
import { fetchFleets, createFleet, updateFleet, deleteFleet, FLEET_COLORS } from '@/lib/fleets'
import { fetchVehicles } from '@/lib/vehicles'
import { fetchDamages } from '@/lib/damages'
import { fetchProtocol } from '@/lib/protocols'
import { exportVehiclesToExcel } from '@/lib/export'
import { fetchFeedback, createFeedback, deleteFeedback } from '@/lib/feedback'
import type { Fleet, Feedback } from '@/lib/types'

import packageJson from '../../package.json'
const VERSION = packageJson.version

// ─── Fleet Form ───────────────────────────────────────────────────────────────

function FleetForm({ initial, onSave, onClose }: {
  initial: Fleet | null
  onSave: (f: Fleet) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [name, setName]   = useState(initial?.name ?? '')
  const [desc, setDesc]   = useState(initial?.description ?? '')
  const [color, setColor] = useState(initial?.color ?? FLEET_COLORS[0])
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError(t('common.required')); return }
    setSaving(true)
    setError(null)
    try {
      let fleet: Fleet
      if (initial) fleet = await updateFleet(initial.id, { name, description: desc, color })
      else         fleet = await createFleet({ name, description: desc, color })
      onSave(fleet)
    } catch {
      setError(t('errors.save_failed'))
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">
          {initial ? t('fleets.edit') : t('fleets.add')}
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={22} /></button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">{error}</div>}

      <form onSubmit={submit} className="space-y-4 pb-[env(safe-area-inset-bottom)]">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('fleets.name')}</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-400" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('fleets.description')}</label>
          <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-400" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('fleets.color')}</label>
          <div className="flex gap-2 flex-wrap">
            {FLEET_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className="w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all"
                style={{ backgroundColor: c, borderColor: color === c ? '#1d4ed8' : 'transparent' }}>
                {color === c && <Check size={14} className="text-white" />}
              </button>
            ))}
          </div>
        </div>

        <button type="submit" disabled={saving}
          className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50">
          {saving ? t('common.loading') : t('common.save')}
        </button>
      </form>
    </Modal>
  )
}

// ─── Settings Page ─────────────────────────────────────────────────────────────

export default function Settings() {
  const { t, i18n } = useTranslation()
  const { isAdmin, logout, userName } = useAuth()
  const navigate = useNavigate()

  const [fleets, setFleets]     = useState<Fleet[]>([])
  const [editFleet, setEditFleet] = useState<Fleet | null | 'new'>(null)
  const [exporting, setExporting] = useState(false)

  const [feedbackText, setFeedbackText]     = useState('')
  const [feedbackSending, setFeedbackSending] = useState(false)
  const [feedbackSent, setFeedbackSent]     = useState(false)
  const [feedbackError, setFeedbackError]   = useState(false)
  const [feedbackList, setFeedbackList]     = useState<Feedback[]>([])
  const [feedbackListOpen, setFeedbackListOpen] = useState(false)
  const [feedbackListFetched, setFeedbackListFetched] = useState(false)
  const [checking, setChecking] = useState(false)

  const loadFleets = useCallback(async () => {
    const data = await fetchFleets()
    setFleets(data)
  }, [])

  useEffect(() => {
    void (async () => { await loadFleets() })()
  }, [loadFleets])

  // Lazy load feedback list for admins
  useEffect(() => {
    if (isAdmin && feedbackListOpen && !feedbackListFetched) {
      fetchFeedback()
        .then(data => { setFeedbackList(data) })
        .catch(() => {})
        .finally(() => setFeedbackListFetched(true))
    }
  }, [feedbackListOpen, isAdmin, feedbackListFetched])

  async function handleExport() {
    setExporting(true)
    try {
      const vehicles = await fetchVehicles()
      const damagesMap: Record<string, Awaited<ReturnType<typeof fetchDamages>>> = {}
      const protocolMap: Record<string, Awaited<ReturnType<typeof fetchProtocol>>> = {}
      await Promise.all(vehicles.map(async (v) => {
        damagesMap[v.id]  = await fetchDamages(v.id)
        protocolMap[v.id] = await fetchProtocol(v.id)
      }))
      exportVehiclesToExcel(vehicles, damagesMap, protocolMap)
    } finally {
      setExporting(false)
    }
  }

  async function handleFeedbackSend() {
    if (!feedbackText.trim()) return
    setFeedbackSending(true)
    setFeedbackError(false)
    try {
      await createFeedback(feedbackText.trim(), userName)
      setFeedbackText('')
      setFeedbackSent(true)
      setTimeout(() => setFeedbackSent(false), 3000)
    } catch {
      setFeedbackError(true)
    }
    finally { setFeedbackSending(false) }
  }

  async function handleFeedbackDelete(id: string) {
    if (!confirm(t('feedback.delete_confirm'))) return
    await deleteFeedback(id)
    setFeedbackList(list => list.filter(f => f.id !== id))
  }

  async function handleDeleteFleet(fleet: Fleet) {
    if (!confirm(t('fleets.confirm_delete'))) return
    await deleteFleet(fleet.id)
    loadFleets()
  }

  return (
    <Layout
      header={
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">{t('settings.title')}</h1>
          <img src="/logo.png" alt="carhandling" className="h-11 w-auto" />
        </div>
      }
    >
      <div className="p-4 space-y-4">

        {/* Language */}
        <Section title={t('settings.language')} icon={<Globe size={18} />}>
          <div className="flex gap-2">
            {['de', 'en'].map((lang) => (
              <button key={lang} onClick={() => i18n.changeLanguage(lang)}
                className={`flex-1 py-2.5 rounded-xl border font-medium transition-colors ${
                  i18n.language.startsWith(lang)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 text-gray-700 hover:border-blue-400'
                }`}>
                {lang === 'de' ? 'Deutsch' : 'English'}
              </button>
            ))}
          </div>
        </Section>

        {/* Fleet Management (admin only) */}
        {isAdmin && (
          <Section title={t('settings.fleet_management')} icon={<Layers size={18} />}>
            <div className="space-y-2">
              {fleets.map((fleet) => (
                <div key={fleet.id}
                  className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-3">
                  <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: fleet.color ?? '#3b82f6' }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{fleet.name}</p>
                    {fleet.description && <p className="text-xs text-gray-400 truncate">{fleet.description}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => setEditFleet(fleet)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => handleDeleteFleet(fleet)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}

              <button onClick={() => setEditFleet('new')}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-blue-200 text-blue-500 hover:bg-blue-50 transition-colors">
                <Plus size={16} />
                <span className="text-sm font-medium">{t('fleets.add')}</span>
              </button>
            </div>
          </Section>
        )}

        {/* Export */}
        {isAdmin && (
          <Section title={t('settings.export')} icon={<Download size={18} />}>
            <p className="text-sm text-gray-500 mb-3">{t('settings.export_hint')}</p>
            <button onClick={handleExport} disabled={exporting}
              className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-medium disabled:opacity-50 hover:bg-emerald-700">
              {exporting ? t('common.loading') : t('settings.export_btn')}
            </button>
          </Section>
        )}

        {/* Feedback */}
        <Section title={t('feedback.title')} icon={<MessageSquare size={18} />}>
          <textarea
            value={feedbackText}
            onChange={e => setFeedbackText(e.target.value)}
            placeholder={t('feedback.placeholder')}
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-400 text-sm resize-none"
          />
          <button
            onClick={handleFeedbackSend}
            disabled={feedbackSending || !feedbackText.trim()}
            className={`w-full py-2.5 rounded-xl text-white font-medium transition-colors disabled:opacity-50 ${
              feedbackSent ? 'bg-emerald-500' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {feedbackSent ? `✓ ${t('feedback.sent')}` : feedbackSending ? t('common.loading') : t('feedback.send')}
          </button>
          {feedbackError && (
            <p className="text-xs text-red-500 text-center">{t('errors.save_failed')}</p>
          )}

          {isAdmin && (
            <div className="border-t border-gray-100 pt-3 mt-1">
              <button
                onClick={() => setFeedbackListOpen(o => !o)}
                className="flex items-center gap-1.5 w-full text-sm font-medium text-gray-500 hover:text-gray-800"
              >
                <ChevronDown size={14} className={`transition-transform duration-200 ${feedbackListOpen ? 'rotate-180' : ''}`} />
                {t('feedback.admin_title')}
                {feedbackListFetched && feedbackList.length > 0 && (
                  <span className="ml-auto text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-semibold">
                    {feedbackList.length}
                  </span>
                )}
              </button>

              {feedbackListOpen && (
                <div className="mt-2 space-y-2">
                  {!feedbackListFetched && (
                    <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
                  )}
                  {feedbackListFetched && feedbackList.length === 0 && (
                    <p className="text-xs text-gray-400 py-1">{t('feedback.no_feedback')}</p>
                  )}
                  {feedbackList.map(f => (
                    <div key={f.id} className="flex gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{f.message}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {f.submitted_by ?? '—'} · {new Date(f.created_at).toLocaleDateString('de-CH')}
                        </p>
                      </div>
                      <button
                        onClick={() => handleFeedbackDelete(f.id)}
                        className="p-1 text-gray-300 hover:text-red-500 flex-shrink-0 self-start"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Section>

        {/* Update check */}
        <Section title={t('update.check')} icon={<RefreshCw size={18} />}>
          <button
            onClick={async () => {
              setChecking(true)
              try {
                if ('serviceWorker' in navigator) {
                  const reg = await navigator.serviceWorker.getRegistration()
                  await reg?.update()
                }
                if ('caches' in window) {
                  const keys = await caches.keys()
                  await Promise.all(keys.map(k => caches.delete(k)))
                }
                window.location.reload()
              } catch {
                window.location.reload()
              }
            }}
            disabled={checking}
            className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-medium disabled:opacity-50 hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <RefreshCw size={16} className={checking ? 'animate-spin' : ''} />
            {checking ? t('update.checking') : t('update.reload')}
          </button>
        </Section>

        {/* Logout */}
        <button onClick={logout}
          className="w-full py-2.5 rounded-xl border border-red-200 text-red-500 font-medium hover:bg-red-50 transition-colors">
          Abmelden / Sign out
        </button>

        {/* Legal */}
        <div className="flex justify-center gap-4">
          <button onClick={() => navigate('/impressum')}
            className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">
            Impressum
          </button>
          <button onClick={() => navigate('/datenschutz')}
            className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">
            Datenschutz
          </button>
        </div>

        <p className="text-center text-xs text-gray-300">{t('settings.version')} {VERSION}</p>
      </div>

      {editFleet != null && (
        <FleetForm
          initial={editFleet === 'new' ? null : editFleet}
          onSave={() => { loadFleets(); setEditFleet(null) }}
          onClose={() => setEditFleet(null)}
        />
      )}
    </Layout>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
        {icon}
        {title}
      </div>
      {children}
    </div>
  )
}

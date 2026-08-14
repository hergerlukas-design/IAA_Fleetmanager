import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Link2, Unlink, Truck, Container, Plus, Download } from 'lucide-react'
import { useAuth } from '@/contexts/useAuth'
import { fetchActiveCouplings, createCoupling, endCoupling } from '@/lib/couplings'
import { fetchVehicles } from '@/lib/vehicles'
import { fetchTrailers } from '@/lib/trailers'
import { exportGespanneToExcel } from '@/lib/export'
import type { Coupling, Vehicle, Trailer } from '@/lib/types'

/** Gespanne-Ansicht als einbettbares Panel (ohne Layout/Header). */
export default function GespannePanel() {
  const { t }        = useTranslation()
  const navigate     = useNavigate()
  const { isUser, userName } = useAuth()

  const [couplings, setCouplings] = useState<Coupling[]>([])
  const [vehicles, setVehicles]   = useState<Vehicle[]>([])
  const [trailers, setTrailers]   = useState<Trailer[]>([])
  const [loading, setLoading]     = useState(true)
  const [busy, setBusy]           = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const [selVehicle, setSelVehicle] = useState('')
  const [selTrailer, setSelTrailer] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cp, veh, tr] = await Promise.all([fetchActiveCouplings(), fetchVehicles(), fetchTrailers()])
      setCouplings(cp); setVehicles(veh); setTrailers(tr)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void (async () => { await load() })() }, [load])

  const coupledVehicleIds = new Set(couplings.map(c => c.vehicle_id))
  const coupledTrailerIds = new Set(couplings.map(c => c.trailer_id))
  const freeVehicles = vehicles.filter(v => !coupledVehicleIds.has(v.id))
  const freeTrailers = trailers.filter(tr => !coupledTrailerIds.has(tr.id))

  async function handleCouple() {
    if (!selVehicle || !selTrailer) return
    setBusy(true)
    try {
      await createCoupling(selVehicle, selTrailer, userName || null)
      setSelVehicle(''); setSelTrailer(''); setShowForm(false)
      await load()
    } finally { setBusy(false) }
  }

  async function handleDecouple(c: Coupling) {
    if (!confirm(t('couplings.decouple_confirm'))) return
    setBusy(true)
    try {
      await endCoupling(c.id)
      await load()
    } finally { setBusy(false) }
  }

  return (
    <div className="px-4 py-4 space-y-3">
      {/* Export-Toolbar */}
      <div className="flex justify-end">
        <button onClick={() => exportGespanneToExcel(couplings)} disabled={couplings.length === 0}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 font-medium hover:border-blue-300 disabled:opacity-40">
          <Download size={13} /> {t('settings.export_btn')}
        </button>
      </div>

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      )}

      {!loading && couplings.length === 0 && !showForm && (
        <div className="text-center py-12 text-gray-400">
          <Link2 size={40} className="mx-auto mb-3 opacity-40" />
          <p>{t('gespanne.empty')}</p>
        </div>
      )}

      {couplings.map(c => {
        const since = new Date(c.gekoppelt_seit).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })
        return (
          <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(`/vehicle/${c.vehicle_id}`)}
                className="flex-1 flex items-center gap-2 min-w-0 text-left">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Truck size={18} className="text-blue-500" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{c.vehicle?.license_plate || c.vehicle?.vin || '—'}</p>
                  <p className="text-xs text-gray-400 truncate">{c.vehicle?.brand_model || '—'}</p>
                </div>
              </button>

              <Link2 size={18} className="text-gray-300 flex-shrink-0" />

              <button onClick={() => navigate(`/trailer/${c.trailer_id}`)}
                className="flex-1 flex items-center gap-2 min-w-0 text-left justify-end">
                <div className="min-w-0 text-right">
                  <p className="font-semibold text-gray-900 truncate">{c.trailer?.license_plate || '—'}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {c.trailer ? t(`trailers.types.${c.trailer.trailer_type}`) : '—'}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Container size={18} className="text-gray-400" />
                </div>
              </button>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">{t('couplings.since')} {since}</span>
              {isUser && (
                <button onClick={() => handleDecouple(c)} disabled={busy}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 disabled:opacity-50">
                  <Unlink size={13} /> {t('couplings.decouple')}
                </button>
              )}
            </div>
          </div>
        )
      })}

      {/* Neue Kopplung */}
      {isUser && (showForm ? (
        <div className="bg-white rounded-xl border border-blue-200 p-4 space-y-3">
          <p className="text-sm font-bold text-gray-900">{t('gespanne.new')}</p>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t('nav.vehicles')}</label>
            <select value={selVehicle} onChange={e => setSelVehicle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:border-blue-400">
              <option value="">{t('couplings.select_vehicle')}</option>
              {freeVehicles.map(v => (
                <option key={v.id} value={v.id}>{(v.license_plate || v.vin || '—') + (v.brand_model ? ` · ${v.brand_model}` : '')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t('nav.trailers')}</label>
            <select value={selTrailer} onChange={e => setSelTrailer(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:border-blue-400">
              <option value="">{t('couplings.select_trailer')}</option>
              {freeTrailers.map(tr => (
                <option key={tr.id} value={tr.id}>{(tr.license_plate || '—') + ` · ${t(`trailers.types.${tr.trailer_type}`)}`}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); setSelVehicle(''); setSelTrailer('') }}
              className="flex-1 py-2 rounded-xl border border-gray-300 text-gray-600 text-sm">{t('common.cancel')}</button>
            <button onClick={handleCouple} disabled={busy || !selVehicle || !selTrailer}
              className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1">
              <Link2 size={14} /> {t('couplings.couple')}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-blue-200 text-blue-500 hover:bg-blue-50 transition-colors">
          <Plus size={18} /> <span className="font-medium">{t('gespanne.new')}</span>
        </button>
      ))}
    </div>
  )
}

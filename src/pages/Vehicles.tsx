import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Search, Car, ArrowUpDown } from 'lucide-react'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { fetchVehicles, createVehicle } from '@/lib/vehicles'
import type { Vehicle } from '@/lib/types'
import CreateVehicleSheet from './CreateVehicleSheet'

const STATUS_COLORS: Record<string, string> = {
  in_bearbeitung: 'bg-amber-100 text-amber-700',
  abgeschlossen:  'bg-emerald-100 text-emerald-700',
}

export default function Vehicles() {
  const { t }       = useTranslation()
  const { isUser, isAdmin } = useAuth()
  const navigate    = useNavigate()
  const [params]    = useSearchParams()

  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [query, setQuery]       = useState('')
  const [onlyInBearbeitung, setOnlyInBearbeitung] = useState(false)
  const [sortBy, setSortBy]     = useState<'plate' | 'newest'>('plate')
  const [loading, setLoading]   = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchVehicles()
      setVehicles(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = vehicles
    .filter((v) => {
      if (params.get('unassigned') && v.fleet_id) return false
      if (onlyInBearbeitung && v.status !== 'in_bearbeitung') return false
      const q = query.toLowerCase()
      return !q || (
        v.license_plate?.toLowerCase().includes(q) ||
        v.vin?.toLowerCase().includes(q) ||
        v.brand_model?.toLowerCase().includes(q) ||
        v.fleet?.name?.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      const ka = a.license_plate || a.vin || ''
      const kb = b.license_plate || b.vin || ''
      return ka.localeCompare(kb, 'de', { numeric: true, sensitivity: 'base' })
    })

  async function handleCreate(payload: Omit<Vehicle, 'id' | 'created_at' | 'fleet'>) {
    const v = await createVehicle(payload)
    setShowCreate(false)
    navigate(`/vehicle/${v.id}`)
  }

  return (
    <Layout
      header={
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">{t('vehicles.title')}</h1>
          <img src="/logo.png" alt="carhandling" className="h-11 w-auto" />
        </div>
      }
    >
      {/* Search */}
      <div className="px-4 pt-4 pb-2 space-y-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('vehicles.search')}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-blue-400"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy(s => s === 'plate' ? 'newest' : 'plate')}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors flex items-center gap-1 ${
              sortBy === 'newest'
                ? 'bg-blue-100 text-blue-700 border-blue-300'
                : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'
            }`}>
            <ArrowUpDown size={11} />
            {sortBy === 'newest' ? t('vehicles.sort_newest') : t('vehicles.sort_alpha')}
          </button>
          {isAdmin && (
            <button
              onClick={() => setOnlyInBearbeitung(v => !v)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                onlyInBearbeitung
                  ? 'bg-amber-100 text-amber-700 border-amber-300'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-amber-300'
              }`}>
              {t('fleets.status.in_bearbeitung')}
            </button>
          )}
        </div>
      </div>

      <div className="px-4 space-y-2 pb-4">
        {loading && (
          <div className="space-y-2 pt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Car size={40} className="mx-auto mb-3 opacity-40" />
            <p>{query ? t('vehicles.no_results') : t('vehicles.no_vehicles')}</p>
          </div>
        )}

        {filtered.map((v) => (
          <button
            key={v.id}
            onClick={() => navigate(`/vehicle/${v.id}`)}
            className={`w-full rounded-xl border px-4 py-3 text-left flex items-center gap-3 hover:shadow-sm active:scale-[0.99] transition-all ${
              v.werkstatt ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${v.werkstatt ? 'bg-red-100' : 'bg-gray-100'}`}>
              <Car size={20} className={v.werkstatt ? 'text-red-400' : 'text-gray-400'} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">
                {v.license_plate || v.vin || '—'}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {v.brand_model || '—'} · {v.fleet?.name ?? t('vehicle_card.no_fleet')}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              {v.werkstatt && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-600">
                  🔧 {t('status_section.werkstatt')}
                </span>
              )}
              <div className="flex items-center gap-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[v.status]}`}>
                  {t(`fleets.status.${v.status}`)}
                </span>
                {v.protocol_submitted && v.status === 'in_bearbeitung' && (
                  <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                )}
              </div>
              {v.km != null && (
                <span className="text-xs text-gray-400">{v.km.toLocaleString()} km</span>
              )}
            </div>
          </button>
        ))}

        {isUser && (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-blue-200 text-blue-500 hover:bg-blue-50 transition-colors mt-2"
          >
            <Plus size={18} />
            <span className="font-medium">{t('vehicles.add')}</span>
          </button>
        )}
      </div>

      {showCreate && (
        <CreateVehicleSheet onSave={handleCreate} onClose={() => setShowCreate(false)} />
      )}
    </Layout>
  )
}

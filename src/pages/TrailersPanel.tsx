import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Search, Container, ArrowUpDown, Link2 } from 'lucide-react'
import { useAuth } from '@/contexts/useAuth'
import { fetchTrailers } from '@/lib/trailers'
import { fetchActiveCouplings } from '@/lib/couplings'
import type { Trailer, Coupling } from '@/lib/types'
import CreateTrailerSheet from './CreateTrailerSheet'

const STATUS_COLORS: Record<string, string> = {
  in_bearbeitung: 'bg-amber-100 text-amber-700',
  abgeschlossen:  'bg-emerald-100 text-emerald-700',
}

/** Trailer-Liste als einbettbares Panel (ohne Layout/Header). */
export default function TrailersPanel() {
  const { t }        = useTranslation()
  const { isUser }   = useAuth()
  const navigate     = useNavigate()

  const [trailers, setTrailers] = useState<Trailer[]>([])
  const [coupledMap, setCoupledMap] = useState<Record<string, Coupling>>({})
  const [query, setQuery]       = useState('')
  const [sortBy, setSortBy]     = useState<'plate' | 'newest'>('plate')
  const [loading, setLoading]   = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [data, couplings] = await Promise.all([fetchTrailers(), fetchActiveCouplings()])
      setTrailers(data)
      const map: Record<string, Coupling> = {}
      for (const c of couplings) map[c.trailer_id] = c
      setCoupledMap(map)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void (async () => { await load() })() }, [load])

  const filtered = trailers
    .filter((tr) => {
      const q = query.toLowerCase()
      return !q || (
        tr.license_plate?.toLowerCase().includes(q) ||
        tr.brand_model?.toLowerCase().includes(q) ||
        tr.fleet?.name?.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      const ka = a.license_plate || ''
      const kb = b.license_plate || ''
      return ka.localeCompare(kb, 'de', { numeric: true, sensitivity: 'base' })
    })

  function handleDone(trailerId: string) {
    setShowCreate(false)
    navigate(`/trailer/${trailerId}`)
  }

  return (
    <>
      <div className="px-4 pt-4 pb-2 space-y-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={t('vehicles.search')}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-blue-400" />
        </div>
        <button onClick={() => setSortBy(s => s === 'plate' ? 'newest' : 'plate')}
          className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors flex items-center gap-1 ${
            sortBy === 'newest' ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'
          }`}>
          <ArrowUpDown size={11} />
          {sortBy === 'newest' ? t('vehicles.sort_newest') : t('vehicles.sort_alpha')}
        </button>
      </div>

      <div className="px-4 space-y-2 pb-4">
        {loading && (
          <div className="space-y-2 pt-2">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Container size={40} className="mx-auto mb-3 opacity-40" />
            <p>{query ? t('vehicles.no_results') : t('trailers.no_trailers')}</p>
          </div>
        )}

        {filtered.map((tr) => {
          const coupling = coupledMap[tr.id]
          return (
            <button key={tr.id} onClick={() => navigate(`/trailer/${tr.id}`)}
              className="w-full rounded-xl border border-gray-100 bg-white px-4 py-3 text-left flex items-center gap-3 hover:shadow-sm active:scale-[0.99] transition-all">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Container size={20} className="text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{tr.license_plate || '—'}</p>
                <p className="text-xs text-gray-400 truncate">
                  {t(`trailers.types.${tr.trailer_type}`)}{tr.brand_model ? ` · ${tr.brand_model}` : ''}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[tr.status]}`}>
                  {t(`fleets.status.${tr.status}`)}
                </span>
                {coupling && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700 flex items-center gap-1">
                    <Link2 size={11} /> {coupling.vehicle?.license_plate || coupling.vehicle?.vin || t('couplings.coupled')}
                  </span>
                )}
              </div>
            </button>
          )
        })}

        {isUser && (
          <button onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-blue-200 text-blue-500 hover:bg-blue-50 transition-colors mt-2">
            <Plus size={18} />
            <span className="font-medium">{t('trailers.add')}</span>
          </button>
        )}
      </div>

      {showCreate && <CreateTrailerSheet onDone={handleDone} onClose={() => setShowCreate(false)} />}
    </>
  )
}

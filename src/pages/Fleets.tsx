import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, ChevronRight, Car } from 'lucide-react'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { fetchActiveFleets, fetchFleetVehicleCounts } from '@/lib/fleets'
import type { Fleet } from '@/lib/types'

// ─── Status bar ─────────────────────────────────────────────────────────────

function StatusBar({ in_bearbeitung, abgeschlossen, total }: {
  in_bearbeitung: number; abgeschlossen: number; total: number
}) {
  if (total === 0) return <div className="h-1.5 bg-gray-100 rounded-full" />
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
      {in_bearbeitung > 0 && <div style={{ flex: in_bearbeitung }} className="bg-amber-400" />}
      {abgeschlossen  > 0 && <div style={{ flex: abgeschlossen  }} className="bg-emerald-500" />}
    </div>
  )
}

// ─── Fleet card ─────────────────────────────────────────────────────────────

function FleetCard({ fleet, counts, onClick }: {
  fleet: Fleet
  counts: { total: number; in_bearbeitung: number; abgeschlossen: number }
  onClick: () => void
}) {
  const { t } = useTranslation()
  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left hover:shadow-md active:scale-[0.99] transition-all"
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex-shrink-0"
          style={{ backgroundColor: fleet.color ?? '#3b82f6' }}
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{fleet.name}</h3>
          {fleet.description && (
            <p className="text-xs text-gray-400 truncate">{fleet.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm font-medium text-gray-500">
            {counts.total === 1 ? t('fleets.vehicle_singular') : t('fleets.vehicles_count', { count: counts.total })}
          </span>
          <ChevronRight size={16} className="text-gray-300" />
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <StatusBar {...counts} />
        <div className="flex gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            {counts.in_bearbeitung} {t('fleets.status.in_bearbeitung')}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            {counts.abgeschlossen} {t('fleets.status.abgeschlossen')}
          </span>
        </div>
      </div>
    </button>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function Fleets() {
  const { t }      = useTranslation()
  const { isAdmin } = useAuth()
  const navigate   = useNavigate()

  const [fleets, setFleets]  = useState<Fleet[]>([])
  const [counts, setCounts]  = useState<Record<string, { total: number; in_bearbeitung: number; abgeschlossen: number }>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [f, c] = await Promise.all([fetchActiveFleets(), fetchFleetVehicleCounts()])
      setFleets(f)
      setCounts(c)
    } catch (err) {
      console.error('[Fleets] Supabase load error:', err)
      setError(t('errors.load_failed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { load() }, [load])

  const totalVehicles = Object.values(counts).reduce((s, c) => s + c.total, 0)

  return (
    <Layout
      header={
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{t('fleets.title')}</h1>
            <p className="text-xs text-gray-400">{totalVehicles === 1 ? t('fleets.vehicle_singular') : t('fleets.vehicles_count', { count: totalVehicles })}</p>
          </div>
          <img src="/logo.png" alt="carhandling" className="h-11 w-auto" />
        </div>
      }
    >
      <div className="p-4 space-y-3">
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm space-y-3">
            <p>{error}</p>
            <button
              onClick={load}
              className="w-full py-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-medium transition-colors"
            >
              {t('common.retry')}
            </button>
          </div>
        )}

        {!loading && !error && fleets.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Car size={40} className="mx-auto mb-3 opacity-40" />
            <p>{t('fleets.no_fleets')}</p>
          </div>
        )}

        {fleets.map((fleet) => (
          <FleetCard
            key={fleet.id}
            fleet={fleet}
            counts={counts[fleet.id] ?? { total: 0, in_bearbeitung: 0, abgeschlossen: 0 }}
            onClick={() => navigate(`/fleet/${fleet.id}`)}
          />
        ))}

        {/* Unassigned vehicles shortcut */}
        {(counts['none']?.total ?? 0) > 0 && (
          <button
            onClick={() => navigate('/vehicles?unassigned=1')}
            className="w-full bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-4 text-left hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-600">{t('fleets.unassigned')}</p>
                <p className="text-xs text-gray-400">{counts['none'].total === 1 ? t('fleets.vehicle_singular') : t('fleets.unassigned_count', { count: counts['none'].total })}</p>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </div>
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => navigate('/settings?tab=fleets')}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-blue-200 text-blue-500 hover:bg-blue-50 transition-colors"
          >
            <Plus size={18} />
            <span className="font-medium">{t('fleets.add')}</span>
          </button>
        )}
      </div>
    </Layout>
  )
}

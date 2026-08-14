import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Search, Car, ArrowUpDown, Lock, X, CheckSquare, Truck, Container, Link2 } from 'lucide-react'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/useAuth'
import { fetchVehicles } from '@/lib/vehicles'
import { confirmAnnahmeByVehicleId } from '@/lib/protocols'
import type { Vehicle } from '@/lib/types'
import CreateVehicleSheet from './CreateVehicleSheet'
import TrailersPanel from './TrailersPanel'
import GespannePanel from './GespannePanel'

type FilterView = 'vehicles' | 'trailers' | 'gespanne'

const STATUS_COLORS: Record<string, string> = {
  in_bearbeitung: 'bg-amber-100 text-amber-700',
  abgeschlossen:  'bg-emerald-100 text-emerald-700',
}

function VehicleRowItem({ vehicle: v, selectionMode, selected, confirming, onNavigate, onLongPress, onToggleSelect, onConfirm }: {
  vehicle: Vehicle
  selectionMode: boolean
  selected: boolean
  confirming: boolean
  onNavigate: () => void
  onLongPress?: () => void
  onToggleSelect: () => void
  onConfirm?: () => void
}) {
  const { t } = useTranslation()
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelled = useRef(false)

  function handlePointerDown() {
    if (selectionMode || !onLongPress) return
    cancelled.current = false
    longPressTimer.current = setTimeout(() => {
      if (!cancelled.current) onLongPress()
    }, 500)
  }
  function handlePointerUp() {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  }
  function handlePointerCancel() {
    cancelled.current = true
    handlePointerUp()
  }
  function handleClick() {
    if (selectionMode) { onToggleSelect(); return }
    onNavigate()
  }

  return (
    <div className={`rounded-xl border overflow-hidden ${
      selected ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200' :
      v.werkstatt ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
    }`}>
      <button
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerCancel}
        onContextMenu={e => { e.preventDefault(); onLongPress?.() }}
        className="w-full px-4 py-3 text-left flex items-center gap-3 hover:shadow-sm active:scale-[0.99] transition-all select-none"
      >
        {selectionMode ? (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
            selected ? 'bg-blue-600' : 'bg-gray-100 border-2 border-gray-300'
          }`}>
            {selected && <CheckSquare size={20} className="text-white" />}
          </div>
        ) : (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${v.werkstatt ? 'bg-red-100' : 'bg-gray-100'}`}>
            <Car size={20} className={v.werkstatt ? 'text-red-400' : 'text-gray-400'} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">
            {v.license_plate || v.vin || '—'}
          </p>
          <p className="text-xs text-gray-400 truncate">
            {v.brand_model || '—'} · {v.fleet?.name ?? t('vehicle_card.no_fleet')}
          </p>
        </div>
        {!selectionMode && (
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
        )}
      </button>
      {!selectionMode && onConfirm && (
        <div className="px-4 pb-3">
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="w-full py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
          >
            {confirming ? t('common.loading') : <><Lock size={12} /> {t('protocol.annahme_confirm')}</>}
          </button>
        </div>
      )}
    </div>
  )
}

export default function Vehicles() {
  const { t }       = useTranslation()
  const { isUser, isAdmin, userName } = useAuth()
  const navigate    = useNavigate()
  const [params]    = useSearchParams()

  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [query, setQuery]       = useState('')
  const [onlyInBearbeitung, setOnlyInBearbeitung] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkConfirming, setBulkConfirming] = useState(false)
  const [sortBy, setSortBy]     = useState<'plate' | 'newest'>('plate')
  const [loading, setLoading]   = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [view, setView]         = useState<FilterView>('vehicles')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchVehicles()
      setVehicles(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void (async () => { await load() })()
  }, [load])

  function enterSelectionMode(firstId: string) {
    setSelectionMode(true)
    setSelectedIds(new Set([firstId]))
  }
  function exitSelectionMode() {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      if (next.size === 0) setSelectionMode(false)
      return next
    })
  }
  async function bulkConfirm() {
    if (!confirm(t('protocol.annahme_confirm_dialog'))) return
    setBulkConfirming(true)
    try {
      await Promise.all([...selectedIds].map(vid => confirmAnnahmeByVehicleId(vid, userName || '')))
      exitSelectionMode()
      await load()
    } finally {
      setBulkConfirming(false)
    }
  }

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

  function handleDone(vehicleId: string) {
    setShowCreate(false)
    navigate(`/vehicle/${vehicleId}`)
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
      {/* Filter: Fahrzeuge / Trailer / Gespanne */}
      <div className="px-4 pt-4">
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
          {([
            { id: 'vehicles', icon: Truck,     label: t('nav.vehicles') },
            { id: 'trailers', icon: Container, label: t('nav.trailers') },
            { id: 'gespanne', icon: Link2,     label: t('nav.gespanne') },
          ] as { id: FilterView; icon: typeof Truck; label: string }[]).map(({ id, icon: Icon, label }) => (
            <button key={id} type="button" onClick={() => setView(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
      </div>

      {view === 'trailers' && <TrailersPanel />}
      {view === 'gespanne' && <GespannePanel />}

      {view === 'vehicles' && (<>
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

        {filtered.map((v) => {
          const canConfirm = isAdmin && v.status === 'in_bearbeitung' && !v.protocol_submitted
          const isSelected = selectedIds.has(v.id)
          return (
            <VehicleRowItem
              key={v.id}
              vehicle={v}
              selectionMode={selectionMode}
              selected={isSelected}
              confirming={confirmingId === v.id}
              onNavigate={() => navigate(`/vehicle/${v.id}`)}
              onLongPress={canConfirm ? () => enterSelectionMode(v.id) : undefined}
              onToggleSelect={() => toggleSelect(v.id)}
              onConfirm={!selectionMode && canConfirm ? async () => {
                if (!confirm(t('protocol.annahme_confirm_dialog'))) return
                setConfirmingId(v.id)
                try {
                  await confirmAnnahmeByVehicleId(v.id, userName || '')
                  await load()
                } finally {
                  setConfirmingId(null)
                }
              } : undefined}
            />
          )
        })}

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

      </>)}

      {showCreate && (
        <CreateVehicleSheet onDone={handleDone} onClose={() => setShowCreate(false)} />
      )}

      {selectionMode && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg px-4 py-3 flex items-center gap-3 safe-bottom">
          <button onClick={exitSelectionMode} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
            <X size={20} />
          </button>
          <span className="flex-1 text-sm font-medium text-gray-700">
            {selectedIds.size} {t('common.selected')}
          </span>
          <button
            onClick={bulkConfirm}
            disabled={bulkConfirming || selectedIds.size === 0}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {bulkConfirming ? t('common.loading') : <><Lock size={14} /> {t('protocol.annahme_confirm')}</>}
          </button>
        </div>
      )}
    </Layout>
  )
}

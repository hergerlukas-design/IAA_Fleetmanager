import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Plus, Search, Car, ArrowUpDown, Gauge, ChevronDown, FileText, Lock, X, CheckSquare, Container, Link2 } from 'lucide-react'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/useAuth'
import { fetchFleet } from '@/lib/fleets'
import { fetchVehicles, updateVehicle } from '@/lib/vehicles'
import { confirmAnnahmeByVehicleId } from '@/lib/protocols'
import { fetchTrailers, updateTrailer, confirmTrailerAnnahme } from '@/lib/trailers'
import { fetchActiveCouplings } from '@/lib/couplings'
import { fetchFleetKmSummary, fetchAllFleetKmEntries } from '@/lib/kmHistory'
import type { Fleet, Vehicle, Trailer, Coupling } from '@/lib/types'
import type { FleetKmSummary } from '@/lib/kmHistory'
import CreateVehicleSheet from './CreateVehicleSheet'
import AddKmSheet from './AddKmSheet'
import FleetTodos from '@/components/FleetTodos'
import CleaningToggles from '@/components/CleaningToggles'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { savePdf } from '@/lib/export'

const STATUS_COLORS: Record<string, string> = {
  in_bearbeitung: 'bg-amber-100 text-amber-700',
  abgeschlossen:  'bg-emerald-100 text-emerald-700',
}

function VehicleRow({ vehicle, onClick, onAddKm, onConfirm, confirming, selectionMode, selected, onLongPress, onToggleSelect, coupledLabel, onToggleCleaning }: {
  vehicle: Vehicle
  onClick: () => void
  onAddKm: () => void
  onConfirm?: () => void
  confirming?: boolean
  selectionMode?: boolean
  selected?: boolean
  onLongPress?: () => void
  onToggleSelect?: () => void
  coupledLabel?: string
  onToggleCleaning?: (kind: 'inside' | 'outside', next: boolean) => void
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
    if (selectionMode) { onToggleSelect?.(); return }
    onClick()
  }

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      selected ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200' :
      vehicle.werkstatt ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
    }`}>
      <div className="flex items-center">
        <button
          onClick={handleClick}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerCancel}
          onContextMenu={e => { e.preventDefault(); onLongPress?.() }}
          className="flex-1 flex items-center gap-3 px-4 py-3 text-left min-w-0 active:opacity-70 select-none"
        >
          {selectionMode ? (
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
              selected ? 'bg-blue-600' : 'bg-gray-100 border-2 border-gray-300'
            }`}>
              {selected && <CheckSquare size={20} className="text-white" />}
            </div>
          ) : (
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${vehicle.werkstatt ? 'bg-red-100' : 'bg-gray-100'}`}>
              <Car size={20} className={vehicle.werkstatt ? 'text-red-400' : 'text-gray-400'} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">
              {vehicle.license_plate || vehicle.vin || '—'}
            </p>
            <p className="text-xs text-gray-400 truncate">{vehicle.brand_model || '—'}</p>
            {coupledLabel && (
              <p className="text-[11px] text-blue-500 truncate flex items-center gap-1">
                <Link2 size={10} /> {coupledLabel}
              </p>
            )}
          </div>
          {!selectionMode && (
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              {vehicle.werkstatt && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-600">
                  🔧 {t('status_section.werkstatt')}
                </span>
              )}
              <div className="flex items-center gap-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[vehicle.status]}`}>
                  {t(`fleets.status.${vehicle.status}`)}
                </span>
                {vehicle.protocol_submitted && vehicle.status === 'in_bearbeitung' && (
                  <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                )}
              </div>
              {vehicle.km != null && (
                <span className="text-xs text-gray-400">{vehicle.km.toLocaleString()} km</span>
              )}
            </div>
          )}
        </button>

        {!selectionMode && (
          <button
            onClick={onAddKm}
            className="flex-shrink-0 w-11 self-stretch flex items-center justify-center border-l border-gray-100 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-r-xl transition-colors"
          >
            <Gauge size={17} />
          </button>
        )}
      </div>

      {!selectionMode && onConfirm && (
        <div className="px-4 pb-2 flex">
          <button onClick={onConfirm} disabled={confirming}
            className="mx-auto px-5 py-2 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 disabled:opacity-50 transition-colors flex items-center gap-1.5">
            {confirming ? t('common.loading') : <><Lock size={12} /> {t('protocol.annahme_confirm')}</>}
          </button>
        </div>
      )}

      {/* Reinigung – erst nach bestätigter Annahme */}
      {!selectionMode && vehicle.protocol_submitted && onToggleCleaning && (
        <div className="px-4 pb-2.5">
          <CleaningToggles
            inside={!!vehicle.cleaning_inside}
            outside={!!vehicle.cleaning_outside}
            onToggle={onToggleCleaning}
          />
        </div>
      )}
    </div>
  )
}

function TrailerRow({ trailer, coupledLabel, onClick, onConfirm, confirming, onToggleCleaning }: {
  trailer: Trailer
  coupledLabel?: string
  onClick: () => void
  onConfirm?: () => void
  confirming?: boolean
  onToggleCleaning?: (next: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
      <button onClick={onClick}
        className="w-full px-4 py-3 text-left flex items-center gap-3 active:opacity-70">
        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
          <Container size={20} className="text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{trailer.license_plate || '—'}</p>
          <p className="text-xs text-gray-400 truncate">
            {t(`trailers.types.${trailer.trailer_type}`)}{trailer.brand_model ? ` · ${trailer.brand_model}` : ''}
          </p>
          {coupledLabel && (
            <p className="text-[11px] text-blue-500 truncate flex items-center gap-1">
              <Link2 size={10} /> {coupledLabel}
            </p>
          )}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[trailer.status]}`}>
          {t(`fleets.status.${trailer.status}`)}
        </span>
      </button>

      {onConfirm && (
        <div className="px-4 pb-2 flex">
          <button onClick={onConfirm} disabled={confirming}
            className="mx-auto px-5 py-2 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 disabled:opacity-50 transition-colors flex items-center gap-1.5">
            {confirming ? t('common.loading') : <><Lock size={12} /> {t('protocol.annahme_confirm')}</>}
          </button>
        </div>
      )}

      {/* Reinigung (nur außen) – erst nach bestätigter Annahme */}
      {trailer.annahme_confirmed && onToggleCleaning && (
        <div className="px-4 pb-2.5">
          <CleaningToggles
            inside={false}
            outside={!!trailer.cleaning_outside}
            showInside={false}
            onToggle={(_, next) => onToggleCleaning(next)}
          />
        </div>
      )}
    </div>
  )
}

export default function FleetDetail() {
  const { id }        = useParams<{ id: string }>()
  const { t }         = useTranslation()
  const { isUser, isAdmin, userName } = useAuth()
  const navigate            = useNavigate()

  const [fleet, setFleet]       = useState<Fleet | null>(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [trailers, setTrailers] = useState<Trailer[]>([])
  const [couplings, setCouplings] = useState<Coupling[]>([])
  const [kmSummary, setKmSummary] = useState<Record<string, FleetKmSummary>>({})
  const [query, setQuery]       = useState('')
  const [onlyInBearbeitung, setOnlyInBearbeitung] = useState(false)
  const [sortBy, setSortBy]     = useState<'plate' | 'newest'>('plate')
  const [loading, setLoading]   = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [addKmVehicle, setAddKmVehicle] = useState<Vehicle | null>(null)
  const [logbookOpen, setLogbookOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkConfirming, setBulkConfirming] = useState(false)

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

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [f, veh, trs, cps] = await Promise.all([
        fetchFleet(id),
        fetchVehicles(id),
        fetchTrailers(id),
        fetchActiveCouplings(),
      ])
      setFleet(f)
      setVehicles(veh)
      setTrailers(trs)
      setCouplings(cps)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // Lazy: only fetch km summary when logbook section is first opened
  useEffect(() => {
    if (isAdmin && logbookOpen && vehicles.length > 0 && Object.keys(kmSummary).length === 0) {
      fetchFleetKmSummary(vehicles.map(v => v.id))
        .then(setKmSummary)
        .catch(() => {})
    }
  }, [logbookOpen, isAdmin, vehicles, kmSummary])

  // Aktive Kopplungen → Gespanne
  const trailerByVehicle: Record<string, Coupling> = {}
  const vehicleByTrailer: Record<string, Coupling> = {}
  for (const c of couplings) {
    trailerByVehicle[c.vehicle_id] = c
    vehicleByTrailer[c.trailer_id] = c
  }

  const q = query.toLowerCase()
  const matchesV = (v: Vehicle) => !q || !!(
    v.license_plate?.toLowerCase().includes(q) || v.vin?.toLowerCase().includes(q) || v.brand_model?.toLowerCase().includes(q))
  const matchesT = (tr: Trailer) => !q || !!(
    tr.license_plate?.toLowerCase().includes(q) || tr.brand_model?.toLowerCase().includes(q))
  const vSort = (a: Vehicle, b: Vehicle) => sortBy === 'newest'
    ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    : (a.license_plate || a.vin || '').localeCompare(b.license_plate || b.vin || '', 'de', { numeric: true, sensitivity: 'base' })
  const tSort = (a: Trailer, b: Trailer) =>
    (a.license_plate || '').localeCompare(b.license_plate || '', 'de', { numeric: true, sensitivity: 'base' })

  // Gespanne = Flotten-Fahrzeug + gekoppelter Flotten-Trailer als eine Einheit
  const trailerIdSet = new Set(trailers.map(tr => tr.id))
  const gespannVIds = new Set<string>()
  const gespannTIds = new Set<string>()
  const gespanne: { vehicle: Vehicle; trailer: Trailer; coupling: Coupling }[] = []
  for (const v of vehicles) {
    const c = trailerByVehicle[v.id]
    if (c && trailerIdSet.has(c.trailer_id)) {
      const tr = trailers.find(x => x.id === c.trailer_id)
      if (tr) {
        gespanne.push({ vehicle: v, trailer: tr, coupling: c })
        gespannVIds.add(v.id)
        gespannTIds.add(tr.id)
      }
    }
  }

  const gespanneToShow = gespanne
    .filter(g => (matchesV(g.vehicle) || matchesT(g.trailer)) && (!onlyInBearbeitung || g.vehicle.status === 'in_bearbeitung'))
    .sort((a, b) => vSort(a.vehicle, b.vehicle))
  const singleVehicles = vehicles
    .filter(v => !gespannVIds.has(v.id) && matchesV(v) && (!onlyInBearbeitung || v.status === 'in_bearbeitung'))
    .sort(vSort)
  const singleTrailers = trailers
    .filter(tr => !gespannTIds.has(tr.id) && matchesT(tr))
    .sort(tSort)

  const totalItems = vehicles.length + trailers.length
  const totalShown = gespanneToShow.length + singleVehicles.length + singleTrailers.length

  async function toggleVehicleCleaning(v: Vehicle, kind: 'inside' | 'outside', next: boolean) {
    const patch = kind === 'inside' ? { cleaning_inside: next } : { cleaning_outside: next }
    setVehicles(prev => prev.map(x => x.id === v.id ? { ...x, ...patch } : x))
    try {
      await updateVehicle(v.id, patch)
    } catch {
      await load()
    }
  }

  async function toggleTrailerCleaning(tr: Trailer, next: boolean) {
    setTrailers(prev => prev.map(x => x.id === tr.id ? { ...x, cleaning_outside: next } : x))
    try {
      await updateTrailer(tr.id, { cleaning_outside: next })
    } catch {
      await load()
    }
  }

  async function confirmTrailer(tr: Trailer) {
    if (!confirm(t('protocol.annahme_confirm_dialog'))) return
    setConfirmingId(tr.id)
    try {
      await confirmTrailerAnnahme(tr.id, userName || '')
      await load()
    } finally {
      setConfirmingId(null)
    }
  }

  async function confirmVehicle(v: Vehicle) {
    if (!confirm(t('protocol.annahme_confirm_dialog'))) return
    setConfirmingId(v.id)
    try {
      await confirmAnnahmeByVehicleId(v.id, userName || '')
      await load()
    } finally {
      setConfirmingId(null)
    }
  }

  const renderVehicle = (v: Vehicle, inGespann = false) => {
    const canConfirm = isAdmin && v.status === 'in_bearbeitung' && !v.protocol_submitted
    const c = trailerByVehicle[v.id]
    const coupledLabel = !inGespann && c?.trailer ? (c.trailer.license_plate || t('couplings.coupled')) : undefined
    return (
      <VehicleRow
        key={v.id}
        vehicle={v}
        coupledLabel={coupledLabel}
        onClick={() => navigate(`/vehicle/${v.id}`)}
        onAddKm={() => setAddKmVehicle(v)}
        onConfirm={!selectionMode && canConfirm ? () => confirmVehicle(v) : undefined}
        onToggleCleaning={isUser ? (kind, next) => toggleVehicleCleaning(v, kind, next) : undefined}
        confirming={confirmingId === v.id}
        selectionMode={selectionMode}
        selected={selectedIds.has(v.id)}
        onLongPress={isAdmin && canConfirm ? () => enterSelectionMode(v.id) : undefined}
        onToggleSelect={() => toggleSelect(v.id)}
      />
    )
  }

  const renderTrailer = (tr: Trailer, inGespann = false) => {
    const c = vehicleByTrailer[tr.id]
    const coupledLabel = !inGespann && c?.vehicle ? (c.vehicle.license_plate || c.vehicle.vin || t('couplings.coupled')) : undefined
    const canConfirm = isAdmin && !tr.annahme_confirmed
    return (
      <TrailerRow
        key={tr.id}
        trailer={tr}
        coupledLabel={coupledLabel}
        onClick={() => navigate(`/trailer/${tr.id}`)}
        onConfirm={canConfirm ? () => confirmTrailer(tr) : undefined}
        confirming={confirmingId === tr.id}
        onToggleCleaning={isUser ? (next) => toggleTrailerCleaning(tr, next) : undefined}
      />
    )
  }

  async function exportFleetPdf() {
    if (exporting || vehicles.length === 0) return
    setExporting(true)
    try {
      const allEntries = await fetchAllFleetKmEntries(vehicles.map(v => v.id))

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const margin = 14
      const pageW  = 210

      function formatDate(iso: string) {
        return new Date(iso).toLocaleString('de-CH', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
      }

      // Cover header
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(`${t('km_history.fahrtenbuch')} – ${fleet?.name ?? ''}`, margin, 14)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(new Date().toLocaleDateString('de-CH'), margin, 20)

      let curY = 28

      for (const v of vehicles) {
        const entries = allEntries[v.id] ?? []
        if (entries.length === 0) continue

        const label = v.license_plate || v.vin || '—'
        const subtitle = v.brand_model ? ` · ${v.brand_model}` : ''

        // Vehicle section heading
        if (curY > 260) { doc.addPage(); curY = 14 }
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text(label + subtitle, margin, curY)
        doc.setFont('helvetica', 'normal')
        curY += 1

        // Separator line
        doc.setDrawColor(200, 200, 200)
        doc.line(margin, curY + 1, pageW - margin, curY + 1)
        curY += 3

        const rows = entries.map(e => [
          formatDate(e.recorded_at),
          e.km.toLocaleString() + ' km',
          e.km_delta != null ? `+${e.km_delta.toLocaleString()} km` : '—',
          e.zweck ?? '—',
          e.recorded_by ?? '—',
        ])

        autoTable(doc, {
          startY: curY,
          head: [[
            t('km_history.col_date'),
            t('km_history.col_km'),
            t('km_history.col_delta'),
            t('km_history.col_zweck'),
            t('km_history.col_driver'),
          ]],
          body: rows,
          margin: { left: margin, right: margin },
          styles: { fontSize: 8, cellPadding: 1.8 },
          headStyles: { fillColor: [37, 99, 235], fontSize: 7.5 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: {
            0: { cellWidth: 32 },  // date
            1: { cellWidth: 22 },  // km
            2: { cellWidth: 20 },  // delta
            3: { cellWidth: 60 },  // zweck
            4: { cellWidth: 48 },  // by — wide enough for an email address
          },
        })

        curY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
      }

      const date = new Date().toISOString().slice(0, 10)
      await savePdf(doc, `Fahrtenbuch_${fleet?.name ?? 'Flotte'}_${date}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  function handleDone(vehicleId: string) {
    setShowCreate(false)
    navigate(`/vehicle/${vehicleId}`)
  }

  return (
    <Layout
      header={
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/fleets')} className="p-1 -ml-1 text-gray-500 hover:text-gray-800">
            <ArrowLeft size={22} />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {fleet?.color && (
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: fleet.color }} />
            )}
            <h1 className="font-bold text-gray-900 truncate">{fleet?.name ?? '…'}</h1>
          </div>
          <span className="text-sm text-gray-400">{t('vehicles.count_short', { count: vehicles.length })}</span>
          <img src="/logo.png" alt="carhandling" className="h-11 w-auto flex-shrink-0" />
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
        {/* Fleet todo list — per fleet, collapsible */}
        {!loading && id && (
          <FleetTodos fleetId={id} />
        )}

        {loading && (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {!loading && totalItems === 0 && (
          <p className="text-center text-gray-400 py-12">{t('vehicles.no_vehicles')}</p>
        )}

        {!loading && totalItems > 0 && totalShown === 0 && (
          <p className="text-center text-gray-400 py-8">{t('vehicles.no_results')}</p>
        )}

        {/* Gespanne – Fahrzeug + Trailer als eine Karte */}
        {gespanneToShow.length > 0 && (
          <div className="pt-1">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 mb-1.5">
              {t('gespanne.title')}
            </h3>
            <div className="space-y-3">
              {gespanneToShow.map(({ vehicle, trailer, coupling }) => (
                <div key={coupling.id} className="rounded-2xl border-2 border-blue-100 bg-blue-50/40 p-2 space-y-2">
                  <div className="flex items-center gap-1.5 px-1 pt-0.5 text-[11px] font-semibold text-blue-600 uppercase tracking-wide">
                    <Link2 size={13} /> {t('gespanne.title')}
                  </div>
                  {renderVehicle(vehicle, true)}
                  {renderTrailer(trailer, true)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fahrzeuge ohne Trailer */}
        {singleVehicles.length > 0 && (
          <div className="pt-2">
            {gespanneToShow.length > 0 && (
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 mb-1.5">
                {t('nav.vehicles')}
              </h3>
            )}
            <div className="space-y-2">
              {singleVehicles.map(v => renderVehicle(v))}
            </div>
          </div>
        )}

        {/* Trailer ohne Fahrzeug */}
        {singleTrailers.length > 0 && (
          <div className="pt-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 mb-1.5">
              {t('nav.trailers')}
            </h3>
            <div className="space-y-2">
              {singleTrailers.map(tr => renderTrailer(tr))}
            </div>
          </div>
        )}

        {/* Fleet km overview — admin only, collapsible */}
        {isAdmin && !loading && vehicles.length > 0 && (
          <div className="mt-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center px-4 py-3 hover:bg-gray-50 transition-colors">
              <button
                onClick={() => setLogbookOpen(o => !o)}
                className="flex items-center gap-2 flex-1 text-left min-w-0"
              >
                <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide flex-1">
                  {t('km_history.fahrtenbuch')}
                </h3>
                <ChevronDown
                  size={16}
                  className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${logbookOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {isAdmin && (
                <button
                  onClick={exportFleetPdf}
                  disabled={exporting}
                  className="flex items-center gap-1 text-xs text-blue-600 font-medium hover:text-blue-800 ml-3 flex-shrink-0 disabled:opacity-50"
                >
                  <FileText size={13} />
                  {exporting ? t('common.loading') : t('km_history.export_pdf')}
                </button>
              )}
            </div>

            {logbookOpen && (
              <div className="border-t border-gray-100 px-4 pb-2">
                {vehicles.map(v => {
                  const sum = kmSummary[v.id]
                  const label = v.license_plate || v.vin || '—'
                  return (
                    <div key={v.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                      <span className="flex-1 text-sm font-medium text-gray-800 truncate">{label}</span>
                      <div className="text-right flex-shrink-0">
                        {sum?.latest ? (
                          <>
                            <p className="text-sm font-semibold text-gray-900">
                              {sum.latest.km.toLocaleString()} km
                            </p>
                            {sum.total_delta != null && sum.total_delta > 0 && (
                              <p className="text-xs text-blue-500">
                                +{sum.total_delta.toLocaleString()} km
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-gray-300">{t('km_history.no_entry')}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

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
        <CreateVehicleSheet
          defaultFleetId={id}
          onDone={handleDone}
          onClose={() => setShowCreate(false)}
        />
      )}

      {addKmVehicle && (
        <AddKmSheet
          vehicle={addKmVehicle}
          onSaved={load}
          onClose={() => setAddKmVehicle(null)}
        />
      )}

      {selectionMode && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg px-4 py-3 flex items-center gap-3 safe-bottom">
          <button onClick={exitSelectionMode} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
            <X size={20} />
          </button>
          <span className="flex-1 text-sm font-medium text-gray-700">
            {selectedIds.size} {t('common.selected', { defaultValue: 'ausgewählt' })}
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

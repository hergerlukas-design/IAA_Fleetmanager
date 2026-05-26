import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Plus, Search, Car, ArrowUpDown, Gauge, ChevronDown, FileText } from 'lucide-react'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { fetchActiveFleets } from '@/lib/fleets'
import { fetchVehicles, createVehicle } from '@/lib/vehicles'
import { fetchFleetKmSummary, fetchAllFleetKmEntries } from '@/lib/kmHistory'
import type { Fleet, Vehicle } from '@/lib/types'
import type { FleetKmSummary } from '@/lib/kmHistory'
import CreateVehicleSheet from './CreateVehicleSheet'
import AddKmSheet from './AddKmSheet'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const STATUS_COLORS: Record<string, string> = {
  in_bearbeitung: 'bg-amber-100 text-amber-700',
  abgeschlossen:  'bg-emerald-100 text-emerald-700',
}

function VehicleRow({ vehicle, onClick, onAddKm }: {
  vehicle: Vehicle
  onClick: () => void
  onAddKm: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className={`rounded-xl border flex items-center transition-all ${
      vehicle.werkstatt ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
    }`}>
      {/* Main tap area → navigate */}
      <button
        onClick={onClick}
        className="flex-1 flex items-center gap-3 px-4 py-3 text-left min-w-0 active:opacity-70"
      >
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${vehicle.werkstatt ? 'bg-red-100' : 'bg-gray-100'}`}>
          <Car size={20} className={vehicle.werkstatt ? 'text-red-400' : 'text-gray-400'} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">
            {vehicle.license_plate || vehicle.vin || '—'}
          </p>
          <p className="text-xs text-gray-400 truncate">{vehicle.brand_model || '—'}</p>
        </div>
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
      </button>

      {/* Add-KM button */}
      <button
        onClick={onAddKm}
        className="flex-shrink-0 w-11 self-stretch flex items-center justify-center border-l border-gray-100 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-r-xl transition-colors"
      >
        <Gauge size={17} />
      </button>
    </div>
  )
}

export default function FleetDetail() {
  const { id }        = useParams<{ id: string }>()
  const { t }         = useTranslation()
  const { isUser, isAdmin } = useAuth()
  const navigate            = useNavigate()

  const [fleet, setFleet]       = useState<Fleet | null>(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [kmSummary, setKmSummary] = useState<Record<string, FleetKmSummary>>({})
  const [query, setQuery]       = useState('')
  const [onlyInBearbeitung, setOnlyInBearbeitung] = useState(false)
  const [sortBy, setSortBy]     = useState<'plate' | 'newest'>('plate')
  const [loading, setLoading]   = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [addKmVehicle, setAddKmVehicle] = useState<Vehicle | null>(null)
  const [logbookOpen, setLogbookOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [fleets, veh] = await Promise.all([
        fetchActiveFleets(),
        fetchVehicles(id),
      ])
      setFleet(fleets.find((f) => f.id === id) ?? null)
      setVehicles(veh)
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

  const filtered = vehicles
    .filter((v) => {
      if (onlyInBearbeitung && v.status !== 'in_bearbeitung') return false
      const q = query.toLowerCase()
      return !q || (
        v.license_plate?.toLowerCase().includes(q) ||
        v.vin?.toLowerCase().includes(q) ||
        v.brand_model?.toLowerCase().includes(q)
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
      doc.save(`Fahrtenbuch_${fleet?.name ?? 'Flotte'}_${date}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  async function handleCreate(payload: Omit<Vehicle, 'id' | 'created_at' | 'fleet'>) {
    const v = await createVehicle({ ...payload, fleet_id: id ?? null })
    setShowCreate(false)
    navigate(`/vehicle/${v.id}`)
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
          <span className="text-sm text-gray-400">{vehicles.length} Fzg.</span>
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
            {sortBy === 'newest' ? 'Neueste zuerst' : 'A → Z'}
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
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && query && (
          <p className="text-center text-gray-400 py-8">{t('vehicles.no_results')}</p>
        )}

        {!loading && vehicles.length === 0 && (
          <p className="text-center text-gray-400 py-12">{t('vehicles.no_vehicles')}</p>
        )}

        {filtered.map((v) => (
          <VehicleRow
            key={v.id}
            vehicle={v}
            onClick={() => navigate(`/vehicle/${v.id}`)}
            onAddKm={() => setAddKmVehicle(v)}
          />
        ))}

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
          onSave={handleCreate}
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
    </Layout>
  )
}

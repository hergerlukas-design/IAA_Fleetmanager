import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Link } from 'react-router-dom'
import { AlertTriangle, Search, Trash2, X, Sparkles, Copy, Ghost, ExternalLink } from 'lucide-react'
import Layout from '@/components/Layout'
import Modal from '@/components/Modal'
import { useAuth } from '@/contexts/useAuth'
import {
  findDuplicateVehicles, findOrphanedRecords, deleteVehicles, deleteOrphanRows,
  type DuplicateGroup, type OrphanGroup,
} from '@/lib/duplicateScan'

const ORPHAN_TABLE_LABEL: Record<OrphanGroup['table'], string> = {
  vehicle_photos:     'Fotos',
  damage_records:      'Schäden',
  intake_protocols:    'Protokolle',
  vehicle_km_history:  'KM-Verlauf',
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('de-CH', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function DuplicateScan() {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()

  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([])
  const [orphanGroups, setOrphanGroups]       = useState<OrphanGroup[]>([])

  const [selectedVehicles, setSelectedVehicles] = useState<Set<string>>(new Set())
  const [selectedOrphans, setSelectedOrphans]   = useState<Record<string, Set<string>>>({})

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting]       = useState(false)

  if (!isAdmin) return <Navigate to="/settings" replace />

  const runScan = useCallback(async () => {
    setScanning(true)
    setError(null)
    try {
      const [dupes, orphans] = await Promise.all([findDuplicateVehicles(), findOrphanedRecords()])
      setDuplicateGroups(dupes)
      setOrphanGroups(orphans)
      setSelectedVehicles(new Set())
      setSelectedOrphans({})
      setScanned(true)
    } catch {
      setError(t('errors.save_failed'))
    } finally {
      setScanning(false)
    }
  }, [t])

  function toggleVehicle(id: string) {
    setSelectedVehicles(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleOrphan(table: string, id: string) {
    setSelectedOrphans(prev => {
      const set = new Set(prev[table] ?? [])
      if (set.has(id)) set.delete(id); else set.add(id)
      return { ...prev, [table]: set }
    })
  }

  // Selects every entry in a group except the "most complete" one (most photos,
  // then damages, then a protocol) — a fast starting point for the reviewer.
  function autoSelectGroup(group: DuplicateGroup) {
    const sorted = [...group.entries].sort((a, b) => {
      if (a.hasProtocol !== b.hasProtocol) return a.hasProtocol ? -1 : 1
      if (a.photoCount !== b.photoCount) return b.photoCount - a.photoCount
      return b.damageCount - a.damageCount
    })
    setSelectedVehicles(prev => {
      const next = new Set(prev)
      for (const entry of sorted.slice(1)) next.add(entry.vehicle.id)
      return next
    })
  }

  const totalSelected = selectedVehicles.size + Object.values(selectedOrphans).reduce((n, s) => n + s.size, 0)

  async function handleDelete() {
    setDeleting(true)
    try {
      if (selectedVehicles.size > 0) await deleteVehicles([...selectedVehicles])
      for (const [table, ids] of Object.entries(selectedOrphans)) {
        if (ids.size > 0) await deleteOrphanRows(table as OrphanGroup['table'], [...ids])
      }
      setConfirmOpen(false)
      await runScan()
    } catch {
      setError(t('errors.save_failed'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Layout
      header={
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">{t('duplicate_scan.title')}</h1>
          <img src="/logo.png" alt="carhandling" className="h-11 w-auto" />
        </div>
      }
    >
      <div className="p-4 space-y-4 pb-24">
        {!scanned && !scanning && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center space-y-3">
            <Search className="mx-auto text-gray-300" size={32} />
            <p className="text-sm text-gray-500">{t('duplicate_scan.intro')}</p>
            <button onClick={runScan}
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors">
              {t('duplicate_scan.scan_btn')}
            </button>
          </div>
        )}

        {scanning && (
          <div className="space-y-2">
            {[0, 1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">{error}</div>
        )}

        {scanned && !scanning && (
          <>
            <button onClick={runScan}
              className="w-full py-2.5 rounded-xl border border-gray-300 text-gray-600 font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
              <Search size={16} /> {t('duplicate_scan.rescan_btn')}
            </button>

            {duplicateGroups.length === 0 && orphanGroups.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
                <p className="text-sm text-gray-500">{t('duplicate_scan.none_found')}</p>
              </div>
            )}

            {duplicateGroups.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm px-1">
                  <Copy size={16} /> {t('duplicate_scan.duplicates_title')}
                  <span className="ml-auto text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-semibold">
                    {duplicateGroups.length}
                  </span>
                </div>
                {duplicateGroups.map(group => (
                  <div key={`${group.field}-${group.key}`} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-400">
                          {group.field === 'license_plate' ? t('vehicles.license_plate') : t('vehicles.vin')}
                        </p>
                        <p className="font-mono font-semibold text-gray-900 truncate">{group.key}</p>
                      </div>
                      <button onClick={() => autoSelectGroup(group)}
                        className="flex-shrink-0 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors">
                        <Sparkles size={12} /> {t('duplicate_scan.auto_select')}
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {group.entries.map(entry => {
                        const v = entry.vehicle
                        const selected = selectedVehicles.has(v.id)
                        const incomplete = !entry.hasProtocol
                        return (
                          <div key={v.id}
                            className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition-colors ${
                              selected ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-transparent hover:border-gray-200'
                            }`}>
                            <label className="flex items-start gap-2.5 flex-1 min-w-0 cursor-pointer">
                              <input type="checkbox" checked={selected} onChange={() => toggleVehicle(v.id)}
                                className="mt-0.5 w-4 h-4 accent-red-600 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-sm font-medium text-gray-900 truncate">
                                    {v.brand_model || t('duplicate_scan.no_brand')}
                                  </span>
                                  {incomplete && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
                                      {t('duplicate_scan.incomplete')}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-400">{fmtDate(v.created_at)}</p>
                                <p className="text-xs text-gray-400">
                                  {t('duplicate_scan.photo_count', { count: entry.photoCount })} ·{' '}
                                  {t('duplicate_scan.damage_count', { count: entry.damageCount })} ·{' '}
                                  {entry.hasProtocol ? t('duplicate_scan.has_protocol') : t('duplicate_scan.no_protocol')}
                                </p>
                              </div>
                            </label>
                            <Link to={`/vehicle/${v.id}`} target="_blank" rel="noopener noreferrer"
                              title={t('duplicate_scan.view_vehicle')}
                              className="flex-shrink-0 p-1.5 -m-1 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors">
                              <ExternalLink size={16} />
                            </Link>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {orphanGroups.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm px-1">
                  <Ghost size={16} /> {t('duplicate_scan.orphans_title')}
                </div>
                {orphanGroups.map(group => (
                  <div key={group.table} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
                    <p className="text-xs font-semibold text-gray-500">
                      {ORPHAN_TABLE_LABEL[group.table]} ({group.rows.length})
                    </p>
                    <div className="space-y-1.5">
                      {group.rows.map(row => {
                        const selected = selectedOrphans[group.table]?.has(row.id) ?? false
                        return (
                          <label key={row.id}
                            className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${
                              selected ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-transparent hover:border-gray-200'
                            }`}>
                            <input type="checkbox" checked={selected} onChange={() => toggleOrphan(group.table, row.id)}
                              className="mt-0.5 w-4 h-4 accent-red-600 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 truncate">{row.label}</p>
                              <p className="text-xs text-gray-400">{fmtDate(row.created_at)}</p>
                              <p className="text-xs text-gray-300 font-mono truncate">{row.vehicle_id}</p>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {totalSelected > 0 && (
        <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 z-20 px-4">
          <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg border border-gray-200 p-3 flex items-center gap-3">
            <span className="text-sm text-gray-600 flex-1">
              {t('duplicate_scan.selected_count', { count: totalSelected })}
            </span>
            <button onClick={() => setConfirmOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors">
              <Trash2 size={15} /> {t('common.delete')}
            </button>
          </div>
        </div>
      )}

      {confirmOpen && (
        <Modal onClose={() => !deleting && setConfirmOpen(false)} className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="text-red-500" size={20} /> {t('duplicate_scan.confirm_title')}
            </h2>
            <button onClick={() => setConfirmOpen(false)} disabled={deleting}
              className="text-gray-400 hover:text-gray-700"><X size={22} /></button>
          </div>
          <p className="text-sm text-gray-600">
            {t('duplicate_scan.confirm_body', { count: totalSelected })}
          </p>
          <button onClick={handleDelete} disabled={deleting}
            className="w-full py-3 rounded-xl bg-red-600 text-white font-semibold disabled:opacity-50 hover:bg-red-700 transition-colors">
            {deleting ? t('common.loading') : t('duplicate_scan.confirm_delete_btn')}
          </button>
        </Modal>
      )}
    </Layout>
  )
}

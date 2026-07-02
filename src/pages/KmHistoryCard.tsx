import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, ChevronDown } from 'lucide-react'
import { fetchKmHistory } from '@/lib/kmHistory'
import type { KmHistoryEntry } from '@/lib/types'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { savePdf } from '@/lib/export'

interface Props {
  vehicleId: string
  vehicleLabel: string  // license plate or VIN for PDF header
  pdfOnly?: boolean     // admin compact mode: just the export button, lazy fetch
}

export default function KmHistoryCard({ vehicleId, vehicleLabel, pdfOnly = false }: Props) {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<KmHistoryEntry[]>([])
  const [fetched,   setFetched]   = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [exporting, setExporting] = useState(false)
  const [open, setOpen] = useState(false)

  // Normal mode: fetch on first open only
  useEffect(() => {
    if (!pdfOnly && open && !fetched) {
      void (async () => {
        setLoading(true)
        try {
          const data = await fetchKmHistory(vehicleId)
          setEntries(data)
          setFetched(true)
        } catch { /* silent */
        } finally {
          setLoading(false)
        }
      })()
    }
  }, [open, pdfOnly, vehicleId, fetched])

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('de-CH', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  async function generatePdf(data: KmHistoryEntry[]) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    doc.setFontSize(14)
    doc.text(`${t('km_history.pdf_title')} – ${vehicleLabel}`, 14, 14)
    doc.setFontSize(9)
    doc.text(new Date().toLocaleDateString('de-CH'), 14, 20)

    const rows = [...data].reverse().map(e => [
      formatDate(e.recorded_at),
      e.km.toLocaleString() + ' km',
      e.km_delta != null ? `+${e.km_delta.toLocaleString()} km` : '—',
      e.zweck ?? '—',
      e.recorded_by ?? '—',
    ])

    autoTable(doc, {
      startY: 25,
      head: [[
        t('km_history.col_date'),
        t('km_history.col_km'),
        t('km_history.col_delta'),
        t('km_history.col_zweck'),
        t('km_history.col_driver'),
      ]],
      body: rows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    })

    await savePdf(doc, `Fahrtenbuch_${vehicleLabel}_${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  // pdfOnly: fetch lazily on click, then generate
  async function handleExportPdf() {
    setExporting(true)
    try {
      const data = fetched ? entries : await fetchKmHistory(vehicleId)
      if (!fetched) { setEntries(data); setFetched(true) }
      generatePdf(data)
    } catch { /* silent */ }
    finally { setExporting(false) }
  }

  // Normal mode: entries already in state (loaded on open)
  async function handleExportPdfSync() {
    await generatePdf(entries)
  }

  // ── pdfOnly (admin compact) ────────────────────────────────────────────────
  if (pdfOnly) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">{t('km_history.fahrtenbuch')}</span>
        <button
          onClick={handleExportPdf}
          disabled={exporting}
          className="flex items-center gap-1.5 text-xs text-blue-600 font-medium hover:text-blue-800 disabled:opacity-50"
        >
          <FileText size={13} />
          {exporting ? t('common.loading') : t('km_history.export_pdf')}
        </button>
      </div>
    )
  }

  // ── Full collapsible card ──────────────────────────────────────────────────
  const totalDriven = entries.length >= 2
    ? entries[0].km - entries[entries.length - 1].km
    : null
  const lastKm = entries[0]?.km ?? null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide flex-1">
          {t('km_history.title')}
        </h2>
        {!open && lastKm != null && (
          <span className="text-xs text-gray-400 font-medium mr-1">
            {lastKm.toLocaleString()} km
            {totalDriven != null && totalDriven > 0 && (
              <span className="text-blue-500 ml-1">+{totalDriven.toLocaleString()}</span>
            )}
          </span>
        )}
        <ChevronDown
          size={16}
          className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
          {fetched && entries.length > 0 && (
            <div className="flex justify-end pt-3">
              <button
                onClick={e => { e.stopPropagation(); handleExportPdfSync() }}
                className="flex items-center gap-1 text-xs text-blue-600 font-medium hover:text-blue-800"
              >
                <FileText size={13} />
                {t('km_history.export_pdf')}
              </button>
            </div>
          )}

          {totalDriven != null && (
            <div className="flex gap-3">
              <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
                <p className="text-xs text-gray-400">{t('km_history.total_driven')}</p>
                <p className="text-sm font-bold text-gray-900">+{totalDriven.toLocaleString()} km</p>
              </div>
              <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
                <p className="text-xs text-gray-400">{t('km_history.last_entry')}</p>
                <p className="text-sm font-semibold text-gray-900">{entries[0].km.toLocaleString()} km</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {!loading && fetched && entries.length === 0 && (
            <p className="text-sm text-gray-400 py-2">{t('km_history.no_entries')}</p>
          )}

          <div className="space-y-2">
            {entries.map(e => (
              <div key={e.id} className="flex items-start gap-3 px-3 py-2.5 bg-gray-50 rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">
                      {e.km.toLocaleString()} km
                    </span>
                    {e.km_delta != null && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                        +{e.km_delta.toLocaleString()} km
                      </span>
                    )}
                  </div>
                  {e.zweck && (
                    <p className="text-xs text-gray-600 truncate mt-0.5">{e.zweck}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-400">{formatDate(e.recorded_at)}</p>
                  {e.recorded_by && (
                    <p className="text-xs text-gray-300 mt-0.5">{e.recorded_by}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

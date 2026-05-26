import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { fetchZweckSuggestions } from '@/lib/kmHistory'

interface Props {
  vehicleId: string
  oldKm: number | null
  newKm: number
  onConfirm: (zweck: string | null) => Promise<void>
  onClose: () => void
}

export default function KmLogSheet({ vehicleId, oldKm, newKm, onConfirm, onClose }: Props) {
  const { t } = useTranslation()
  const [zweck, setZweck] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  const delta = oldKm != null ? newKm - oldKm : null

  useEffect(() => {
    fetchZweckSuggestions(vehicleId).then(setSuggestions).catch(() => {})
  }, [vehicleId])

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[80dvh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{t('km_history.log_trip')}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <X size={22} />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
          {/* KM summary */}
          <div className="bg-blue-50 rounded-2xl px-4 py-3 space-y-1">
            <p className="text-sm text-blue-700 font-medium">
              {t('km_history.new_km', { km: newKm.toLocaleString() })}
            </p>
            {delta != null && (
              <p className="text-xs text-blue-500">
                {t('km_history.delta', { delta: delta.toLocaleString() })}
              </p>
            )}
          </div>

          {/* Zweck input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('km_history.zweck_label')}
            </label>
            <input
              type="text"
              value={zweck}
              onChange={e => setZweck(e.target.value)}
              placeholder={t('km_history.zweck_placeholder')}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-400 text-sm"
              autoFocus
            />

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {suggestions
                  .filter(s => s.toLowerCase().includes(zweck.toLowerCase()))
                  .slice(0, 8)
                  .map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setZweck(s)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                        s === zweck
                          ? 'bg-blue-100 text-blue-800 border-blue-300 font-medium'
                          : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium disabled:opacity-40"
            >
              {t('common.cancel')}
            </button>
            <button
              disabled={saving || saved}
              onClick={async () => {
                setSaving(true)
                try {
                  await onConfirm(zweck.trim() || null)
                  setSaving(false)
                  setSaved(true)
                  setTimeout(() => onClose(), 900)
                } catch (err) {
                  setSaving(false)
                  alert(t('errors.save_failed') + '\n' + (err instanceof Error ? err.message : String(err)))
                }
              }}
              className={`flex-1 py-3 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-50 ${
                saved ? 'bg-emerald-500' : 'bg-blue-600'
              }`}
            >
              {saved ? '✓ ' + t('common.success') : saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { fetchZweckSuggestions, createKmEntry } from '@/lib/kmHistory'
import { updateVehicle } from '@/lib/vehicles'
import { useAuth } from '@/contexts/useAuth'
import Modal from '@/components/Modal'
import type { Vehicle } from '@/lib/types'

interface Props {
  vehicle: Vehicle
  onSaved: () => void
  onClose: () => void
}

export default function AddKmSheet({ vehicle, onSaved, onClose }: Props) {
  const { t } = useTranslation()
  const { userName } = useAuth()
  const [km, setKm] = useState('')
  const [zweck, setZweck] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchZweckSuggestions(vehicle.id).then(setSuggestions).catch(() => {})
  }, [vehicle.id])

  const newKmNum = km ? parseInt(km) : NaN
  const oldKm = vehicle.km ?? null
  const delta = oldKm != null && !isNaN(newKmNum) && newKmNum > oldKm
    ? newKmNum - oldKm
    : null

  async function handleSave() {
    if (!km || isNaN(newKmNum)) return
    if (oldKm != null && newKmNum < oldKm) {
      setError(t('km_history.backwards_error', { km: oldKm.toLocaleString() }))
      return
    }
    setSaving(true)
    setError(null)
    try {
      const kmDelta = oldKm != null ? newKmNum - oldKm : null
      await updateVehicle(vehicle.id, { km: newKmNum })
      await createKmEntry(vehicle.id, newKmNum, kmDelta, zweck.trim() || null, userName)
      setSaved(true)
      setTimeout(() => { onSaved(); onClose() }, 900)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.save_failed'))
      setSaving(false)
    }
  }

  const label = vehicle.license_plate || vehicle.vin || '—'

  return (
    <Modal onClose={onClose}>

      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{t('km_history.log_trip')}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{label}</p>
        </div>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
          <X size={22} />
        </button>
      </div>

      <div className="px-4 py-4 space-y-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">

        {/* KM input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('status_section.km')}
          </label>
          {oldKm != null && (
            <p className="text-xs text-gray-400 mb-1.5">
              {t('km_history.last_entry')}: {oldKm.toLocaleString()} km
            </p>
          )}
          <div className="flex gap-2 items-center">
            <input
              type="number"
              inputMode="numeric"
              value={km}
              onChange={e => { setKm(e.target.value); setError(null) }}
              placeholder={oldKm != null ? String(oldKm) : '0'}
              className="flex-1 px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-400 text-sm"
              autoFocus
            />
            <span className="text-sm text-gray-400 flex-shrink-0">km</span>
          </div>
          {delta != null && (
            <p className="text-xs text-blue-500 mt-1">+{delta.toLocaleString()} km</p>
          )}
          {error && (
            <p className="text-xs text-red-500 mt-1">{error}</p>
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
          />
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
            disabled={saving || saved}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium disabled:opacity-40"
          >
            {t('common.cancel')}
          </button>
          <button
            disabled={saving || saved || !km || isNaN(newKmNum)}
            onClick={handleSave}
            className={`flex-1 py-3 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-50 ${
              saved ? 'bg-emerald-500' : 'bg-blue-600'
            }`}
          >
            {saved ? '✓ ' + t('common.success') : saving ? t('common.loading') : t('common.save')}
          </button>
        </div>

      </div>
    </Modal>
  )
}

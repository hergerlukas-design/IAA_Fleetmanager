import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { fetchActiveFleets } from '@/lib/fleets'
import { supabase } from '@/lib/supabase'
import type { Fleet, Vehicle } from '@/lib/types'

interface Props {
  defaultFleetId?: string
  onSave: (payload: Omit<Vehicle, 'id' | 'created_at' | 'fleet'>) => Promise<void>
  onClose: () => void
}

export default function CreateVehicleSheet({ defaultFleetId, onSave, onClose }: Props) {
  const { t }      = useTranslation()
  const { userName } = useAuth()

  const [fleets, setFleets]   = useState<Fleet[]>([])
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const [vin, setVin]                 = useState('')
  const [licensePlate, setLicensePlate] = useState('')
  const [brandModel, setBrandModel]   = useState('')
  const [km, setKm]                   = useState('')
  const [fuel, setFuel]               = useState('100')
  const [battery, setBattery]         = useState('')
  const [fleetId, setFleetId]         = useState(defaultFleetId ?? '')

  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([])
  const [vinPrefixes, setVinPrefixes]           = useState<string[]>([])
  const vinInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchActiveFleets().then(setFleets).catch(() => {})

    // Brand/Model suggestions
    supabase.from('vehicles').select('brand_model').then(({ data }) => {
      if (!data) return
      const unique = [...new Set(
        data.map((v: { brand_model: string | null }) => v.brand_model).filter((v): v is string => !!v)
      )].sort()
      setBrandSuggestions(unique)
    })

    // VIN prefix detection: find the longest shared prefix per WMI group
    supabase.from('vehicles').select('vin').then(({ data }) => {
      if (!data) return
      const vins = data
        .map((v: { vin: string | null }) => v.vin)
        .filter((v): v is string => v != null && v.length >= 3)

      if (vins.length === 0) return

      // Group VINs by WMI (first 3 chars)
      const groups = new Map<string, string[]>()
      for (const v of vins) {
        const wmi = v.slice(0, 3)
        groups.set(wmi, [...(groups.get(wmi) ?? []), v])
      }

      // For each group find the longest common prefix
      const prefixes: string[] = []
      for (const [, groupVins] of groups) {
        if (groupVins.length === 1) {
          // Only 1 VIN with this WMI → use WMI as prefix
          prefixes.push(groupVins[0].slice(0, 3))
        } else {
          // Find longest common prefix across all VINs in this group
          let common = groupVins[0]
          for (const v of groupVins.slice(1)) {
            let i = 0
            while (i < common.length && i < v.length && common[i] === v[i]) i++
            common = common.slice(0, i)
          }
          prefixes.push(common.length >= 3 ? common : groupVins[0].slice(0, 3))
        }
      }

      setVinPrefixes([...new Set(prefixes)].slice(0, 4))
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave({
        fleet_id:     fleetId || null,
        vin:          vin.trim() || null,
        license_plate: licensePlate.trim() || null,
        brand_model:  brandModel.trim() || null,
        km:           km ? parseInt(km) : null,
        fuel:         fuel ? parseInt(fuel) : null,
        battery:      battery ? parseInt(battery) : null,
        notes:        null,
        status:       'in_bearbeitung',
        werkstatt:    false,
        created_by:   userName || null,
      })
    } catch {
      setError(t('errors.save_failed'))
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[90dvh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{t('vehicles.add')}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">{error}</div>
          )}

          {/* Fleet */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('vehicles.fleet')}</label>
            <select
              value={fleetId}
              onChange={(e) => setFleetId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-blue-400"
            >
              <option value="">{t('vehicle_card.no_fleet')}</option>
              {fleets.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* License Plate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('vehicles.license_plate')}</label>
            <input
              type="text"
              value={licensePlate}
              onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
              placeholder="AB CD 1234"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-400 font-mono uppercase"
            />
          </div>

          {/* VIN */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('vehicles.vin')}</label>
            {vinPrefixes.length > 0 && !vin && (
              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                <span className="text-xs text-gray-400">Präfix:</span>
                {vinPrefixes.map(p => (
                  <button key={p} type="button"
                    onClick={() => { setVin(p); setTimeout(() => vinInputRef.current?.focus(), 0) }}
                    className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-mono tracking-wider hover:bg-blue-100 transition-colors">
                    {p}<span className="opacity-50">…</span>
                  </button>
                ))}
              </div>
            )}
            <input
              ref={vinInputRef}
              type="text"
              value={vin}
              onChange={(e) => setVin(e.target.value.toUpperCase())}
              placeholder="WBA12345678901234"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-400 font-mono uppercase"
            />
          </div>

          {/* Brand / Model */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('vehicles.brand_model')}</label>
            <input
              type="text"
              value={brandModel}
              onChange={(e) => setBrandModel(e.target.value)}
              placeholder="Audi R8"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-400"
            />
            {brandSuggestions.length > 0 && (
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {brandSuggestions
                  .filter(s => s.toLowerCase().includes(brandModel.toLowerCase()))
                  .slice(0, 6)
                  .map(s => {
                    const active = s === brandModel
                    return (
                      <button key={s} type="button" onClick={() => setBrandModel(s)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                          active
                            ? 'bg-blue-100 text-blue-800 border-blue-300 font-medium'
                            : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200'
                        }`}>
                        {s}
                      </button>
                    )
                  })}
              </div>
            )}
          </div>

          {/* KM */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('vehicles.km')}</label>
            <input
              type="number"
              inputMode="numeric"
              value={km}
              onChange={(e) => setKm(e.target.value)}
              placeholder="0"
              min="0"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-400"
            />
          </div>

          {/* Fuel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('vehicles.fuel')} — {fuel ? `${fuel}%` : '—'}
            </label>
            <input
              type="range"
              min="0" max="100" step="5"
              value={fuel}
              onChange={(e) => setFuel(e.target.value)}
              className="w-full accent-blue-600"
            />
          </div>

          {/* Battery (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('vehicles.battery')} ({t('common.optional')}) — {battery ? `${battery}%` : '—'}
            </label>
            <input
              type="range"
              min="0" max="100" step="5"
              value={battery || 0}
              onChange={(e) => setBattery(e.target.value)}
              className="w-full accent-green-500"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </form>
      </div>
    </>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Camera, Trash2, Plus, Lock, CheckCircle2,
  AlertCircle, Pencil, ChevronRight, Wrench,
} from 'lucide-react'
import { supabase, getPhotoUrl, ERR_FILE_TOO_LARGE } from '@/lib/supabase'
import {
  fetchVehicle, updateVehicle, fetchVehiclePhotos,
  uploadVehiclePhoto, deleteVehiclePhoto, uploadSignature,
  deleteVehicle,
} from '@/lib/vehicles'
import {
  fetchProtocol, createProtocol, updateProtocol,
  confirmAnnahme,
  confirmAnnahmeByVehicleId, unlockAnnahmeByVehicleId,
} from '@/lib/protocols'
import {
  fetchDamages, createDamage, updateDamage, deleteDamage,
  uploadDamagePhoto, parseDamagePaths, serializeDamagePaths,
  DAMAGE_TYPES, DAMAGE_INTENSITIES, ZONE_LABEL_EN,
} from '@/lib/damages'
import { createKmEntry } from '@/lib/kmHistory'
import { fetchActiveFleets } from '@/lib/fleets'
import { useAuth } from '@/contexts/AuthContext'
import CarDamageSelector from '@/components/CarDamageSelector'
import KmLogSheet from '@/pages/KmLogSheet'
import KmHistoryCard from '@/pages/KmHistoryCard'
import type {
  Vehicle, VehiclePhoto, DamageRecord,
  IntakeProtocol, Fleet,
} from '@/lib/types'

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  in_bearbeitung: 'bg-amber-100 text-amber-700',
  abgeschlossen:  'bg-emerald-100 text-emerald-700',
}

const PHOTO_TYPES: VehiclePhoto['photo_type'][] = ['vorne', 'hinten', 'links', 'rechts', 'schein']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SectionHeader({ title, icon, badge, action }: {
  title: string
  icon?: React.ReactNode
  badge?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {icon && <span className="text-gray-400">{icon}</span>}
      <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide flex-1">{title}</h2>
      {badge}
      {action}
    </div>
  )
}


function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

// ─── Hero Card ───────────────────────────────────────────────────────────────

function HeroCard({ vehicle, photos }: { vehicle: Vehicle; photos: VehiclePhoto[] }) {
  const { t } = useTranslation()
  const frontPhoto = photos.find(p => p.photo_type === 'vorne')

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex gap-3">
        {/* Photo */}
        <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center">
          {frontPhoto
            ? <img src={getPhotoUrl(frontPhoto.storage_path)} alt="" className="w-full h-full object-cover" />
            : <span className="text-3xl">🚗</span>
          }
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl font-bold text-gray-900 truncate">
              {vehicle.license_plate || vehicle.vin || '—'}
            </h1>
            <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[vehicle.status]}`}>
              {t(`fleets.status.${vehicle.status}`)}
            </span>
          </div>
          <p className="text-sm text-gray-500 truncate">{vehicle.brand_model || '—'}</p>
          <p className="text-xs text-gray-400 mt-0.5">VIN: {vehicle.vin || '—'}</p>

          {vehicle.fleet && (
            <span
              className="inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full text-white font-medium"
              style={{ backgroundColor: vehicle.fleet.color ?? '#3b82f6' }}
            >
              {vehicle.fleet.name}
            </span>
          )}
        </div>
      </div>

      {/* Quick stats */}
      <div className="flex gap-3 mt-3 pt-3 border-t border-gray-100">
        {vehicle.km != null && (
          <div className="flex-1 text-center">
            <p className="text-xs text-gray-400">km</p>
            <p className="text-sm font-semibold text-gray-800">{vehicle.km.toLocaleString()}</p>
          </div>
        )}
        {vehicle.fuel != null && (
          <div className="flex-1 text-center">
            <p className="text-xs text-gray-400">⛽</p>
            <p className="text-sm font-semibold text-gray-800">{vehicle.fuel}%</p>
          </div>
        )}
        {vehicle.battery != null && vehicle.battery > 0 && (
          <div className="flex-1 text-center">
            <p className="text-xs text-gray-400">⚡</p>
            <p className="text-sm font-semibold text-gray-800">{vehicle.battery}%</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Basisdaten Card ──────────────────────────────────────────────────────────

function BasisdatenCard({ vehicle, fleets, locked, isAdmin, onUpdate }: {
  vehicle: Vehicle
  fleets: Fleet[]
  locked: boolean
  isAdmin: boolean
  onUpdate: (p: Partial<Vehicle>) => Promise<void>
}) {
  const { t }   = useTranslation()
  const canEdit = !locked && (isAdmin || vehicle.status === 'in_bearbeitung')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    license_plate: vehicle.license_plate ?? '',
    vin:           vehicle.vin ?? '',
    brand_model:   vehicle.brand_model ?? '',
    fleet_id:      vehicle.fleet_id ?? '',
    notes:         vehicle.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([])
  const [vinPrefixes, setVinPrefixes]           = useState<string[]>([])
  const vinInputRef = useRef<HTMLInputElement | null>(null)

  // Fetch suggestions once on mount (not gated on editing)
  useEffect(() => {
    // Brand/Model suggestions
    supabase.from('vehicles').select('brand_model')
      .then(({ data }) => {
        if (!data) return
        const unique = [...new Set(
          data.map((v: { brand_model: string | null }) => v.brand_model).filter((v): v is string => !!v)
        )].sort()
        setBrandSuggestions(unique)
      })

    // VIN prefix detection: longest shared prefix per WMI group
    supabase.from('vehicles').select('vin')
      .then(({ data }) => {
        if (!data) return
        const vins = data
          .map((v: { vin: string | null }) => v.vin)
          .filter((v): v is string => v != null && v.length >= 3)
        if (vins.length === 0) return

        const groups = new Map<string, string[]>()
        for (const v of vins) {
          const wmi = v.slice(0, 3)
          groups.set(wmi, [...(groups.get(wmi) ?? []), v])
        }

        const prefixes: string[] = []
        for (const [, groupVins] of groups) {
          if (groupVins.length === 1) {
            prefixes.push(groupVins[0].slice(0, 3))
          } else {
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
  }, []) // run once on mount

  useEffect(() => {
    setForm({
      license_plate: vehicle.license_plate ?? '',
      vin:           vehicle.vin ?? '',
      brand_model:   vehicle.brand_model ?? '',
      fleet_id:      vehicle.fleet_id ?? '',
      notes:         vehicle.notes ?? '',
    })
  }, [vehicle])

  const f = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function save() {
    setSaving(true)
    await onUpdate({
      license_plate: form.license_plate || null,
      vin:           form.vin || null,
      brand_model:   form.brand_model || null,
      fleet_id:      form.fleet_id || null,
      notes:         form.notes || null,
    })
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <SectionHeader
        title={t('vehicle_card.tabs.basisdaten')}
        badge={locked ? <Lock size={14} className="text-amber-400" /> : undefined}
        action={canEdit && !editing ? (
          <button onClick={() => setEditing(true)} className="text-blue-500 hover:text-blue-700">
            <Pencil size={15} />
          </button>
        ) : undefined}
      />

      {!editing ? (
        <div className="grid grid-cols-2 gap-3">
          {[
            [t('vehicles.license_plate'), vehicle.license_plate],
            [t('vehicles.vin'),           vehicle.vin],
            [t('vehicles.brand_model'),   vehicle.brand_model],
            [t('vehicles.fleet'),         vehicle.fleet?.name],
            [t('vehicles.notes'),         vehicle.notes],
          ].map(([label, val]) => val ? (
            <div key={label} className="bg-gray-50 rounded-xl px-3 py-2.5">
              <p className="text-xs text-gray-400">{label}</p>
              <p className="text-sm font-semibold text-gray-900 truncate">{val}</p>
            </div>
          ) : null)}
        </div>
      ) : (
        <div className="space-y-3">
          <Field label={t('vehicles.fleet')}>
            <select value={form.fleet_id} onChange={e => f('fleet_id', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm focus:outline-none focus:border-blue-400">
              <option value="">{t('vehicle_card.no_fleet')}</option>
              {fleets.map(fl => <option key={fl.id} value={fl.id}>{fl.name}</option>)}
            </select>
          </Field>
          <Field label={t('vehicles.license_plate')}>
            <input type="text" value={form.license_plate}
              onChange={e => f('license_plate', e.target.value.toUpperCase())}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-blue-400 font-mono uppercase" />
          </Field>
          <Field label={t('vehicles.vin')}>
            {vinPrefixes.length > 0 && !form.vin && (
              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                <span className="text-xs text-gray-400">Präfix:</span>
                {vinPrefixes.map(p => (
                  <button key={p} type="button"
                    onClick={() => { f('vin', p); setTimeout(() => vinInputRef.current?.focus(), 0) }}
                    className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-mono tracking-wider hover:bg-blue-100 transition-colors">
                    {p}<span className="opacity-50">…</span>
                  </button>
                ))}
              </div>
            )}
            <input ref={vinInputRef} type="text" value={form.vin}
              onChange={e => f('vin', e.target.value.toUpperCase())}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-blue-400 font-mono uppercase" />
          </Field>
          <Field label={t('vehicles.brand_model')}>
            <input type="text" value={form.brand_model} placeholder="Audi R8"
              onChange={e => f('brand_model', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-blue-400" />
            {brandSuggestions.length > 0 && (
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {brandSuggestions
                  .filter(s => s.toLowerCase().includes(form.brand_model.toLowerCase()))
                  .slice(0, 6)
                  .map(s => {
                    const active = s === form.brand_model
                    return (
                      <button key={s} type="button" onClick={() => f('brand_model', s)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                          active
                            ? 'bg-blue-100 text-blue-800 border-blue-300 font-medium'
                            : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200'
                        }`}>
                        {s}
                      </button>
                    )
                  })
                }
              </div>
            )}
          </Field>
          <Field label={t('vehicles.notes')}>
            <textarea value={form.notes} onChange={e => f('notes', e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-blue-400 resize-none" />
          </Field>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)}
              className="flex-1 py-2 rounded-xl border border-gray-300 text-gray-600 text-sm">
              {t('common.cancel')}
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-50">
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Fotos Card ───────────────────────────────────────────────────────────────

function FotosCard({ vehicleId, vehicle, photos, locked, isAdmin, onRefresh }: {
  vehicleId: string
  vehicle: Vehicle
  photos: VehiclePhoto[]
  locked: boolean
  isAdmin: boolean
  onRefresh: () => void
}) {
  const { t }        = useTranslation()
  const { userName } = useAuth()
  const canEdit = !locked && (isAdmin || vehicle.status === 'in_bearbeitung')
  const [uploading, setUploading] = useState<string | null>(null)
  const [cacheBust, setCacheBust] = useState(0)
  const photoByType = Object.fromEntries(photos.map(p => [p.photo_type, p]))

  async function handleFile(type: VehiclePhoto['photo_type'], file: File) {
    setUploading(type)
    try {
      await uploadVehiclePhoto(vehicleId, type, file, userName)
      setCacheBust(c => c + 1)
      onRefresh()
    } catch (err) {
      console.error('Upload error:', err)
      const raw = err instanceof Error ? err.message : String(err)
      const msg = raw === ERR_FILE_TOO_LARGE ? t('errors.file_too_large') : raw
      alert(t('errors.upload_failed') + '\n' + msg)
    } finally {
      setUploading(null)
    }
  }

  async function handleDelete(photo: VehiclePhoto) {
    if (!confirm(t('photos.delete') + '?')) return
    try {
      await deleteVehiclePhoto(photo)
      onRefresh()
    } catch (err) {
      alert(t('errors.save_failed') + '\n' + (err instanceof Error ? err.message : String(err)))
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <SectionHeader
        title={t('vehicle_card.tabs.fotos')}
        badge={locked ? <Lock size={14} className="text-amber-400" /> : undefined}
      />

      <div className="grid grid-cols-3 gap-2">
        {PHOTO_TYPES.map(type => {
          const photo     = photoByType[type]
          const isLoading = uploading === type
          return (
            <div key={type} className="relative">
              <p className="text-xs text-gray-400 mb-1">{t(`photos.${type}`)}</p>
              <label className={canEdit ? 'cursor-pointer' : 'cursor-default'}>
                {canEdit && (
                  <input type="file" accept="image/*" capture="environment" className="sr-only"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(type, f) }} />
                )}
                <div className={`aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all ${
                  photo ? 'border-transparent' : canEdit ? 'border-dashed border-gray-300 hover:border-blue-400' : 'border-gray-200'
                }`}>
                  {photo
                    ? <img src={`${getPhotoUrl(photo.storage_path)}?v=${cacheBust}`} alt={type} className="w-full h-full object-cover" />
                    : (
                      <div className="w-full h-full bg-gray-50 flex flex-col items-center justify-center text-gray-300 gap-1">
                        {isLoading
                          ? <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                          : <Camera size={16} />
                        }
                      </div>
                    )
                  }
                </div>
              </label>
              {photo && canEdit && (
                <button onClick={() => handleDelete(photo)}
                  className="absolute top-5 right-1 bg-red-500 text-white rounded-full p-0.5 shadow">
                  <Trash2 size={10} />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── File preview with proper Object URL cleanup ────────────────────────────

function FilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return (
    <div className="relative">
      <img src={url} alt="" className="w-full aspect-square object-cover rounded-lg" />
      <button type="button" onClick={onRemove}
        className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 shadow">
        <Trash2 size={9} />
      </button>
    </div>
  )
}

// ─── Schäden Card ─────────────────────────────────────────────────────────────

// ─── Damage Row ───────────────────────────────────────────────────────────────

function DamageRow({ damage: d, onDelete }: {
  damage: DamageRecord
  onDelete: (d: DamageRecord) => void
}) {
  const { t, i18n } = useTranslation()
  const isEn = i18n.language.startsWith('en')
  const [open, setOpen] = useState(false)
  const photoPaths = parseDamagePaths(d.storage_path)
  const hasDetails = !!(d.description || photoPaths.length > 0)

  return (
    <div className="bg-gray-50 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button onClick={() => hasDetails && setOpen(o => !o)}
          className="flex-1 min-w-0 flex items-center gap-2 text-left">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-gray-900">
                {t(`damages.types.${d.damage_type}`, { defaultValue: d.damage_type ?? '—' })}
              </span>
              {d.intensity && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${INTENSITY_COLORS[d.intensity] ?? ''}`}>
                  {t(`damages.intensities.${d.intensity}`)}
                </span>
              )}
            </div>
            {(d.position || d.created_at) && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {d.position && (isEn ? (ZONE_LABEL_EN[d.position] ?? d.position) : d.position)}
                {d.position && d.created_at && ' · '}
                {d.created_at && new Date(d.created_at).toLocaleDateString('de-CH')}
              </p>
            )}
          </div>
          {hasDetails && (
            <ChevronRight size={14} className={`text-gray-300 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
          )}
        </button>
        <button onClick={() => onDelete(d)} className="text-gray-300 hover:text-red-500 flex-shrink-0 p-0.5">
          <Trash2 size={15} />
        </button>
      </div>

      {open && hasDetails && (
        <div className="px-3 pb-3 space-y-2 border-t border-gray-200">
          {d.description && (
            <p className="text-xs text-gray-600 pt-2">{d.description}</p>
          )}
          {photoPaths.length > 0 && (
            <div className={`grid gap-2 ${photoPaths.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {photoPaths.map((p, i) => (
                <img key={i} src={getPhotoUrl(p)} alt={`Schadensfoto ${i + 1}`}
                  className="w-full rounded-xl object-cover max-h-48" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const INTENSITY_COLORS: Record<string, string> = {
  leicht: 'bg-green-100 text-green-700',
  mittel: 'bg-amber-100 text-amber-700',
  schwer: 'bg-red-100 text-red-700',
}

function SchadenCard({ vehicleId, damages, onRefresh }: {
  vehicleId: string
  damages: DamageRecord[]
  onRefresh: () => void
}) {
  const { t }        = useTranslation()
  const { userName } = useAuth()
  const [showForm, setShowForm]   = useState(false)
  const [formType, setFormType]   = useState<typeof DAMAGE_TYPES[number]>(DAMAGE_TYPES[0])
  const [formIntensity, setFormIntensity] = useState<typeof DAMAGE_INTENSITIES[number]>(DAMAGE_INTENSITIES[0])
  const [formPosition, setFormPosition]   = useState<string | null>(null)
  const [formDesc, setFormDesc]   = useState('')
  const [formFiles, setFormFiles] = useState<File[]>([])
  const [saving, setSaving]       = useState(false)
  const [saved,  setSaved]        = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const record = await createDamage(vehicleId, {
        damage_type:  formType,
        intensity:    formIntensity,
        position:     formPosition,
        description:  formDesc || null,
        storage_path: null,
        created_by:   userName || null,
      })
      if (formFiles.length > 0) {
        const paths = await Promise.all(
          formFiles.map((f, i) => uploadDamagePhoto(record.id, vehicleId, f, i))
        )
        await updateDamage(record.id, { storage_path: serializeDamagePaths(paths) })
      }
      onRefresh()
      setSaved(true)
      setTimeout(() => {
        setShowForm(false)
        setFormDesc('')
        setFormFiles([])
        setFormPosition(null)
        setSaved(false)
      }, 800)
    } catch (err) {
      console.error('Save error:', err)
      const raw = err instanceof Error ? err.message : String(err)
      const msg = raw === ERR_FILE_TOO_LARGE ? t('errors.file_too_large') : raw
      alert(t('errors.save_failed') + '\n' + msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(d: DamageRecord) {
    if (!confirm(t('damages.delete_confirm'))) return
    await deleteDamage(d)
    onRefresh()
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <SectionHeader
        title={`${t('damages.title')} (${damages.length})`}
        icon={<Wrench size={15} />}
        action={
          !showForm ? (
            <button onClick={() => setShowForm(true)}
              className="text-xs text-red-500 font-medium flex items-center gap-1 hover:text-red-700">
              <Plus size={14} /> {t('damages.add')}
            </button>
          ) : undefined
        }
      />

      {damages.length === 0 && !showForm && (
        <p className="text-sm text-gray-400 py-2">{t('damages.no_damages')}</p>
      )}

      <div className="space-y-2 mb-3">
        {damages.map(d => (
          <DamageRow key={d.id} damage={d} onDelete={handleDelete} />
        ))}
      </div>

      {showForm && (
        <div className="border border-gray-200 rounded-xl p-3 space-y-3 bg-gray-50">
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1.5">{t('damages.type')}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {DAMAGE_TYPES.map(dt => (
                <button key={dt} type="button" onClick={() => setFormType(dt)}
                  className={`py-1.5 px-2 rounded-lg text-xs border transition-colors ${
                    formType === dt ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700'
                  }`}>
                  {t(`damages.types.${dt}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-600 mb-1.5">{t('damages.intensity')}</p>
            <div className="flex gap-2">
              {DAMAGE_INTENSITIES.map(i => (
                <button key={i} type="button" onClick={() => setFormIntensity(i)}
                  className={`flex-1 py-1.5 rounded-lg text-xs border transition-colors ${
                    formIntensity === i ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700'
                  }`}>
                  {t(`damages.intensities.${i}`)}
                </button>
              ))}
            </div>
          </div>

          <CarDamageSelector value={formPosition} onChange={setFormPosition} />

          <Field label={t('damages.description')}>
            <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-blue-400 resize-none" />
          </Field>

          <div>
            <p className="text-xs font-medium text-gray-600 mb-1">{t('damages.photo')}</p>
            {/* Vorschau hinzugefügter Fotos */}
            {formFiles.length > 0 && (
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {formFiles.map((f, i) => (
                  <FilePreview key={i} file={f} onRemove={() => setFormFiles(fs => fs.filter((_, j) => j !== i))} />
                ))}
              </div>
            )}
            {/* Kamera / Galerie Buttons — immer sichtbar zum Hinzufügen weiterer */}
            <div className="flex gap-2">
              <label className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-gray-300 text-gray-500 text-xs cursor-pointer hover:border-blue-400 hover:text-blue-500 transition-colors">
                <input type="file" accept="image/*" capture="environment" className="sr-only"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setFormFiles(fs => [...fs, f]); e.target.value = '' }} />
                <Camera size={14} /> {t('damages.photo_camera')}
              </label>
              <label className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-gray-300 text-gray-500 text-xs cursor-pointer hover:border-blue-400 hover:text-blue-500 transition-colors">
                <input type="file" accept="image/*" multiple className="sr-only"
                  onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) setFormFiles(fs => [...fs, ...files]); e.target.value = '' }} />
                <Plus size={14} /> {t('damages.photo_gallery')}
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)}
              className="flex-1 py-2 rounded-xl border border-gray-300 text-gray-600 text-sm">
              {t('common.cancel')}
            </button>
            <button onClick={handleSave} disabled={saving || saved}
              className={`flex-1 py-2 rounded-xl text-white text-sm font-medium transition-colors ${
                saved ? 'bg-emerald-500' : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50'
              }`}>
              {saved ? '✓ ' + t('common.success') : saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Fahrzeugstatus Card ──────────────────────────────────────────────────────

function FahrzeugstatusCard({ vehicle, onUpdate, onKmChange }: {
  vehicle: Vehicle
  onUpdate: (p: Partial<Vehicle>) => Promise<void>
  onKmChange?: (newKm: number, oldKm: number | null) => void
}) {
  const { t } = useTranslation()
  const [km,   setKm]   = useState(vehicle.km?.toString() ?? '')
  const [fuel, setFuel] = useState(vehicle.fuel?.toString() ?? '100')
  const [bat,  setBat]  = useState(vehicle.battery?.toString() ?? '0')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [werkstattBusy, setWerkstattBusy] = useState(false)

  useEffect(() => {
    setKm(vehicle.km?.toString() ?? '')
    setFuel(vehicle.fuel?.toString() ?? '100')
    setBat(vehicle.battery?.toString() ?? '0')
  }, [vehicle])

  async function toggleWerkstatt() {
    setWerkstattBusy(true)
    await onUpdate({ werkstatt: !vehicle.werkstatt })
    setWerkstattBusy(false)
  }

  async function save() {
    const newKm = km ? parseInt(km) : null
    const oldKm = vehicle.km ?? null
    if (newKm != null && oldKm != null && newKm < oldKm) {
      alert(t('km_history.backwards_error', { km: oldKm.toLocaleString() }))
      return
    }
    setSaving(true)
    await onUpdate({
      km:      newKm,
      fuel:    fuel ? parseInt(fuel) : null,
      battery: bat ? parseInt(bat) : null,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    if (newKm != null && newKm !== oldKm) {
      onKmChange?.(newKm, oldKm)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <SectionHeader title={t('status_section.title')} />
      {/* Werkstatt toggle — always available */}
      <button onClick={toggleWerkstatt} disabled={werkstattBusy}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border mb-3 transition-colors ${
          vehicle.werkstatt
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-gray-50 border-gray-200 text-gray-500'
        }`}>
        <Wrench size={16} className={vehicle.werkstatt ? 'text-red-500' : 'text-gray-400'} />
        <span className="text-sm font-medium flex-1 text-left">{t('status_section.werkstatt')}</span>
        <div className={`w-9 h-5 rounded-full transition-colors relative ${vehicle.werkstatt ? 'bg-red-400' : 'bg-gray-300'}`}>
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${vehicle.werkstatt ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </div>
      </button>

      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {/* KM */}
          <div className="col-span-3">
            <Field label={t('status_section.km')}>
              <div className="flex gap-2 items-center">
                <input type="number" inputMode="numeric" value={km}
                  onChange={e => setKm(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-blue-400" />
                <span className="text-sm text-gray-400 flex-shrink-0">km</span>
              </div>
            </Field>
          </div>

          {/* Fuel */}
          <div className="col-span-3">
            <Field label={`${t('status_section.fuel')} — ${fuel}%`}>
              <input type="range" min="0" max="100" step="5" value={fuel}
                onChange={e => setFuel(e.target.value)}
                className="w-full accent-blue-600" />
            </Field>
          </div>

          {/* Battery */}
          <div className="col-span-3">
            <Field label={`${t('status_section.battery')} — ${bat}%`}>
              <input type="range" min="0" max="100" step="5" value={bat}
                onChange={e => setBat(e.target.value)}
                className="w-full accent-green-500" />
            </Field>
          </div>
        </div>

        <button onClick={save} disabled={saving}
          className={`w-full py-2.5 rounded-xl font-medium text-sm transition-colors ${
            saved ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
          }`}>
          {saved ? '✓ ' + t('common.success') : saving ? t('common.loading') : t('status_section.save')}
        </button>
      </div>
    </div>
  )
}

// ─── Annahme Action Card ─────────────────────────────────────────────────────

function AnnahmeActionCard({ vehicleId, onRefresh }: {
  vehicleId: string
  onRefresh: () => void
}) {
  const { t }        = useTranslation()
  const { userName } = useAuth()
  const [busy, setBusy] = useState(false)

  async function handleConfirm() {
    if (!confirm(t('protocol.annahme_confirm_dialog'))) return
    setBusy(true)
    try {
      await confirmAnnahmeByVehicleId(vehicleId, userName || '')
      onRefresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-blue-200 shadow-sm p-4">
      <button onClick={handleConfirm} disabled={busy}
        className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
        {busy ? t('common.loading') : <><Lock size={15} /> {t('protocol.annahme_confirm')}</>}
      </button>
      <p className="text-xs text-gray-400 text-center mt-2">{t('protocol.annahme_confirm_hint')}</p>
    </div>
  )
}

// ─── Protokoll Card ───────────────────────────────────────────────────────────

function ProtokollCard({ vehicleId, protocol, vehicleKm, isAdmin, onRefresh }: {
  vehicleId: string
  protocol: IntakeProtocol | null
  vehicleKm: number | null
  isAdmin: boolean
  onRefresh: () => void
}) {
  const { t }        = useTranslation()
  const { userName } = useAuth()
  const canvasRef    = useRef<HTMLCanvasElement | null>(null)
  const isDrawing    = useRef(false)
  const lastPos      = useRef<{ x: number; y: number } | null>(null)
  const [hasStroke, setHasStroke] = useState(false)
  const [annahmeBusy, setAnnahmeBusy] = useState(false)

  const confirmed = protocol?.annahme_confirmed ?? false

  const [editing, setEditing] = useState(!protocol)
  const [form, setForm] = useState({
    inspector_name: protocol?.inspector_name ?? userName,
    location:       protocol?.location ?? '',
    intake_date:    protocol?.intake_date ?? new Date().toISOString().split('T')[0],
    notes:          protocol?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm({
      inspector_name: protocol?.inspector_name ?? userName,
      location:       protocol?.location ?? '',
      intake_date:    protocol?.intake_date ?? new Date().toISOString().split('T')[0],
      notes:          protocol?.notes ?? '',
    })
    setEditing(!protocol)
  }, [protocol, userName])

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!
    const rect   = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top)  * scaleY,
      }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    isDrawing.current = true
    lastPos.current   = getPos(e)
  }
  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing.current || !canvasRef.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')!
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth   = 2
    ctx.lineCap     = 'round'
    ctx.stroke()
    lastPos.current = pos
    setHasStroke(true)
  }
  function endDraw() { isDrawing.current = false; lastPos.current = null }
  function clearCanvas() {
    const c = canvasRef.current
    if (!c) return
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    setHasStroke(false)
  }

  async function handleUnlockAnnahme() {
    if (!confirm(t('protocol.annahme_unlock_confirm'))) return
    setAnnahmeBusy(true)
    try {
      await unlockAnnahmeByVehicleId(vehicleId)
      onRefresh()
    } finally {
      setAnnahmeBusy(false)
    }
  }

  async function save() {
    // Admin: Speichern = gleichzeitig Annahme bestätigen → Bestätigungsdialog
    if (isAdmin && !confirm(t('protocol.annahme_confirm_dialog'))) return
    setSaving(true)
    try {
      let signatureUrl = protocol?.signature_url ?? null
      if (hasStroke && canvasRef.current) {
        const blob = await new Promise<Blob>(res =>
          canvasRef.current!.toBlob(b => res(b!), 'image/png')
        )
        signatureUrl = await uploadSignature(vehicleId, blob)
      }
      const payload = { ...form, signature_url: signatureUrl }
      const saved = protocol
        ? await updateProtocol(protocol.id, payload)
        : await createProtocol(vehicleId, payload)
      // Admin: Annahme direkt beim Speichern bestätigen
      if (isAdmin) {
        await confirmAnnahme(saved.id, userName)
        // Write starting km entry at intake confirmation
        if (vehicleKm != null) {
          try {
            await createKmEntry(vehicleId, vehicleKm, null, t('km_history.annahme_entry'), userName)
          } catch { /* non-fatal */ }
        }
      }
      setEditing(false)
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <SectionHeader title={t('protocol.title')} />

      {/* Annahme status */}
      {isAdmin && confirmed && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4">
          <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-emerald-800 text-sm">{t('protocol.annahme_confirmed')}</p>
            <p className="text-xs text-emerald-600">
              {t('protocol.annahme_confirmed_by', { name: protocol!.annahme_confirmed_by })}
              {protocol!.annahme_confirmed_at
                ? ' ' + t('protocol.annahme_confirmed_at', {
                    date: new Date(protocol!.annahme_confirmed_at).toLocaleDateString('de-CH'),
                  })
                : ''
              }
            </p>
          </div>
        </div>
      )}

      {/* No protocol yet */}
      {!protocol && !editing && (
        <div className="text-center py-4 space-y-3">
          <p className="text-gray-400 text-sm">{t('protocol.not_started')}</p>
          <button onClick={() => setEditing(true)}
            className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-medium text-sm">
            {t('protocol.start')}
          </button>
        </div>
      )}

      {/* Read view */}
      {protocol && !editing && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              [t('protocol.inspector'), protocol.inspector_name],
              [t('protocol.location'),  protocol.location],
              [t('protocol.date'),      protocol.intake_date],
              [t('protocol.notes'),     protocol.notes],
            ].map(([label, val]) => val ? (
              <div key={label} className="bg-gray-50 rounded-xl px-3 py-2.5">
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-sm font-semibold text-gray-900">{val}</p>
              </div>
            ) : null)}
          </div>

          {protocol.signature_url && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">{t('protocol.signature')}</p>
              <img src={protocol.signature_url} alt="Unterschrift"
                className="w-full max-h-20 object-contain" />
            </div>
          )}

          {!confirmed && (
            <button onClick={() => setEditing(true)}
              className="w-full py-2 rounded-xl border border-blue-200 text-blue-600 text-sm font-medium hover:bg-blue-50">
              {t('vehicle_card.edit')}
            </button>
          )}
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="space-y-3">
          <Field label={t('protocol.inspector')}>
            <input type="text" value={form.inspector_name}
              onChange={e => setForm(p => ({ ...p, inspector_name: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-blue-400" />
          </Field>
          <Field label={t('protocol.location')}>
            <input type="text" value={form.location}
              onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-blue-400" />
          </Field>
          <Field label={t('protocol.date')}>
            <input type="date" value={form.intake_date}
              onChange={e => setForm(p => ({ ...p, intake_date: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-blue-400" />
          </Field>
          <Field label={t('protocol.notes')}>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-blue-400 resize-none" />
          </Field>

          {/* Signature */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">{t('protocol.signature')}</p>
            {protocol?.signature_url && !hasStroke && (
              <img src={protocol.signature_url} alt="Unterschrift"
                className="w-full rounded-xl border border-gray-200 mb-2 max-h-20 object-contain" />
            )}
            <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-gray-50">
              <canvas ref={canvasRef} width={600} height={160} className="w-full touch-none"
                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-400">{t('protocol.signature_hint')}</span>
              <button onClick={clearCanvas} className="text-xs text-gray-400 hover:text-gray-700">
                {t('protocol.signature_clear')}
              </button>
            </div>
          </div>

          {isAdmin && (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Lock size={11} /> {t('protocol.annahme_confirm_hint')}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)}
              className="flex-1 py-2 rounded-xl border border-gray-300 text-gray-600 text-sm">
              {t('common.cancel')}
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5">
              {saving
                ? t('common.loading')
                : isAdmin
                  ? <><Lock size={13} /> {t('protocol.annahme_confirm')}</>
                  : t('common.save')
              }
            </button>
          </div>
        </div>
      )}

      {/* Admin: unlock */}
      {isAdmin && confirmed && (
        <button onClick={handleUnlockAnnahme} disabled={annahmeBusy}
          className="w-full mt-3 py-2 rounded-xl border border-red-200 text-red-500 text-xs font-medium hover:bg-red-50 disabled:opacity-50">
          {t('protocol.annahme_unlock')}
        </button>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VehicleCard() {
  const { id }       = useParams<{ id: string }>()
  const { t }        = useTranslation()
  const { isAdmin, userName } = useAuth()
  const navigate     = useNavigate()

  const [vehicle, setVehicle]   = useState<Vehicle | null>(null)
  const [pendingKmChange, setPendingKmChange] = useState<{ newKm: number; oldKm: number | null } | null>(null)
  const [fleets, setFleets]     = useState<Fleet[]>([])
  const [photos, setPhotos]     = useState<VehiclePhoto[]>([])
  const [damages, setDamages]   = useState<DamageRecord[]>([])
  const [protocol, setProtocol] = useState<IntakeProtocol | null>(null)
  const [loading, setLoading]   = useState(true)

  const loadAll = useCallback(async () => {
    if (!id) return
    try {
      const [v, f, ph, d, pr] = await Promise.all([
        fetchVehicle(id),
        fetchActiveFleets(),
        fetchVehiclePhotos(id),
        fetchDamages(id),
        fetchProtocol(id),
      ])
      setVehicle(v); setFleets(f); setPhotos(ph); setDamages(d); setProtocol(pr)
    } catch {
      setVehicle(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadAll() }, [loadAll])

  // Realtime: reload on changes from other users
  useEffect(() => {
    if (!id) return
    const ch = supabase
      .channel(`vehicle-changes:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'intake_protocols', filter: `vehicle_id=eq.${id}` }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles', filter: `id=eq.${id}` }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'damage_records', filter: `vehicle_id=eq.${id}` }, loadAll)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id, loadAll])

  async function handleVehicleUpdate(patch: Partial<Vehicle>) {
    if (!vehicle) return
    const updated = await updateVehicle(vehicle.id, patch)
    setVehicle(updated)
  }

  async function handleDelete() {
    if (!vehicle) return
    const label = vehicle.license_plate || vehicle.vin || t('vehicles.this_vehicle')
    if (!confirm(`${t('vehicles.delete_confirm')} "${label}"?`)) return
    await deleteVehicle(vehicle.id)
    navigate(-1)
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!vehicle) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">{t('errors.load_failed')}</p>
        </div>
      </div>
    )
  }

  const locked = protocol?.annahme_confirmed ?? false

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col max-w-2xl mx-auto">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-gray-500 hover:text-gray-800">
          <ArrowLeft size={22} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-gray-900 truncate">
              {vehicle.license_plate || vehicle.vin || '—'}
            </h1>
            {locked && (
              <span className="flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                <Lock size={10} /> {t('protocol.annahme_confirmed')}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 truncate">
            {vehicle.brand_model || '—'} · {vehicle.fleet?.name ?? t('vehicle_card.no_fleet')}
          </p>
        </div>
        <img src="/logo.png" alt="carhandling" className="h-11 w-auto flex-shrink-0" />
        {isAdmin && (
          <button onClick={handleDelete}
            className="p-2 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
            <Trash2 size={18} />
          </button>
        )}
      </header>

      {/* Scrollable content */}
      <main className="flex-1 px-4 py-4 space-y-4 pb-24">
        <HeroCard vehicle={vehicle} photos={photos} />

        {isAdmin ? (
          // Admin: Confirm button → Basisdaten → Fotos → Schäden → (Status after confirmed) → Protokoll
          <>
            {!locked && vehicle.status === 'in_bearbeitung' && (
              <AnnahmeActionCard vehicleId={id!} onRefresh={loadAll} />
            )}
            <BasisdatenCard vehicle={vehicle} fleets={fleets} locked={locked} isAdmin={isAdmin} onUpdate={handleVehicleUpdate} />
            <FotosCard vehicleId={id!} vehicle={vehicle} photos={photos} locked={locked} isAdmin={isAdmin}
              onRefresh={() => fetchVehiclePhotos(id!).then(setPhotos)} />
            <SchadenCard vehicleId={id!} damages={damages}
              onRefresh={() => fetchDamages(id!).then(setDamages)} />
            {locked && (
              <>
                <FahrzeugstatusCard vehicle={vehicle} onUpdate={handleVehicleUpdate}
                  onKmChange={(newKm, oldKm) => setPendingKmChange({ newKm, oldKm })} />
                <KmHistoryCard vehicleId={id!} vehicleLabel={vehicle.license_plate || vehicle.vin || ''} pdfOnly />
              </>
            )}
            <ProtokollCard vehicleId={id!} protocol={protocol} vehicleKm={vehicle.km ?? null} isAdmin={isAdmin} onRefresh={loadAll} />
          </>
        ) : (
          // User: Schäden → (Status after confirmed) → Fotos → Basisdaten → Protokoll
          <>
            <SchadenCard vehicleId={id!} damages={damages}
              onRefresh={() => fetchDamages(id!).then(setDamages)} />
            {locked && (
              <FahrzeugstatusCard vehicle={vehicle} onUpdate={handleVehicleUpdate}
                onKmChange={(newKm, oldKm) => setPendingKmChange({ newKm, oldKm })} />
            )}
            <FotosCard vehicleId={id!} vehicle={vehicle} photos={photos} locked={locked} isAdmin={isAdmin}
              onRefresh={() => fetchVehiclePhotos(id!).then(setPhotos)} />
            <BasisdatenCard vehicle={vehicle} fleets={fleets} locked={locked} isAdmin={isAdmin} onUpdate={handleVehicleUpdate} />
            <ProtokollCard vehicleId={id!} protocol={protocol} vehicleKm={vehicle.km ?? null} isAdmin={isAdmin} onRefresh={loadAll} />
          </>
        )}
      </main>

      {pendingKmChange && (
        <KmLogSheet
          vehicleId={id!}
          oldKm={pendingKmChange.oldKm}
          newKm={pendingKmChange.newKm}
          onConfirm={async (zweck) => {
            const delta = pendingKmChange.oldKm != null
              ? pendingKmChange.newKm - pendingKmChange.oldKm
              : null
            await createKmEntry(id!, pendingKmChange.newKm, delta, zweck, userName)
          }}
          onClose={() => setPendingKmChange(null)}
        />
      )}
    </div>
  )
}

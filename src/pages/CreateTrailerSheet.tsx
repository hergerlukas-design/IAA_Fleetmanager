import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Camera, Trash2, Plus, Check, ChevronRight, ChevronLeft, Link2 } from 'lucide-react'
import { useAuth } from '@/contexts/useAuth'
import { fetchActiveFleets } from '@/lib/fleets'
import { fetchVehicles } from '@/lib/vehicles'
import {
  createTrailer, updateTrailer, uploadTrailerPhoto,
  createTrailerDamage, uploadTrailerDamagePhoto, updateTrailerDamage,
  serializeTrailerDamagePaths, TRAILER_DAMAGE_POSITIONS,
} from '@/lib/trailers'
import { createCoupling } from '@/lib/couplings'
import { ERR_FILE_TOO_LARGE } from '@/lib/supabase'
import Modal from '@/components/Modal'
import type { Fleet, Vehicle, TrailerType, TrailerDamagePosition } from '@/lib/types'

interface Props {
  defaultFleetId?: string
  onDone: (trailerId: string) => void
  onClose: () => void
}

const TRAILER_TYPES: TrailerType[] = ['anhaenger', 'sattelauflieger', 'sonstiges']

const STEPS = [
  { key: 'basisdaten', icon: '1' },
  { key: 'fotos',      icon: '2' },
  { key: 'schaeden',   icon: '3' },
] as const

interface PendingDamage {
  position: TrailerDamagePosition | null
  desc: string
  files: File[]
}

export default function CreateTrailerSheet({ defaultFleetId, onDone, onClose }: Props) {
  const { t }        = useTranslation()
  const { userName } = useAuth()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [trailerId, setTrailerId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  // ── Step 1: Basisdaten ──────────────────────────────────────────────────────
  const [fleets, setFleets] = useState<Fleet[]>([])
  const [licensePlate, setLicensePlate] = useState('')
  const [trailerType, setTrailerType]   = useState<TrailerType>('anhaenger')
  const [brandModel, setBrandModel]     = useState('')
  const [fleetId, setFleetId]           = useState(defaultFleetId ?? '')

  // ── Step 2: Fotos ───────────────────────────────────────────────────────────
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const photoUrls = useMemo(() => photoFiles.map(f => URL.createObjectURL(f)), [photoFiles])
  useEffect(() => () => { photoUrls.forEach(URL.revokeObjectURL) }, [photoUrls])

  // ── Step 3: Schäden + Kopplung ───────────────────────────────────────────────
  const [damages, setDamages] = useState<PendingDamage[]>([])
  const [showDamageForm, setShowDamageForm] = useState(false)
  const [dmgPosition, setDmgPosition] = useState<TrailerDamagePosition | ''>('')
  const [dmgDesc, setDmgDesc] = useState('')
  const [dmgFiles, setDmgFiles] = useState<File[]>([])

  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [coupleVehicleId, setCoupleVehicleId] = useState('')

  useEffect(() => {
    fetchActiveFleets().then(setFleets).catch(() => {})
    fetchVehicles().then(setVehicles).catch(() => {})
  }, [])

  async function handleStep1() {
    setSaving(true)
    setError(null)
    try {
      const fields = {
        fleet_id:      fleetId || null,
        license_plate: licensePlate.trim() || null,
        trailer_type:  trailerType,
        brand_model:   brandModel.trim() || null,
      }
      if (trailerId) {
        await updateTrailer(trailerId, fields)
      } else {
        const tr = await createTrailer({
          ...fields,
          notes:      null,
          status:     'in_bearbeitung',
          created_by: userName || null,
        })
        setTrailerId(tr.id)
      }
      setStep(2)
    } catch {
      setError(t('errors.save_failed'))
    } finally {
      setSaving(false)
    }
  }

  async function handleStep2() {
    if (!trailerId) return
    setSaving(true)
    setError(null)
    try {
      let i = 0
      for (const file of photoFiles) {
        await uploadTrailerPhoto(trailerId, file, i++, userName || '')
      }
      setStep(3)
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      setError(raw === ERR_FILE_TOO_LARGE ? t('errors.file_too_large') : t('errors.upload_failed'))
    } finally {
      setSaving(false)
    }
  }

  function addDamage() {
    setDamages(prev => [...prev, { position: dmgPosition || null, desc: dmgDesc, files: [...dmgFiles] }])
    setDmgPosition('')
    setDmgDesc('')
    setDmgFiles([])
    setShowDamageForm(false)
  }
  function removeDamage(idx: number) {
    setDamages(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleFinish() {
    if (!trailerId) return
    setFinishing(true)
    setError(null)
    try {
      for (const d of damages) {
        const record = await createTrailerDamage(trailerId, {
          position:     d.position,
          description:  d.desc || null,
          storage_path: null,
          created_by:   userName || null,
        })
        if (d.files.length > 0) {
          const paths = await Promise.all(
            d.files.map((f, i) => uploadTrailerDamagePhoto(record.id, trailerId, f, i))
          )
          await updateTrailerDamage(record.id, { storage_path: serializeTrailerDamagePaths(paths) })
        }
      }
      if (coupleVehicleId) {
        await createCoupling(coupleVehicleId, trailerId, userName || null)
      }
      onDone(trailerId)
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      setError(raw === ERR_FILE_TOO_LARGE ? t('errors.file_too_large') : t('errors.save_failed'))
      setFinishing(false)
    }
  }

  return (
    <Modal onClose={onClose} closeOnBackdrop={step === 1}>
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-4 z-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">{t('trailers.add')}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <X size={22} />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((s, i) => {
            const stepNum = (i + 1) as 1 | 2 | 3
            const done = step > stepNum
            const active = step === stepNum
            const canGoBack = done && !saving && !finishing
            return (
              <div key={s.key} className="flex items-center gap-2">
                {i > 0 && (
                  <div className={`w-8 h-0.5 rounded-full transition-colors ${done ? 'bg-blue-500' : 'bg-gray-200'}`} />
                )}
                <button type="button" disabled={!canGoBack}
                  onClick={() => canGoBack && setStep(stepNum)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    done ? 'bg-blue-100 text-blue-700 cursor-pointer hover:bg-blue-200' :
                    active ? 'bg-blue-600 text-white cursor-default' :
                    'bg-gray-100 text-gray-400 cursor-default'
                  }`}>
                  {done ? <Check size={12} /> : <span>{s.icon}</span>}
                  <span className="hidden sm:inline">{t(`create_wizard.step_${s.key}`)}</span>
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="px-4 py-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm mb-4">{error}</div>
        )}

        {/* ── STEP 1: Basisdaten ───────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('vehicles.fleet')}</label>
              <select value={fleetId} onChange={(e) => setFleetId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-blue-400">
                <option value="">{t('vehicle_card.no_fleet')}</option>
                {fleets.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('trailers.license_plate')}</label>
              <input type="text" value={licensePlate} onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                placeholder="AB CD 1234"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-400 font-mono uppercase" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('trailers.type')}</label>
              <div className="grid grid-cols-3 gap-1.5">
                {TRAILER_TYPES.map(tt => (
                  <button key={tt} type="button" onClick={() => setTrailerType(tt)}
                    className={`py-2 px-2 rounded-lg text-xs border transition-colors ${
                      trailerType === tt ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700'
                    }`}>
                    {t(`trailers.types.${tt}`)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('vehicles.brand_model')}</label>
              <input type="text" value={brandModel} onChange={(e) => setBrandModel(e.target.value)}
                placeholder="Schmitz Cargobull"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-400" />
            </div>

            <button onClick={handleStep1} disabled={saving}
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {saving ? t('common.loading') : <>{t('create_wizard.next')} <ChevronRight size={18} /></>}
            </button>
          </div>
        )}

        {/* ── STEP 2: Fotos ────────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">{t('trailers.photos_hint')}</p>

            {photoUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photoUrls.map((url, i) => (
                  <div key={i} className="relative">
                    <img src={url} alt="" className="w-full aspect-[4/3] object-cover rounded-xl" />
                    <button onClick={() => setPhotoFiles(fs => fs.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 shadow">
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <label className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl border border-dashed border-gray-300 text-gray-500 text-sm cursor-pointer hover:border-blue-400 hover:text-blue-500 transition-colors">
                <input type="file" accept="image/*" capture="environment" className="sr-only"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setPhotoFiles(fs => [...fs, f]); e.target.value = '' }} />
                <Camera size={16} /> {t('damages.photo_camera')}
              </label>
              <label className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl border border-dashed border-gray-300 text-gray-500 text-sm cursor-pointer hover:border-blue-400 hover:text-blue-500 transition-colors">
                <input type="file" accept="image/*" multiple className="sr-only"
                  onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) setPhotoFiles(fs => [...fs, ...files]); e.target.value = '' }} />
                <Plus size={16} /> {t('damages.photo_gallery')}
              </label>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep(1)}
                className="py-3 px-4 rounded-xl border border-gray-300 text-gray-600 font-medium flex items-center gap-1">
                <ChevronLeft size={18} /> {t('create_wizard.back')}
              </button>
              <button onClick={handleStep2} disabled={saving}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {saving ? t('common.loading') : <>{t('create_wizard.next')} <ChevronRight size={18} /></>}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Schäden (Freitext) + Kopplung ────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            {damages.length > 0 && (
              <div className="space-y-2">
                {damages.map((d, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl px-3 py-2.5 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      {d.position && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">
                          {t(`trailers.positions.${d.position}`)}
                        </span>
                      )}
                      {d.desc && <p className="text-sm text-gray-800 mt-1 break-words">{d.desc}</p>}
                      {d.files.length > 0 && <p className="text-xs text-gray-400 mt-0.5">{d.files.length} {t('create_wizard.photos_count')}</p>}
                    </div>
                    <button onClick={() => removeDamage(i)} className="text-gray-300 hover:text-red-500 p-0.5">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {showDamageForm ? (
              <div className="border border-gray-200 rounded-xl p-3 space-y-3 bg-gray-50">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('trailers.position')}</label>
                  <select value={dmgPosition} onChange={e => setDmgPosition(e.target.value as TrailerDamagePosition | '')}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:border-blue-400">
                    <option value="">{t('trailers.position_none')}</option>
                    {TRAILER_DAMAGE_POSITIONS.map(p => (
                      <option key={p} value={p}>{t(`trailers.positions.${p}`)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('trailers.damage_description')}</label>
                  <textarea value={dmgDesc} onChange={e => setDmgDesc(e.target.value)} rows={3}
                    placeholder={t('trailers.damage_description_placeholder')}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-blue-400 resize-none" />
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">{t('damages.photo')}</p>
                  {dmgFiles.length > 0 && (
                    <div className="grid grid-cols-3 gap-1.5 mb-2">
                      {dmgFiles.map((f, i) => (
                        <DmgFilePreview key={i} file={f} onRemove={() => setDmgFiles(fs => fs.filter((_, j) => j !== i))} />
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <label className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-gray-300 text-gray-500 text-xs cursor-pointer hover:border-blue-400 hover:text-blue-500 transition-colors">
                      <input type="file" accept="image/*" capture="environment" className="sr-only"
                        onChange={e => { const f = e.target.files?.[0]; if (f) setDmgFiles(fs => [...fs, f]); e.target.value = '' }} />
                      <Camera size={14} /> {t('damages.photo_camera')}
                    </label>
                    <label className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-gray-300 text-gray-500 text-xs cursor-pointer hover:border-blue-400 hover:text-blue-500 transition-colors">
                      <input type="file" accept="image/*" multiple className="sr-only"
                        onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) setDmgFiles(fs => [...fs, ...files]); e.target.value = '' }} />
                      <Plus size={14} /> {t('damages.photo_gallery')}
                    </label>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setShowDamageForm(false)}
                    className="flex-1 py-2 rounded-xl border border-gray-300 text-gray-600 text-sm">
                    {t('common.cancel')}
                  </button>
                  <button onClick={addDamage}
                    className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
                    {t('create_wizard.add_damage')}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowDamageForm(true)}
                className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 text-sm font-medium flex items-center justify-center gap-1.5 hover:border-red-300 hover:text-red-500 transition-colors">
                <Plus size={16} /> {t('trailers.add_damage')}
              </button>
            )}

            {/* Optionale Kopplung */}
            {!showDamageForm && (
              <div className="border border-gray-200 rounded-xl p-3 bg-blue-50/40">
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                  <Link2 size={15} className="text-blue-600" /> {t('couplings.couple_optional')}
                </label>
                <select value={coupleVehicleId} onChange={e => setCoupleVehicleId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:border-blue-400">
                  <option value="">{t('couplings.no_vehicle')}</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {(v.license_plate || v.vin || '—') + (v.brand_model ? ` · ${v.brand_model}` : '')}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!showDamageForm && (
              <div className="flex gap-2 pt-1">
                <button onClick={() => setStep(2)}
                  className="py-3 px-4 rounded-xl border border-gray-300 text-gray-600 font-medium flex items-center gap-1">
                  <ChevronLeft size={18} /> {t('create_wizard.back')}
                </button>
                <button onClick={handleFinish} disabled={finishing}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {finishing ? t('common.loading') : <><Check size={18} /> {t('create_wizard.done')}</>}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

function DmgFilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
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

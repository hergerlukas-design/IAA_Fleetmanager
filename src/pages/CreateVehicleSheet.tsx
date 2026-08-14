import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Camera, Trash2, Plus, Check, ChevronRight, ChevronLeft } from 'lucide-react'
import { useAuth } from '@/contexts/useAuth'
import { fetchActiveFleets } from '@/lib/fleets'
import { createVehicle, updateVehicle, uploadVehiclePhoto, uploadSignature } from '@/lib/vehicles'
import {
  createDamage, uploadDamagePhoto, updateDamage, serializeDamagePaths,
  DAMAGE_TYPES, DAMAGE_INTENSITIES,
} from '@/lib/damages'
import {
  createTrailer, updateTrailer, uploadTrailerPhoto,
  createTrailerDamage, updateTrailerDamage, uploadTrailerDamagePhoto,
  serializeTrailerDamagePaths,
} from '@/lib/trailers'
import { createCoupling } from '@/lib/couplings'
import { createProtocol } from '@/lib/protocols'
import { supabase, ERR_FILE_TOO_LARGE } from '@/lib/supabase'
import TruckDamageSelector from '@/components/TruckDamageSelector'
import Modal from '@/components/Modal'
import type { Fleet, VehiclePhoto } from '@/lib/types'

interface Props {
  defaultFleetId?: string
  onDone: (vehicleId: string) => void
  onClose: () => void
}

const PHOTO_TYPES: VehiclePhoto['photo_type'][] = ['vorne', 'hinten', 'links', 'rechts', 'schein']

const STEPS = [
  { key: 'basisdaten', icon: '1' },
  { key: 'fotos',      icon: '2' },
  { key: 'schaeden',   icon: '3' },
  { key: 'trailer',    icon: '4' },
  { key: 'protokoll',  icon: '5' },
] as const

type StepNum = 1 | 2 | 3 | 4 | 5

interface TrailerDamageDraft { type: string; intensity: string; desc: string; files: File[] }

export default function CreateVehicleSheet({ defaultFleetId, onDone, onClose }: Props) {
  const { t }        = useTranslation()
  const { userName } = useAuth()

  const [step, setStep] = useState<StepNum>(1)
  const [vehicleId, setVehicleId] = useState<string | null>(null)

  // ── Step 1: Basisdaten ─────────────────────────────────────────────────────
  const [fleets, setFleets]   = useState<Fleet[]>([])
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const [vin, setVin]                   = useState('')
  const [licensePlate, setLicensePlate] = useState('')
  const [brandModel, setBrandModel]     = useState('')
  const [km, setKm]                     = useState('')
  const [fuel, setFuel]                 = useState('100')
  const [battery, setBattery]           = useState('')
  const [fleetId, setFleetId]           = useState(defaultFleetId ?? '')

  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([])
  const [vinPrefixes, setVinPrefixes]           = useState<string[]>([])
  const vinInputRef = useRef<HTMLInputElement>(null)

  // ── Step 2: Fotos ──────────────────────────────────────────────────────────
  const [uploading]   = useState<string | null>(null)
  const [photoFiles, setPhotoFiles] = useState<Record<string, File>>({})
  const photoUrls = useMemo(() => {
    const urls: Record<string, string> = {}
    for (const [type, file] of Object.entries(photoFiles)) {
      urls[type] = URL.createObjectURL(file)
    }
    return urls
  }, [photoFiles])
  useEffect(() => () => { Object.values(photoUrls).forEach(URL.revokeObjectURL) }, [photoUrls])

  // ── Step 3: Schäden ────────────────────────────────────────────────────────
  const [showDamageForm, setShowDamageForm]   = useState(false)
  const [damages, setDamages]                 = useState<{ type: string; intensity: string; position: string | null; desc: string; files: File[] }[]>([])
  const [dmgType, setDmgType]                 = useState<typeof DAMAGE_TYPES[number]>(DAMAGE_TYPES[0])
  const [dmgIntensity, setDmgIntensity]       = useState<typeof DAMAGE_INTENSITIES[number]>(DAMAGE_INTENSITIES[0])
  const [dmgPosition, setDmgPosition]         = useState<string | null>(null)
  const [dmgDesc, setDmgDesc]                 = useState('')
  const [dmgFiles, setDmgFiles]               = useState<File[]>([])
  const [finishing, setFinishing]             = useState(false)

  // ── Step 4: Trailer (optional) ─────────────────────────────────────────────
  const [trailerId, setTrailerId]     = useState<string | null>(null)
  const [trailerPlate, setTrailerPlate] = useState('')
  const [trailerModel, setTrailerModel] = useState('')
  const [trailerPhotos, setTrailerPhotos] = useState<File[]>([])
  const [trailerDamages, setTrailerDamages] = useState<TrailerDamageDraft[]>([])
  const [showTrailerDmgForm, setShowTrailerDmgForm] = useState(false)
  const [tDmgType, setTDmgType]           = useState<typeof DAMAGE_TYPES[number]>(DAMAGE_TYPES[0])
  const [tDmgIntensity, setTDmgIntensity] = useState<typeof DAMAGE_INTENSITIES[number]>(DAMAGE_INTENSITIES[0])
  const [tDmgDesc, setTDmgDesc]           = useState('')
  const [tDmgFiles, setTDmgFiles]         = useState<File[]>([])

  // ── Step 4: Protokoll ─────────────────────────────────────────────────────
  const [protoForm, setProtoForm] = useState({
    inspector_name: userName || '',
    location:       '',
    intake_date:    new Date().toISOString().split('T')[0],
    notes:          '',
  })
  const canvasRef  = useRef<HTMLCanvasElement | null>(null)
  const isDrawing  = useRef(false)
  const lastPos    = useRef<{ x: number; y: number } | null>(null)
  const [hasStroke, setHasStroke] = useState(false)

  useEffect(() => {
    fetchActiveFleets().then(setFleets).catch(() => {})

    supabase.from('vehicles').select('brand_model').then(({ data }) => {
      if (!data) return
      const unique = [...new Set(
        data.map((v: { brand_model: string | null }) => v.brand_model).filter((v): v is string => !!v)
      )].sort()
      setBrandSuggestions(unique)
    })

    supabase.from('vehicles').select('vin').then(({ data }) => {
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
  }, [])

  // ── Step 1 submit: create vehicle ──────────────────────────────────────────
  async function handleStep1() {
    setSaving(true)
    setError(null)
    try {
      const fields = {
        fleet_id:      fleetId || null,
        vin:           vin.trim() || null,
        license_plate: licensePlate.trim() || null,
        brand_model:   brandModel.trim() || null,
        km:            km ? parseInt(km) : null,
        fuel:          fuel ? parseInt(fuel) : null,
        battery:       battery ? parseInt(battery) : null,
      }
      if (vehicleId) {
        await updateVehicle(vehicleId, fields)
      } else {
        const v = await createVehicle({
          ...fields,
          notes:      null,
          status:     'in_bearbeitung',
          werkstatt:  false,
          created_by: userName || null,
        })
        setVehicleId(v.id)
      }
      setStep(2)
    } catch {
      setError(t('errors.save_failed'))
    } finally {
      setSaving(false)
    }
  }

  // ── Step 2: upload photos then advance ─────────────────────────────────────
  async function handleStep2() {
    if (!vehicleId) return
    setSaving(true)
    setError(null)
    try {
      for (const [type, file] of Object.entries(photoFiles)) {
        await uploadVehiclePhoto(vehicleId, type as VehiclePhoto['photo_type'], file, userName || '')
      }
      setStep(3)
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      setError(raw === ERR_FILE_TOO_LARGE ? t('errors.file_too_large') : t('errors.upload_failed'))
    } finally {
      setSaving(false)
    }
  }

  // ── Step 3: save damages then advance to step 4 ────────────────────────────
  async function handleStep3() {
    if (!vehicleId) return
    setSaving(true)
    setError(null)
    try {
      for (const d of damages) {
        const record = await createDamage(vehicleId, {
          damage_type:  d.type,
          intensity:    d.intensity as 'leicht' | 'mittel' | 'schwer',
          position:     d.position,
          description:  d.desc || null,
          storage_path: null,
          created_by:   userName || null,
        })
        if (d.files.length > 0) {
          const paths = await Promise.all(
            d.files.map((f, i) => uploadDamagePhoto(record.id, vehicleId, f, i))
          )
          await updateDamage(record.id, { storage_path: serializeDamagePaths(paths) })
        }
      }
      setStep(4)
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      setError(raw === ERR_FILE_TOO_LARGE ? t('errors.file_too_large') : t('errors.save_failed'))
    } finally {
      setSaving(false)
    }
  }

  // ── Step 4: create trailer (optional) + couple, then advance ──────────────
  const hasTrailerInput =
    !!(trailerPlate.trim() || trailerModel.trim() || trailerPhotos.length || trailerDamages.length)

  async function handleStep4() {
    if (!vehicleId) return
    // Kein Trailer erfasst → Step überspringen.
    if (!hasTrailerInput) { setStep(5); return }
    setSaving(true)
    setError(null)
    try {
      if (trailerId) {
        // Bereits angelegt (Zurück-Navigation) → nur Basisdaten aktualisieren.
        await updateTrailer(trailerId, {
          license_plate: trailerPlate.trim() || null,
          brand_model:   trailerModel.trim() || null,
        })
      } else {
        const tr = await createTrailer({
          fleet_id:      fleetId || null,
          license_plate: trailerPlate.trim() || null,
          trailer_type:  'anhaenger',
          brand_model:   trailerModel.trim() || null,
          notes:         null,
          status:        'in_bearbeitung',
          created_by:    userName || null,
        })
        setTrailerId(tr.id)

        for (let i = 0; i < trailerPhotos.length; i++) {
          await uploadTrailerPhoto(tr.id, trailerPhotos[i], i, userName || '')
        }

        for (const d of trailerDamages) {
          const record = await createTrailerDamage(tr.id, {
            position:     null,
            damage_type:  d.type,
            intensity:    d.intensity as 'leicht' | 'mittel' | 'schwer',
            description:  d.desc || null,
            storage_path: null,
            created_by:   userName || null,
          })
          if (d.files.length > 0) {
            const paths = await Promise.all(
              d.files.map((f, i) => uploadTrailerDamagePhoto(record.id, tr.id, f, i))
            )
            await updateTrailerDamage(record.id, { storage_path: serializeTrailerDamagePaths(paths) })
          }
        }

        // Trailer direkt mit dem Zugfahrzeug koppeln (Gespann).
        await createCoupling(vehicleId, tr.id, userName || null)
      }
      setStep(5)
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      setError(raw === ERR_FILE_TOO_LARGE ? t('errors.file_too_large') : t('errors.save_failed'))
    } finally {
      setSaving(false)
    }
  }

  function addTrailerDamage() {
    setTrailerDamages(prev => [...prev, {
      type: tDmgType, intensity: tDmgIntensity, desc: tDmgDesc, files: [...tDmgFiles],
    }])
    setTDmgType(DAMAGE_TYPES[0])
    setTDmgIntensity(DAMAGE_INTENSITIES[0])
    setTDmgDesc('')
    setTDmgFiles([])
    setShowTrailerDmgForm(false)
  }

  function removeTrailerDamage(idx: number) {
    setTrailerDamages(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Step 5: save protocol and finish ──────────────────────────────────────
  function getCanvasPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!
    const rect   = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }
  function startDraw(e: React.MouseEvent | React.TouchEvent) { isDrawing.current = true; lastPos.current = getCanvasPos(e) }
  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing.current || !canvasRef.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')!
    const pos = getCanvasPos(e)
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

  async function handleFinish() {
    if (!vehicleId) return
    setFinishing(true)
    setError(null)
    try {
      let signatureUrl: string | null = null
      if (hasStroke && canvasRef.current) {
        const blob = await new Promise<Blob>(res =>
          canvasRef.current!.toBlob(b => res(b!), 'image/png')
        )
        signatureUrl = await uploadSignature(vehicleId, blob)
      }
      await createProtocol(vehicleId, {
        inspector_name: protoForm.inspector_name || null,
        location:       protoForm.location || null,
        intake_date:    protoForm.intake_date || null,
        notes:          protoForm.notes || null,
        signature_url:  signatureUrl,
      })
      onDone(vehicleId)
    } catch {
      setError(t('errors.save_failed'))
      setFinishing(false)
    }
  }

  function addDamage() {
    setDamages(prev => [...prev, {
      type: dmgType, intensity: dmgIntensity, position: dmgPosition,
      desc: dmgDesc, files: [...dmgFiles],
    }])
    setDmgType(DAMAGE_TYPES[0])
    setDmgIntensity(DAMAGE_INTENSITIES[0])
    setDmgPosition(null)
    setDmgDesc('')
    setDmgFiles([])
    setShowDamageForm(false)
  }

  function removeDamage(idx: number) {
    setDamages(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Modal onClose={onClose} closeOnBackdrop={step === 1}>
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-4 z-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">{t('vehicles.add')}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <X size={22} />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((s, i) => {
            const stepNum = (i + 1) as StepNum
            const done = step > stepNum
            const active = step === stepNum
            const canGoBack = done && !saving && !finishing
            return (
              <div key={s.key} className="flex items-center gap-2">
                {i > 0 && (
                  <div className={`w-8 h-0.5 rounded-full transition-colors ${done ? 'bg-blue-500' : 'bg-gray-200'}`} />
                )}
                <button
                  type="button"
                  disabled={!canGoBack}
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

        {/* ── STEP 1: Basisdaten ─────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Fleet */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('vehicles.fleet')}</label>
              <select value={fleetId} onChange={(e) => setFleetId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-blue-400">
                <option value="">{t('vehicle_card.no_fleet')}</option>
                {fleets.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>

            {/* License Plate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('vehicles.license_plate')}</label>
              <input type="text" value={licensePlate} onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                placeholder="AB CD 1234"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-400 font-mono uppercase" />
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
              <input ref={vinInputRef} type="text" value={vin} onChange={(e) => setVin(e.target.value.toUpperCase())}
                placeholder="WBA12345678901234"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-400 font-mono uppercase" />
            </div>

            {/* Brand / Model */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('vehicles.brand_model')}</label>
              <input type="text" value={brandModel} onChange={(e) => setBrandModel(e.target.value)}
                placeholder="Audi R8"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-400" />
              {brandSuggestions.length > 0 && (
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {brandSuggestions
                    .filter(s => s.toLowerCase().includes(brandModel.toLowerCase()))
                    .slice(0, 6)
                    .map(s => (
                      <button key={s} type="button" onClick={() => setBrandModel(s)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                          s === brandModel
                            ? 'bg-blue-100 text-blue-800 border-blue-300 font-medium'
                            : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200'
                        }`}>
                        {s}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* KM */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('vehicles.km')}</label>
              <input type="number" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)}
                placeholder="0" min="0"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-400" />
            </div>

            {/* Fuel */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('vehicles.fuel')} — {fuel ? `${fuel}%` : '—'}
              </label>
              <input type="range" min="0" max="100" step="5" value={fuel} onChange={(e) => setFuel(e.target.value)}
                className="w-full accent-blue-600" />
            </div>

            {/* Battery */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('vehicles.battery')} ({t('common.optional')}) — {battery ? `${battery}%` : '—'}
              </label>
              <input type="range" min="0" max="100" step="5" value={battery || 0} onChange={(e) => setBattery(e.target.value)}
                className="w-full accent-green-500" />
            </div>

            <button onClick={handleStep1} disabled={saving}
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {saving ? t('common.loading') : <>{t('create_wizard.next')} <ChevronRight size={18} /></>}
            </button>
          </div>
        )}

        {/* ── STEP 2: Fotos ──────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">{t('create_wizard.photos_hint')}</p>

            <div className="grid grid-cols-3 gap-2">
              {PHOTO_TYPES.map(type => {
                const file = photoFiles[type]
                const previewUrl = photoUrls[type]
                const isLoading = uploading === type
                return (
                  <div key={type} className="relative">
                    <p className="text-xs text-gray-400 mb-1">{t(`photos.${type}`)}</p>
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" capture="environment" className="sr-only"
                        onChange={e => {
                          const f = e.target.files?.[0]
                          if (f) setPhotoFiles(prev => ({ ...prev, [type]: f }))
                          e.target.value = ''
                        }} />
                      <div className={`aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all ${
                        file ? 'border-transparent' : 'border-dashed border-gray-300 hover:border-blue-400'
                      }`}>
                        {file && previewUrl
                          ? <img src={previewUrl} alt={type} className="w-full h-full object-cover" />
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
                    {file && (
                      <button onClick={() => setPhotoFiles(prev => {
                        const next = { ...prev }
                        delete next[type]
                        return next
                      })}
                        className="absolute top-5 right-1 bg-red-500 text-white rounded-full p-0.5 shadow">
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep(1)}
                className="py-3 px-4 rounded-xl border border-gray-300 text-gray-600 font-medium flex items-center gap-1">
                <ChevronLeft size={18} /> {t('create_wizard.back')}
              </button>
              <button onClick={() => handleStep2()} disabled={saving}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {saving ? t('common.loading') : <>{t('create_wizard.next')} <ChevronRight size={18} /></>}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Schäden ─────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Added damages list */}
            {damages.length > 0 && (
              <div className="space-y-2">
                {damages.map((d, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl px-3 py-2.5 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-gray-900">
                          {t(`damages.types.${d.type}`, { defaultValue: d.type })}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          d.intensity === 'leicht' ? 'bg-green-100 text-green-700' :
                          d.intensity === 'mittel' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {t(`damages.intensities.${d.intensity}`)}
                        </span>
                      </div>
                      {d.position && <p className="text-xs text-gray-400 mt-0.5">{d.position}</p>}
                      {d.files.length > 0 && <p className="text-xs text-gray-400 mt-0.5">{d.files.length} {t('create_wizard.photos_count')}</p>}
                    </div>
                    <button onClick={() => removeDamage(i)} className="text-gray-300 hover:text-red-500 p-0.5">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Damage form */}
            {showDamageForm ? (
              <div className="border border-gray-200 rounded-xl p-3 space-y-3 bg-gray-50">
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1.5">{t('damages.type')}</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {DAMAGE_TYPES.map(dt => (
                      <button key={dt} type="button" onClick={() => setDmgType(dt)}
                        className={`py-1.5 px-2 rounded-lg text-xs border transition-colors ${
                          dmgType === dt ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700'
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
                      <button key={i} type="button" onClick={() => setDmgIntensity(i)}
                        className={`flex-1 py-1.5 rounded-lg text-xs border transition-colors ${
                          dmgIntensity === i ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700'
                        }`}>
                        {t(`damages.intensities.${i}`)}
                      </button>
                    ))}
                  </div>
                </div>

                <TruckDamageSelector value={dmgPosition} onChange={setDmgPosition} />

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('damages.description')}</label>
                  <textarea value={dmgDesc} onChange={e => setDmgDesc(e.target.value)} rows={2}
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
                <Plus size={16} /> {t('damages.add')}
              </button>
            )}

            {/* Action buttons */}
            {!showDamageForm && (
              <div className="flex gap-2 pt-2">
                <button onClick={() => setStep(2)}
                  className="py-3 px-4 rounded-xl border border-gray-300 text-gray-600 font-medium flex items-center gap-1">
                  <ChevronLeft size={18} /> {t('create_wizard.back')}
                </button>
                {damages.length === 0 ? (
                  <button onClick={handleStep3} disabled={saving}
                    className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                    {saving ? t('common.loading') : <><Check size={18} /> {t('create_wizard.no_damages')}</>}
                  </button>
                ) : (
                  <button onClick={handleStep3} disabled={saving}
                    className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                    {saving ? t('common.loading') : <>{t('create_wizard.next')} <ChevronRight size={18} /></>}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 4: Trailer (optional) ──────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">{t('create_wizard.trailer_hint')}</p>

            {/* Basisdaten: nur Kennzeichen + Modell */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{t('create_wizard.trailer_basisdaten')}</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('trailers.license_plate')}</label>
                <input type="text" value={trailerPlate} onChange={e => setTrailerPlate(e.target.value.toUpperCase())}
                  placeholder="AB CD 1234"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-400 font-mono uppercase" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('vehicles.brand_model')}</label>
                <input type="text" value={trailerModel} onChange={e => setTrailerModel(e.target.value)}
                  placeholder="Krone / Schmitz …"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-400" />
              </div>
            </div>

            {/* Fotos – Raster mit dauerhaften Hinzufügen-Kacheln (mehrere möglich) */}
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">{t('create_wizard.trailer_photos')}</p>
              <div className="grid grid-cols-3 gap-1.5">
                {trailerPhotos.map((f, i) => (
                  <DmgFilePreview key={i} file={f} onRemove={() => setTrailerPhotos(fs => fs.filter((_, j) => j !== i))} />
                ))}
                {/* Kachel: aus Galerie hinzufügen (mehrere) */}
                <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-400 cursor-pointer hover:border-blue-400 hover:text-blue-500 transition-colors">
                  <input type="file" accept="image/*" multiple className="sr-only"
                    onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) setTrailerPhotos(fs => [...fs, ...files]); e.target.value = '' }} />
                  <Plus size={24} />
                  <span className="text-[10px] font-medium leading-none">{t('damages.photo_gallery')}</span>
                </label>
                {/* Kachel: Foto aufnehmen */}
                <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-400 cursor-pointer hover:border-blue-400 hover:text-blue-500 transition-colors">
                  <input type="file" accept="image/*" capture="environment" className="sr-only"
                    onChange={e => { const f = e.target.files?.[0]; if (f) setTrailerPhotos(fs => [...fs, f]); e.target.value = '' }} />
                  <Camera size={20} />
                  <span className="text-[10px] font-medium leading-none">{t('damages.photo_camera')}</span>
                </label>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">{t('trailers.photos_hint')}</p>
            </div>

            {/* Schäden – ohne visuelle Karte: Art, Stärke, Beschreibung, Foto */}
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">{t('create_wizard.trailer_damages')}</p>
              {trailerDamages.length > 0 && (
                <div className="space-y-2 mb-2">
                  {trailerDamages.map((d, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl px-3 py-2.5 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-gray-900">{t(`damages.types.${d.type}`, { defaultValue: d.type })}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            d.intensity === 'leicht' ? 'bg-green-100 text-green-700' :
                            d.intensity === 'mittel' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>{t(`damages.intensities.${d.intensity}`)}</span>
                        </div>
                        {d.desc && <p className="text-xs text-gray-400 mt-0.5 truncate">{d.desc}</p>}
                        {d.files.length > 0 && <p className="text-xs text-gray-400 mt-0.5">{d.files.length} {t('create_wizard.photos_count')}</p>}
                      </div>
                      <button onClick={() => removeTrailerDamage(i)} className="text-gray-300 hover:text-red-500 p-0.5">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {showTrailerDmgForm ? (
                <div className="border border-gray-200 rounded-xl p-3 space-y-3 bg-gray-50">
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1.5">{t('damages.type')}</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {DAMAGE_TYPES.map(dt => (
                        <button key={dt} type="button" onClick={() => setTDmgType(dt)}
                          className={`py-1.5 px-2 rounded-lg text-xs border transition-colors ${
                            tDmgType === dt ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700'
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
                        <button key={i} type="button" onClick={() => setTDmgIntensity(i)}
                          className={`flex-1 py-1.5 rounded-lg text-xs border transition-colors ${
                            tDmgIntensity === i ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700'
                          }`}>
                          {t(`damages.intensities.${i}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('damages.description')}</label>
                    <textarea value={tDmgDesc} onChange={e => setTDmgDesc(e.target.value)} rows={2}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-blue-400 resize-none" />
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">{t('damages.photo')}</p>
                    {tDmgFiles.length > 0 && (
                      <div className="grid grid-cols-3 gap-1.5 mb-2">
                        {tDmgFiles.map((f, i) => (
                          <DmgFilePreview key={i} file={f} onRemove={() => setTDmgFiles(fs => fs.filter((_, j) => j !== i))} />
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <label className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-gray-300 text-gray-500 text-xs cursor-pointer hover:border-blue-400 hover:text-blue-500 transition-colors">
                        <input type="file" accept="image/*" capture="environment" className="sr-only"
                          onChange={e => { const f = e.target.files?.[0]; if (f) setTDmgFiles(fs => [...fs, f]); e.target.value = '' }} />
                        <Camera size={14} /> {t('damages.photo_camera')}
                      </label>
                      <label className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-gray-300 text-gray-500 text-xs cursor-pointer hover:border-blue-400 hover:text-blue-500 transition-colors">
                        <input type="file" accept="image/*" multiple className="sr-only"
                          onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) setTDmgFiles(fs => [...fs, ...files]); e.target.value = '' }} />
                        <Plus size={14} /> {t('damages.photo_gallery')}
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setShowTrailerDmgForm(false)}
                      className="flex-1 py-2 rounded-xl border border-gray-300 text-gray-600 text-sm">
                      {t('common.cancel')}
                    </button>
                    <button onClick={addTrailerDamage}
                      className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
                      {t('create_wizard.add_trailer_damage')}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowTrailerDmgForm(true)}
                  className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 text-sm font-medium flex items-center justify-center gap-1.5 hover:border-red-300 hover:text-red-500 transition-colors">
                  <Plus size={16} /> {t('damages.add')}
                </button>
              )}
            </div>

            {/* Nav */}
            {!showTrailerDmgForm && (
              <div className="flex gap-2 pt-2">
                <button onClick={() => setStep(3)}
                  className="py-3 px-4 rounded-xl border border-gray-300 text-gray-600 font-medium flex items-center gap-1">
                  <ChevronLeft size={18} /> {t('create_wizard.back')}
                </button>
                <button onClick={handleStep4} disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {saving ? t('common.loading') : <>{hasTrailerInput ? t('create_wizard.next') : t('create_wizard.no_trailer')} <ChevronRight size={18} /></>}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 5: Protokoll ───────────────────────────────────────────── */}
        {step === 5 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">{t('create_wizard.protocol_hint')}</p>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('protocol.inspector')}</label>
              <input type="text" value={protoForm.inspector_name}
                onChange={e => setProtoForm(p => ({ ...p, inspector_name: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-blue-400" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('protocol.location')}</label>
              <input type="text" value={protoForm.location}
                onChange={e => setProtoForm(p => ({ ...p, location: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-blue-400" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('protocol.date')}</label>
              <input type="date" value={protoForm.intake_date}
                onChange={e => setProtoForm(p => ({ ...p, intake_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-blue-400" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('protocol.notes')}</label>
              <textarea value={protoForm.notes} onChange={e => setProtoForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-blue-400 resize-none" />
            </div>

            {/* Signature */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">{t('protocol.signature')}</p>
              <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-gray-50">
                <canvas ref={canvasRef} width={600} height={160} className="w-full touch-none"
                  onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                  onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-400">{t('protocol.signature_hint')}</span>
                <button type="button" onClick={clearCanvas} className="text-xs text-gray-400 hover:text-gray-700">
                  {t('protocol.signature_clear')}
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep(4)}
                className="py-3 px-4 rounded-xl border border-gray-300 text-gray-600 font-medium flex items-center gap-1">
                <ChevronLeft size={18} /> {t('create_wizard.back')}
              </button>
              <button onClick={handleFinish} disabled={finishing}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {finishing ? t('common.loading') : <><Check size={18} /> {t('create_wizard.done')}</>}
              </button>
            </div>
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

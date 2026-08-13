import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Trash2, Link2, Unlink, Container } from 'lucide-react'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/useAuth'
import {
  fetchTrailer, deleteTrailer,
  fetchTrailerPhotos, fetchTrailerDamages,
  parseTrailerDamagePaths,
} from '@/lib/trailers'
import {
  fetchCouplingsForTrailer, fetchActiveCouplingForTrailer,
  createCoupling, endCoupling,
} from '@/lib/couplings'
import { fetchVehicles } from '@/lib/vehicles'
import { getPhotoUrl } from '@/lib/supabase'
import ImageLightbox from '@/components/ImageLightbox'
import type { Trailer, TrailerPhoto, TrailerDamage, Coupling, Vehicle } from '@/lib/types'

export default function TrailerCard() {
  const { t }        = useTranslation()
  const { id }       = useParams<{ id: string }>()
  const navigate     = useNavigate()
  const { isAdmin, isUser, userName } = useAuth()

  const [trailer, setTrailer]   = useState<Trailer | null>(null)
  const [photos, setPhotos]     = useState<TrailerPhoto[]>([])
  const [damages, setDamages]   = useState<TrailerDamage[]>([])
  const [couplings, setCouplings] = useState<Coupling[]>([])
  const [activeCoupling, setActiveCoupling] = useState<Coupling | null>(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading]   = useState(true)
  const [busy, setBusy]         = useState(false)
  const [coupleVehicleId, setCoupleVehicleId] = useState('')
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [tr, ph, dm, cp, active, veh] = await Promise.all([
        fetchTrailer(id),
        fetchTrailerPhotos(id),
        fetchTrailerDamages(id),
        fetchCouplingsForTrailer(id),
        fetchActiveCouplingForTrailer(id),
        fetchVehicles(),
      ])
      setTrailer(tr); setPhotos(ph); setDamages(dm)
      setCouplings(cp); setActiveCoupling(active); setVehicles(veh)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void (async () => { await load() })() }, [load])

  async function handleCouple() {
    if (!id || !coupleVehicleId) return
    setBusy(true)
    try {
      await createCoupling(coupleVehicleId, id, userName || null)
      setCoupleVehicleId('')
      await load()
    } finally { setBusy(false) }
  }

  async function handleDecouple() {
    if (!activeCoupling) return
    if (!confirm(t('couplings.decouple_confirm'))) return
    setBusy(true)
    try {
      await endCoupling(activeCoupling.id)
      await load()
    } finally { setBusy(false) }
  }

  async function handleDelete() {
    if (!id) return
    if (!confirm(t('trailers.delete_confirm'))) return
    setBusy(true)
    try {
      await deleteTrailer(id)
      navigate('/trailers')
    } finally { setBusy(false) }
  }

  if (loading) {
    return (
      <Layout header={<HeaderBar title={t('common.loading')} onBack={() => navigate('/trailers')} />}>
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      </Layout>
    )
  }

  if (!trailer) {
    return (
      <Layout header={<HeaderBar title="—" onBack={() => navigate('/trailers')} />}>
        <p className="p-6 text-center text-gray-400">{t('errors.load_failed')}</p>
      </Layout>
    )
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <Layout header={<HeaderBar title={trailer.license_plate || '—'} onBack={() => navigate('/trailers')} />}>
      <div className="p-4 space-y-4">
        {/* Basisdaten */}
        <section className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-lg bg-gray-100 flex items-center justify-center">
              <Container size={22} className="text-gray-400" />
            </div>
            <div>
              <p className="font-bold text-gray-900">{trailer.license_plate || '—'}</p>
              <p className="text-xs text-gray-400">{t(`trailers.types.${trailer.trailer_type}`)}</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-gray-400">{t('vehicles.brand_model')}</dt>
            <dd className="text-gray-800 text-right">{trailer.brand_model || '—'}</dd>
            <dt className="text-gray-400">{t('vehicles.fleet')}</dt>
            <dd className="text-gray-800 text-right">{trailer.fleet?.name || t('vehicle_card.no_fleet')}</dd>
            <dt className="text-gray-400">{t('vehicles.created_by')}</dt>
            <dd className="text-gray-800 text-right">{trailer.created_by || '—'}</dd>
          </dl>
        </section>

        {/* Kopplung */}
        <section className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
            <Link2 size={15} className="text-blue-600" /> {t('couplings.title')}
          </h2>
          {activeCoupling ? (
            <div className="bg-blue-50 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <button onClick={() => navigate(`/vehicle/${activeCoupling.vehicle_id}`)}
                  className="font-semibold text-blue-700 truncate underline-offset-2 hover:underline">
                  {activeCoupling.vehicle?.license_plate || activeCoupling.vehicle?.vin || '—'}
                </button>
                <p className="text-xs text-gray-500">{t('couplings.since')} {fmt(activeCoupling.gekoppelt_seit)}</p>
              </div>
              {isUser && (
                <button onClick={handleDecouple} disabled={busy}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 disabled:opacity-50">
                  <Unlink size={13} /> {t('couplings.decouple')}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-400">{t('couplings.not_coupled')}</p>
              {isUser && (
                <div className="flex gap-2">
                  <select value={coupleVehicleId} onChange={e => setCoupleVehicleId(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:border-blue-400">
                    <option value="">{t('couplings.select_vehicle')}</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>
                        {(v.license_plate || v.vin || '—') + (v.brand_model ? ` · ${v.brand_model}` : '')}
                      </option>
                    ))}
                  </select>
                  <button onClick={handleCouple} disabled={busy || !coupleVehicleId}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
                    <Link2 size={14} /> {t('couplings.couple')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Historie */}
          {couplings.filter(c => c.gekoppelt_bis).length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-400 mb-1.5">{t('couplings.history')}</p>
              <ul className="space-y-1">
                {couplings.filter(c => c.gekoppelt_bis).map(c => (
                  <li key={c.id} className="text-xs text-gray-500 flex justify-between gap-2">
                    <span className="truncate">{c.vehicle?.license_plate || c.vehicle?.vin || '—'}</span>
                    <span className="text-gray-400 flex-shrink-0">{fmt(c.gekoppelt_seit)} – {c.gekoppelt_bis ? fmt(c.gekoppelt_bis) : '…'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Fotos */}
        <section className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-2">{t('vehicle_card.tabs.fotos')}</h2>
          {photos.length === 0 ? (
            <p className="text-sm text-gray-400">{t('trailers.no_photos')}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p, i) => (
                <button key={p.id} onClick={() => setLightbox({ images: photos.map(x => getPhotoUrl(x.storage_path)), index: i })}
                  className="aspect-[4/3] rounded-lg overflow-hidden">
                  <img src={getPhotoUrl(p.storage_path)} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Schäden */}
        <section className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-2">{t('damages.title')}</h2>
          {damages.length === 0 ? (
            <p className="text-sm text-gray-400">{t('damages.no_damages')}</p>
          ) : (
            <div className="space-y-2">
              {damages.map(d => {
                const paths = parseTrailerDamagePaths(d.storage_path)
                return (
                  <div key={d.id} className="bg-gray-50 rounded-xl p-3">
                    {d.position && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">
                        {t(`trailers.positions.${d.position}`)}
                      </span>
                    )}
                    {d.description && <p className="text-sm text-gray-800 mt-1.5 break-words">{d.description}</p>}
                    {paths.length > 0 && (
                      <div className="grid grid-cols-4 gap-1.5 mt-2">
                        {paths.map((path, i) => (
                          <button key={i} onClick={() => setLightbox({ images: paths.map(pp => getPhotoUrl(pp)), index: i })}
                            className="aspect-square rounded-lg overflow-hidden">
                            <img src={getPhotoUrl(path)} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {isAdmin && (
          <button onClick={handleDelete} disabled={busy}
            className="w-full py-3 rounded-xl border border-red-200 text-red-600 font-medium flex items-center justify-center gap-2 hover:bg-red-50 disabled:opacity-50">
            <Trash2 size={16} /> {t('common.delete')}
          </button>
        )}
      </div>

      {lightbox && (
        <ImageLightbox
          urls={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNext={() => setLightbox(l => l && { ...l, index: Math.min(l.index + 1, l.images.length - 1) })}
          onPrev={() => setLightbox(l => l && { ...l, index: Math.max(l.index - 1, 0) })}
        />
      )}
    </Layout>
  )
}

function HeaderBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={onBack} className="p-1 -ml-1 text-gray-500 hover:text-gray-800">
        <ChevronLeft size={22} />
      </button>
      <h1 className="text-lg font-bold text-gray-900 truncate">{title}</h1>
    </div>
  )
}

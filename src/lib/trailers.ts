import { supabase, uploadFile, deleteFile, STORAGE_BUCKET } from './supabase'
import type { Trailer, TrailerPhoto, TrailerDamage } from './types'

// ─── Trailers ─────────────────────────────────────────────────────────────────

export async function fetchTrailers(fleetId?: string): Promise<Trailer[]> {
  let query = supabase
    .from('trailers')
    .select('*, fleet:fleets(id,name,color)')
    .order('created_at', { ascending: false })

  if (fleetId) query = query.eq('fleet_id', fleetId)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Trailer[]
}

export async function fetchTrailer(id: string): Promise<Trailer> {
  const { data, error } = await supabase
    .from('trailers')
    .select('*, fleet:fleets(id,name,color)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Trailer
}

export async function createTrailer(payload: Omit<Trailer, 'id' | 'created_at' | 'fleet'>): Promise<Trailer> {
  const { data, error } = await supabase
    .from('trailers')
    .insert(payload)
    .select('*, fleet:fleets(id,name,color)')
    .single()
  if (error) throw error
  return data as Trailer
}

export async function updateTrailer(id: string, payload: Partial<Omit<Trailer, 'id' | 'created_at' | 'fleet'>>): Promise<Trailer> {
  const { data, error } = await supabase
    .from('trailers')
    .update(payload)
    .eq('id', id)
    .select('*, fleet:fleets(id,name,color)')
    .single()
  if (error) throw error
  return data as Trailer
}

/** Annahme eines Trailers bestätigen (setzt Status auf abgeschlossen). */
export async function confirmTrailerAnnahme(id: string, confirmedBy: string): Promise<void> {
  const { error } = await supabase
    .from('trailers')
    .update({
      annahme_confirmed:    true,
      annahme_confirmed_by: confirmedBy || null,
      annahme_confirmed_at: new Date().toISOString(),
      status:               'abgeschlossen',
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteTrailer(id: string): Promise<void> {
  const { error } = await supabase.from('trailers').delete().eq('id', id)
  if (error) throw error
  await deleteTrailerStorage(id).catch(() => {})
}

async function deleteTrailerStorage(trailerId: string): Promise<void> {
  const storage = supabase.storage.from(STORAGE_BUCKET)
  const prefixes = [`trailers/${trailerId}`, `trailers/${trailerId}/damages`]
  const paths: string[] = []
  for (const prefix of prefixes) {
    const { data } = await storage.list(prefix, { limit: 1000 })
    for (const entry of data ?? []) {
      if (entry.id) paths.push(`${prefix}/${entry.name}`)
    }
  }
  if (paths.length > 0) await storage.remove(paths)
}

// ─── Photos ───────────────────────────────────────────────────────────────────

export async function fetchTrailerPhotos(trailerId: string): Promise<TrailerPhoto[]> {
  const { data, error } = await supabase
    .from('trailer_photos')
    .select('*')
    .eq('trailer_id', trailerId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function uploadTrailerPhoto(
  trailerId: string,
  file: File,
  index: number,
  takenBy: string,
): Promise<TrailerPhoto> {
  const ext  = file.name.split('.').pop() ?? 'jpg'
  const path = `trailers/${trailerId}/photo_${index}_${Date.now()}.${ext}`
  await uploadFile(path, file)

  const { data, error } = await supabase
    .from('trailer_photos')
    .insert({ trailer_id: trailerId, storage_path: path, taken_by: takenBy })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTrailerPhoto(photo: TrailerPhoto): Promise<void> {
  await deleteFile(photo.storage_path)
  await supabase.from('trailer_photos').delete().eq('id', photo.id)
}

// ─── Damages (schlanke Erfassung) ─────────────────────────────────────────────

export const TRAILER_DAMAGE_POSITIONS = [
  'plane', 'achse', 'ladeflaeche', 'deichsel', 'aufbau', 'sonstiges',
] as const

export async function fetchTrailerDamages(trailerId: string): Promise<TrailerDamage[]> {
  const { data, error } = await supabase
    .from('trailer_damages')
    .select('*')
    .eq('trailer_id', trailerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createTrailerDamage(
  trailerId: string,
  payload: Omit<TrailerDamage, 'id' | 'trailer_id' | 'created_at'>,
): Promise<TrailerDamage> {
  const { data, error } = await supabase
    .from('trailer_damages')
    .insert({ trailer_id: trailerId, ...payload })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTrailerDamage(
  id: string,
  payload: Partial<Omit<TrailerDamage, 'id' | 'trailer_id' | 'created_at'>>,
): Promise<TrailerDamage> {
  const { data, error } = await supabase
    .from('trailer_damages')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTrailerDamage(damage: TrailerDamage): Promise<void> {
  for (const p of parseTrailerDamagePaths(damage.storage_path)) {
    await deleteFile(p).catch(() => {})
  }
  const { error } = await supabase.from('trailer_damages').delete().eq('id', damage.id)
  if (error) throw error
}

export async function uploadTrailerDamagePhoto(
  damageId: string,
  trailerId: string,
  file: File,
  index: number,
): Promise<string> {
  const ext  = file.name.split('.').pop() ?? 'jpg'
  const path = `trailers/${trailerId}/damages/${damageId}_${index}.${ext}`
  await uploadFile(path, file)
  return path
}

// storage_path <-> string[] (JSON-Array, Einzel-String-kompatibel)
export function parseTrailerDamagePaths(storagePath: string | null): string[] {
  if (!storagePath) return []
  try {
    const parsed = JSON.parse(storagePath)
    if (Array.isArray(parsed)) return parsed
  } catch { /* not JSON */ }
  return [storagePath]
}

export function serializeTrailerDamagePaths(paths: string[]): string | null {
  if (paths.length === 0) return null
  if (paths.length === 1) return paths[0]
  return JSON.stringify(paths)
}

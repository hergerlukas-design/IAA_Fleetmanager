import { supabase, uploadFile, deleteFile, STORAGE_BUCKET } from './supabase'
import type { Vehicle, VehiclePhoto } from './types'

export async function fetchVehicles(fleetId?: string): Promise<Vehicle[]> {
  let query = supabase
    .from('vehicles')
    .select('*, fleet:fleets(id,name,color)')
    .order('created_at', { ascending: false })

  if (fleetId) query = query.eq('fleet_id', fleetId)

  const { data, error } = await query
  if (error) throw error

  const vehicles = (data ?? []) as Vehicle[]
  if (vehicles.length === 0) return vehicles

  // Fetch which vehicles have a confirmed intake protocol
  try {
    const ids = vehicles.map(v => v.id)
    const { data: protocols } = await supabase
      .from('intake_protocols')
      .select('vehicle_id')
      .in('vehicle_id', ids)
      .eq('annahme_confirmed', true)

    const confirmed = new Set((protocols ?? []).map((p: { vehicle_id: string }) => p.vehicle_id))
    return vehicles.map(v => ({ ...v, protocol_submitted: confirmed.has(v.id) }))
  } catch {
    return vehicles
  }
}

export async function fetchVehicle(id: string): Promise<Vehicle> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*, fleet:fleets(id,name,color)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Vehicle
}

export async function createVehicle(payload: Omit<Vehicle, 'id' | 'created_at' | 'fleet'>): Promise<Vehicle> {
  const { data, error } = await supabase
    .from('vehicles')
    .insert(payload)
    .select('*, fleet:fleets(id,name,color)')
    .single()
  if (error) throw error
  return data as Vehicle
}

export async function updateVehicle(id: string, payload: Partial<Omit<Vehicle, 'id' | 'created_at' | 'fleet'>>): Promise<Vehicle> {
  const { data, error } = await supabase
    .from('vehicles')
    .update(payload)
    .eq('id', id)
    .select('*, fleet:fleets(id,name,color)')
    .single()
  if (error) throw error
  return data as Vehicle
}

export async function deleteVehicle(id: string): Promise<void> {
  const { error } = await supabase.from('vehicles').delete().eq('id', id)
  if (error) throw error
  // Storage-Reste (Fotos, Schadensbilder, Signatur) dürfen das Löschen nicht blockieren
  await deleteVehicleStorage(id).catch(() => {})
}

async function deleteVehicleStorage(vehicleId: string): Promise<void> {
  const storage = supabase.storage.from(STORAGE_BUCKET)
  const prefixes = [`vehicles/${vehicleId}`, `vehicles/${vehicleId}/damages`]
  const paths: string[] = []
  for (const prefix of prefixes) {
    const { data } = await storage.list(prefix, { limit: 1000 })
    for (const entry of data ?? []) {
      // Ordner-Einträge haben id === null, nur echte Dateien löschen
      if (entry.id) paths.push(`${prefix}/${entry.name}`)
    }
  }
  if (paths.length > 0) await storage.remove(paths)
}

// ─── Photos ─────────────────────────────────────────────────────────────────

export async function fetchVehiclePhotos(vehicleId: string): Promise<VehiclePhoto[]> {
  const { data, error } = await supabase
    .from('vehicle_photos')
    .select('*')
    .eq('vehicle_id', vehicleId)
  if (error) throw error
  return data ?? []
}

export async function uploadVehiclePhoto(
  vehicleId: string,
  type: VehiclePhoto['photo_type'],
  file: File,
  takenBy: string,
): Promise<VehiclePhoto> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `vehicles/${vehicleId}/${type}.${ext}`
  await uploadFile(path, file)

  const { data: existing } = await supabase
    .from('vehicle_photos')
    .select('id')
    .eq('vehicle_id', vehicleId)
    .eq('photo_type', type)
    .maybeSingle()

  if (existing) {
    const { data, error } = await supabase
      .from('vehicle_photos')
      .update({ storage_path: path, taken_by: takenBy })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('vehicle_photos')
    .insert({ vehicle_id: vehicleId, photo_type: type, storage_path: path, taken_by: takenBy })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteVehiclePhoto(photo: VehiclePhoto): Promise<void> {
  await deleteFile(photo.storage_path)
  await supabase.from('vehicle_photos').delete().eq('id', photo.id)
}

export function getVehiclePhotoStoragePath(vehicleId: string, type: string): string {
  return `vehicles/${vehicleId}/${type}`
}

export function getSignatureStoragePath(vehicleId: string): string {
  return `vehicles/${vehicleId}/signature.png`
}

export async function uploadSignature(vehicleId: string, blob: Blob): Promise<string> {
  const path = getSignatureStoragePath(vehicleId)
  const file = new File([blob], 'signature.png', { type: 'image/png' })
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

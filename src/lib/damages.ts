import { supabase, uploadFile, deleteFile, STORAGE_BUCKET } from './supabase'
import type { DamageRecord } from './types'

export const ZONE_LABEL_EN: Record<string, string> = {
  'Motorhaube': 'Hood',
  'Dach': 'Roof',
  'Spiegel links': 'Mirror (left)',
  'Spiegel rechts': 'Mirror (right)',
  'Frontscheibe': 'Windshield',
  'Scheinwerfer links': 'Headlight (left)',
  'Scheinwerfer rechts': 'Headlight (right)',
  'Stoßfänger vorne': 'Front Bumper',
  'Kennzeichen vorne': 'License Plate (front)',
  'Heckscheibe': 'Rear Window',
  'Rückleuchte links': 'Tail Light (left)',
  'Rückleuchte rechts': 'Tail Light (right)',
  'Stoßfänger hinten': 'Rear Bumper',
  'Kennzeichen hinten': 'License Plate (rear)',
  'Kotflügel vorne links': 'Front Fender (left)',
  'Tür vorne links': 'Front Door (left)',
  'Tür hinten links': 'Rear Door (left)',
  'Kotflügel hinten links': 'Rear Fender (left)',
  'Seitenscheibe vorne links': 'Front Side Window (left)',
  'Seitenscheibe hinten links': 'Rear Side Window (left)',
  'Reifen vorne links': 'Front Tire (left)',
  'Felge vorne links': 'Front Rim (left)',
  'Reifen hinten links': 'Rear Tire (left)',
  'Felge hinten links': 'Rear Rim (left)',
  'Kotflügel vorne rechts': 'Front Fender (right)',
  'Tür vorne rechts': 'Front Door (right)',
  'Tür hinten rechts': 'Rear Door (right)',
  'Kotflügel hinten rechts': 'Rear Fender (right)',
  'Seitenscheibe vorne rechts': 'Front Side Window (right)',
  'Seitenscheibe hinten rechts': 'Rear Side Window (right)',
  'Reifen vorne rechts': 'Front Tire (right)',
  'Felge vorne rechts': 'Front Rim (right)',
  'Reifen hinten rechts': 'Rear Tire (right)',
  'Felge hinten rechts': 'Rear Rim (right)',
  'Innenraum': 'Interior',
  // Lkw-spezifische Zonen (IAA Nutzfahrzeuge)
  'Kabine': 'Cabin',
  'Aufbau': 'Body',
  'Ladefläche': 'Load Floor',
  'Unterfahrschutz': 'Underrun Guard',
  // Zugmaschinen-Grafik (Sattelzugmaschine / Lkw)
  'Windschutzscheibe': 'Windshield',
  'Kühlergrill': 'Grille',
  'Dachblende': 'Roof Fairing',
  'Kabinenrückwand': 'Cab Rear Wall',
  'Sattelkupplung': 'Fifth Wheel',
  'Kabinendach': 'Cab Roof',
  'Chassis': 'Chassis',
  'Chassis links': 'Chassis (left)',
  'Chassis rechts': 'Chassis (right)',
  'Tür links': 'Door (left)',
  'Tür rechts': 'Door (right)',
  'Seitenscheibe links': 'Side Window (left)',
  'Seitenscheibe rechts': 'Side Window (right)',
  'Trittstufe links': 'Step (left)',
  'Trittstufe rechts': 'Step (right)',
  'Tank links': 'Fuel Tank (left)',
  'Tank rechts': 'Fuel Tank (right)',
}

/** Zusätzliche Schadenszonen als Buttons (für Aufbauten / Innenraum jenseits der Grafik). */
export const TRUCK_ZONES = ['Innenraum', 'Aufbau', 'Ladefläche'] as const

export const DAMAGE_TYPES = [
  'delle', 'kratzer', 'riss', 'steinschlag', 'fehlend', 'sonstiges',
] as const

export const DAMAGE_INTENSITIES = ['leicht', 'mittel', 'schwer'] as const

export async function fetchDamages(vehicleId: string): Promise<DamageRecord[]> {
  const { data, error } = await supabase
    .from('damage_records')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createDamage(
  vehicleId: string,
  payload: Omit<DamageRecord, 'id' | 'vehicle_id' | 'created_at'>,
): Promise<DamageRecord> {
  const { data, error } = await supabase
    .from('damage_records')
    .insert({ vehicle_id: vehicleId, ...payload })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateDamage(id: string, payload: Partial<Omit<DamageRecord, 'id' | 'vehicle_id' | 'created_at'>>): Promise<DamageRecord> {
  const { data, error } = await supabase
    .from('damage_records')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteDamage(damage: DamageRecord): Promise<void> {
  if (damage.storage_path) await deleteFile(damage.storage_path)
  const { error } = await supabase.from('damage_records').delete().eq('id', damage.id)
  if (error) throw error
}

// Parse storage_path → string[] (supports legacy single-path strings + JSON arrays)
export function parseDamagePaths(storagePath: string | null): string[] {
  if (!storagePath) return []
  try {
    const parsed = JSON.parse(storagePath)
    if (Array.isArray(parsed)) return parsed
  } catch { /* not JSON */ }
  return [storagePath]
}

// Serialize string[] → storage_path string
export function serializeDamagePaths(paths: string[]): string | null {
  if (paths.length === 0) return null
  if (paths.length === 1) return paths[0]  // backward compat
  return JSON.stringify(paths)
}

export async function uploadDamagePhoto(
  damageId: string,
  vehicleId: string,
  file: File,
  index: number,
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `vehicles/${vehicleId}/damages/${damageId}_${index}.${ext}`
  await uploadFile(path, file)
  return path
}

export function getDamagePhotoUrl(storagePath: string): string {
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

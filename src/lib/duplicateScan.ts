import { supabase } from './supabase'
import { deleteVehicle } from './vehicles'
import type { Vehicle } from './types'

export interface VehicleCompleteness {
  vehicle: Vehicle
  photoCount: number
  damageCount: number
  hasProtocol: boolean
}

export interface DuplicateGroup {
  key: string
  field: 'license_plate' | 'vin'
  entries: VehicleCompleteness[]
}

const NORM = (v: string | null) => (v ?? '').trim().toUpperCase()

export async function findDuplicateVehicles(): Promise<DuplicateGroup[]> {
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('*, fleet:fleets(id,name,color)')
    .order('created_at', { ascending: true })
  if (error) throw error

  const all = (vehicles ?? []) as Vehicle[]
  const ids = all.map(v => v.id)
  if (ids.length === 0) return []

  const [{ data: photos }, { data: damages }, { data: protocols }] = await Promise.all([
    supabase.from('vehicle_photos').select('vehicle_id').in('vehicle_id', ids),
    supabase.from('damage_records').select('vehicle_id').in('vehicle_id', ids),
    supabase.from('intake_protocols').select('vehicle_id').in('vehicle_id', ids),
  ])

  const photoCounts = countBy(photos)
  const damageCounts = countBy(damages)
  const protocolIds = new Set((protocols ?? []).map((p: { vehicle_id: string }) => p.vehicle_id))

  const toEntry = (v: Vehicle): VehicleCompleteness => ({
    vehicle: v,
    photoCount: photoCounts.get(v.id) ?? 0,
    damageCount: damageCounts.get(v.id) ?? 0,
    hasProtocol: protocolIds.has(v.id),
  })

  const groups: DuplicateGroup[] = []
  for (const field of ['license_plate', 'vin'] as const) {
    const byKey = new Map<string, Vehicle[]>()
    for (const v of all) {
      const key = NORM(v[field])
      if (!key) continue
      byKey.set(key, [...(byKey.get(key) ?? []), v])
    }
    for (const [key, vs] of byKey) {
      if (vs.length > 1) {
        groups.push({ key, field, entries: vs.map(toEntry) })
      }
    }
  }

  // A vehicle can appear in both a plate-group and a vin-group; keep both,
  // the UI groups them separately so the reviewer sees why they matched.
  return groups.sort((a, b) => a.key.localeCompare(b.key))
}

function countBy(rows: { vehicle_id: string }[] | null): Map<string, number> {
  const map = new Map<string, number>()
  for (const r of rows ?? []) map.set(r.vehicle_id, (map.get(r.vehicle_id) ?? 0) + 1)
  return map
}

export interface OrphanGroup {
  table: 'vehicle_photos' | 'damage_records' | 'intake_protocols' | 'vehicle_km_history'
  rows: { id: string; vehicle_id: string; label: string; created_at: string | null }[]
}

const ORPHAN_TABLES: { table: OrphanGroup['table']; labelField: string; dateField: string }[] = [
  { table: 'vehicle_photos',     labelField: 'photo_type',   dateField: 'created_at' },
  { table: 'damage_records',     labelField: 'damage_type',  dateField: 'created_at' },
  { table: 'intake_protocols',   labelField: 'inspector_name', dateField: 'created_at' },
  { table: 'vehicle_km_history', labelField: 'zweck',        dateField: 'recorded_at' },
]

export async function findOrphanedRecords(): Promise<OrphanGroup[]> {
  const { data: vehicles, error } = await supabase.from('vehicles').select('id')
  if (error) throw error
  const knownIds = new Set((vehicles ?? []).map((v: { id: string }) => v.id))

  const groups: OrphanGroup[] = []
  for (const { table, labelField, dateField } of ORPHAN_TABLES) {
    const { data, error: rowsError } = await supabase.from(table).select('*')
    if (rowsError) throw rowsError
    const orphans = (data ?? []).filter((r: { vehicle_id: string }) => !knownIds.has(r.vehicle_id))
    if (orphans.length > 0) {
      groups.push({
        table,
        rows: orphans.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          vehicle_id: r.vehicle_id as string,
          label: (r[labelField] as string | null) ?? '—',
          created_at: (r[dateField] as string | null) ?? null,
        })),
      })
    }
  }
  return groups
}

export async function deleteVehicles(ids: string[]): Promise<void> {
  for (const id of ids) await deleteVehicle(id)
}

export async function deleteOrphanRows(table: OrphanGroup['table'], ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.from(table).delete().in('id', ids)
  if (error) throw error
}

import { supabase } from './supabase'
import type { KmHistoryEntry } from './types'

export async function fetchKmHistory(vehicleId: string): Promise<KmHistoryEntry[]> {
  const { data, error } = await supabase
    .from('vehicle_km_history')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('recorded_at', { ascending: false })
  if (error) throw new Error(error.message ?? JSON.stringify(error))
  return data ?? []
}

export async function createKmEntry(
  vehicleId: string,
  km: number,
  kmDelta: number | null,
  zweck: string | null,
  recordedBy: string | null,
): Promise<KmHistoryEntry> {
  const { data, error } = await supabase
    .from('vehicle_km_history')
    .insert({ vehicle_id: vehicleId, km, km_delta: kmDelta, zweck, recorded_by: recordedBy })
    .select()
    .single()
  if (error) throw new Error(error.message ?? JSON.stringify(error))
  return data
}

export async function fetchZweckSuggestions(vehicleId: string): Promise<string[]> {
  const { data } = await supabase
    .from('vehicle_km_history')
    .select('zweck')
    .eq('vehicle_id', vehicleId)
    .not('zweck', 'is', null)
    .order('recorded_at', { ascending: false })
    .limit(50)
  if (!data) return []
  const unique = [...new Set(data.map((d: { zweck: string | null }) => d.zweck).filter(Boolean) as string[])]
  return unique.slice(0, 10)
}

export interface FleetKmSummary {
  vehicle_id: string
  latest: KmHistoryEntry | null
  first: KmHistoryEntry | null
  total_delta: number | null
}

export async function fetchAllFleetKmEntries(
  vehicleIds: string[],
): Promise<Record<string, KmHistoryEntry[]>> {
  if (vehicleIds.length === 0) return {}
  const { data } = await supabase
    .from('vehicle_km_history')
    .select('*')
    .in('vehicle_id', vehicleIds)
    .order('recorded_at', { ascending: false })
  const result: Record<string, KmHistoryEntry[]> = {}
  for (const id of vehicleIds) {
    result[id] = (data ?? []).filter((e: KmHistoryEntry) => e.vehicle_id === id)
  }
  return result
}

export async function fetchFleetKmSummary(vehicleIds: string[]): Promise<Record<string, FleetKmSummary>> {
  if (vehicleIds.length === 0) return {}

  const { data } = await supabase
    .from('vehicle_km_history')
    .select('*')
    .in('vehicle_id', vehicleIds)
    .order('recorded_at', { ascending: true })

  const result: Record<string, FleetKmSummary> = {}
  for (const id of vehicleIds) {
    const entries = (data ?? []).filter((e: KmHistoryEntry) => e.vehicle_id === id)
    const first  = entries[0]  ?? null
    const latest = entries[entries.length - 1] ?? null
    const total_delta = (first && latest && first.id !== latest.id)
      ? latest.km - first.km
      : null
    result[id] = { vehicle_id: id, first, latest, total_delta }
  }
  return result
}

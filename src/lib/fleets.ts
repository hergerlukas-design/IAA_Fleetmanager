import { supabase } from './supabase'
import type { Fleet } from './types'

export const FLEET_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
  '#f97316', '#6366f1',
]

export async function fetchFleets(): Promise<Fleet[]> {
  const { data, error } = await supabase
    .from('fleets')
    .select('*')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function fetchActiveFleets(): Promise<Fleet[]> {
  const { data, error } = await supabase
    .from('fleets')
    .select('*')
    .eq('active', true)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function createFleet(payload: Pick<Fleet, 'name' | 'color' | 'description'>): Promise<Fleet> {
  const { data, error } = await supabase
    .from('fleets')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateFleet(id: string, payload: Partial<Pick<Fleet, 'name' | 'color' | 'description' | 'active'>>): Promise<Fleet> {
  const { data, error } = await supabase
    .from('fleets')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteFleet(id: string): Promise<void> {
  const { error } = await supabase.from('fleets').delete().eq('id', id)
  if (error) throw error
}

export async function fetchFleetVehicleCounts(): Promise<Record<string, { total: number; abgeschlossen: number; in_bearbeitung: number }>> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('fleet_id, status')
  if (error) throw error

  const counts: Record<string, { total: number; abgeschlossen: number; in_bearbeitung: number }> = {}
  for (const row of data ?? []) {
    const fid = row.fleet_id ?? 'none'
    if (!counts[fid]) counts[fid] = { total: 0, abgeschlossen: 0, in_bearbeitung: 0 }
    counts[fid].total++
    if (row.status === 'in_bearbeitung' || row.status === 'abgeschlossen')
      counts[fid][row.status as 'in_bearbeitung' | 'abgeschlossen']++
  }
  return counts
}

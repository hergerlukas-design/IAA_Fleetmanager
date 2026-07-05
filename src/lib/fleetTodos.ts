import { supabase } from './supabase'
import type { FleetTodo } from './types'

export async function fetchFleetTodos(fleetId: string): Promise<FleetTodo[]> {
  const { data, error } = await supabase
    .from('fleet_todos')
    .select('*')
    .eq('fleet_id', fleetId)
    .order('position')
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export async function addFleetTodo(fleetId: string, title: string, position: number): Promise<FleetTodo> {
  const { data, error } = await supabase
    .from('fleet_todos')
    .insert({ fleet_id: fleetId, title, position })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function toggleFleetTodo(id: string, done: boolean): Promise<void> {
  const { error } = await supabase.from('fleet_todos').update({ done }).eq('id', id)
  if (error) throw error
}

export async function deleteFleetTodo(id: string): Promise<void> {
  const { error } = await supabase.from('fleet_todos').delete().eq('id', id)
  if (error) throw error
}

/** Open (not done) todo count per fleet, for the fleet-overview cards. */
export async function fetchOpenTodoCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('fleet_todos')
    .select('fleet_id, done')
    .eq('done', false)
  if (error) throw error

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.fleet_id] = (counts[row.fleet_id] ?? 0) + 1
  }
  return counts
}

import { supabase } from './supabase'
import type { IntakeProtocol } from './types'

export async function fetchProtocol(vehicleId: string): Promise<IntakeProtocol | null> {
  const { data, error } = await supabase
    .from('intake_protocols')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createProtocol(vehicleId: string, payload: Partial<Omit<IntakeProtocol, 'id' | 'vehicle_id' | 'created_at'>>): Promise<IntakeProtocol> {
  const { data, error } = await supabase
    .from('intake_protocols')
    .insert({ vehicle_id: vehicleId, ...payload })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateProtocol(id: string, payload: Partial<Omit<IntakeProtocol, 'id' | 'vehicle_id' | 'created_at'>>): Promise<IntakeProtocol> {
  const { data, error } = await supabase
    .from('intake_protocols')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function completeProtocol(id: string, completedBy: string): Promise<IntakeProtocol> {
  return updateProtocol(id, {
    completed: true,
    completed_by: completedBy,
    completed_at: new Date().toISOString(),
  })
}

export async function unlockProtocol(id: string): Promise<IntakeProtocol> {
  return updateProtocol(id, {
    completed: false,
    completed_by: null,
    completed_at: null,
  })
}

export async function confirmAnnahme(id: string, confirmedBy: string): Promise<IntakeProtocol> {
  return updateProtocol(id, {
    annahme_confirmed: true,
    annahme_confirmed_by: confirmedBy,
    annahme_confirmed_at: new Date().toISOString(),
  })
}

export async function unlockAnnahme(id: string): Promise<IntakeProtocol> {
  return updateProtocol(id, {
    annahme_confirmed: false,
    annahme_confirmed_by: null,
    annahme_confirmed_at: null,
  })
}

export async function confirmAnnahmeByVehicleId(vehicleId: string, confirmedBy: string): Promise<void> {
  let proto = await fetchProtocol(vehicleId)
  if (!proto) {
    proto = await createProtocol(vehicleId, {})
  }
  await confirmAnnahme(proto.id, confirmedBy)
  await supabase.from('vehicles').update({ status: 'abgeschlossen' }).eq('id', vehicleId)
}

export async function unlockAnnahmeByVehicleId(vehicleId: string): Promise<void> {
  const proto = await fetchProtocol(vehicleId)
  if (proto) await unlockAnnahme(proto.id)
  await supabase.from('vehicles').update({ status: 'in_bearbeitung' }).eq('id', vehicleId)
}

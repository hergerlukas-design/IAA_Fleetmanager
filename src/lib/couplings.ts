import { supabase } from './supabase'
import type { Coupling } from './types'

const SELECT_WITH_RELS =
  '*, vehicle:vehicles(id,license_plate,vin,brand_model,status), trailer:trailers(id,license_plate,trailer_type,brand_model,status)'

/** Alle Kopplungen (aktiv + historisch), neueste zuerst. */
export async function fetchCouplings(): Promise<Coupling[]> {
  const { data, error } = await supabase
    .from('couplings')
    .select(SELECT_WITH_RELS)
    .order('gekoppelt_seit', { ascending: false })
  if (error) throw error
  return (data ?? []) as Coupling[]
}

/** Aktuell aktive Kopplungen (gekoppelt_bis IS NULL). */
export async function fetchActiveCouplings(): Promise<Coupling[]> {
  const { data, error } = await supabase
    .from('couplings')
    .select(SELECT_WITH_RELS)
    .is('gekoppelt_bis', null)
    .order('gekoppelt_seit', { ascending: false })
  if (error) throw error
  return (data ?? []) as Coupling[]
}

/** Kopplungshistorie eines Zugfahrzeugs. */
export async function fetchCouplingsForVehicle(vehicleId: string): Promise<Coupling[]> {
  const { data, error } = await supabase
    .from('couplings')
    .select(SELECT_WITH_RELS)
    .eq('vehicle_id', vehicleId)
    .order('gekoppelt_seit', { ascending: false })
  if (error) throw error
  return (data ?? []) as Coupling[]
}

/** Kopplungshistorie eines Trailers. */
export async function fetchCouplingsForTrailer(trailerId: string): Promise<Coupling[]> {
  const { data, error } = await supabase
    .from('couplings')
    .select(SELECT_WITH_RELS)
    .eq('trailer_id', trailerId)
    .order('gekoppelt_seit', { ascending: false })
  if (error) throw error
  return (data ?? []) as Coupling[]
}

/** Aktive Kopplung eines Zugfahrzeugs (oder null). */
export async function fetchActiveCouplingForVehicle(vehicleId: string): Promise<Coupling | null> {
  const { data, error } = await supabase
    .from('couplings')
    .select(SELECT_WITH_RELS)
    .eq('vehicle_id', vehicleId)
    .is('gekoppelt_bis', null)
    .maybeSingle()
  if (error) throw error
  return (data as Coupling | null) ?? null
}

/** Aktive Kopplung eines Trailers (oder null). */
export async function fetchActiveCouplingForTrailer(trailerId: string): Promise<Coupling | null> {
  const { data, error } = await supabase
    .from('couplings')
    .select(SELECT_WITH_RELS)
    .eq('trailer_id', trailerId)
    .is('gekoppelt_bis', null)
    .maybeSingle()
  if (error) throw error
  return (data as Coupling | null) ?? null
}

/**
 * Kopplung herstellen. Löst zuvor bestehende offene Kopplungen von Zugfahrzeug
 * UND Trailer, damit die Partial-Unique-Indizes nicht verletzt werden.
 */
export async function createCoupling(
  vehicleId: string,
  trailerId: string,
  createdBy: string | null,
  notes: string | null = null,
): Promise<Coupling> {
  await decoupleVehicle(vehicleId)
  await decoupleTrailer(trailerId)

  const { data, error } = await supabase
    .from('couplings')
    .insert({ vehicle_id: vehicleId, trailer_id: trailerId, created_by: createdBy, notes })
    .select(SELECT_WITH_RELS)
    .single()
  if (error) throw error
  return data as Coupling
}

/** Kopplung beenden (gekoppelt_bis = now). */
export async function endCoupling(couplingId: string): Promise<void> {
  const { error } = await supabase
    .from('couplings')
    .update({ gekoppelt_bis: new Date().toISOString() })
    .eq('id', couplingId)
    .is('gekoppelt_bis', null)
  if (error) throw error
}

async function decoupleVehicle(vehicleId: string): Promise<void> {
  const { error } = await supabase
    .from('couplings')
    .update({ gekoppelt_bis: new Date().toISOString() })
    .eq('vehicle_id', vehicleId)
    .is('gekoppelt_bis', null)
  if (error) throw error
}

async function decoupleTrailer(trailerId: string): Promise<void> {
  const { error } = await supabase
    .from('couplings')
    .update({ gekoppelt_bis: new Date().toISOString() })
    .eq('trailer_id', trailerId)
    .is('gekoppelt_bis', null)
  if (error) throw error
}

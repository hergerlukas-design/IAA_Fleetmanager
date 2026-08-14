export interface Fleet {
  id: string
  name: string
  color: string | null
  description: string | null
  active: boolean
  /** Manual sort order (ascending). Nulls sort last. */
  position: number | null
  created_at: string
}

export interface Vehicle {
  id: string
  fleet_id: string | null
  vin: string | null
  license_plate: string | null
  brand_model: string | null
  km: number | null
  fuel: number | null
  battery: number | null
  notes: string | null
  status: 'in_bearbeitung' | 'abgeschlossen'
  werkstatt: boolean | null
  cleaning_inside?: boolean
  cleaning_outside?: boolean
  created_at: string
  created_by: string | null
  fleet?: Fleet
  /** true when the intake protocol has been annahme_confirmed but vehicle is still in_bearbeitung */
  protocol_submitted?: boolean
}

export interface IntakeProtocol {
  id: string
  vehicle_id: string
  inspector_name: string | null
  location: string | null
  intake_date: string | null
  notes: string | null
  signature_url: string | null
  completed: boolean
  completed_by: string | null
  completed_at: string | null
  annahme_confirmed: boolean
  annahme_confirmed_by: string | null
  annahme_confirmed_at: string | null
  created_at: string
}

export interface VehiclePhoto {
  id: string
  vehicle_id: string
  photo_type: 'vorne' | 'hinten' | 'links' | 'rechts' | 'schein' | 'extra'
  storage_path: string
  taken_by: string | null
  created_at: string
}

export interface DamageRecord {
  id: string
  vehicle_id: string
  damage_type: string | null
  intensity: 'leicht' | 'mittel' | 'schwer' | null
  position: string | null
  description: string | null
  storage_path: string | null
  created_by: string | null
  created_at: string
}

export interface KmHistoryEntry {
  id: string
  vehicle_id: string
  km: number
  km_delta: number | null
  zweck: string | null
  recorded_by: string | null
  recorded_at: string
}

export interface Feedback {
  id: string
  message: string
  submitted_by: string | null
  created_at: string
}

export interface FleetTodo {
  id: string
  fleet_id: string
  title: string
  done: boolean
  position: number
  created_at: string
}

// ─── Material- & Packliste ────────────────────────────────────────────────────

/** Arbeitsablauf-Status eines Packlisten-Eintrags. */
export type PackingStatus = 'offen' | 'kaufen' | 'gekauft' | 'gepackt'

export interface PackingItem {
  id: string
  name: string
  quantity: string | null
  category: string | null
  status: PackingStatus
  note: string | null
  position: number
  created_at: string
  created_by: string | null
}

// ─── Trailer (Anhänger / Sattelauflieger) ────────────────────────────────────

export type TrailerType = 'anhaenger' | 'sattelauflieger' | 'sonstiges'

/** Grobe Positionsangabe der Trailer-Schadenserfassung (Vorfilter). */
export type TrailerDamagePosition =
  | 'plane' | 'achse' | 'ladeflaeche' | 'deichsel' | 'aufbau' | 'sonstiges'

export interface Trailer {
  id: string
  fleet_id: string | null
  license_plate: string | null
  trailer_type: TrailerType
  brand_model: string | null
  notes: string | null
  status: 'in_bearbeitung' | 'abgeschlossen'
  cleaning_outside?: boolean
  annahme_confirmed?: boolean
  annahme_confirmed_by?: string | null
  annahme_confirmed_at?: string | null
  created_at: string
  created_by: string | null
  fleet?: Fleet
}

export interface TrailerPhoto {
  id: string
  trailer_id: string
  storage_path: string
  taken_by: string | null
  created_at: string
}

export interface TrailerDamage {
  id: string
  trailer_id: string
  position: TrailerDamagePosition | null
  /** Schadensart (delle/kratzer/…) – optional, für strukturierte Erfassung. */
  damage_type?: string | null
  /** Stärke – optional, für strukturierte Erfassung. */
  intensity?: 'leicht' | 'mittel' | 'schwer' | null
  description: string | null
  storage_path: string | null
  created_by: string | null
  created_at: string
}

// ─── Coupling (Kopplung / Gespann) ────────────────────────────────────────────

export interface Coupling {
  id: string
  vehicle_id: string
  trailer_id: string
  gekoppelt_seit: string
  gekoppelt_bis: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  vehicle?: Vehicle
  trailer?: Trailer
}

export type VehicleSection = 'basisdaten' | 'fotos' | 'schaeden' | 'protokoll'

export interface SectionPresence {
  name: string
  section: VehicleSection | null
  since: number
}

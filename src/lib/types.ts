export interface Fleet {
  id: string
  name: string
  color: string | null
  description: string | null
  active: boolean
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

export type VehicleSection = 'basisdaten' | 'fotos' | 'schaeden' | 'protokoll'

export interface SectionPresence {
  name: string
  section: VehicleSection | null
  since: number
}

import * as XLSX from 'xlsx'
import type { Vehicle, DamageRecord, IntakeProtocol } from './types'

interface ExportRow {
  Kennzeichen: string
  FIN_VIN: string
  Marke_Modell: string
  Flotte: string
  KM_Stand: string
  Kraftstoff_Pct: string
  Batterie_Pct: string
  Status: string
  Schaeden_Anzahl: number
  Protokoll_Datum: string
  Inspektor: string
  Protokoll_Abgeschlossen: string
  Erstellt_am: string
  Erstellt_von: string
}

export function exportVehiclesToExcel(
  vehicles: Vehicle[],
  damagesByVehicle: Record<string, DamageRecord[]>,
  protocolsByVehicle: Record<string, IntakeProtocol | null>,
) {
  const rows: ExportRow[] = vehicles.map((v) => {
    const protocol = protocolsByVehicle[v.id]
    const damages  = damagesByVehicle[v.id] ?? []
    return {
      Kennzeichen:             v.license_plate ?? '',
      FIN_VIN:                 v.vin ?? '',
      Marke_Modell:            v.brand_model ?? '',
      Flotte:                  v.fleet?.name ?? '',
      KM_Stand:                v.km != null ? String(v.km) : '',
      Kraftstoff_Pct:          v.fuel != null ? `${v.fuel}%` : '',
      Batterie_Pct:            v.battery != null ? `${v.battery}%` : '',
      Status:                  v.status,
      Schaeden_Anzahl:         damages.length,
      Protokoll_Datum:         protocol?.intake_date ?? '',
      Inspektor:               protocol?.inspector_name ?? '',
      Protokoll_Abgeschlossen: protocol?.completed ? (protocol.completed_by ?? 'Ja') : 'Nein',
      Erstellt_am:             v.created_at ? new Date(v.created_at).toLocaleDateString('de-CH') : '',
      Erstellt_von:            v.created_by ?? '',
    }
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Fahrzeuge')

  const date = new Date().toISOString().split('T')[0]
  XLSX.writeFile(wb, `CLX_Fleetmanager_${date}.xlsx`)
}

import * as XLSX from 'xlsx'
import type { jsPDF } from 'jspdf'
import type { Vehicle, DamageRecord, IntakeProtocol, Coupling } from './types'

const TRAILER_TYPE_LABEL: Record<string, string> = {
  anhaenger: 'Anhänger',
  sattelauflieger: 'Sattelauflieger',
  sonstiges: 'Sonstiges',
}

export async function savePdf(doc: jsPDF, filename: string): Promise<void> {
  const blob = doc.output('blob')
  const file = new File([blob], filename, { type: 'application/pdf' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
    }
  }

  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

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
  XLSX.utils.book_append_sheet(wb, ws, 'Zugfahrzeuge')

  const date = new Date().toISOString().split('T')[0]
  XLSX.writeFile(wb, `IAA_Nutzfahrzeuge_${date}.xlsx`)
}

interface GespannRow {
  Zugfahrzeug_Kennzeichen: string
  Zugfahrzeug_FIN: string
  Zugfahrzeug_Modell: string
  Trailer_Kennzeichen: string
  Trailer_Typ: string
  Trailer_Modell: string
  Gekoppelt_seit: string
  Gekoppelt_bis: string
  Status: string
}

/** Export einer Gespann-Liste (Zugfahrzeug + Trailer) nach Excel. */
export function exportGespanneToExcel(couplings: Coupling[]) {
  const rows: GespannRow[] = couplings.map((c) => ({
    Zugfahrzeug_Kennzeichen: c.vehicle?.license_plate ?? '',
    Zugfahrzeug_FIN:         c.vehicle?.vin ?? '',
    Zugfahrzeug_Modell:      c.vehicle?.brand_model ?? '',
    Trailer_Kennzeichen:     c.trailer?.license_plate ?? '',
    Trailer_Typ:             c.trailer ? (TRAILER_TYPE_LABEL[c.trailer.trailer_type] ?? c.trailer.trailer_type) : '',
    Trailer_Modell:          c.trailer?.brand_model ?? '',
    Gekoppelt_seit:          c.gekoppelt_seit ? new Date(c.gekoppelt_seit).toLocaleString('de-CH') : '',
    Gekoppelt_bis:           c.gekoppelt_bis ? new Date(c.gekoppelt_bis).toLocaleString('de-CH') : 'aktiv',
    Status:                  c.gekoppelt_bis ? 'entkoppelt' : 'gekoppelt',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Gespanne')

  const date = new Date().toISOString().split('T')[0]
  XLSX.writeFile(wb, `IAA_Gespanne_${date}.xlsx`)
}

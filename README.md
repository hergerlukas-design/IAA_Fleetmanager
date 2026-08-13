# IAA Nutzfahrzeuge – Fleet Manager

PWA zur Fahrzeug- und Trailerannahme für die **IAA Nutzfahrzeuge** (Trucks/Lkw).
Verwaltet Zugfahrzeug-Trailer-Kombinationen („Gespanne"), die im Projektverlauf
mehrfach neu gekoppelt werden können.

Basiert auf der Architektur von **CLX Fleetmanager** / **ADE Fleet Manager**.

## Features (MVP)

- **Fahrzeugannahme** (Zugfahrzeug): Kennzeichen, FIN/VIN, Fotos, strukturierte
  Damage-Card inkl. Lkw-spezifischer Zonen (Kabine, Aufbau, Ladefläche,
  Unterfahrschutz).
- **Trailerannahme**: Kennzeichen/ID, Typ (Anhänger / Sattelauflieger / Sonstiges),
  Fotos, schlanke Schadenserfassung (Freitext + optionales Positions-Dropdown).
- **Kopplung / Gespanne**: Trailer bei der Annahme direkt oder später über die
  Gespann-Ansicht koppeln/entkoppeln – mit vollständiger Kopplungshistorie.
- **Kartei-Ansicht**: je Zugfahrzeug und je Trailer, inkl. aktueller/historischer
  Kopplung.
- **Export**: Excel je Fahrzeugliste bzw. je Gespann (Zugfahrzeug + gekoppelter
  Trailer).
- Zweisprachig (DE/EN), PWA-fähig (offline-Installierbar).

## Tech-Stack

- React 19, TypeScript, Vite
- Tailwind CSS 4
- Supabase (DB + Auth-Header + Storage)
- Fly.io (Deployment)
- GitHub Actions: Claude-Code-Issue-Automation (`@claude`) + Auto-Deploy on merge

## Datenmodell

| Tabelle           | Zweck                                                        |
| ----------------- | ----------------------------------------------------------- |
| `vehicles`        | Zugfahrzeuge (Trucks) – FIN, Kennzeichen, Status, Schäden   |
| `trailers`        | Anhänger / Sattelauflieger – Kennzeichen, Typ               |
| `trailer_photos`  | Fotos je Trailer                                            |
| `trailer_damages` | Schlanke Schadenserfassung (Freitext + grobe Position)      |
| `couplings`       | Relationstabelle Zugfahrzeug ↔ Trailer mit Zeitstempeln     |

Kopplungen werden nicht als 1:1-Fremdschlüssel abgebildet, sondern als eigene
Relationstabelle mit `gekoppelt_seit` / `gekoppelt_bis` (nullable) – so lässt sich
die vollständige Historie mehrfacher Umkopplungen abbilden.

## Entwicklung

```bash
npm install
npm run dev      # Dev-Server
npm run build    # tsc + vite build
npm run lint     # ESLint
```

### Umgebungsvariablen (Build-Secrets)

| Variable             | Zweck                                        |
| -------------------- | -------------------------------------------- |
| `VITE_SUPABASE_URL`  | Supabase-Projekt-URL                         |
| `VITE_SUPABASE_KEY`  | Supabase Anon/Publishable Key                |
| `VITE_APP_SECRET`    | Wert des `x-app-secret`-Headers (RLS)        |
| `VITE_APP_PASSWORD`  | App-Passwort (Login)                         |
| `VITE_ADMIN_PIN`     | Admin-PIN                                     |

## Supabase-Setup

1. Neues Supabase-Projekt anlegen.
2. Migrationen aus `supabase/migrations/` in Reihenfolge im SQL-Editor ausführen.
3. Storage-Bucket **`iaa-assets`** (private) anlegen.
4. App-Secret setzen: `INSERT INTO _app_secret (secret) VALUES ('<geheim>');`
   – denselben Wert als `VITE_APP_SECRET` hinterlegen.

## Deployment (Fly.io)

Auto-Deploy via GitHub Action bei Merge/Push auf `main` (siehe
`.github/workflows/deploy.yml`). Erforderliche Repo-Secrets: `FLY_API_TOKEN`
sowie alle `VITE_*`-Build-Args.

## Bug-Reports / Feature-Requests

Über GitHub Issues mit `@claude`-Mention – die Claude-Code-Action
(`.github/workflows/claude.yml`) bearbeitet die Anfrage automatisch.

-- ─────────────────────────────────────────────────────────────────────────────
-- IAA Nutzfahrzeuge – Trailer & Coupling (Gespann) Schema
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Erweitert das Fahrzeug-Datenmodell um Trailer (Anhänger/Sattelauflieger) und
-- Kopplungen zwischen Zugfahrzeug und Trailer ("Gespanne"). Ein Trailer kann im
-- Projektverlauf mehrfach neu gekoppelt werden – daher keine 1:1-FK-Beziehung,
-- sondern eine eigene Relationstabelle mit Zeitstempeln (Historie).
--
-- Schadenserfassung Trailer: bewusst schlanker als beim Zugfahrzeug –
-- Freitext + optionale grobe Positionsangabe + Fotos (kein Punkte-Katalog).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Trailers (Anhänger / Sattelauflieger) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS trailers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fleet_id      UUID REFERENCES fleets(id) ON DELETE SET NULL,
  license_plate TEXT,                          -- Kennzeichen / ID
  trailer_type  TEXT NOT NULL DEFAULT 'anhaenger'
                  CHECK (trailer_type IN ('anhaenger', 'sattelauflieger', 'sonstiges')),
  brand_model   TEXT,
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'in_bearbeitung'
                  CHECK (status IN ('in_bearbeitung', 'abgeschlossen')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    TEXT
);

CREATE INDEX IF NOT EXISTS idx_trailers_fleet_id ON trailers(fleet_id);
CREATE INDEX IF NOT EXISTS idx_trailers_status   ON trailers(status);

-- ─── Trailer Photos ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trailer_photos (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trailer_id   UUID NOT NULL REFERENCES trailers(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  taken_by     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trailer_photos_trailer_id ON trailer_photos(trailer_id);

-- ─── Trailer Damages (schlanke Erfassung: Freitext + grobe Position) ──────────
CREATE TABLE IF NOT EXISTS trailer_damages (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trailer_id   UUID NOT NULL REFERENCES trailers(id) ON DELETE CASCADE,
  -- grobe Positionsangabe als Vorfilter (optional)
  position     TEXT CHECK (position IS NULL OR position IN
                  ('plane', 'achse', 'ladeflaeche', 'deichsel', 'aufbau', 'sonstiges')),
  description  TEXT,                            -- Freitext-Schadensbeschreibung
  -- storage_path: JSON-Array mehrerer Pfade (oder Einzel-String, Legacy-kompatibel)
  storage_path TEXT,
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trailer_damages_trailer_id ON trailer_damages(trailer_id);

-- ─── Couplings (Kopplungen / Gespanne) ───────────────────────────────────────
-- gekoppelt_bis = NULL  →  Kopplung aktuell aktiv
CREATE TABLE IF NOT EXISTS couplings (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id     UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  trailer_id     UUID NOT NULL REFERENCES trailers(id) ON DELETE CASCADE,
  gekoppelt_seit TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  gekoppelt_bis  TIMESTAMPTZ,
  notes          TEXT,
  created_by     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_couplings_vehicle_id ON couplings(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_couplings_trailer_id ON couplings(trailer_id);

-- Ein Zugfahrzeug bzw. ein Trailer kann jeweils nur EINE offene Kopplung haben.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_coupling_vehicle
  ON couplings(vehicle_id) WHERE gekoppelt_bis IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_coupling_trailer
  ON couplings(trailer_id) WHERE gekoppelt_bis IS NULL;

-- ─── Row Level Security (App-Secret-Header, analog bestehender Tabellen) ──────
-- Setzt voraus, dass die Funktion app_secret_ok() bereits existiert
-- (siehe Migration 20260713_rls_app_secret.sql).
ALTER TABLE trailers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE trailer_photos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE trailer_damages ENABLE ROW LEVEL SECURITY;
ALTER TABLE couplings       ENABLE ROW LEVEL SECURITY;

-- trailers
CREATE POLICY "app_select" ON trailers FOR SELECT USING (app_secret_ok());
CREATE POLICY "app_insert" ON trailers FOR INSERT WITH CHECK (app_secret_ok());
CREATE POLICY "app_update" ON trailers FOR UPDATE USING (app_secret_ok()) WITH CHECK (app_secret_ok());
CREATE POLICY "app_delete" ON trailers FOR DELETE USING (app_secret_ok());

-- trailer_photos
CREATE POLICY "app_select" ON trailer_photos FOR SELECT USING (app_secret_ok());
CREATE POLICY "app_insert" ON trailer_photos FOR INSERT WITH CHECK (app_secret_ok());
CREATE POLICY "app_delete" ON trailer_photos FOR DELETE USING (app_secret_ok());

-- trailer_damages
CREATE POLICY "app_select" ON trailer_damages FOR SELECT USING (app_secret_ok());
CREATE POLICY "app_insert" ON trailer_damages FOR INSERT WITH CHECK (app_secret_ok());
CREATE POLICY "app_update" ON trailer_damages FOR UPDATE USING (app_secret_ok()) WITH CHECK (app_secret_ok());
CREATE POLICY "app_delete" ON trailer_damages FOR DELETE USING (app_secret_ok());

-- couplings
CREATE POLICY "app_select" ON couplings FOR SELECT USING (app_secret_ok());
CREATE POLICY "app_insert" ON couplings FOR INSERT WITH CHECK (app_secret_ok());
CREATE POLICY "app_update" ON couplings FOR UPDATE USING (app_secret_ok()) WITH CHECK (app_secret_ok());
CREATE POLICY "app_delete" ON couplings FOR DELETE USING (app_secret_ok());

-- ─── Hinweis: Storage-Bucket ─────────────────────────────────────────────────
-- Bucket "iaa-assets" (public = false) anlegen. Pfad-Konventionen:
--   trailers/{trailerId}/photo_{n}.jpg
--   trailers/{trailerId}/damages/{damageId}_{n}.jpg

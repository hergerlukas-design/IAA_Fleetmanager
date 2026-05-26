-- CLX Fleetmanager – Initial Schema
-- Run this in the Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- Fleets (Flotten)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE fleets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  color       TEXT DEFAULT '#3b82f6',
  description TEXT,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Vehicles (Fahrzeuge)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE vehicles (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fleet_id      UUID REFERENCES fleets(id) ON DELETE SET NULL,
  vin           TEXT,
  license_plate TEXT,
  brand_model   TEXT,
  km            INTEGER,
  fuel          INTEGER CHECK (fuel IS NULL OR (fuel >= 0 AND fuel <= 100)),
  battery       INTEGER CHECK (battery IS NULL OR (battery >= 0 AND battery <= 100)),
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'ausstehend'
                  CHECK (status IN ('ausstehend', 'in_bearbeitung', 'abgeschlossen')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    TEXT
);

CREATE INDEX idx_vehicles_fleet_id ON vehicles(fleet_id);
CREATE INDEX idx_vehicles_status    ON vehicles(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- Intake Protocols (Annahmeprotokolle) – one per vehicle
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE intake_protocols (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id     UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE UNIQUE,
  inspector_name TEXT,
  location       TEXT,
  intake_date    DATE DEFAULT CURRENT_DATE,
  notes          TEXT,
  signature_url  TEXT,
  completed      BOOLEAN NOT NULL DEFAULT false,
  completed_by   TEXT,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Vehicle Photos
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE vehicle_photos (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id   UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  photo_type   TEXT NOT NULL CHECK (photo_type IN ('vorne','hinten','links','rechts','schein','extra')),
  storage_path TEXT NOT NULL,
  taken_by     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vehicle_photos_vehicle_id ON vehicle_photos(vehicle_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Damage Records
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE damage_records (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id   UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  damage_type  TEXT,
  intensity    TEXT CHECK (intensity IS NULL OR intensity IN ('leicht','mittel','schwer')),
  position     TEXT,
  description  TEXT,
  storage_path TEXT,
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_damage_records_vehicle_id ON damage_records(vehicle_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage Buckets (run separately in Storage section or via API)
-- ─────────────────────────────────────────────────────────────────────────────
-- Create bucket "clx-assets" with public = false
-- Path conventions:
--   vehicles/{vehicleId}/vorne.jpg
--   vehicles/{vehicleId}/hinten.jpg
--   vehicles/{vehicleId}/links.jpg
--   vehicles/{vehicleId}/rechts.jpg
--   vehicles/{vehicleId}/schein.jpg
--   vehicles/{vehicleId}/signature.png
--   vehicles/{vehicleId}/damages/{damageId}.jpg

-- Disable RLS for anon-key PIN-auth approach (same as V2)
ALTER TABLE fleets           DISABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles         DISABLE ROW LEVEL SECURITY;
ALTER TABLE intake_protocols DISABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_photos   DISABLE ROW LEVEL SECURITY;
ALTER TABLE damage_records   DISABLE ROW LEVEL SECURITY;

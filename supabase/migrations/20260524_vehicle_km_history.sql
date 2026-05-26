-- KM-Verlauf / Fahrtenbuch
CREATE TABLE IF NOT EXISTS vehicle_km_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  km          integer NOT NULL,
  km_delta    integer,
  zweck       text,
  recorded_by text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vehicle_km_history_vehicle_id_idx
  ON vehicle_km_history(vehicle_id);
CREATE INDEX IF NOT EXISTS vehicle_km_history_recorded_at_idx
  ON vehicle_km_history(recorded_at DESC);

-- App uses PIN-based auth (no Supabase Auth) → disable RLS
ALTER TABLE vehicle_km_history DISABLE ROW LEVEL SECURITY;

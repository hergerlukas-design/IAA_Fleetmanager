-- ─────────────────────────────────────────────────────────────────────────────
-- Stufe-1 Security: Row Level Security via App-Secret Header
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Funktionsweise:
--   Die App sendet bei jedem Supabase-Request den Header "x-app-secret".
--   Die RLS-Funktion app_secret_ok() liest diesen Header und vergleicht ihn
--   mit dem Wert in der Tabelle _app_secret (via API nicht erreichbar).
--
-- WICHTIG – nach dieser Migration einmalig im Supabase SQL-Editor ausführen:
--
--   INSERT INTO _app_secret (secret) VALUES ('DEIN_GENERIERTER_SECRET_WERT');
--
--   Secret generieren (PowerShell):
--     [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
--
--   Denselben Wert als GitHub-Secret VITE_APP_SECRET setzen.
--
-- Der Secret-Wert darf NICHT in dieses File oder git eingecheckt werden.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Secret-Tabelle (via API vollständig gesperrt) ────────────────────────

CREATE TABLE IF NOT EXISTS _app_secret (
  secret TEXT NOT NULL
);

-- RLS ohne Policies = kein API-Zugriff möglich (weder lesen noch schreiben)
ALTER TABLE _app_secret ENABLE ROW LEVEL SECURITY;

-- ─── 2. Helper-Funktion ──────────────────────────────────────────────────────

-- SECURITY DEFINER: läuft mit den Rechten des Erstellers, umgeht RLS der
-- _app_secret-Tabelle – so kann die Funktion den Wert lesen, die API jedoch nicht.

CREATE OR REPLACE FUNCTION app_secret_ok()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM _app_secret)
    AND coalesce(
          current_setting('request.headers', true)::jsonb->>'x-app-secret',
          ''
        ) = (SELECT secret FROM _app_secret LIMIT 1)
$$;

-- ─── 3. RLS aktivieren ───────────────────────────────────────────────────────

ALTER TABLE fleets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_protocols   ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_photos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE damage_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_km_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback           ENABLE ROW LEVEL SECURITY;

-- ─── 4. Policies ─────────────────────────────────────────────────────────────

-- fleets
CREATE POLICY "app_select" ON fleets FOR SELECT USING (app_secret_ok());
CREATE POLICY "app_insert" ON fleets FOR INSERT WITH CHECK (app_secret_ok());
CREATE POLICY "app_update" ON fleets FOR UPDATE USING (app_secret_ok()) WITH CHECK (app_secret_ok());
CREATE POLICY "app_delete" ON fleets FOR DELETE USING (app_secret_ok());

-- vehicles
CREATE POLICY "app_select" ON vehicles FOR SELECT USING (app_secret_ok());
CREATE POLICY "app_insert" ON vehicles FOR INSERT WITH CHECK (app_secret_ok());
CREATE POLICY "app_update" ON vehicles FOR UPDATE USING (app_secret_ok()) WITH CHECK (app_secret_ok());
CREATE POLICY "app_delete" ON vehicles FOR DELETE USING (app_secret_ok());

-- intake_protocols
CREATE POLICY "app_select" ON intake_protocols FOR SELECT USING (app_secret_ok());
CREATE POLICY "app_insert" ON intake_protocols FOR INSERT WITH CHECK (app_secret_ok());
CREATE POLICY "app_update" ON intake_protocols FOR UPDATE USING (app_secret_ok()) WITH CHECK (app_secret_ok());
CREATE POLICY "app_delete" ON intake_protocols FOR DELETE USING (app_secret_ok());

-- vehicle_photos
CREATE POLICY "app_select" ON vehicle_photos FOR SELECT USING (app_secret_ok());
CREATE POLICY "app_insert" ON vehicle_photos FOR INSERT WITH CHECK (app_secret_ok());
CREATE POLICY "app_delete" ON vehicle_photos FOR DELETE USING (app_secret_ok());

-- damage_records
CREATE POLICY "app_select" ON damage_records FOR SELECT USING (app_secret_ok());
CREATE POLICY "app_insert" ON damage_records FOR INSERT WITH CHECK (app_secret_ok());
CREATE POLICY "app_update" ON damage_records FOR UPDATE USING (app_secret_ok()) WITH CHECK (app_secret_ok());
CREATE POLICY "app_delete" ON damage_records FOR DELETE USING (app_secret_ok());

-- vehicle_km_history
CREATE POLICY "app_select" ON vehicle_km_history FOR SELECT USING (app_secret_ok());
CREATE POLICY "app_insert" ON vehicle_km_history FOR INSERT WITH CHECK (app_secret_ok());
CREATE POLICY "app_delete" ON vehicle_km_history FOR DELETE USING (app_secret_ok());

-- feedback
CREATE POLICY "app_select" ON feedback FOR SELECT USING (app_secret_ok());
CREATE POLICY "app_insert" ON feedback FOR INSERT WITH CHECK (app_secret_ok());
CREATE POLICY "app_delete" ON feedback FOR DELETE USING (app_secret_ok());

-- ─── Hinweis: Storage-Bucket ─────────────────────────────────────────────────
-- Der Storage-Bucket "clx-assets" hat eigene Policies (Storage → Policies).
-- Diese Migration deckt nur DB-Tabellen ab. Storage-Policies separat prüfen.

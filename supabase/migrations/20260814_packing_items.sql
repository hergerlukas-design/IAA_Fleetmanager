-- ─────────────────────────────────────────────────────────────────────────────
-- Material- & Packliste
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Globale (nicht flottengebundene) Liste für Material, das für das Projekt
-- gepackt, gekauft oder besorgt werden muss. Jeder Eintrag hat einen Status,
-- der den Arbeitsablauf abbildet:
--
--   offen    → muss noch erledigt / eingepackt werden
--   kaufen   → muss noch gekauft / besorgt werden
--   gekauft  → besorgt, aber noch nicht eingepackt
--   gepackt  → eingepackt / erledigt
--
-- RLS analog zu den übrigen Tabellen (App-Secret-Header). Setzt voraus, dass die
-- Funktion app_secret_ok() bereits existiert (Migration 20260713_rls_app_secret.sql).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS packing_items (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  quantity   TEXT,                         -- Freitext-Menge, z. B. "2 Rollen", "5x"
  category   TEXT,                         -- optionale Gruppierung, z. B. "Werkzeug"
  status     TEXT        NOT NULL DEFAULT 'offen'
                CHECK (status IN ('offen', 'kaufen', 'gekauft', 'gepackt')),
  note       TEXT,
  position   INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_packing_items_status ON packing_items(status);

-- ─── Row Level Security (App-Secret-Header) ──────────────────────────────────
ALTER TABLE packing_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_select" ON packing_items FOR SELECT USING (app_secret_ok());
CREATE POLICY "app_insert" ON packing_items FOR INSERT WITH CHECK (app_secret_ok());
CREATE POLICY "app_update" ON packing_items FOR UPDATE USING (app_secret_ok()) WITH CHECK (app_secret_ok());
CREATE POLICY "app_delete" ON packing_items FOR DELETE USING (app_secret_ok());

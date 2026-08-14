-- IAA Nutzfahrzeuge – Trailer-Schäden um Schadensart & Stärke erweitern
-- --------------------------------------------------------------------------
-- Bisher war die Trailer-Schadenserfassung schlank (nur grobe Position +
-- Freitext). Beim Anlegen eines Zugfahrzeugs sollen Trailer-Schäden nun wie
-- Fahrzeug-Schäden mit Schadensart und Stärke erfasst werden (ohne visuelle
-- Karte). Beide Spalten sind nullable, damit bestehende Datensätze (nur
-- Position/Beschreibung) gültig bleiben.

ALTER TABLE trailer_damages
  ADD COLUMN IF NOT EXISTS damage_type TEXT;

ALTER TABLE trailer_damages
  ADD COLUMN IF NOT EXISTS intensity TEXT
  CHECK (intensity IS NULL OR intensity IN ('leicht', 'mittel', 'schwer'));

-- RLS-Policies liegen auf Tabellenebene und decken die neuen Spalten
-- automatisch ab – keine weitere Änderung nötig.

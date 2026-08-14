-- IAA Nutzfahrzeuge – Cleaning-Status & Trailer-Annahmebestätigung
-- --------------------------------------------------------------------------
-- Nach bestätigter Annahme sollen Fahrzeuge (innen + außen) und Trailer
-- (nur außen) einen einfachen Reinigungsstatus bekommen. Trailer erhalten
-- zusätzlich – analog zu Fahrzeugen – eine Annahmebestätigung.

-- Fahrzeuge: innen + außen
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS cleaning_inside  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS cleaning_outside BOOLEAN NOT NULL DEFAULT false;

-- Trailer: nur außen
ALTER TABLE trailers ADD COLUMN IF NOT EXISTS cleaning_outside BOOLEAN NOT NULL DEFAULT false;

-- Trailer-Annahmebestätigung (direkt auf der Trailer-Tabelle, kein eigenes Protokoll)
ALTER TABLE trailers ADD COLUMN IF NOT EXISTS annahme_confirmed    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE trailers ADD COLUMN IF NOT EXISTS annahme_confirmed_by TEXT;
ALTER TABLE trailers ADD COLUMN IF NOT EXISTS annahme_confirmed_at TIMESTAMPTZ;

-- RLS-Policies liegen auf Tabellenebene und decken die neuen Spalten ab.

-- IAA Nutzfahrzeuge – Schlüsselanzahl am Fahrzeug
-- --------------------------------------------------------------------------
-- Die Anzahl der übergebenen Schlüssel gehört zu den Basisdaten des Fahrzeugs
-- und nicht ins Annahmeprotokoll. Die zuvor angelegte Spalte auf
-- intake_protocols wird daher wieder entfernt (sie wurde nie befüllt).

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS key_count INTEGER
    CHECK (key_count IS NULL OR key_count >= 0);

ALTER TABLE intake_protocols DROP COLUMN IF EXISTS key_count;

-- RLS-Policies liegen auf Tabellenebene und decken die neue Spalte ab.

-- IAA Nutzfahrzeuge – Schlüsselanzahl im Annahmeprotokoll
-- --------------------------------------------------------------------------
-- Bei der Fahrzeugannahme wird erfasst, wie viele Schlüssel übergeben wurden.
-- Die Bemerkungen (notes) existieren bereits, bleiben aber – anders als die
-- übrigen Protokollfelder – auch nach bestätigter Annahme bearbeitbar.

ALTER TABLE intake_protocols
  ADD COLUMN IF NOT EXISTS key_count INTEGER
    CHECK (key_count IS NULL OR key_count >= 0);

-- RLS-Policies liegen auf Tabellenebene und decken die neue Spalte ab.

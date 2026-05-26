-- Add Annahme-Bestätigung fields to intake_protocols
-- Run this in the Supabase SQL Editor

ALTER TABLE intake_protocols
  ADD COLUMN IF NOT EXISTS annahme_confirmed      BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS annahme_confirmed_by   TEXT,
  ADD COLUMN IF NOT EXISTS annahme_confirmed_at   TIMESTAMPTZ;

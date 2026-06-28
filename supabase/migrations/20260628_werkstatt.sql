-- Add werkstatt (workshop) boolean column to vehicles
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS werkstatt BOOLEAN DEFAULT false;

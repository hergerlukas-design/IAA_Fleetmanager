-- Prevent duplicate vehicles with the same license plate at the DB level.
-- (App-level bug in CreateVehicleSheet could re-insert instead of update on Step 1 back-navigation.)
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_license_plate_unique_idx
  ON vehicles (license_plate)
  WHERE license_plate IS NOT NULL;

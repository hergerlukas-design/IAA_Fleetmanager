-- Manual fleet ordering: add a position column and backfill by current name order.
ALTER TABLE fleets ADD COLUMN IF NOT EXISTS position INTEGER;

WITH ordered AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY name) - 1) AS rn
  FROM fleets
)
UPDATE fleets f
SET position = o.rn
FROM ordered o
WHERE f.id = o.id
  AND f.position IS DISTINCT FROM o.rn;

CREATE INDEX IF NOT EXISTS idx_fleets_position ON fleets(position);

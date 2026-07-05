-- Per-fleet todo lists (Aufgaben je Flotte)
CREATE TABLE IF NOT EXISTS fleet_todos (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_id   UUID        NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL,
  done       BOOLEAN     NOT NULL DEFAULT false,
  position   INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fleet_todos_fleet_id ON fleet_todos(fleet_id);

ALTER TABLE fleet_todos DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON fleet_todos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON fleet_todos TO authenticated;

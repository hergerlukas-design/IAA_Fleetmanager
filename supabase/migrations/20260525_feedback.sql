-- Feedback / improvement suggestions from users
CREATE TABLE IF NOT EXISTS feedback (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  message      text        NOT NULL,
  submitted_by text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE feedback DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON feedback TO anon;
GRANT SELECT, INSERT, DELETE ON feedback TO authenticated;

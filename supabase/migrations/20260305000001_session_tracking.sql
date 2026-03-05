-- Add session tracking columns to profiles for session_start analytics
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS session_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_session_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_session_at timestamptz;

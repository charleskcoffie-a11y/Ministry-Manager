-- ============================================================
--  MINISTER'S DIARY  –  Table Setup
--  Run this in: Supabase → SQL Editor → New query → Run
-- ============================================================

CREATE TABLE IF NOT EXISTS public.diary_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date      DATE NOT NULL,
  title           TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'Personal Reflection',
  spiritual_tone  TEXT NOT NULL DEFAULT 'Peaceful',
  body            TEXT NOT NULL,
  scripture_ref   TEXT,
  prayer_response TEXT,
  is_private      BOOLEAN NOT NULL DEFAULT FALSE,
  remind_on       DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast reminder-date queries (dashboard upcoming widget)
CREATE INDEX IF NOT EXISTS idx_diary_remind_on
  ON public.diary_entries (remind_on);

-- Index for fast date-sorted listing
CREATE INDEX IF NOT EXISTS idx_diary_entry_date
  ON public.diary_entries (entry_date DESC);

-- Enable Row Level Security
ALTER TABLE public.diary_entries ENABLE ROW LEVEL SECURITY;

-- ── Choose ONE of the policies below ──────────────────────────

-- Option A: Open access (no Supabase Auth / anonymous use)
CREATE POLICY "Allow all"
  ON public.diary_entries
  FOR ALL USING (true);

-- Option B: Authenticated users only (if using Supabase Auth)
-- CREATE POLICY "Allow authenticated"
--   ON public.diary_entries
--   FOR ALL USING (auth.role() = 'authenticated');

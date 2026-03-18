CREATE TABLE IF NOT EXISTS public.john_wesley_sermons (
  sermon_number INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  scripture TEXT NOT NULL,
  source_url TEXT NOT NULL,
  sermon_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wesley_title
  ON public.john_wesley_sermons (title);

ALTER TABLE public.john_wesley_sermons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON public.john_wesley_sermons;
CREATE POLICY "Allow all"
  ON public.john_wesley_sermons
  FOR ALL USING (true)
  WITH CHECK (true);

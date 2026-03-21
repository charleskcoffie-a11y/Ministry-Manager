CREATE TABLE IF NOT EXISTS public.song_canvas_favorites (
  song_id INTEGER PRIMARY KEY REFERENCES public.songs (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.touch_song_canvas_favorites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_song_canvas_favorites_updated_at ON public.song_canvas_favorites;
CREATE TRIGGER set_song_canvas_favorites_updated_at
BEFORE UPDATE ON public.song_canvas_favorites
FOR EACH ROW
EXECUTE FUNCTION public.touch_song_canvas_favorites_updated_at();

ALTER TABLE public.song_canvas_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read song canvas favorites" ON public.song_canvas_favorites;
CREATE POLICY "Allow public read song canvas favorites"
ON public.song_canvas_favorites
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow public insert song canvas favorites" ON public.song_canvas_favorites;
CREATE POLICY "Allow public insert song canvas favorites"
ON public.song_canvas_favorites
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete song canvas favorites" ON public.song_canvas_favorites;
CREATE POLICY "Allow public delete song canvas favorites"
ON public.song_canvas_favorites
FOR DELETE
USING (true);

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.REACT_APP_SUPABASE_URL;

const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing env vars. Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const jsonPath = path.resolve(__dirname, '..', 'public', 'wesley', 'sermons.json');
const BATCH_SIZE = Number(process.env.WESLEY_SEED_BATCH_SIZE || 2);

if (!Number.isInteger(BATCH_SIZE) || BATCH_SIZE < 1) {
  console.error('WESLEY_SEED_BATCH_SIZE must be a positive integer.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const ensureSchema = async () => {
  const sql = `
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
`;

  const { error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    // Some projects do not expose an exec_sql helper function.
    // In that case, require a one-time manual schema run.
    console.warn('Schema auto-setup skipped. If table does not exist, run 00_schema_min.sql once.');
  }
};

const main = async () => {
  await ensureSchema();

  const raw = await readFile(jsonPath, 'utf8');
  const sermons = JSON.parse(raw);

  if (!Array.isArray(sermons) || sermons.length === 0) {
    throw new Error('Sermon JSON is empty or invalid.');
  }

  const rows = sermons.map((item) => ({
    sermon_number: item.number,
    title: item.title,
    scripture: item.scripture,
    source_url: item.source,
    sermon_text: item.text,
  }));

  console.log(`Seeding ${rows.length} sermons to public.john_wesley_sermons...`);

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const start = i + 1;
    const end = i + batch.length;

    const { error } = await supabase
      .from('john_wesley_sermons')
      .upsert(batch, { onConflict: 'sermon_number' });

    if (error) {
      throw new Error(`Batch ${start}-${end} failed: ${error.message}`);
    }

    console.log(`Inserted/updated sermons ${start}-${end}`);
  }

  const { count, error: countError } = await supabase
    .from('john_wesley_sermons')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    throw new Error(`Count check failed: ${countError.message}`);
  }

  console.log(`Done. Table now has ${count ?? 0} sermons.`);
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

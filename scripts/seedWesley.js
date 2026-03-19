import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import {
  expectedWesleyCount,
  isMissingWesleyTableError,
  resolveSupabaseEnv,
  wesleyJsonPath,
  wesleySchemaSetupHint,
} from './wesleyUtils.js';

const {
  supabaseUrl,
  supabaseKey,
  supabaseServiceRoleKey,
  keyLabel,
  usingDefaultProject,
  isPartiallyConfigured,
} = resolveSupabaseEnv();

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Set VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY or SUPABASE_URL/SUPABASE_ANON_KEY.');
  process.exit(1);
}

const BATCH_SIZE = Number(process.env.WESLEY_SEED_BATCH_SIZE || 2);

if (!Number.isInteger(BATCH_SIZE) || BATCH_SIZE < 1) {
  console.error('WESLEY_SEED_BATCH_SIZE must be a positive integer.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
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

  if (!error) {
    console.log('Ensured John Wesley schema via exec_sql.');
    return true;
  }

  const detail = error?.message || 'Unknown schema bootstrap error.';
  if (supabaseServiceRoleKey) {
    console.warn(`Schema auto-setup did not run via exec_sql: ${detail}`);
  } else {
    console.warn(`Schema auto-setup skipped: ${detail}`);
  }

  return false;
};

const getRemoteCount = async () => {
  const { count, error } = await supabase
    .from('john_wesley_sermons')
    .select('sermon_number', { count: 'exact' })
    .limit(1);

  return {
    count: count ?? 0,
    error,
  };
};

const main = async () => {
  if (isPartiallyConfigured) {
    console.warn(
      'Supabase env vars are only partially configured. Falling back to the shared default project until both URL and anon key are provided.'
    );
  }

  if (usingDefaultProject) {
    console.warn(
      'Using the shared fallback Supabase project. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env to target your own database.'
    );
  }

  console.log(`Using ${keyLabel} key for John Wesley seeding.`);

  await ensureSchema();

  const preflight = await getRemoteCount();
  if (preflight.error) {
    if (isMissingWesleyTableError(preflight.error)) {
      throw new Error(wesleySchemaSetupHint());
    }

    throw new Error(`Could not access public.john_wesley_sermons: ${preflight.error.message}`);
  }

  const raw = await readFile(wesleyJsonPath, 'utf8');
  const sermons = JSON.parse(raw.replace(/^\uFEFF/u, ''));

  if (!Array.isArray(sermons) || sermons.length === 0) {
    throw new Error('Local Wesley sermon corpus is empty or invalid.');
  }

  const uniqueNumbers = new Set(sermons.map((item) => item.number)).size;
  if (sermons.length !== expectedWesleyCount || uniqueNumbers !== expectedWesleyCount) {
    throw new Error(
      `Expected ${expectedWesleyCount} local Wesley sermons, found ${sermons.length} rows and ${uniqueNumbers} unique sermon numbers.`
    );
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
      if (isMissingWesleyTableError(error)) {
        throw new Error(wesleySchemaSetupHint());
      }

      throw new Error(`Batch ${start}-${end} failed: ${error.message}`);
    }

    console.log(`Inserted/updated sermons ${start}-${end}`);
  }

  const postflight = await getRemoteCount();
  if (postflight.error) {
    throw new Error(`Count check failed: ${postflight.error.message}`);
  }

  if (postflight.count !== rows.length) {
    throw new Error(`Seed completed but remote count is ${postflight.count}; expected ${rows.length}.`);
  }

  console.log(`Done. Table now has ${postflight.count} sermons.`);
};

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

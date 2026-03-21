import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveSupabaseEnv } from './wesleyUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
  supabaseUrl,
  supabaseKey,
  keyLabel,
  usingDefaultProject,
  isPartiallyConfigured,
} = resolveSupabaseEnv();

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Set VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY or SUPABASE_URL/SUPABASE_ANON_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const schemaPath = path.resolve(__dirname, '..', 'sql', 'song_canvas_favorites.sql');

const probeSongCanvasFavorites = async () => {
  const { error: probeError } = await supabase
    .from('song_canvas_favorites')
    .select('song_id', { count: 'exact' })
    .limit(1);

  return probeError;
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

  console.log(`Using ${keyLabel} key for Song Canvas favorites schema.`);

  const sql = await readFile(schemaPath, 'utf8');
  const { error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    const missingExecSql = /Could not find the function\s+public\.exec_sql/i.test(error.message || '');

    if (!missingExecSql) {
      throw new Error(`Could not apply song_canvas_favorites schema: ${error.message}`);
    }

    const probeError = await probeSongCanvasFavorites();
    if (!probeError) {
      console.warn(
        'Supabase RPC public.exec_sql is unavailable in this project, but song_canvas_favorites already exists. Skipping schema apply.'
      );
      console.log('Song Canvas favorites schema is ready.');
      return;
    }

    throw new Error(
      `Could not apply song_canvas_favorites schema via RPC (${error.message}) and table probe failed: ${probeError.message}`
    );
  }

  const probeError = await probeSongCanvasFavorites();

  if (probeError) {
    throw new Error(`Schema applied, but table probe failed: ${probeError.message}`);
  }

  console.log('Song Canvas favorites schema is ready.');
};

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

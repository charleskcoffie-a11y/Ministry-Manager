import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import {
  expectedWesleyCount,
  isMissingWesleyTableError,
  resolveSupabaseEnv,
  wesleyJsonPath,
  wesleySchemaSetupHint,
} from './wesleyUtils.js';

const countLocalSermons = async () => {
  const raw = await readFile(wesleyJsonPath, 'utf8');
  const sermons = JSON.parse(raw.replace(/^\uFEFF/u, ''));

  if (!Array.isArray(sermons)) {
    throw new Error('Local Wesley sermon corpus is invalid.');
  }

  return {
    count: sermons.length,
    uniqueCount: new Set(sermons.map((item) => item.number)).size,
  };
};

const main = async () => {
  const local = await countLocalSermons();
  if (local.count !== expectedWesleyCount || local.uniqueCount !== expectedWesleyCount) {
    throw new Error(
      `Local Wesley corpus expected ${expectedWesleyCount} sermons, found ${local.count} rows and ${local.uniqueCount} unique sermon numbers.`
    );
  }

  const { supabaseUrl, supabaseAnonKey, usingDefaultProject, isPartiallyConfigured } = resolveSupabaseEnv();

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

  console.log(`Local Wesley corpus: ${local.count}/${expectedWesleyCount} sermons.`);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { count, error } = await supabase
    .from('john_wesley_sermons')
    .select('sermon_number', { count: 'exact' })
    .limit(1);

  if (error) {
    if (isMissingWesleyTableError(error)) {
      throw new Error(wesleySchemaSetupHint());
    }

    throw new Error(`Could not query public.john_wesley_sermons: ${error.message}`);
  }

  const remoteCount = count ?? 0;
  console.log(`Remote Wesley table: ${remoteCount}/${expectedWesleyCount} sermons.`);

  if (remoteCount !== local.count) {
    throw new Error(
      `Remote John Wesley table has ${remoteCount} sermons, expected ${local.count}. Run npm run seed:wesley after the schema exists.`
    );
  }

  console.log(`John Wesley sync is complete: ${remoteCount}/${expectedWesleyCount} sermons are present in Supabase.`);
};

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
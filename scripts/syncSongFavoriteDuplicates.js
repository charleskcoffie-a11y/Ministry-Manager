import { createClient } from '@supabase/supabase-js';
import { resolveSupabaseEnv } from './wesleyUtils.js';

const APPLY_CHANGES = process.argv.includes('--apply');
const FETCH_BATCH_SIZE = Number.parseInt(process.env.SONG_FAVORITE_SYNC_FETCH_BATCH_SIZE || '1000', 10);

if (!Number.isInteger(FETCH_BATCH_SIZE) || FETCH_BATCH_SIZE < 1) {
  console.error('SONG_FAVORITE_SYNC_FETCH_BATCH_SIZE must be a positive integer.');
  process.exit(1);
}

const {
  supabaseUrl,
  supabaseAnonKey,
  supabaseServiceRoleKey,
  usingDefaultProject,
  isPartiallyConfigured,
} = resolveSupabaseEnv();

const supabaseKey = supabaseServiceRoleKey || supabaseAnonKey;

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

const normalizeCollection = (value) => String(value ?? '').trim().toUpperCase();
const normalizeCode = (value) => String(value ?? '').trim().toUpperCase();

const buildIdentityKey = (song) => {
  const collection = normalizeCollection(song.collection);
  const code = normalizeCode(song.code);
  const number = Number.isInteger(song.number) ? song.number : '';

  if (!collection || !code) {
    return '';
  }

  return `${collection}|${code}|${number}`;
};

const fetchAllSongs = async () => {
  const rows = [];

  for (let from = 0; ; from += FETCH_BATCH_SIZE) {
    const { data, error } = await supabase
      .from('songs')
      .select('id, collection, code, number, title, is_favorite')
      .order('id', { ascending: true })
      .range(from, from + FETCH_BATCH_SIZE - 1);

    if (error) {
      throw new Error(`Could not load songs: ${error.message}`);
    }

    if (!data?.length) {
      break;
    }

    rows.push(...data);

    if (data.length < FETCH_BATCH_SIZE) {
      break;
    }
  }

  return rows;
};

const main = async () => {
  if (isPartiallyConfigured) {
    console.warn('Supabase env vars are partially configured. Falling back to shared default project.');
  }

  if (usingDefaultProject) {
    console.warn('Using shared fallback Supabase project. Configure your own project in .env for production safety.');
  }

  const songs = await fetchAllSongs();
  const groups = new Map();

  for (const song of songs) {
    const identityKey = buildIdentityKey(song);
    if (!identityKey) {
      continue;
    }

    const existing = groups.get(identityKey) || [];
    existing.push(song);
    groups.set(identityKey, existing);
  }

  const mismatches = [];
  for (const [identityKey, entries] of groups.entries()) {
    if (entries.length < 2) {
      continue;
    }

    const targetFavorite = entries.some((entry) => Boolean(entry.is_favorite));
    const inconsistent = entries.some((entry) => Boolean(entry.is_favorite) !== targetFavorite);
    if (!inconsistent) {
      continue;
    }

    mismatches.push({
      identityKey,
      targetFavorite,
      entries,
    });
  }

  console.log(`Songs scanned: ${songs.length}`);
  console.log(`Duplicate groups with favorite mismatch: ${mismatches.length}`);

  if (mismatches.length) {
    for (const mismatch of mismatches.slice(0, 10)) {
      console.log(`\n${mismatch.identityKey} -> target is_favorite=${mismatch.targetFavorite}`);
      for (const entry of mismatch.entries) {
        console.log(`  id=${entry.id} is_favorite=${Boolean(entry.is_favorite)} title=${entry.title}`);
      }
    }
  }

  if (!APPLY_CHANGES) {
    console.log('\nDry run only. Re-run with `npm run songs:favorites:sync:apply` to apply changes.');
    return;
  }

  for (const mismatch of mismatches) {
    const [collection, code, numberRaw] = mismatch.identityKey.split('|');
    const number = numberRaw === '' ? null : Number(numberRaw);

    let query = supabase
      .from('songs')
      .update({ is_favorite: mismatch.targetFavorite })
      .eq('collection', collection)
      .eq('code', code);

    if (Number.isInteger(number)) {
      query = query.eq('number', number);
    }

    const { error } = await query;
    if (error) {
      throw new Error(`Failed to update ${mismatch.identityKey}: ${error.message}`);
    }
  }

  console.log(`\nApplied synchronization to ${mismatches.length} duplicate groups.`);
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

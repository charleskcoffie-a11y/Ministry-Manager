import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { resolveSupabaseEnv } from './wesleyUtils.js';

const getArgValue = (flag) => {
  const prefixed = process.argv.find((value) => value.startsWith(`${flag}=`));
  if (prefixed) {
    return prefixed.slice(flag.length + 1).trim();
  }

  const index = process.argv.indexOf(flag);
  if (index < 0) {
    return '';
  }

  const candidate = process.argv[index + 1];
  if (!candidate || candidate.startsWith('--')) {
    return '';
  }

  return candidate.trim();
};

const APPLY_CHANGES = process.argv.includes('--apply');
const REPORT_FLAG_USED = process.argv.some((value) => value === '--report' || value.startsWith('--report='));
const REPORT_PATH = getArgValue('--report');
const KEEP_STRATEGY = (() => {
  const rawArg = process.argv.find((value) => value.startsWith('--keep='));
  const selected = rawArg?.split('=')[1] ?? 'lowest-id';
  return ['lowest-id', 'oldest', 'newest'].includes(selected) ? selected : 'lowest-id';
})();
const FETCH_BATCH_SIZE = Number.parseInt(process.env.SONG_DEDUPE_FETCH_BATCH_SIZE || '1000', 10);
const DELETE_BATCH_SIZE = Number.parseInt(process.env.SONG_DEDUPE_DELETE_BATCH_SIZE || '250', 10);

if (!Number.isInteger(FETCH_BATCH_SIZE) || FETCH_BATCH_SIZE < 1) {
  console.error('SONG_DEDUPE_FETCH_BATCH_SIZE must be a positive integer.');
  process.exit(1);
}

if (!Number.isInteger(DELETE_BATCH_SIZE) || DELETE_BATCH_SIZE < 1) {
  console.error('SONG_DEDUPE_DELETE_BATCH_SIZE must be a positive integer.');
  process.exit(1);
}

if (REPORT_FLAG_USED && !REPORT_PATH) {
  console.error('Missing report path. Use --report=<path> (for example --report=reports/song-conflicts.json).');
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

const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/gu, ' ').trim();
const normalizeLower = (value) => normalizeWhitespace(value).toLowerCase();
const normalizeUpper = (value) => normalizeWhitespace(value).toUpperCase();
const getLyricsHash = (value) =>
  createHash('sha1')
    .update(normalizeLower(value))
    .digest('hex')
    .slice(0, 12);

const exactDuplicateKey = (song) => [
  normalizeUpper(song.collection),
  normalizeUpper(song.code),
  String(song.number ?? ''),
  normalizeLower(song.title),
  normalizeLower(song.lyrics),
].join('|');

const collectionCodeKey = (song) => [
  normalizeUpper(song.collection),
  normalizeUpper(song.code),
  String(song.number ?? ''),
].join('|');

const sortGroupForKeepStrategy = (songs) => {
  const copy = [...songs];

  copy.sort((left, right) => {
    if (KEEP_STRATEGY === 'oldest' || KEEP_STRATEGY === 'newest') {
      const leftTime = Date.parse(left.created_at ?? '') || 0;
      const rightTime = Date.parse(right.created_at ?? '') || 0;
      if (leftTime !== rightTime) {
        return KEEP_STRATEGY === 'oldest' ? leftTime - rightTime : rightTime - leftTime;
      }
    }

    return Number(left.id) - Number(right.id);
  });

  return copy;
};

const fetchAllSongs = async () => {
  const rows = [];

  for (let from = 0; ; from += FETCH_BATCH_SIZE) {
    const { data, error } = await supabase
      .from('songs')
      .select('id, collection, code, number, title, lyrics, created_at')
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

const describeGroup = (songs) => songs.map((song) => ({
  id: song.id,
  created_at: song.created_at,
  collection: song.collection,
  code: song.code,
  number: song.number,
  title: song.title,
}));

const printSummary = ({ totalSongs, duplicateGroups, conflictingGroups, removableIds }) => {
  console.log(`Songs scanned: ${totalSongs}`);
  console.log(`Exact duplicate groups: ${duplicateGroups.length}`);
  console.log(`Rows eligible for deletion: ${removableIds.length}`);
  console.log(`Conflicting collection/code/number groups left untouched: ${conflictingGroups.length}`);

  if (duplicateGroups.length) {
    console.log('\nSample exact duplicate groups (keep first row shown):');
    for (const group of duplicateGroups.slice(0, 5)) {
      console.log(JSON.stringify(describeGroup(group), null, 2));
    }
  }

  if (conflictingGroups.length) {
    console.log('\nSample conflicting groups left untouched (same collection/code/number but different title or lyrics):');
    for (const group of conflictingGroups.slice(0, 5)) {
      console.log(JSON.stringify(describeGroup(group), null, 2));
    }
  }

  if (!APPLY_CHANGES) {
    console.log('\nDry run only. Re-run with `npm run songs:dedupe:apply` to delete exact duplicates.');
  }
};

const buildConflictReport = ({ totalSongs, duplicateGroups, conflictingGroups, removableIds }) => ({
  generatedAt: new Date().toISOString(),
  keepStrategy: KEEP_STRATEGY,
  summary: {
    songsScanned: totalSongs,
    exactDuplicateGroups: duplicateGroups.length,
    rowsEligibleForDeletion: removableIds.length,
    conflictingGroups: conflictingGroups.length,
  },
  conflicts: conflictingGroups.map((group) => {
    const canonical = group[0];
    const variants = new Map();

    for (const song of group) {
      const variantKey = `${normalizeLower(song.title)}|${getLyricsHash(song.lyrics)}`;
      const existing = variants.get(variantKey) ?? {
        title: song.title,
        lyricsHash: getLyricsHash(song.lyrics),
        rowIds: [],
      };

      existing.rowIds.push(song.id);
      variants.set(variantKey, existing);
    }

    return {
      key: collectionCodeKey(canonical),
      collection: canonical.collection,
      code: canonical.code,
      number: canonical.number,
      totalRows: group.length,
      recommendedKeepId: canonical.id,
      variants: [...variants.values()].sort((left, right) => left.rowIds[0] - right.rowIds[0]),
      rows: group.map((song) => ({
        id: song.id,
        created_at: song.created_at,
        title: song.title,
        lyricsHash: getLyricsHash(song.lyrics),
      })),
    };
  }),
});

const writeConflictReport = async (reportPayload) => {
  if (!REPORT_PATH) {
    return;
  }

  const absolutePath = path.isAbsolute(REPORT_PATH)
    ? REPORT_PATH
    : path.resolve(process.cwd(), REPORT_PATH);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(reportPayload, null, 2)}\n`, 'utf8');
  console.log(`Conflict report written to ${absolutePath}`);
};

const main = async () => {
  if (isPartiallyConfigured) {
    console.warn('Supabase env vars are partially configured. Provide both URL and anon key to target your own project reliably.');
  }

  if (usingDefaultProject) {
    console.warn('Using the shared fallback Supabase project. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env to target your own database.');
  }

  if (APPLY_CHANGES && !supabaseServiceRoleKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY is not configured. The script will attempt deletion with the anon key and will rely on your table policies.');
  }

  const songs = await fetchAllSongs();
  const exactGroups = new Map();
  const collectionCodeGroups = new Map();

  for (const song of songs) {
    const duplicateBucket = exactGroups.get(exactDuplicateKey(song)) ?? [];
    duplicateBucket.push(song);
    exactGroups.set(exactDuplicateKey(song), duplicateBucket);

    const collectionBucket = collectionCodeGroups.get(collectionCodeKey(song)) ?? [];
    collectionBucket.push(song);
    collectionCodeGroups.set(collectionCodeKey(song), collectionBucket);
  }

  const duplicateGroups = [...exactGroups.values()]
    .filter((group) => group.length > 1)
    .map(sortGroupForKeepStrategy)
    .sort((left, right) => left[0].id - right[0].id);

  const removableIds = duplicateGroups.flatMap((group) => group.slice(1).map((song) => song.id));

  const conflictingGroups = [...collectionCodeGroups.values()]
    .filter((group) => {
      if (group.length < 2) return false;
      const exactKeys = new Set(group.map(exactDuplicateKey));
      return exactKeys.size > 1;
    })
    .map(sortGroupForKeepStrategy)
    .sort((left, right) => left[0].id - right[0].id);

  printSummary({ totalSongs: songs.length, duplicateGroups, conflictingGroups, removableIds });
  await writeConflictReport(
    buildConflictReport({
      totalSongs: songs.length,
      duplicateGroups,
      conflictingGroups,
      removableIds,
    })
  );

  if (!APPLY_CHANGES || !removableIds.length) {
    return;
  }

  for (let index = 0; index < removableIds.length; index += DELETE_BATCH_SIZE) {
    const batch = removableIds.slice(index, index + DELETE_BATCH_SIZE);
    const { error } = await supabase
      .from('songs')
      .delete()
      .in('id', batch);

    if (error) {
      throw new Error(`Delete batch ${index + 1}-${index + batch.length} failed: ${error.message}`);
    }

    console.log(`Deleted duplicate song rows ${index + 1}-${index + batch.length}`);
  }

  console.log(`Done. Deleted ${removableIds.length} duplicate song rows.`);
};

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
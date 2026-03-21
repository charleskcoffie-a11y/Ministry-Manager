import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { repoRoot, resolveSupabaseEnv, relativeRepoPath } from './wesleyUtils.js';

const SIDE_BY_SIDE_COLLECTIONS = ['SIDE_BY_SIDE_HYMNS', 'SIDE_BY_SIDE_CANTICLES'];
const BATCH_SIZE = 150;

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

const normalizeText = (value) => String(value ?? '').replace(/\r/gu, '').trim();

const parseNumber = (value) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toSongCollection = (record) => {
  const existing = String(record.collection ?? '').trim().toUpperCase();
  if (existing === 'SIDE_BY_SIDE_HYMNS' || existing === 'SIDE_BY_SIDE_CANTICLES') {
    return existing;
  }

  const sourceGroup = String(record.source_group ?? '').toUpperCase();
  return sourceGroup.includes('CANTICLE') ? 'SIDE_BY_SIDE_CANTICLES' : 'SIDE_BY_SIDE_HYMNS';
};

const buildLyrics = (record) => {
  const left = normalizeText(record.lyrics_left);
  const right = normalizeText(record.lyrics_right);
  const merged = normalizeText(record.lyrics);

  if (left || right) {
    return `[LEFT]\n${left}\n\n[RIGHT]\n${right}`.trim();
  }

  return merged;
};

const buildStableSongId = (record, usedIds) => {
  const identity = [
    toSongCollection(record),
    normalizeText(record.code),
    String(parseNumber(record.number) ?? ''),
    normalizeText(record.title).toLowerCase(),
    normalizeText(record.source_path).toLowerCase(),
  ].join('|');

  const digest = createHash('sha1').update(identity).digest();
  let id = 2000000 + (digest.readUInt32BE(0) % 700000000);

  while (usedIds.has(id)) {
    id += 1;
  }

  usedIds.add(id);
  return id;
};

const mapRecordToSong = (record, usedIds) => {
  const collection = toSongCollection(record);
  const number = parseNumber(record.number);
  const title = normalizeText(record.title) || normalizeText(record.code) || `Song ${number ?? ''}`.trim();
  const code = number
    ? collection === 'SIDE_BY_SIDE_CANTICLES'
      ? `CAN ${number}`
      : `MHB ${number}`
    : normalizeText(record.code) || 'SBS';
  const sourceGroup = normalizeText(record.source_group);

  return {
    id: buildStableSongId(record, usedIds),
    collection,
    code,
    number,
    title,
    raw_title: title,
    lyrics: buildLyrics(record),
    author: null,
    copyright: null,
    tags: sourceGroup ? `SIDE_BY_SIDE,${sourceGroup}` : 'SIDE_BY_SIDE',
    reference_number: sourceGroup || null,
  };
};

const run = async () => {
  const relativeInputPath = getArgValue('--input') || 'reports/hymns-side-by-side.json';
  const inputPath = path.resolve(repoRoot, relativeInputPath);

  if (!fs.existsSync(inputPath)) {
    console.error(`Input JSON file not found: ${relativeRepoPath(inputPath)}`);
    process.exit(1);
  }

  const rawJson = fs.readFileSync(inputPath, 'utf8');
  const sanitizedJson = rawJson
    .replace(/^\uFEFF/gu, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/gu, '');
  let records;

  try {
    records = JSON.parse(sanitizedJson);
  } catch (error) {
    console.error(`Failed to parse JSON from ${relativeRepoPath(inputPath)}: ${error.message}`);
    process.exit(1);
  }

  if (!Array.isArray(records) || records.length === 0) {
    console.error(`No records found in ${relativeRepoPath(inputPath)}.`);
    process.exit(1);
  }

  records.sort((left, right) => String(left.source_path ?? '').localeCompare(String(right.source_path ?? '')));

  const usedIds = new Set();
  const songs = records.map((record) => mapRecordToSong(record, usedIds));

  const { supabaseUrl, supabaseKey, keyLabel, usingDefaultProject, isPartiallyConfigured } = resolveSupabaseEnv();

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or SUPABASE_URL and SUPABASE_ANON_KEY).');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log(`Import target: ${supabaseUrl}`);
  console.log(`Using key: ${keyLabel}`);
  if (usingDefaultProject) {
    console.warn('No fully configured env vars found. Using default shared Supabase project from config.');
  } else if (isPartiallyConfigured) {
    console.warn('Supabase env vars are partially configured; default project may be used for missing values.');
  }

  console.log(`Loaded ${songs.length} songs from ${relativeRepoPath(inputPath)}.`);

  const { error: deleteError } = await supabase.from('songs').delete().in('collection', SIDE_BY_SIDE_COLLECTIONS);
  if (deleteError) {
    console.error(`Failed clearing old side-by-side songs: ${deleteError.message}`);
    process.exit(1);
  }

  console.log('Cleared existing side-by-side songs. Starting insert...');

  let inserted = 0;
  for (let index = 0; index < songs.length; index += BATCH_SIZE) {
    const batch = songs.slice(index, index + BATCH_SIZE);
    const { error } = await supabase.from('songs').upsert(batch);
    if (error) {
      console.error(`Batch ${index}-${index + batch.length - 1} failed: ${error.message}`);
      process.exit(1);
    }

    inserted += batch.length;
    console.log(`Inserted ${inserted}/${songs.length}`);
  }

  const { count: totalCount, error: verifyError } = await supabase
    .from('songs')
    .select('id', { count: 'exact', head: true })
    .in('collection', SIDE_BY_SIDE_COLLECTIONS);

  if (verifyError) {
    console.warn(`Import completed but verification failed: ${verifyError.message}`);
  } else {
    console.log(`Verified ${totalCount ?? 0} side-by-side songs in database.`);
  }

  console.log('Side-by-side song import completed successfully.');
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

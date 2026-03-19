import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const defaultStoryFiles = [
  path.resolve(repoRoot, 'public', 'wesley', 'hymn_stories.json'),
  path.resolve(repoRoot, 'public', 'wesley', 'canticle_stories.json'),
];

const defaultExportCandidates = [
  process.env.HYMN_EXPORT_PATH,
  path.resolve(repoRoot, 'hymns_firestore_clean_v2.json'),
  'C:/Users/charlesc/OneDrive - Ghana Methodist church of Toronto/GMCT/EASYWORSHIP/hymns_firestore_clean_v2.json',
];

const normalizeText = (value) => String(value ?? '').trim();
const normalizeCollection = (value) => normalizeText(value).toUpperCase();
const normalizeCode = (value) => normalizeText(value).toUpperCase();
const normalizeTitle = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const parsePositiveInteger = (value) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getArgValue = (flag) => {
  const index = process.argv.indexOf(flag);
  if (index < 0) return null;
  return process.argv[index + 1] ?? null;
};

const hasFlag = (flag) => process.argv.includes(flag);

const resolveExistingPath = (rawPath) => {
  if (!rawPath) return null;
  const absolutePath = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
  return existsSync(absolutePath) ? absolutePath : null;
};

const loadJson = async (filePath) => {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw.replace(/^\uFEFF/u, ''));
};

const resolveExportPath = () => {
  const explicit = getArgValue('--export');
  const candidates = [explicit, ...defaultExportCandidates];

  for (const candidate of candidates) {
    const resolved = resolveExistingPath(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return null;
};

const resolveStoryFiles = () => {
  const custom = getArgValue('--files');
  if (!custom) {
    return defaultStoryFiles.filter((filePath) => existsSync(filePath));
  }

  return custom
    .split(',')
    .map((entry) => normalizeText(entry))
    .filter(Boolean)
    .map((entry) => path.resolve(repoRoot, entry));
};

const normalizeSongRefs = (value) => {
  if (!Array.isArray(value)) return [];

  const seen = new Set();
  const refs = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;

    const collection = normalizeCollection(item.collection);
    if (!collection) continue;

    const code = normalizeCode(item.code);
    const number = parsePositiveInteger(item.number);
    if (!code && number === null) continue;

    const key = `${collection}|${code}|${number ?? ''}`;
    if (seen.has(key)) continue;

    seen.add(key);
    refs.push({
      collection,
      ...(code ? { code } : {}),
      ...(number !== null ? { number } : {}),
    });
  }

  return refs;
};

const dedupeSongRecords = (records) => {
  const seen = new Set();
  const deduped = [];

  for (const record of records) {
    const key = `${record.collection}|${record.code ?? ''}|${record.number ?? ''}|${record.titleKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(record);
  }

  return deduped;
};

const buildExportIndexes = (songs) => {
  const byTitle = new Map();
  const byCollectionCode = new Map();
  const byCollectionNumber = new Map();

  for (const song of songs) {
    const collection = normalizeCollection(song.collection);
    const titleKey = normalizeTitle(song.title);
    const code = normalizeCode(song.code);
    const number = parsePositiveInteger(song.number);

    if (!collection || !titleKey) continue;

    const record = {
      collection,
      code: code || null,
      number,
      title: normalizeText(song.title),
      titleKey,
    };

    const titleBucket = byTitle.get(titleKey) ?? [];
    titleBucket.push(record);
    byTitle.set(titleKey, titleBucket);

    if (record.code) {
      byCollectionCode.set(`${collection}|${record.code}`, record);
    }

    if (record.number !== null) {
      byCollectionNumber.set(`${collection}|${record.number}`, record);
    }
  }

  return {
    byTitle,
    byCollectionCode,
    byCollectionNumber,
  };
};

const syncStoryRecord = (story, indexes) => {
  const titleKeys = [story.title, ...(Array.isArray(story.alternateTitles) ? story.alternateTitles : [])]
    .map((title) => normalizeTitle(title))
    .filter(Boolean);

  const matchedRecords = [];

  for (const titleKey of titleKeys) {
    const fromTitle = indexes.byTitle.get(titleKey) ?? [];
    matchedRecords.push(...fromTitle);
  }

  const existingRefs = normalizeSongRefs(story.songRefs);
  for (const ref of existingRefs) {
    if (ref.code) {
      const codeMatch = indexes.byCollectionCode.get(`${ref.collection}|${ref.code}`);
      if (codeMatch) matchedRecords.push(codeMatch);
    }

    if (ref.number !== undefined) {
      const numberMatch = indexes.byCollectionNumber.get(`${ref.collection}|${ref.number}`);
      if (numberMatch) matchedRecords.push(numberMatch);
    }
  }

  const dedupedMatches = dedupeSongRecords(matchedRecords);

  const currentMhbNumbers = Array.isArray(story.mhbNumbers)
    ? story.mhbNumbers
        .map((number) => parsePositiveInteger(number))
        .filter((number) => number !== null)
    : [];

  const mappedMhbNumbers = Array.from(
    new Set(
      dedupedMatches
        .filter((record) => record.collection === 'MHB' && record.number !== null)
        .map((record) => record.number)
    )
  ).sort((left, right) => left - right);

  const nextMhbNumbers = mappedMhbNumbers.length ? mappedMhbNumbers : currentMhbNumbers;

  const mappedSongRefs = dedupedMatches
    .filter((record) => record.collection !== 'MHB')
    .map((record) => ({
      collection: record.collection,
      ...(record.code ? { code: record.code } : {}),
      ...(record.number !== null ? { number: record.number } : {}),
    }));

  const nextSongRefs = mappedSongRefs.length ? normalizeSongRefs(mappedSongRefs) : existingRefs;

  return {
    ...story,
    mhbNumbers: Array.from(new Set(nextMhbNumbers)).sort((left, right) => left - right),
    songRefs: nextSongRefs,
  };
};

const summarizeStories = (stories) => ({
  total: stories.length,
  withMhbNumbers: stories.filter((story) => Array.isArray(story.mhbNumbers) && story.mhbNumbers.length > 0).length,
  withSongRefs: stories.filter((story) => Array.isArray(story.songRefs) && story.songRefs.length > 0).length,
});

const main = async () => {
  const exportPath = resolveExportPath();
  if (!exportPath) {
    throw new Error(
      'Could not resolve hymnal export path. Provide --export "path/to/hymns_firestore_clean_v2.json" or set HYMN_EXPORT_PATH.'
    );
  }

  const storyFiles = resolveStoryFiles();
  if (!storyFiles.length) {
    throw new Error('No story files were found. Use --files "public/wesley/hymn_stories.json,public/wesley/canticle_stories.json".');
  }

  const dryRun = hasFlag('--dry-run');
  const songs = await loadJson(exportPath);
  if (!Array.isArray(songs)) {
    throw new Error('The hymnal export file is not a JSON array.');
  }

  const indexes = buildExportIndexes(songs);
  let changedFiles = 0;

  console.log(`Using export: ${exportPath}`);

  for (const storyFilePath of storyFiles) {
    const current = await loadJson(storyFilePath);
    if (!Array.isArray(current)) {
      console.warn(`Skipping ${storyFilePath}: expected an array.`);
      continue;
    }

    const next = current.map((story) => syncStoryRecord(story, indexes));
    const beforeSummary = summarizeStories(current);
    const afterSummary = summarizeStories(next);
    const changed = JSON.stringify(current) !== JSON.stringify(next);

    console.log(`\n${path.relative(repoRoot, storyFilePath)}`);
    console.log(`  before: total=${beforeSummary.total}, mhb=${beforeSummary.withMhbNumbers}, refs=${beforeSummary.withSongRefs}`);
    console.log(`  after : total=${afterSummary.total}, mhb=${afterSummary.withMhbNumbers}, refs=${afterSummary.withSongRefs}`);

    if (changed) {
      changedFiles += 1;
      if (!dryRun) {
        await writeFile(storyFilePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
      }
      console.log(`  status: ${dryRun ? 'changes detected (dry-run)' : 'updated'}`);
    } else {
      console.log('  status: unchanged');
    }
  }

  if (dryRun) {
    console.log(`\nDry run complete. ${changedFiles} file(s) would change.`);
    return;
  }

  console.log(`\nSync complete. ${changedFiles} file(s) updated.`);
};

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

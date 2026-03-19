import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

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

const parsePositiveInteger = (value) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toAbsolutePath = (value, fallbackRelativePath) => {
  const resolved = value || fallbackRelativePath;
  return path.isAbsolute(resolved)
    ? resolved
    : path.resolve(repoRoot, resolved);
};

const csvEscape = (value) => {
  const text = String(value ?? '');
  if (/[",\n\r]/u.test(text)) {
    return `"${text.replace(/"/gu, '""')}"`;
  }

  return text;
};

const getDateBounds = (rows) => {
  const timestamps = rows
    .map((row) => Date.parse(row.created_at ?? ''))
    .filter((timestamp) => Number.isFinite(timestamp));

  if (!timestamps.length) {
    return { min: '', max: '' };
  }

  const minTimestamp = Math.min(...timestamps);
  const maxTimestamp = Math.max(...timestamps);

  return {
    min: new Date(minTimestamp).toISOString(),
    max: new Date(maxTimestamp).toISOString(),
  };
};

const toCsvRow = (conflict) => {
  const rowIds = (Array.isArray(conflict.rows) ? conflict.rows : [])
    .map((row) => row.id)
    .filter((value) => value !== undefined && value !== null);

  const titles = (Array.isArray(conflict.rows) ? conflict.rows : [])
    .map((row) => row.title)
    .filter(Boolean);

  const lyricsHashes = (Array.isArray(conflict.rows) ? conflict.rows : [])
    .map((row) => row.lyricsHash)
    .filter(Boolean);

  const dateBounds = getDateBounds(Array.isArray(conflict.rows) ? conflict.rows : []);
  const recommendedKeepId = conflict.recommendedKeepId ?? '';
  const recommendedDeleteIds = rowIds.filter((id) => id !== recommendedKeepId);
  const variantCount = Array.isArray(conflict.variants) ? conflict.variants.length : 0;

  return {
    key: conflict.key ?? '',
    collection: conflict.collection ?? '',
    code: conflict.code ?? '',
    number: conflict.number ?? '',
    totalRows: conflict.totalRows ?? rowIds.length,
    variantCount,
    recommendedKeepId,
    recommendedDeleteIds: recommendedDeleteIds.join('|'),
    rowIds: rowIds.join('|'),
    titles: titles.join(' || '),
    lyricsHashes: lyricsHashes.join('|'),
    createdAtMin: dateBounds.min,
    createdAtMax: dateBounds.max,
    reviewAction: '',
    reviewKeepId: '',
    reviewDeleteIds: '',
    reviewNotes: '',
  };
};

const compareConflicts = (left, right) => {
  const leftTotalRows = parsePositiveInteger(left.totalRows) ?? 0;
  const rightTotalRows = parsePositiveInteger(right.totalRows) ?? 0;
  if (leftTotalRows !== rightTotalRows) {
    return rightTotalRows - leftTotalRows;
  }

  const leftVariantCount = parsePositiveInteger(left.variantCount) ?? 0;
  const rightVariantCount = parsePositiveInteger(right.variantCount) ?? 0;
  if (leftVariantCount !== rightVariantCount) {
    return rightVariantCount - leftVariantCount;
  }

  const leftCollection = String(left.collection ?? '');
  const rightCollection = String(right.collection ?? '');
  if (leftCollection !== rightCollection) {
    return leftCollection.localeCompare(rightCollection);
  }

  const leftNumber = parsePositiveInteger(left.number) ?? Number.MAX_SAFE_INTEGER;
  const rightNumber = parsePositiveInteger(right.number) ?? Number.MAX_SAFE_INTEGER;
  if (leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }

  return String(left.code ?? '').localeCompare(String(right.code ?? ''));
};

const main = async () => {
  const inputPath = toAbsolutePath(getArgValue('--input'), 'reports/song-conflicts.json');
  const outputPath = toAbsolutePath(getArgValue('--output'), 'reports/song-conflicts-review.csv');

  const headers = [
    'key',
    'collection',
    'code',
    'number',
    'totalRows',
    'variantCount',
    'recommendedKeepId',
    'recommendedDeleteIds',
    'rowIds',
    'titles',
    'lyricsHashes',
    'createdAtMin',
    'createdAtMax',
    'reviewAction',
    'reviewKeepId',
    'reviewDeleteIds',
    'reviewNotes',
  ];

  const raw = await readFile(inputPath, 'utf8');
  const report = JSON.parse(raw.replace(/^\uFEFF/u, ''));

  const conflicts = Array.isArray(report?.conflicts) ? report.conflicts : [];
  if (!conflicts.length) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${headers.join(',')}\n`, 'utf8');
    console.log(`No conflicts found in ${inputPath}.`);
    console.log(`Conflict review CSV written to ${outputPath}`);
    console.log('Rows exported: 0');
    return;
  }

  const rows = conflicts
    .map(toCsvRow)
    .sort(compareConflicts);

  const csvLines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ];

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${csvLines.join('\n')}\n`, 'utf8');

  console.log(`Conflict review CSV written to ${outputPath}`);
  console.log(`Rows exported: ${rows.length}`);
};

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

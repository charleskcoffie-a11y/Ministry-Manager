import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..');
const outputPath = path.resolve(repoRoot, 'public', 'wesley', 'diary.json');
const outputIndexPath = path.resolve(repoRoot, 'public', 'wesley', 'diary_index.json');
const outputTextsPath = path.resolve(repoRoot, 'public', 'wesley', 'diary_texts.json');

const JOURNAL_BASE_URL = 'https://ccel.org/ccel/wesley/journal/';
const JOURNAL_TOC_URL = new URL('journal.toc.html', JOURNAL_BASE_URL).toString();

const includeParentPages = process.argv.includes('--all');
const splitOnly = process.argv.includes('--split-only');

const DIARY_YEAR_REGEX = /\b(17\d{2})\b/u;
const DIARY_DAY_MONTH_REGEX = /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+([A-Z][a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\b/u;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const decodeHtmlEntities = (value) => {
  const namedEntities = {
    amp: '&',
    apos: "'",
    gt: '>',
    hellip: '…',
    ldquo: '“',
    lsquo: '‘',
    lt: '<',
    mdash: '—',
    nbsp: ' ',
    ndash: '–',
    quot: '"',
    rdquo: '”',
    rsquo: '’',
  };

  return value
    .replace(/&#x([0-9a-f]+);/giu, (_, hex) => {
      const codePoint = Number.parseInt(hex, 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _;
    })
    .replace(/&#(\d+);/gu, (_, dec) => {
      const codePoint = Number.parseInt(dec, 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _;
    })
    .replace(/&([a-z]+);/giu, (match, name) => namedEntities[name.toLowerCase()] ?? match);
};

const stripHtml = (value) =>
  value
    .replace(/<span class="mnote"[\s\S]*?<\/span>/giu, '')
    .replace(/<sup class="Note"[\s\S]*?<\/sup>/giu, '')
    .replace(/<script[\s\S]*?<\/script>/giu, '')
    .replace(/<style[\s\S]*?<\/style>/giu, '')
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|tr|blockquote|table|section)>/giu, '\n\n')
    .replace(/<li[^>]*>/giu, '- ')
    .replace(/<(td|th)[^>]*>/giu, ' ')
    .replace(/<[^>]+>/gu, '');

const normalizeWhitespace = (value) =>
  value
    .replace(/\u00A0/gu, ' ')
    .replace(/[ \t]+/gu, ' ')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();

const cleanDiaryText = (rawHtml) => {
  const start = rawHtml.indexOf('<div id="theText"');
  const end = rawHtml.indexOf('<div id="content-foot"');

  if (start < 0 || end <= start) {
    return '';
  }

  let content = rawHtml.slice(start, end);
  content = stripHtml(content);
  content = decodeHtmlEntities(content);
  content = content.replace(/^\s*«\s*Prev[\s\S]*?Next\s*»\s*/u, '');
  content = content.replace(/\n+\s*«\s*Prev[\s\S]*$/u, '');
  content = content.replace(/\n+\s*Please login[\s\S]*$/u, '');
  content = content.replace(/\n+\s*VIEWNAME is[\s\S]*$/u, '');
  content = content.replace(/Click here to close the reader/giu, '');
  content = content.replace(/^(\s*Contents\s*)+$/gimu, '');

  return normalizeWhitespace(content);
};

const cleanInlineText = (value) => normalizeWhitespace(decodeHtmlEntities(stripHtml(value)));

const extractSectionId = (rawHtml, fallback) => {
  const match = /id="book_section_id"[^>]*name="([^"]+)"/iu.exec(rawHtml);
  if (match?.[1]) {
    return match[1].trim();
  }
  return fallback;
};

const extractTitle = (rawHtml, fallback) => {
  const navTitleMatch = /<td class="book_navbar_title">([\s\S]*?)<\/td>/iu.exec(rawHtml);
  if (navTitleMatch?.[1]) {
    const title = cleanInlineText(navTitleMatch[1]);
    if (title) {
      return title;
    }
  }

  const headingMatch = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/iu.exec(rawHtml);
  if (headingMatch?.[1]) {
    const title = cleanInlineText(headingMatch[1]);
    if (title) {
      return title;
    }
  }

  return fallback;
};

const fetchHtml = async (url) => {
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Ministry-Manager Wesley Diary Builder',
      },
    });

    if (response.ok) {
      return response.text();
    }

    const isRetryable = response.status === 429 || response.status >= 500;
    if (!isRetryable || attempt === maxAttempts) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    const retryAfterRaw = response.headers.get('retry-after');
    const retryAfterSeconds = retryAfterRaw ? Number.parseInt(retryAfterRaw, 10) : NaN;
    const waitMs = Number.isFinite(retryAfterSeconds)
      ? Math.max(retryAfterSeconds, 1) * 1000
      : Math.min(20000, 1200 * attempt * attempt);

    console.warn(`Retryable HTTP ${response.status} for ${url}; retrying in ${waitMs}ms (attempt ${attempt}/${maxAttempts})...`);
    await wait(waitMs);
  }

  throw new Error(`Failed to fetch ${url}`);
};

const extractSlugsFromToc = (tocHtml) => {
  const seen = new Set();
  const slugs = [];

  for (const match of tocHtml.matchAll(/journal\.[a-z0-9.]+\.html/giu)) {
    const slug = match[0].toLowerCase();
    if (slug === 'journal.toc.html' || slug === 'journal.css') {
      continue;
    }
    if (seen.has(slug)) {
      continue;
    }
    seen.add(slug);
    slugs.push(slug);
  }

  return slugs;
};

const isLeafSlug = (slug, allSlugs) => {
  const prefix = slug.replace(/\.html$/iu, '.');
  return !allSlugs.some((other) => other !== slug && other.startsWith(prefix));
};

const isJournalSection = (section) => {
  const normalized = String(section ?? '').toLowerCase();
  return normalized.startsWith('vi.') || normalized.startsWith('vii.');
};

const getDiaryYearCandidate = (title, text) => {
  const probe = `${title}\n${text}`.slice(0, 240);
  const match = probe.match(DIARY_YEAR_REGEX);
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  if (!Number.isInteger(year) || year < 1700 || year > 1799) return null;
  return year;
};

const getDiaryDateLabel = (title, text, year) => {
  const probe = `${title}\n${text}`.slice(0, 240);
  const dayMonthMatch = probe.match(DIARY_DAY_MONTH_REGEX);

  if (dayMonthMatch) {
    const [, weekday, month, dayValue] = dayMonthMatch;
    const day = Number.parseInt(dayValue, 10);
    if (Number.isFinite(day)) {
      return year ? `${weekday}, ${month} ${day}, ${year}` : `${weekday}, ${month} ${day}`;
    }
  }

  return year ? String(year) : null;
};

const createDiaryExcerpt = (text) =>
  normalizeWhitespace(text)
    .replace(/\n+/gu, ' ')
    .slice(0, 220);

const writeDiaryArtifacts = async (entries) => {
  const diaryIndex = entries.map((entry) => ({
    id: entry.id,
    section: entry.section,
    title: entry.title,
    source: entry.source,
    year: entry.year ?? null,
    dateLabel: entry.dateLabel ?? null,
    excerpt: createDiaryExcerpt(entry.text),
  }));

  const diaryTexts = Object.fromEntries(entries.map((entry) => [entry.id, entry.text]));

  await Promise.all([
    writeFile(outputPath, `${JSON.stringify(entries, null, 2)}\n`, 'utf8'),
    writeFile(outputIndexPath, `${JSON.stringify(diaryIndex, null, 2)}\n`, 'utf8'),
    writeFile(outputTextsPath, `${JSON.stringify(diaryTexts, null, 2)}\n`, 'utf8'),
  ]);

  console.log(`Saved ${entries.length} diary entries to ${outputPath}`);
  console.log(`Saved diary index to ${outputIndexPath}`);
  console.log(`Saved diary text lookup to ${outputTextsPath}`);
};

const toDiaryEntry = (slug, rawHtml) => {
  const source = new URL(slug, JOURNAL_BASE_URL).toString();
  const id = slug.replace(/^journal\./iu, '').replace(/\.html$/iu, '');
  const section = extractSectionId(rawHtml, id);
  const title = extractTitle(rawHtml, section);
  const text = cleanDiaryText(rawHtml);

  return {
    id,
    section,
    title,
    source,
    text,
  };
};

const main = async () => {
  if (splitOnly) {
    const raw = await readFile(outputPath, 'utf8');
    const entries = JSON.parse(raw);

    if (!Array.isArray(entries) || !entries.length) {
      throw new Error('Existing public/wesley/diary.json is empty or invalid.');
    }

    await writeDiaryArtifacts(entries);
    return;
  }

  console.log(`Fetching Wesley journal TOC: ${JOURNAL_TOC_URL}`);
  const tocHtml = await fetchHtml(JOURNAL_TOC_URL);
  const allSlugs = extractSlugsFromToc(tocHtml);

  if (!allSlugs.length) {
    throw new Error('No Wesley diary links were found in the TOC page.');
  }

  const targetSlugs = includeParentPages ? allSlugs : allSlugs.filter((slug) => isLeafSlug(slug, allSlugs));
  console.log(`Found ${allSlugs.length} pages in TOC. Building ${targetSlugs.length} ${includeParentPages ? 'all' : 'leaf'} diary entries...`);

  const entries = [];
  const seen = new Set();
  const failedSlugs = [];
  let activeJournalYear = null;

  for (let i = 0; i < targetSlugs.length; i += 1) {
    const slug = targetSlugs[i];
    const url = new URL(slug, JOURNAL_BASE_URL).toString();

    try {
      const rawHtml = await fetchHtml(url);
      const entry = toDiaryEntry(slug, rawHtml);

      const yearCandidate = getDiaryYearCandidate(entry.title, entry.text);
      const journalSection = isJournalSection(entry.section);
      if (journalSection && yearCandidate !== null) {
        activeJournalYear = yearCandidate;
      }

      const year = journalSection ? (yearCandidate ?? activeJournalYear) : null;
      entry.year = year;
      entry.dateLabel = getDiaryDateLabel(entry.title, entry.text, year);

      if (!entry.text) {
        console.warn(`[${i + 1}/${targetSlugs.length}] ${slug} skipped (empty text).`);
        continue;
      }

      const dedupeKey = `${entry.title.toLowerCase()}|${entry.text.slice(0, 400).toLowerCase()}`;
      if (seen.has(dedupeKey)) {
        console.warn(`[${i + 1}/${targetSlugs.length}] ${slug} skipped (duplicate content).`);
        continue;
      }

      seen.add(dedupeKey);
      entries.push(entry);
      console.log(`[${i + 1}/${targetSlugs.length}] ${slug} -> ${entry.title}`);
    } catch (error) {
      failedSlugs.push(slug);
      console.warn(`[${i + 1}/${targetSlugs.length}] ${slug} failed: ${error instanceof Error ? error.message : error}`);
    }

    await wait(180);
  }

  if (!entries.length) {
    throw new Error('No Wesley diary entries were produced.');
  }

  await writeDiaryArtifacts(entries);

  if (failedSlugs.length) {
    console.warn(`Skipped ${failedSlugs.length} page(s) due fetch failures.`);
    console.warn(`Failed slugs: ${failedSlugs.join(', ')}`);
  }
};

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
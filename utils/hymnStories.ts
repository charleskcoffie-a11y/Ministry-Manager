import { Song } from '../types';

export interface WesleyStorySongReference {
  collection: string;
  code?: string;
  number?: number;
}

export interface WesleyHymnStoryRecord {
  id: string;
  title: string;
  writer: string;
  firstPublished: string;
  hymnalHint: string;
  story: string;
  methodistConnection: string;
  themes: string[];
  source: string;
  mhbNumbers: number[];
  alternateTitles: string[];
  songRefs: WesleyStorySongReference[];
}

const normalizeText = (value: unknown) => String(value ?? '').trim();
const normalizeCollection = (value: unknown) => normalizeText(value).toUpperCase();
const normalizeSongCode = (value: unknown) => normalizeText(value).toUpperCase();

export const normalizeHymnTitle = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeSongReferences = (value: unknown): WesleyStorySongReference[] => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;

      const rawReference = item as Partial<WesleyStorySongReference>;
      const collection = normalizeCollection(rawReference.collection);
      if (!collection) return null;

      const parsedNumber = Number.parseInt(String(rawReference.number ?? ''), 10);
      const number = Number.isInteger(parsedNumber) && parsedNumber > 0 ? parsedNumber : undefined;
      const code = normalizeSongCode(rawReference.code);

      if (!code && number === undefined) return null;

      const dedupeKey = `${collection}|${code}|${number ?? ''}`;
      if (seen.has(dedupeKey)) return null;
      seen.add(dedupeKey);

      return {
        collection,
        ...(code ? { code } : {}),
        ...(number !== undefined ? { number } : {}),
      };
    })
    .filter((item): item is WesleyStorySongReference => Boolean(item));
};

export const normalizeHymnStories = (value: unknown): WesleyHymnStoryRecord[] => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  return (value as WesleyHymnStoryRecord[])
    .map((item, index) => {
      const id = normalizeText(item.id || `hymn-story-${index + 1}`) || `hymn-story-${index + 1}`;
      const title = normalizeText(item.title);
      const writer = normalizeText(item.writer);
      const firstPublished = normalizeText(item.firstPublished);
      const hymnalHint = normalizeText(item.hymnalHint);
      const story = normalizeText(item.story);
      const methodistConnection = normalizeText(item.methodistConnection);
      const source = normalizeText(item.source);
      const themes = Array.isArray(item.themes)
        ? item.themes.map((theme) => normalizeText(theme)).filter(Boolean)
        : [];
      const mhbNumbers = Array.isArray(item.mhbNumbers)
        ? item.mhbNumbers
            .map((number) => Number.parseInt(String(number), 10))
            .filter((number) => Number.isInteger(number) && number > 0)
        : [];
      const alternateTitles = Array.isArray(item.alternateTitles)
        ? item.alternateTitles.map((title) => normalizeText(title)).filter(Boolean)
        : [];
      const songRefs = normalizeSongReferences((item as Partial<WesleyHymnStoryRecord>).songRefs);

      return {
        id,
        title,
        writer,
        firstPublished,
        hymnalHint,
        story,
        methodistConnection,
        themes,
        source,
        mhbNumbers,
        alternateTitles,
        songRefs,
      };
    })
    .filter((entry) => {
      if (!entry.title || !entry.story || !entry.writer) return false;
      const key = `${entry.id}|${entry.title}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const isMethodistHymnalCollection = (collection: string | undefined) => {
  const normalized = normalizeCollection(collection);
  return normalized === 'MHB' || normalized === 'HYMNS' || normalized === 'GENERAL';
};

const songMatchesReference = (
  song: Pick<Song, 'number' | 'collection' | 'code'>,
  reference: WesleyStorySongReference
) => {
  const songCollection = normalizeCollection(song.collection);
  if (!songCollection || songCollection !== reference.collection) return false;

  const songCode = normalizeSongCode(song.code);
  if (reference.code && songCode && reference.code === songCode) {
    return true;
  }

  if (reference.number !== undefined && Number.isInteger(song.number) && reference.number === song.number) {
    return true;
  }

  return false;
};

export const findHymnStoryForSong = (
  song: Pick<Song, 'title' | 'number' | 'collection' | 'code'> | null | undefined,
  stories: WesleyHymnStoryRecord[]
) => {
  if (!song) return null;

  const normalizedSongTitle = normalizeHymnTitle(song.title ?? '');
  if (!normalizedSongTitle) return null;

  const songNumber = Number.isInteger(song.number) ? song.number : null;
  const inMethodistCollection = isMethodistHymnalCollection(song.collection);

  let titleMatch: WesleyHymnStoryRecord | null = null;

  for (const story of stories) {
    if (story.songRefs.some((reference) => songMatchesReference(song, reference))) {
      return story;
    }

    if (inMethodistCollection && songNumber !== null && story.mhbNumbers.includes(songNumber)) {
      return story;
    }

    const candidates = [story.title, ...story.alternateTitles].map(normalizeHymnTitle).filter(Boolean);
    if (candidates.includes(normalizedSongTitle)) {
      titleMatch = story;
      break;
    }

    if (candidates.some((candidate) => candidate.length > 12 && (candidate.includes(normalizedSongTitle) || normalizedSongTitle.includes(candidate)))) {
      titleMatch = story;
    }
  }

  return titleMatch;
};

const formatSongReferenceLabel = (reference: WesleyStorySongReference) => {
  if (reference.collection === 'MHB' && reference.number !== undefined) {
    return `MHB ${reference.number}`;
  }

  if (reference.code) {
    return reference.code;
  }

  if (reference.number !== undefined) {
    return `${reference.collection} ${reference.number}`;
  }

  return reference.collection;
};

export const getStoryReferenceLabels = (
  story: WesleyHymnStoryRecord,
  preferredCollection?: string | null
) => {
  const normalizedPreferredCollection = normalizeCollection(preferredCollection);
  const labels: string[] = [];

  if (!normalizedPreferredCollection || normalizedPreferredCollection === 'MHB') {
    labels.push(...story.mhbNumbers.map((number) => `MHB ${number}`));
  }

  const scopedReferences = normalizedPreferredCollection
    ? story.songRefs.filter((reference) => reference.collection === normalizedPreferredCollection)
    : story.songRefs;

  const referencesToRender = scopedReferences.length ? scopedReferences : story.songRefs;
  labels.push(...referencesToRender.map((reference) => formatSongReferenceLabel(reference)));

  return Array.from(new Set(labels)).filter(Boolean);
};

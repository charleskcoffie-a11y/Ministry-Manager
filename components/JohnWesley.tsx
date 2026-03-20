import React, { useEffect, useMemo, useState } from 'react';
import {
  BookHeart,
  BookMarked,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Church,
  Loader2,
  Music,
  Quote,
  Scroll,
  Search,
} from 'lucide-react';
import localWesleyQuotes from '../public/wesley/quotes.json';
import localWesleyHymnStories from '../public/wesley/hymn_stories.json';
import localWesleyCanticleStories from '../public/wesley/canticle_stories.json';
import { WesleyHymnStoryRecord, getStoryReferenceLabels, normalizeHymnStories } from '../utils/hymnStories';

interface WesleySermonRecord {
  number: number;
  title: string;
  scripture: string;
  source: string;
  text: string;
}

interface WesleyQuoteRecord {
  quote: string;
  source: string;
  theme: string;
}

interface WesleyDiaryRecord {
  id: string;
  section: string;
  title: string;
  source: string;
  text: string;
  excerpt?: string;
  year: number | null;
  dateLabel: string | null;
}

const EXPECTED_WESLEY_SERMON_COUNT = 44;

const THEME_COLORS: Record<string, string> = {
  Discipleship: 'bg-stone-100 text-stone-700',
  Faith: 'bg-amber-100 text-amber-700',
  Holiness: 'bg-purple-100 text-purple-700',
  Love: 'bg-rose-100 text-rose-700',
  Mission: 'bg-blue-100 text-blue-700',
  Stewardship: 'bg-green-100 text-green-700',
  Zeal: 'bg-orange-100 text-orange-700',
};

const themeClass = (theme: string) => THEME_COLORS[theme] || 'bg-gray-100 text-gray-600';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const getLocalDayNumber = (date: Date = new Date()) =>
  Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / DAY_IN_MS);
const getDailyQuoteIndex = (total: number, date: Date = new Date()) => {
  if (!total) return 0;
  const dayNumber = getLocalDayNumber(date);
  return ((dayNumber % total) + total) % total;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeWhitespace = (value: string) => value.replace(/\s+/gu, ' ').trim();

const normalizeSermonText = (sermon: WesleySermonRecord) => {
  let text = sermon.text;
  text = text.replace(/^\s*« Prev[\s\S]*?Next »\s*/u, '');
  text = text.replace(/\n+\s*« Prev[\s\S]*$/u, '');
  text = text.replace(/\n+\s*Please login[\s\S]*$/u, '');
  text = text.replace(/\n+\s*VIEWNAME is[\s\S]*$/u, '');
  text = text.replace(new RegExp(`^\\s*Sermon\\s+${sermon.number}\\s*`, 'i'), '');
  text = text.replace(new RegExp(`^\\s*${escapeRegExp(sermon.title)}\\s*`, 'i'), '');
  text = text.replace(new RegExp(`^\\s*${escapeRegExp(sermon.scripture)}\\.?\\s*`, 'i'), '');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
};

const normalizeDiaryText = (entry: Pick<WesleyDiaryRecord, 'text'>) => {
  let text = entry.text;
  text = text.replace(/^\s*« Prev[\s\S]*?Next »\s*/u, '');
  text = text.replace(/\n+\s*« Prev[\s\S]*$/u, '');
  text = text.replace(/\n+\s*Please login[\s\S]*$/u, '');
  text = text.replace(/\n+\s*VIEWNAME is[\s\S]*$/u, '');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
};

const DIARY_YEAR_REGEX = /\b(17\d{2})\b/u;
const DIARY_DAY_MONTH_REGEX = /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+([A-Z][a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\b/u;

const isJournalSection = (section: string) => {
  const normalized = section.toLowerCase();
  return normalized.startsWith('vi.') || normalized.startsWith('vii.');
};

const getDiaryYearCandidate = (title: string, text: string) => {
  const probe = `${title}\n${text}`.slice(0, 240);
  const match = probe.match(DIARY_YEAR_REGEX);
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  if (!Number.isInteger(year) || year < 1700 || year > 1799) return null;
  return year;
};

const getDiaryDateLabel = (title: string, text: string, year: number | null) => {
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

const normalizeSermonEntries = (value: unknown): WesleySermonRecord[] => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<number>();
  return (value as WesleySermonRecord[])
    .map((item) => {
      const number = Number.parseInt(String(item.number ?? ''), 10);
      const title = String(item.title ?? '').trim();
      const scripture = String(item.scripture ?? '').trim();
      const source = String(item.source ?? '').trim();
      const rawText = String(item.text ?? '').trim();

      if (!Number.isInteger(number) || !title || !scripture || !source || !rawText) {
        return null;
      }

      const normalizedSermon = {
        number,
        title,
        scripture,
        source,
        text: rawText,
      } satisfies WesleySermonRecord;

      return {
        ...normalizedSermon,
        text: normalizeSermonText(normalizedSermon),
      };
    })
    .filter((sermon): sermon is WesleySermonRecord => {
      if (!sermon) return false;
      if (seen.has(sermon.number)) return false;
      seen.add(sermon.number);
      return true;
    })
    .sort((left, right) => left.number - right.number);
};

const BUNDLED_WESLEY_QUOTES = (() => {
  if (!Array.isArray(localWesleyQuotes)) return [];

  const seen = new Set<string>();
  return (localWesleyQuotes as WesleyQuoteRecord[])
    .map(item => ({
      quote: String(item.quote ?? '').trim(),
      source: String(item.source ?? '').trim(),
      theme: String(item.theme ?? '').trim() || 'Faith',
    }))
    .filter(item => {
      if (!item.quote || !item.source) return false;
      const key = `${item.quote}|${item.source}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
})();

const normalizeDiaryEntries = (value: unknown): WesleyDiaryRecord[] => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const normalized = (value as WesleyDiaryRecord[])
    .map((item, index) => {
      const id = String(item.id ?? item.section ?? `entry-${index + 1}`).trim() || `entry-${index + 1}`;
      const section = String(item.section ?? '').trim();
      const title = String(item.title ?? '').trim();
      const source = String(item.source ?? '').trim();
      const text = normalizeDiaryText({
        id,
        section,
        title,
        source,
        text: String(item.text ?? '').trim(),
      });

      return {
        id,
        section,
        title,
        source,
        text,
      };
    })
    .filter((entry) => {
      if (!entry.title || !entry.text || !entry.source) return false;
      const key = `${entry.id}|${entry.title}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  let activeJournalYear: number | null = null;

  return normalized.map((entry) => {
    const yearCandidate = getDiaryYearCandidate(entry.title, entry.text);
    const journalSection = isJournalSection(entry.section);

    if (journalSection && yearCandidate !== null) {
      activeJournalYear = yearCandidate;
    }

    const year = journalSection ? (yearCandidate ?? activeJournalYear) : null;

    return {
      ...entry,
      year,
      dateLabel: getDiaryDateLabel(entry.title, entry.text, year),
    };
  });
};

const normalizeDiaryIndexEntries = (value: unknown): WesleyDiaryRecord[] => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  return (value as Array<Record<string, unknown>>)
    .map((item, index) => {
      const id = String(item.id ?? item.section ?? `entry-${index + 1}`).trim() || `entry-${index + 1}`;
      const section = String(item.section ?? '').trim();
      const title = String(item.title ?? '').trim();
      const source = String(item.source ?? '').trim();
      const excerpt = normalizeWhitespace(String(item.excerpt ?? ''));
      const year = typeof item.year === 'number' ? item.year : null;
      const dateLabel = typeof item.dateLabel === 'string' && item.dateLabel.trim() ? item.dateLabel.trim() : null;

      return {
        id,
        section,
        title,
        source,
        text: '',
        excerpt,
        year,
        dateLabel,
      } satisfies WesleyDiaryRecord;
    })
    .filter((entry) => {
      if (!entry.title || !entry.source) return false;
      const key = `${entry.id}|${entry.title}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const EXPECTED_WESLEY_QUOTE_COUNT = BUNDLED_WESLEY_QUOTES.length;

const getWesleyJsonUrls = (fileName: string) => {
  const viteBaseUrl = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  return [`${viteBaseUrl}wesley/${fileName}`, `/wesley/${fileName}`];
};

const loadBundledSermons = async () => {
  try {
    const module = await import('../public/wesley/sermons.json');
    const normalized = normalizeSermonEntries(module.default ?? module);
    if (normalized.length) {
      return normalized;
    }
  } catch {
    // Fall through to fetch fallback below.
  }

  for (const url of getWesleyJsonUrls('sermons.json')) {
    const response = await fetch(url);
    if (!response.ok) {
      continue;
    }

    const payload = await response.json();
    const normalized = normalizeSermonEntries(payload);
    if (normalized.length) {
      return normalized;
    }
  }

  return [];
};

const loadBundledDiaryEntries = async () => {
  for (const url of getWesleyJsonUrls('diary_index.json')) {
    const response = await fetch(url);
    if (!response.ok) {
      continue;
    }

    const payload = await response.json();
    const normalized = normalizeDiaryIndexEntries(payload);
    if (normalized.length) {
      return normalized;
    }
  }

  return [];
};

const loadBundledDiaryTexts = async () => {
  for (const url of getWesleyJsonUrls('diary_texts.json')) {
    const response = await fetch(url);
    if (!response.ok) {
      continue;
    }

    const payload = await response.json();
    if (payload && typeof payload === 'object') {
      return payload as Record<string, string>;
    }
  }

  return {};
};

const BUNDLED_WESLEY_HYMN_STORIES = normalizeHymnStories([
  ...(Array.isArray(localWesleyHymnStories) ? localWesleyHymnStories : []),
  ...(Array.isArray(localWesleyCanticleStories) ? localWesleyCanticleStories : []),
]);
const EXPECTED_WESLEY_HYMN_STORY_COUNT = BUNDLED_WESLEY_HYMN_STORIES.length;

const JohnWesley: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sermons' | 'quotes' | 'diary' | 'hymnStories'>('sermons');
  const [sermons, setSermons] = useState<WesleySermonRecord[]>([]);
  const [sermonsLoading, setSermonsLoading] = useState(false);
  const [sermonsError, setSermonsError] = useState('');
  const [sermonsLoaded, setSermonsLoaded] = useState(false);
  const [sermonQuery, setSermonQuery] = useState('');
  const [selectedSermonNumber, setSelectedSermonNumber] = useState<number | null>(null);

  const [quotes] = useState<WesleyQuoteRecord[]>(BUNDLED_WESLEY_QUOTES);
  const [quoteQuery, setQuoteQuery] = useState('');
  const [quoteIdx, setQuoteIdx] = useState(() => getDailyQuoteIndex(BUNDLED_WESLEY_QUOTES.length));

  const [diaryEntries, setDiaryEntries] = useState<WesleyDiaryRecord[]>([]);
  const [diaryLoading, setDiaryLoading] = useState(false);
  const [diaryTextsLoading, setDiaryTextsLoading] = useState(false);
  const [diaryTextsLoaded, setDiaryTextsLoaded] = useState(false);
  const [diaryError, setDiaryError] = useState('');
  const [diaryLoaded, setDiaryLoaded] = useState(false);
  const [diaryQuery, setDiaryQuery] = useState('');
  const [diaryYearFilter, setDiaryYearFilter] = useState<string>('all');
  const [selectedDiaryId, setSelectedDiaryId] = useState<string | null>(null);

  const [hymnStories] = useState<WesleyHymnStoryRecord[]>(BUNDLED_WESLEY_HYMN_STORIES);
  const [hymnStoryQuery, setHymnStoryQuery] = useState('');
  const [selectedHymnStoryId, setSelectedHymnStoryId] = useState<string | null>(BUNDLED_WESLEY_HYMN_STORIES[0]?.id ?? null);

  const [sermonsPanelOpen, setSermonsPanelOpen] = useState(true);
  const [diaryPanelOpen, setDiaryPanelOpen] = useState(true);

  const filteredSermons = useMemo(() => {
    const query = sermonQuery.trim().toLowerCase();
    if (!query) return sermons;
    return sermons.filter(sermon =>
      sermon.title.toLowerCase().includes(query) ||
      sermon.scripture.toLowerCase().includes(query) ||
      sermon.text.toLowerCase().includes(query)
    );
  }, [sermonQuery, sermons]);

  const selectedSermon = useMemo(() => {
    if (!selectedSermonNumber) return filteredSermons[0] ?? sermons[0] ?? null;
    return sermons.find(sermon => sermon.number === selectedSermonNumber) ?? filteredSermons[0] ?? sermons[0] ?? null;
  }, [filteredSermons, selectedSermonNumber, sermons]);

  useEffect(() => {
    if (!filteredSermons.length) return;
    if (!selectedSermon || !filteredSermons.some(sermon => sermon.number === selectedSermon.number)) {
      setSelectedSermonNumber(filteredSermons[0].number);
    }
  }, [filteredSermons, selectedSermon]);

  const filteredQuotes = useMemo(() => {
    const query = quoteQuery.trim().toLowerCase();
    if (!query) return quotes;
    return quotes.filter(quote =>
      quote.quote.toLowerCase().includes(query) ||
      quote.source.toLowerCase().includes(query) ||
      quote.theme.toLowerCase().includes(query)
    );
  }, [quoteQuery, quotes]);

  const quoteOfTheDay = useMemo(() => {
    if (!quotes.length) return null;
    return quotes[getDailyQuoteIndex(quotes.length)] ?? null;
  }, [quotes]);

  const quoteOfTheDayDate = useMemo(
    () => new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    []
  );

  useEffect(() => {
    if (quoteIdx >= filteredQuotes.length) {
      setQuoteIdx(0);
    }
  }, [filteredQuotes.length, quoteIdx]);

  const activeQuote = filteredQuotes[quoteIdx] ?? null;

  useEffect(() => {
    if (activeTab !== 'sermons' || sermonsLoaded) return;

    let cancelled = false;

    const loadSermons = async () => {
      setSermonsLoading(true);
      setSermonsError('');

      try {
        const loadedSermons = await loadBundledSermons();
        if (!loadedSermons.length) {
          throw new Error('Could not load bundled John Wesley sermons.');
        }

        if (cancelled) return;

        setSermons(loadedSermons);
        setSelectedSermonNumber((current) => current ?? loadedSermons[0].number);
        setSermonsLoaded(true);
      } catch (error) {
        if (cancelled) return;
        setSermonsError(error instanceof Error ? error.message : 'Could not load John Wesley sermons.');
      } finally {
        if (!cancelled) {
          setSermonsLoading(false);
        }
      }
    };

    loadSermons();

    return () => {
      cancelled = true;
    };
  }, [activeTab, sermonsLoaded]);

  useEffect(() => {
    if (activeTab !== 'diary' || diaryLoaded) return;

    let cancelled = false;

    const loadDiaryEntries = async () => {
      setDiaryLoading(true);
      setDiaryError('');

      try {
        let normalizedEntries = await loadBundledDiaryEntries();

        if (!normalizedEntries.length) {
          const diaryUrls = getWesleyJsonUrls('diary_index.json');
          let payload: unknown = null;

          for (const url of diaryUrls) {
            const response = await fetch(url);
            if (!response.ok) {
              continue;
            }

            payload = await response.json();
            break;
          }

          if (!payload) {
            throw new Error('Could not load bundled Wesley diary entries.');
          }

          normalizedEntries = normalizeDiaryIndexEntries(payload);
        }

        if (!normalizedEntries.length) {
          throw new Error('The bundled Wesley diary corpus is empty or invalid.');
        }

        if (cancelled) return;

        setDiaryEntries(normalizedEntries);
        setSelectedDiaryId((current) => current ?? normalizedEntries[0].id);
        setDiaryLoaded(true);
      } catch (error) {
        if (cancelled) return;
        setDiaryError(error instanceof Error ? error.message : 'Could not load Wesley diary entries.');
      } finally {
        if (!cancelled) {
          setDiaryLoading(false);
        }
      }
    };

    loadDiaryEntries();

    return () => {
      cancelled = true;
    };
  }, [activeTab, diaryLoaded]);

  useEffect(() => {
    if (activeTab !== 'diary' || !diaryLoaded || diaryTextsLoaded) return;

    let cancelled = false;

    const hydrateDiaryTexts = async () => {
      setDiaryTextsLoading(true);

      try {
        const diaryTextMap = await loadBundledDiaryTexts();
        if (cancelled) return;

        if (Object.keys(diaryTextMap).length) {
          setDiaryEntries((current) => current.map((entry) => ({
            ...entry,
            text: typeof diaryTextMap[entry.id] === 'string' ? diaryTextMap[entry.id] : entry.text,
          })));
        }

        setDiaryTextsLoaded(true);
      } finally {
        if (!cancelled) {
          setDiaryTextsLoading(false);
        }
      }
    };

    hydrateDiaryTexts();

    return () => {
      cancelled = true;
    };
  }, [activeTab, diaryLoaded, diaryTextsLoaded]);

  const availableDiaryYears = useMemo(() => {
    const years = new Set<number>();
    for (const entry of diaryEntries) {
      if (entry.year !== null) {
        years.add(entry.year);
      }
    }

    return Array.from(years).sort((a, b) => a - b);
  }, [diaryEntries]);

  const filteredDiaryEntries = useMemo(() => {
    const selectedYear = diaryYearFilter === 'all' ? null : Number.parseInt(diaryYearFilter, 10);
    const query = diaryQuery.trim().toLowerCase();
    if (!query && selectedYear === null) return diaryEntries;

    return diaryEntries.filter((entry) =>
      (selectedYear === null || entry.year === selectedYear) &&
      (
        !query ||
        entry.title.toLowerCase().includes(query) ||
        entry.section.toLowerCase().includes(query) ||
        entry.text.toLowerCase().includes(query) ||
        (entry.excerpt ?? '').toLowerCase().includes(query)
      )
    );
  }, [diaryEntries, diaryQuery, diaryYearFilter]);

  useEffect(() => {
    if (diaryYearFilter === 'all') return;
    if (!availableDiaryYears.some((year) => String(year) === diaryYearFilter)) {
      setDiaryYearFilter('all');
    }
  }, [availableDiaryYears, diaryYearFilter]);

  const selectedDiaryEntry = useMemo(() => {
    if (!selectedDiaryId) return filteredDiaryEntries[0] ?? diaryEntries[0] ?? null;
    return diaryEntries.find((entry) => entry.id === selectedDiaryId) ?? filteredDiaryEntries[0] ?? diaryEntries[0] ?? null;
  }, [diaryEntries, filteredDiaryEntries, selectedDiaryId]);

  useEffect(() => {
    if (!filteredDiaryEntries.length) return;
    if (!selectedDiaryEntry || !filteredDiaryEntries.some((entry) => entry.id === selectedDiaryEntry.id)) {
      setSelectedDiaryId(filteredDiaryEntries[0].id);
    }
  }, [filteredDiaryEntries, selectedDiaryEntry]);

  const filteredHymnStories = useMemo(() => {
    const query = hymnStoryQuery.trim().toLowerCase();
    if (!query) return hymnStories;

    return hymnStories.filter((story) =>
      story.title.toLowerCase().includes(query) ||
      story.writer.toLowerCase().includes(query) ||
      story.alternateTitles.some((title) => title.toLowerCase().includes(query)) ||
      story.mhbNumbers.some((number) => String(number).includes(query)) ||
      story.songRefs.some((reference) =>
        reference.collection.toLowerCase().includes(query) ||
        (reference.code ?? '').toLowerCase().includes(query) ||
        (reference.number !== undefined && String(reference.number).includes(query))
      ) ||
      story.story.toLowerCase().includes(query) ||
      story.methodistConnection.toLowerCase().includes(query) ||
      story.themes.some((theme) => theme.toLowerCase().includes(query))
    );
  }, [hymnStories, hymnStoryQuery]);

  const selectedHymnStory = useMemo(() => {
    if (!selectedHymnStoryId) return filteredHymnStories[0] ?? hymnStories[0] ?? null;
    return hymnStories.find((entry) => entry.id === selectedHymnStoryId) ?? filteredHymnStories[0] ?? hymnStories[0] ?? null;
  }, [filteredHymnStories, hymnStories, selectedHymnStoryId]);

  const selectedHymnStoryReferenceLabels = useMemo(
    () => (selectedHymnStory ? getStoryReferenceLabels(selectedHymnStory) : []),
    [selectedHymnStory]
  );

  useEffect(() => {
    if (!filteredHymnStories.length) return;
    if (!selectedHymnStory || !filteredHymnStories.some((entry) => entry.id === selectedHymnStory.id)) {
      setSelectedHymnStoryId(filteredHymnStories[0].id);
    }
  }, [filteredHymnStories, selectedHymnStory]);

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #1a0a05 0%, #2d1208 50%, #3d1a0a 100%)' }}>
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #3d1a0a 0%, #6b2f10 50%, #8b3d14 100%)' }}>
        <div
          className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 50%)', backgroundSize: '20px 20px' }}
        />
        <div className="relative max-w-5xl mx-auto px-6 py-10 flex items-center gap-6">
          <div className="w-20 h-20 rounded-full border-4 border-amber-400/40 bg-amber-400/10 flex items-center justify-center shrink-0 shadow-2xl">
            <Church className="w-10 h-10 text-amber-300" />
          </div>
          <div>
            <p className="text-amber-400/70 text-xs font-semibold tracking-widest uppercase mb-1">Methodist Heritage</p>
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-amber-100 mb-1">John Wesley</h1>
            <p className="text-amber-200/60 text-sm font-serif italic">1703 - 1791 · Founder of Methodism · Servant of God</p>
          </div>
        </div>
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, transparent, #b8860b, #ffd700, #b8860b, transparent)' }} />
      </div>

      <div className="max-w-5xl mx-auto px-4 mt-6">
        <div className="flex gap-2 bg-black/20 rounded-2xl p-1.5 backdrop-blur-sm border border-amber-800/30">
          <button
            onClick={() => setActiveTab('sermons')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'sermons' ? 'bg-amber-700 text-amber-50 shadow-lg' : 'text-amber-300/70 hover:text-amber-200'}`}
          >
            <Scroll className="w-4 h-4" /> The 44 Sermons
          </button>
          <button
            onClick={() => setActiveTab('quotes')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'quotes' ? 'bg-amber-700 text-amber-50 shadow-lg' : 'text-amber-300/70 hover:text-amber-200'}`}
          >
            <Quote className="w-4 h-4" /> Wesley Quotes
          </button>
          <button
            onClick={() => setActiveTab('diary')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'diary' ? 'bg-amber-700 text-amber-50 shadow-lg' : 'text-amber-300/70 hover:text-amber-200'}`}
          >
            <BookHeart className="w-4 h-4" /> Wesley Diary
          </button>
          <button
            onClick={() => setActiveTab('hymnStories')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'hymnStories' ? 'bg-amber-700 text-amber-50 shadow-lg' : 'text-amber-300/70 hover:text-amber-200'}`}
          >
            <Music className="w-4 h-4" /> Hymn Stories
          </button>
        </div>
      </div>

      {activeTab === 'sermons' && (
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500/50" />
            <input
              type="text"
              value={sermonQuery}
              onChange={event => setSermonQuery(event.target.value)}
              placeholder="Search sermon title, scripture, or full text..."
              className="w-full rounded-2xl border border-amber-800/30 bg-black/20 pl-11 pr-4 py-3 text-sm text-amber-50 placeholder:text-amber-400/40 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className={`${sermonsPanelOpen ? 'md:w-80 shrink-0' : 'hidden'} transition-all duration-300`}>
              <div className="flex items-center justify-between px-1 mb-3">
                <p className="text-amber-400/60 text-xs font-semibold uppercase tracking-wider">Sermon Library</p>
                <div className="flex items-center gap-2">
                  <span className="text-amber-600/50 text-xs">{filteredSermons.length} found</span>
                  <button
                    onClick={() => setSermonsPanelOpen(!sermonsPanelOpen)}
                    className="p-1.5 hover:bg-amber-700/40 rounded-lg transition-colors text-amber-400"
                    title={sermonsPanelOpen ? 'Collapse' : 'Expand'}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#b8860b transparent' }}>
                {sermonsLoading && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 className="w-7 h-7 animate-spin text-amber-500" />
                    <p className="text-amber-300/60 text-sm font-serif italic">Loading Wesley sermons...</p>
                  </div>
                )}

                {!sermonsLoading && filteredSermons.map(sermon => (
                  <button
                    key={sermon.number}
                    onClick={() => setSelectedSermonNumber(sermon.number)}
                    className={`w-full text-left px-3 py-3 rounded-xl transition-all border group ${
                      selectedSermon?.number === sermon.number
                        ? 'bg-amber-700/80 border-amber-500/60 text-amber-50'
                        : 'border-transparent text-amber-200/70 hover:bg-amber-900/40 hover:border-amber-700/40 hover:text-amber-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono w-6 shrink-0 ${selectedSermon?.number === sermon.number ? 'text-amber-300' : 'text-amber-600/50'}`}>
                        {String(sermon.number).padStart(2, '0')}
                      </span>
                      <span className="text-sm md:text-[15px] font-semibold leading-snug line-clamp-2">{sermon.title}</span>
                      {selectedSermon?.number === sermon.number && <ChevronRight className="w-3 h-3 ml-auto shrink-0 text-amber-300" />}
                    </div>
                    <p className="text-[13px] text-amber-600/60 mt-1 ml-8 line-clamp-1">{sermon.scripture}</p>
                  </button>
                ))}

                {!sermonsLoading && !filteredSermons.length && (
                  <div className="rounded-2xl border border-amber-800/30 bg-black/20 p-5 text-center">
                    <p className="text-amber-300/60 text-sm font-serif italic">No sermons match that search.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              {sermonsError && (
                <div className="bg-red-900/30 border border-red-700/40 rounded-2xl p-6 text-red-300 text-sm">
                  {sermonsError}
                </div>
              )}

              {!sermonsError && !sermonsLoading && !selectedSermon && (
                <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
                  <div className="w-20 h-20 rounded-full bg-amber-900/30 border border-amber-700/30 flex items-center justify-center">
                    <BookMarked className="w-9 h-9 text-amber-600/50" />
                  </div>
                  <div>
                    <p className="text-amber-300/60 font-serif text-sm italic">Select a sermon from the list</p>
                    <p className="text-amber-500/40 text-xs mt-1">Search works across title, scripture, and full text</p>
                  </div>
                </div>
              )}

              {!sermonsError && selectedSermon && (
                <div className="space-y-4">
                  <div className="rounded-2xl overflow-hidden border border-amber-700/30" style={{ background: 'linear-gradient(135deg, #3d1a0a, #5c2a12)' }}>
                    <div className="px-6 py-5">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-amber-500/70 text-xs font-semibold uppercase tracking-wider">Sermon {selectedSermon.number}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-300/10 text-amber-200 border border-amber-300/20">
                          Original text · Wesley corpus
                        </span>
                      </div>
                      <h2 className="text-xl font-serif font-bold text-amber-100 leading-tight mb-2">{selectedSermon.title}</h2>
                      <div className="flex items-center gap-2 text-amber-400/80 text-sm font-medium">
                        <BookOpen className="w-3.5 h-3.5 text-amber-500/60" />
                        <span>{selectedSermon.scripture}</span>
                      </div>
                      <p className="text-amber-500/50 text-xs mt-3">Loaded from the bundled CCEL public-domain corpus.</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-800/30 bg-[#f6edd8] text-stone-800 shadow-2xl overflow-hidden">
                    <div className="border-b border-amber-200/70 px-6 py-3 bg-amber-50/90 flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.24em] text-amber-700/80 font-semibold">Original Sermon Text</p>
                      <a
                        href={selectedSermon.source}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-amber-700 hover:text-amber-900 underline underline-offset-2"
                      >
                        View source
                      </a>
                    </div>
                    <div
                      className="px-6 py-6 max-h-[72vh] overflow-y-auto font-serif text-[15px] leading-8 whitespace-pre-wrap"
                      style={{ backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, rgba(180,130,40,0.18) 31px, rgba(180,130,40,0.18) 32px)', backgroundPositionY: '18px' }}
                    >
                      {selectedSermon.text}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'quotes' && (
        <div className="max-w-3xl mx-auto px-4 py-10 space-y-5">
          {quoteOfTheDay && (
            <div className="relative rounded-2xl overflow-hidden border border-amber-700/30 shadow-2xl" style={{ background: 'linear-gradient(135deg, #3d1a0a, #5c2a12)' }}>
              <div className="absolute top-4 left-4 opacity-20">
                <Quote className="w-16 h-16 text-amber-400" />
              </div>
              <div className="px-8 py-8 relative">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-300/10 text-amber-200 border border-amber-300/20">
                    Quote of the Day
                  </span>
                  <span className="text-amber-500/70 text-xs">{quoteOfTheDayDate}</span>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold mb-4 ${themeClass(quoteOfTheDay.theme)}`}>
                  {quoteOfTheDay.theme}
                </span>
                <p className="font-serif text-lg md:text-xl text-amber-100 leading-relaxed mb-5 italic">
                  "{quoteOfTheDay.quote}"
                </p>
                <p className="text-amber-400/70 text-sm font-medium">- John Wesley</p>
                <p className="text-amber-600/50 text-xs mt-0.5">{quoteOfTheDay.source}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500/50" />
              <input
                type="text"
                value={quoteQuery}
                onChange={event => setQuoteQuery(event.target.value)}
                placeholder="Search quotes by words, source, or theme..."
                className="w-full rounded-2xl border border-amber-800/30 bg-black/20 pl-11 pr-4 py-3 text-sm text-amber-50 placeholder:text-amber-400/40 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>
          </div>

          {!filteredQuotes.length && (
            <div className="rounded-2xl border border-amber-800/30 bg-black/20 p-8 text-center">
              <p className="text-amber-300/60 font-serif text-sm italic">No quotes match that search.</p>
            </div>
          )}

          {activeQuote && (
            <div className="space-y-6">
              <div className="relative rounded-2xl overflow-hidden border border-amber-700/30 shadow-2xl" style={{ background: 'linear-gradient(135deg, #3d1a0a, #5c2a12)' }}>
                <div className="absolute top-4 left-4 opacity-20">
                  <Quote className="w-16 h-16 text-amber-400" />
                </div>
                <div className="px-8 py-10 relative">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold mb-4 ${themeClass(activeQuote.theme)}`}>
                    {activeQuote.theme}
                  </span>
                  <p className="font-serif text-xl md:text-2xl text-amber-100 leading-relaxed mb-6 italic">
                    "{activeQuote.quote}"
                  </p>
                  <p className="text-amber-400/70 text-sm font-medium">- John Wesley</p>
                  <p className="text-amber-600/50 text-xs mt-0.5">{activeQuote.source}</p>
                </div>
                <div className="flex items-center justify-between px-6 pb-5">
                  <button
                    onClick={() => setQuoteIdx(index => (index - 1 + filteredQuotes.length) % filteredQuotes.length)}
                    className="p-2 rounded-lg bg-amber-900/40 border border-amber-700/30 text-amber-300 hover:bg-amber-800/60 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <p className="text-amber-500/70 text-xs">
                    {quoteIdx + 1} of {filteredQuotes.length}
                  </p>
                  <button
                    onClick={() => setQuoteIdx(index => (index + 1) % filteredQuotes.length)}
                    className="p-2 rounded-lg bg-amber-900/40 border border-amber-700/30 text-amber-300 hover:bg-amber-800/60 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredQuotes.map((quote, index) => (
                  <button
                    key={`${quote.quote}-${index}`}
                    onClick={() => setQuoteIdx(index)}
                    className={`text-left p-4 rounded-xl border transition-all ${index === quoteIdx ? 'border-amber-500/50 bg-amber-800/30' : 'border-amber-800/30 bg-amber-950/30 hover:border-amber-700/50'}`}
                  >
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold mb-2 ${themeClass(quote.theme)}`}>{quote.theme}</span>
                    <p className="text-amber-200/70 text-xs font-serif italic line-clamp-2">"{quote.quote}"</p>
                    <p className="text-amber-600/50 text-[11px] mt-2 line-clamp-1">{quote.source}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'diary' && (
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500/50" />
              <input
                type="text"
                value={diaryQuery}
                onChange={(event) => setDiaryQuery(event.target.value)}
                placeholder="Search diary title, section, or full text..."
                className="w-full rounded-2xl border border-amber-800/30 bg-black/20 pl-11 pr-4 py-3 text-sm text-amber-50 placeholder:text-amber-400/40 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>
            <div className="sm:w-44">
              <select
                value={diaryYearFilter}
                onChange={(event) => setDiaryYearFilter(event.target.value)}
                className="w-full rounded-2xl border border-amber-800/30 bg-black/20 px-4 py-3 text-sm text-amber-50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              >
                <option value="all">All years</option>
                {availableDiaryYears.map((year) => (
                  <option key={year} value={String(year)}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className={`${diaryPanelOpen ? 'md:w-96 shrink-0' : 'hidden'} transition-all duration-300`}>
              <div className="flex items-center justify-between px-1 mb-3">
                <p className="text-amber-400/60 text-xs font-semibold uppercase tracking-wider">Diary Entries</p>
                <div className="flex items-center gap-2">
                  <span className="text-amber-600/50 text-xs">{diaryLoading ? 'Loading...' : `${filteredDiaryEntries.length} found`}</span>
                  <button
                    onClick={() => setDiaryPanelOpen(!diaryPanelOpen)}
                    className="p-1.5 hover:bg-amber-700/40 rounded-lg transition-colors text-amber-400"
                    title={diaryPanelOpen ? 'Collapse' : 'Expand'}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#b8860b transparent' }}>
                {diaryLoading && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 className="w-7 h-7 animate-spin text-amber-500" />
                    <p className="text-amber-300/60 text-sm font-serif italic">Loading Wesley diary entries...</p>
                  </div>
                )}

                {!diaryLoading && filteredDiaryEntries.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedDiaryId(entry.id)}
                    className={`w-full text-left px-3 py-3 rounded-xl transition-all border group ${
                      selectedDiaryEntry?.id === entry.id
                        ? 'bg-amber-700/80 border-amber-500/60 text-amber-50'
                        : 'border-transparent text-amber-200/70 hover:bg-amber-900/40 hover:border-amber-700/40 hover:text-amber-100'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`text-xs font-mono shrink-0 mt-0.5 ${selectedDiaryEntry?.id === entry.id ? 'text-amber-300' : 'text-amber-600/50'}`}>
                        {entry.section}
                      </span>
                      <span className="text-xs font-medium leading-snug line-clamp-2">{entry.title}</span>
                      {selectedDiaryEntry?.id === entry.id && <ChevronRight className="w-3 h-3 ml-auto mt-0.5 shrink-0 text-amber-300" />}
                    </div>
                    {entry.dateLabel && (
                      <p className={`text-[11px] mt-1 ml-8 ${selectedDiaryEntry?.id === entry.id ? 'text-amber-200/90' : 'text-amber-500/60'}`}>
                        {entry.dateLabel}
                      </p>
                    )}
                    {!entry.text && entry.excerpt && (
                      <p className={`text-[11px] mt-1 ml-8 line-clamp-2 ${selectedDiaryEntry?.id === entry.id ? 'text-amber-200/80' : 'text-amber-500/50'}`}>
                        {entry.excerpt}
                      </p>
                    )}
                  </button>
                ))}

                {!diaryLoading && !filteredDiaryEntries.length && (
                  <div className="rounded-2xl border border-amber-800/30 bg-black/20 p-5 text-center">
                    <p className="text-amber-300/60 text-sm font-serif italic">No diary entries match that search.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              {diaryError && (
                <div className="bg-red-900/30 border border-red-700/40 rounded-2xl p-6 text-red-300 text-sm">
                  {diaryError}
                </div>
              )}

              {!diaryError && !diaryLoading && !selectedDiaryEntry && (
                <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
                  <div className="w-20 h-20 rounded-full bg-amber-900/30 border border-amber-700/30 flex items-center justify-center">
                    <BookMarked className="w-9 h-9 text-amber-600/50" />
                  </div>
                  <div>
                    <p className="text-amber-300/60 font-serif text-sm italic">Select a diary entry from the list</p>
                    <p className="text-amber-500/40 text-xs mt-1">Search works across title, section, and full text</p>
                  </div>
                </div>
              )}

              {!diaryError && selectedDiaryEntry && (
                <div className="space-y-4">
                  <div className="rounded-2xl overflow-hidden border border-amber-700/30" style={{ background: 'linear-gradient(135deg, #3d1a0a, #5c2a12)' }}>
                    <div className="px-6 py-5">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-amber-500/70 text-xs font-semibold uppercase tracking-wider">Section {selectedDiaryEntry.section}</span>
                        {selectedDiaryEntry.year !== null && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-300/10 text-amber-200 border border-amber-300/20">
                            {selectedDiaryEntry.year}
                          </span>
                        )}
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-300/10 text-amber-200 border border-amber-300/20">
                          Original text · Wesley corpus
                        </span>
                      </div>
                      <h2 className="text-xl font-serif font-bold text-amber-100 leading-tight mb-2">{selectedDiaryEntry.title}</h2>
                      {selectedDiaryEntry.dateLabel && (
                        <p className="text-amber-300/80 text-xs font-medium">{selectedDiaryEntry.dateLabel}</p>
                      )}
                      <p className="text-amber-500/50 text-xs mt-3">Loaded from the bundled CCEL public-domain diary corpus.</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-800/30 bg-[#f6edd8] text-stone-800 shadow-2xl overflow-hidden">
                    <div className="border-b border-amber-200/70 px-6 py-3 bg-amber-50/90 flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.24em] text-amber-700/80 font-semibold">Original Diary Text</p>
                      {diaryTextsLoading && !selectedDiaryEntry.text && (
                        <span className="text-[11px] text-amber-700/70 font-medium">Loading full entry...</span>
                      )}
                      <a
                        href={selectedDiaryEntry.source}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-amber-700 hover:text-amber-900 underline underline-offset-2"
                      >
                        View source
                      </a>
                    </div>
                    <div
                      className="px-6 py-6 max-h-[72vh] overflow-y-auto font-serif text-[15px] leading-8 whitespace-pre-wrap"
                      style={{ backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, rgba(180,130,40,0.18) 31px, rgba(180,130,40,0.18) 32px)', backgroundPositionY: '18px' }}
                    >
                      {selectedDiaryEntry.text || selectedDiaryEntry.excerpt || 'Loading diary entry...'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'hymnStories' && (
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
          <div className="rounded-2xl border border-amber-800/30 bg-black/20 px-4 py-3 text-xs text-amber-200/80 backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-1">
              Stories Behind The Hymns
            </p>
            <p className="leading-relaxed">
              This section contains {EXPECTED_WESLEY_HYMN_STORY_COUNT} curated Methodist hymn and canticle stories. Search by title, writer, theme, code, or story keywords.
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500/50" />
            <input
              type="text"
              value={hymnStoryQuery}
              onChange={(event) => setHymnStoryQuery(event.target.value)}
                placeholder="Search title, writer, theme, code, or story..."
              className="w-full rounded-2xl border border-amber-800/30 bg-black/20 pl-11 pr-4 py-3 text-sm text-amber-50 placeholder:text-amber-400/40 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="md:w-96 shrink-0">
              <div className="flex items-center justify-between px-1 mb-3">
                <p className="text-amber-400/60 text-xs font-semibold uppercase tracking-wider">Hymn Stories</p>
                <span className="text-amber-600/50 text-xs">{filteredHymnStories.length} found</span>
              </div>

              <div className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#b8860b transparent' }}>
                {filteredHymnStories.map((story) => {
                  const referenceLabels = getStoryReferenceLabels(story);
                  const leadLabel = referenceLabels[0] ?? story.firstPublished;

                  return (
                  <button
                    key={story.id}
                    onClick={() => setSelectedHymnStoryId(story.id)}
                    className={`w-full text-left px-3 py-3 rounded-xl transition-all border group ${
                      selectedHymnStory?.id === story.id
                        ? 'bg-amber-700/80 border-amber-500/60 text-amber-50'
                        : 'border-transparent text-amber-200/70 hover:bg-amber-900/40 hover:border-amber-700/40 hover:text-amber-100'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`text-xs font-mono shrink-0 mt-0.5 ${selectedHymnStory?.id === story.id ? 'text-amber-300' : 'text-amber-600/50'}`}>
                        {leadLabel}
                      </span>
                      <span className="text-xs font-medium leading-snug line-clamp-2">{story.title}</span>
                      {selectedHymnStory?.id === story.id && <ChevronRight className="w-3 h-3 ml-auto mt-0.5 shrink-0 text-amber-300" />}
                    </div>
                    <p className={`text-[11px] mt-1 ml-12 ${selectedHymnStory?.id === story.id ? 'text-amber-200/90' : 'text-amber-500/60'}`}>
                      {story.writer}
                    </p>
                  </button>
                  );
                })}

                {!filteredHymnStories.length && (
                  <div className="rounded-2xl border border-amber-800/30 bg-black/20 p-5 text-center">
                    <p className="text-amber-300/60 text-sm font-serif italic">No hymn stories match that search.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              {!selectedHymnStory && (
                <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
                  <div className="w-20 h-20 rounded-full bg-amber-900/30 border border-amber-700/30 flex items-center justify-center">
                    <BookMarked className="w-9 h-9 text-amber-600/50" />
                  </div>
                  <div>
                    <p className="text-amber-300/60 font-serif text-sm italic">Select a hymn story from the list</p>
                    <p className="text-amber-500/40 text-xs mt-1">Search works across title, writer, themes, and story text</p>
                  </div>
                </div>
              )}

              {selectedHymnStory && (
                <div className="space-y-4">
                  <div className="rounded-2xl overflow-hidden border border-amber-700/30" style={{ background: 'linear-gradient(135deg, #3d1a0a, #5c2a12)' }}>
                    <div className="px-6 py-5">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-amber-500/70 text-xs font-semibold uppercase tracking-wider">{selectedHymnStory.firstPublished}</span>
                        {selectedHymnStoryReferenceLabels.map((referenceLabel) => (
                          <span
                            key={referenceLabel}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-300/10 text-amber-200 border border-amber-300/20"
                          >
                            {referenceLabel}
                          </span>
                        ))}
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-300/10 text-amber-200 border border-amber-300/20">
                          {selectedHymnStory.writer}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-300/10 text-amber-200 border border-amber-300/20">
                          {selectedHymnStory.hymnalHint}
                        </span>
                      </div>
                      <h2 className="text-xl font-serif font-bold text-amber-100 leading-tight mb-2">{selectedHymnStory.title}</h2>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {selectedHymnStory.themes.map((theme) => (
                          <span
                            key={theme}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-900/40 text-amber-200 border border-amber-600/30"
                          >
                            {theme}
                          </span>
                        ))}
                        {selectedHymnStory.alternateTitles.map((title) => (
                          <span
                            key={title}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100/90 text-stone-700 border border-stone-200"
                          >
                            Also: {title}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-800/30 bg-[#f6edd8] text-stone-800 shadow-2xl overflow-hidden">
                    <div className="border-b border-amber-200/70 px-6 py-3 bg-amber-50/90 flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.24em] text-amber-700/80 font-semibold">Story Behind The Hymn</p>
                      <a
                        href={selectedHymnStory.source}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-amber-700 hover:text-amber-900 underline underline-offset-2"
                      >
                        View source
                      </a>
                    </div>
                    <div className="px-6 py-6 max-h-[72vh] overflow-y-auto space-y-4 font-serif text-[15px] leading-8">
                      <p>{selectedHymnStory.story}</p>
                      <div className="rounded-xl border border-amber-300/70 bg-amber-100/70 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-amber-800/80 font-semibold mb-2">Methodist Connection</p>
                        <p>{selectedHymnStory.methodistConnection}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JohnWesley;

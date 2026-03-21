import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Song } from '../types';
import {
  AlertCircle,
  ArrowLeft,
  ArrowLeftRight,
  BookOpen,
  ChevronRight,
  Languages,
  Loader2,
  Music2,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

type SideBySideSong = Song & {
  lyrics_left?: string | null;
  lyrics_right?: string | null;
  lyrics_akan?: string | null;
  lyrics_english?: string | null;
  language_left?: string | null;
  language_right?: string | null;
  source_group?: string | null;
};

type SongPane = {
  label: string;
  text: string;
};

type PaneTheme = {
  section: string;
  header: string;
  label: string;
  body: string;
};

const SIDE_BY_SIDE_COLLECTIONS = ['SIDE_BY_SIDE_HYMNS', 'SIDE_BY_SIDE_CANTICLES'];
const SONG_BATCH_SIZE = 1000;

const normalizeText = (value?: string | null) => String(value ?? '').replace(/\r/g, '').trim();
const normalizeSearchText = (value?: string | number | null) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim();

const isSongCodeLine = (line: string) => {
  const compact = normalizeSearchText(line).replace(/\s+/gu, '');
  return /^(mhb|can|canf)\d+$/u.test(compact);
};

const getSongBookCode = (song: SideBySideSong) => {
  const number = Number.isInteger(song.number) ? Number(song.number) : null;
  if (number === null) {
    return normalizeText(song.code) || normalizeText(song.collection) || 'Song';
  }

  const collection = String(song.collection ?? '').toUpperCase();
  if (collection.includes('CANTICLE')) {
    return `CAN ${number}`;
  }

  return `MHB ${number}`;
};

const getPaneTheme = (label: string): PaneTheme => {
  const key = normalizeSearchText(label);

  if (key.includes('english')) {
    return {
      section: 'border-sky-200 bg-gradient-to-b from-white via-sky-50/70 to-blue-100/40 shadow-sm',
      header: 'border-sky-100 bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-100/80',
      label: 'text-sky-900',
      body: 'text-slate-900',
    };
  }

  if (key.includes('akan')) {
    return {
      section: 'border-amber-200 bg-gradient-to-b from-white via-amber-50/75 to-orange-100/45 shadow-sm',
      header: 'border-amber-100 bg-gradient-to-r from-amber-50 via-orange-50 to-rose-100/70',
      label: 'text-amber-900',
      body: 'text-slate-900',
    };
  }

  return {
    section: 'border-slate-200 bg-white shadow-sm',
    header: 'border-slate-100 bg-slate-50',
    label: 'text-slate-700',
    body: 'text-slate-900',
  };
};

const countMatches = (text: string, regex: RegExp) => {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
};

const analyzeLanguage = (text: string) => {
  const sample = normalizeSearchText(text.slice(0, 3000));
  if (!sample) {
    return {
      englishScore: 0,
      akanScore: 0,
      dominance: 0,
      label: 'Unknown' as 'English' | 'Akan' | 'Unknown',
    };
  }

  const englishScore =
    countMatches(sample, /\b(the|and|of|to|in|his|thy|thou|thee|lord|god|king|praise|grace|worship|shield|defender|ancient|friend|mercy|christ|jesus)\b/gu)
    + countMatches(sample, /\b(o\s+[a-z])/gu)
    + (sample.includes('amen') ? 1 : 0);

  const akanScore =
    countMatches(sample, /\b(wo|w[ɔo]|h[ɛe]n|nye|na|no|nyame|ewuradze|adom|asase|tum|nkwa|ay[ɛe]w|hom|kotow|gyefo|pomfo|d[ɔo]fo|mbra|onyame)\b/gu)
    + countMatches(sample, /[ɛƐɔƆŋŊↄ]/gu) * 2
    + (sample.includes('nyim') ? 1 : 0);

  const dominance = englishScore - akanScore;
  const label = dominance >= 2 ? 'English' : dominance <= -2 ? 'Akan' : 'Unknown';

  return {
    englishScore,
    akanScore,
    dominance,
    label,
  };
};

const isEnglishLabel = (value?: string | null) => /english|eng/u.test(normalizeSearchText(value));
const isAkanLabel = (value?: string | null) => /akan|fante|twi|fanti/u.test(normalizeSearchText(value));

const parseMarkedLyrics = (lyrics: string) => {
  const normalized = normalizeText(lyrics);
  const match = normalized.match(/\[LEFT\]\s*([\s\S]*?)\s*\[RIGHT\]\s*([\s\S]*)$/i);
  if (!match) {
    return { left: '', right: '' };
  }

  return {
    left: normalizeText(match[1]),
    right: normalizeText(match[2]),
  };
};

const toStanzas = (text: string, titleHints: Array<string | null | undefined> = []) => {
  const rawLines = normalizeText(text).split('\n').map((line) => line.trim());

  const normalizedLineCounts = new Map<string, number>();
  for (const line of rawLines) {
    const key = normalizeSearchText(line);
    if (!key) {
      continue;
    }

    normalizedLineCounts.set(key, (normalizedLineCounts.get(key) ?? 0) + 1);
  }

  const titleLineKeys = new Set(
    titleHints
      .map((value) => normalizeSearchText(value))
      .filter((value) => Boolean(value))
  );

  const firstNonEmptyLine = rawLines.find((line) => line.length > 0) ?? '';
  const firstLineKey = normalizeSearchText(firstNonEmptyLine);
  const firstLineCount = normalizedLineCounts.get(firstLineKey) ?? 0;
  const firstLineLooksLikeTitle =
    Boolean(firstLineKey)
    && firstLineKey.length <= 80
    && !/\d/u.test(firstLineKey)
    && firstLineKey.split(' ').length <= 12;

  if (firstLineLooksLikeTitle && firstLineCount >= 2) {
    titleLineKeys.add(firstLineKey);
  }

  const sanitizedLines = rawLines.flatMap((line) => {
    if (!line) {
      return [''];
    }

    if (isSongCodeLine(line)) {
      return [''];
    }

    if (titleLineKeys.has(normalizeSearchText(line))) {
      return [''];
    }

    return [line];
  });

  const sanitizedText = sanitizedLines
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();

  const chunks = sanitizedText
    .split(/\n\s*\n/)
    .map((chunk) => chunk.split('\n').map((line) => line.trim()).filter(Boolean))
    .filter((lines) => lines.length > 0);

  if (!chunks.length) {
    const lines = sanitizedText.split('\n').map((line) => line.trim()).filter(Boolean);
    return lines.length ? [lines] : [];
  }

  return chunks;
};

const sortSongs = (left: SideBySideSong, right: SideBySideSong) => {
  const leftCollection = String(left.collection ?? '').toUpperCase();
  const rightCollection = String(right.collection ?? '').toUpperCase();

  const leftRank = leftCollection.includes('CANTICLE') ? 2 : 1;
  const rightRank = rightCollection.includes('CANTICLE') ? 2 : 1;

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  const leftNumber = Number.isInteger(left.number) ? Number(left.number) : Number.MAX_SAFE_INTEGER;
  const rightNumber = Number.isInteger(right.number) ? Number(right.number) : Number.MAX_SAFE_INTEGER;

  if (leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }

  return String(left.title ?? '').localeCompare(String(right.title ?? ''));
};

const buildSongPanes = (song: SideBySideSong): SongPane[] => {
  const explicitLeft = normalizeText(song.lyrics_left);
  const explicitRight = normalizeText(song.lyrics_right);
  const english = normalizeText(song.lyrics_english);
  const akan = normalizeText(song.lyrics_akan);
  const marked = parseMarkedLyrics(song.lyrics);

  const left = explicitLeft || marked.left;
  const right = explicitRight || marked.right;
  const leftLanguageMeta = normalizeText(song.language_left);
  const rightLanguageMeta = normalizeText(song.language_right);

  const leftStats = analyzeLanguage(left);
  const rightStats = analyzeLanguage(right);
  const englishFieldStats = analyzeLanguage(english);
  const akanFieldStats = analyzeLanguage(akan);

  let englishText = english;
  let akanText = akan;

  if (left && right) {
    const leftLooksEnglish = isEnglishLabel(leftLanguageMeta);
    const rightLooksEnglish = isEnglishLabel(rightLanguageMeta);
    const leftLooksAkan = isAkanLabel(leftLanguageMeta);
    const rightLooksAkan = isAkanLabel(rightLanguageMeta);

    if ((leftLooksEnglish && !rightLooksEnglish) || (rightLooksAkan && !leftLooksAkan)) {
      englishText = left;
      akanText = right;
    } else if ((rightLooksEnglish && !leftLooksEnglish) || (leftLooksAkan && !rightLooksAkan)) {
      englishText = right;
      akanText = left;
    } else if (leftStats.dominance >= rightStats.dominance) {
      englishText = left;
      akanText = right;
    } else {
      englishText = right;
      akanText = left;
    }
  }

  if (!englishText && english && englishFieldStats.label !== 'Akan') {
    englishText = english;
  }

  if (!akanText && akan && akanFieldStats.label !== 'English') {
    akanText = akan;
  }

  if (!englishText && left && left !== akanText && leftStats.dominance >= 0) {
    englishText = left;
  }

  if (!englishText && right && right !== akanText && rightStats.dominance >= 0) {
    englishText = right;
  }

  if (!akanText && left && left !== englishText && leftStats.dominance < 0) {
    akanText = left;
  }

  if (!akanText && right && right !== englishText && rightStats.dominance < 0) {
    akanText = right;
  }

  if (!englishText) {
    englishText = normalizeText(song.lyrics);
  }

  const panes: SongPane[] = [];
  if (englishText) {
    panes.push({ label: 'English (MHB)', text: englishText });
  }

  if (akanText && akanText !== englishText) {
    panes.push({ label: 'Akan (CAN)', text: akanText });
  }

  if (!panes.length) {
    panes.push({ label: 'Lyrics', text: normalizeText(song.lyrics) });
  }

  return panes;
};

const SongCanvas: React.FC = () => {
  const navigate = useNavigate();
  const [songs, setSongs] = useState<SideBySideSong[]>([]);
  const [selectedSong, setSelectedSong] = useState<SideBySideSong | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSongList, setShowSongList] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth >= 1280));
  const [isSwapped, setIsSwapped] = useState(false);
  const [fontSize, setFontSize] = useState(24);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchSongs = async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        const loadedSongs: SideBySideSong[] = [];
        let from = 0;

        while (true) {
          const { data, error } = await supabase
            .from('songs')
            .select('*')
            .in('collection', SIDE_BY_SIDE_COLLECTIONS)
            .order('number', { ascending: true })
            .order('id', { ascending: true })
            .range(from, from + SONG_BATCH_SIZE - 1);

          if (error) {
            throw error;
          }

          if (!data?.length) {
            break;
          }

          loadedSongs.push(...(data as SideBySideSong[]));

          if (data.length < SONG_BATCH_SIZE) {
            break;
          }

          from += SONG_BATCH_SIZE;
        }

        const sortedSongs = loadedSongs.sort(sortSongs);
        setSongs(sortedSongs);

        if (sortedSongs.length > 0) {
          setSelectedSong((current) => current ?? sortedSongs[0]);
        } else {
          setSelectedSong(null);
        }
      } catch (error: any) {
        console.error('Error loading side-by-side songs:', error);
        setErrorMsg(error.message || 'Failed to load Song Canvas content.');
      } finally {
        setLoading(false);
      }
    };

    fetchSongs();
  }, []);

  const filteredSongs = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchQuery);
    if (!normalizedQuery) {
      return songs;
    }

    const compactQuery = normalizedQuery.replace(/\s+/gu, '');

    return songs.filter((song) => {
      const bookCode = getSongBookCode(song);
      const searchAliases = [
        bookCode,
        bookCode.replace(/\s+/gu, ''),
        song.number ? `song ${song.number}` : '',
        song.number ? `hymn ${song.number}` : '',
      ];

      const normalizedHaystack = [
        song.title,
        song.code,
        song.collection,
        song.number,
        song.lyrics,
        song.lyrics_left,
        song.lyrics_right,
        song.lyrics_english,
        song.lyrics_akan,
        ...searchAliases,
      ]
        .map((value) => normalizeSearchText(value))
        .join(' ');

      const compactHaystack = normalizedHaystack.replace(/\s+/gu, '');

      return normalizedHaystack.includes(normalizedQuery) || compactHaystack.includes(compactQuery);
    });
  }, [songs, searchQuery]);

  useEffect(() => {
    if (!selectedSong) {
      return;
    }

    const stillVisible = filteredSongs.find((song) => song.id === selectedSong.id);
    if (!stillVisible) {
      setSelectedSong(filteredSongs[0] ?? null);
    }
  }, [filteredSongs, selectedSong]);

  const handleSelectSong = (song: SideBySideSong) => {
    setSelectedSong(song);

    if (typeof window !== 'undefined' && window.innerWidth < 1280) {
      setShowSongList(false);
    }
  };

  const panes = selectedSong ? buildSongPanes(selectedSong) : [];
  const hasMultiplePanes = panes.length > 1;
  const displayPanes = isSwapped && hasMultiplePanes ? [...panes].reverse() : panes;

  const songListContent = (
    <>
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
          <Music2 className="w-4 h-4" /> Songs
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{filteredSongs.length}</span>
          <button
            type="button"
            onClick={() => setShowSongList(false)}
            className="xl:hidden inline-flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
            aria-label="Hide songs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading songs...
          </div>
        ) : filteredSongs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center text-slate-500 px-4 text-sm">
            No songs loaded yet.
          </div>
        ) : (
          filteredSongs.map((song) => {
            const active = selectedSong?.id === song.id;
            return (
              <button
                key={song.id}
                type="button"
                onClick={() => handleSelectSong(song)}
                className={`w-full text-left px-3 py-3 rounded-xl border transition-all ${
                  active
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-900 shadow-sm'
                    : 'border-transparent hover:border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                      {getSongBookCode(song)}
                    </div>
                    <div className="font-semibold text-sm truncate">{song.title}</div>
                  </div>
                  <ChevronRight className={`w-4 h-4 mt-1 ${active ? 'text-indigo-500' : 'text-slate-300'}`} />
                </div>
              </button>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <div className="h-full flex flex-col bg-slate-50 gap-4">
      <div className="bg-gradient-to-r from-indigo-900 via-blue-900 to-slate-900 rounded-2xl p-5 md:p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Languages className="w-6 h-6 text-blue-100" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Akan & English Songs</h1>
              <p className="text-blue-200 text-sm">Clean side-by-side reader for bilingual worship songs</p>
            </div>
          </div>

          <div className="w-full md:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSongList((current) => !current)}
              className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-white/10 text-white border border-white/25 hover:bg-white/20 transition-all font-semibold text-sm"
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${showSongList ? 'rotate-180' : ''}`} />
              {showSongList ? 'Hide Songs' : 'Show Songs'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/hymnal')}
              className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-white/10 text-white border border-white/25 hover:bg-white/20 transition-all font-semibold text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Hymnal
            </button>

            <div className="relative w-full md:w-[360px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search MHB number (e.g. MHB 383), title, or lyric"
                className="w-full h-11 pl-10 pr-3 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 flex items-start gap-2 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="xl:hidden">
        <div
          className={`fixed inset-0 z-40 bg-slate-950/35 transition-opacity duration-300 ${showSongList ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setShowSongList(false)}
        />
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-[86vw] max-w-sm bg-white border-r border-slate-200 shadow-2xl flex flex-col transition-transform duration-300 xl:hidden ${showSongList ? 'translate-x-0' : '-translate-x-full'}`}
        >
          {songListContent}
        </aside>
      </div>

      <div className={`flex-1 min-h-0 grid gap-4 ${showSongList ? 'grid-cols-1 xl:grid-cols-[320px_1fr]' : 'grid-cols-1'}`}>
        {showSongList && (
          <div className="hidden xl:flex bg-white border border-slate-200 rounded-2xl shadow-sm flex-col min-h-0">
            {songListContent}
          </div>
        )}

        <div className="min-h-0 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
          {!selectedSong ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 px-6">
              <BookOpen className="w-10 h-10 mb-3 text-slate-300" />
              <p className="font-semibold">Select a song to open the canvas.</p>
            </div>
          ) : (
            <>
              <div className="sticky top-0 z-20 px-4 md:px-6 py-4 border-b border-slate-100 bg-slate-50/90 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                    {getSongBookCode(selectedSong)}
                  </p>
                  <h2 className="text-lg md:text-xl font-bold text-slate-900 truncate">{selectedSong.title}</h2>
                </div>
                <div className="w-full md:w-auto flex items-center flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSongList((current) => !current)}
                    className="inline-flex items-center gap-2 h-10 px-3 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all text-sm font-semibold"
                  >
                    <ChevronRight className={`w-4 h-4 transition-transform ${showSongList ? 'rotate-180' : ''}`} />
                    {showSongList ? 'Hide Songs' : 'Show Songs'}
                  </button>

                  {hasMultiplePanes && (
                    <button
                      type="button"
                      onClick={() => setIsSwapped((current) => !current)}
                      className={`inline-flex items-center gap-2 h-10 px-3 rounded-full border transition-all text-sm font-semibold ${
                        isSwapped
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                      aria-pressed={isSwapped}
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                      Swap Sides
                    </button>
                  )}

                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-full px-1 py-1">
                  <button
                    type="button"
                    onClick={() => setFontSize((current) => Math.max(16, current - 2))}
                    className="p-2 rounded-full text-slate-600 hover:bg-slate-100"
                    aria-label="Decrease font size"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-xs w-7 text-center font-semibold text-slate-700">{fontSize}</span>
                  <button
                    type="button"
                    onClick={() => setFontSize((current) => Math.min(40, current + 2))}
                    className="p-2 rounded-full text-slate-600 hover:bg-slate-100"
                    aria-label="Increase font size"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
                <div className={`max-w-6xl mx-auto grid gap-4 ${displayPanes.length > 1 ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
                  {displayPanes.map((pane) => {
                    const stanzas = toStanzas(pane.text, [selectedSong.title, selectedSong.raw_title]);
                    const theme = getPaneTheme(pane.label);
                    return (
                      <section
                        key={`${selectedSong.id}-${pane.label}`}
                        className={`rounded-2xl border overflow-hidden ${theme.section}`}
                      >
                        <header className={`px-4 py-3 border-b ${theme.header}`}>
                          <span className={`text-xs font-bold uppercase tracking-[0.2em] ${theme.label}`}>{pane.label}</span>
                        </header>

                        <div className="px-5 py-5 md:px-6 md:py-6 space-y-8">
                          {stanzas.length === 0 ? (
                            <p className="text-sm text-slate-500">No lyrics found.</p>
                          ) : (
                            stanzas.map((stanza, index) => (
                              <div key={index} className="text-center space-y-2">
                                {stanza.map((line, lineIndex) => (
                                  <p
                                    key={lineIndex}
                                    className={`font-serif ${theme.body}`}
                                    style={{ fontSize: `${fontSize}px`, lineHeight: 1.55 }}
                                  >
                                    {line}
                                  </p>
                                ))}
                              </div>
                            ))
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SongCanvas;

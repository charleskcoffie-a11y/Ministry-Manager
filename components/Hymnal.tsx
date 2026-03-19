
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Song } from '../types';
import { Search, Music, BookOpen, ChevronRight, ArrowLeft, Loader2, ZoomIn, ZoomOut, Globe, List, X, AlertCircle, PlayCircle, Star, Heart } from 'lucide-react';
import localWesleyHymnStories from '../public/wesley/hymn_stories.json';
import localWesleyCanticleStories from '../public/wesley/canticle_stories.json';
import { findHymnStoryForSong, getStoryReferenceLabels, normalizeHymnStories } from '../utils/hymnStories';

// --- Helper: Advanced Stanza Parser ---
const parseStanzas = (raw: string | undefined | null): string[][] => {
    if (!raw) return [];
    
    const lines = raw.split('\n');
    const stanzas: string[][] = [];
    let currentStanza: string[] = [];

    lines.forEach(line => {
        let text = line.trim();
        
        // Filter out common artifacts first
        if (text.toLowerCase().startsWith('tahoma')) return;
        if (/^[;:,.]+$/.test(text)) return;

        // Detect Stanza Breakers (Empty lines or Headers)
        const isHeader = 
            /^\d+\.?$/.test(text) ||
            /^[-0-9\s]*(Verse|Stanza|Hymn)\s*\d*/i.test(text);

        const isEmpty = !text;

        if (isHeader || isEmpty) {
            if (currentStanza.length > 0) {
                stanzas.push(currentStanza);
                currentStanza = [];
            }
            return;
        }

        // Clean line content (remove leading artifacts like "-1")
        if (/^-\d+/.test(text)) text = text.replace(/^-\d+/, '').trim();

        if (text) {
            currentStanza.push(text);
        }
    });

    // Capture final stanza
    if (currentStanza.length > 0) {
        stanzas.push(currentStanza);
    }

    return stanzas;
};

// --- Helper: Preview Text Extractor ---
const getPreviewText = (raw: string | undefined | null): string => {
    const stanzas = parseStanzas(raw);
    if (stanzas.length > 0 && stanzas[0].length > 0) return stanzas[0][0];
    return '';
};

// --- Helper: Collection Colors ---
const getCollectionStyle = (collection: string) => {
    if (collection === 'MHB' || collection === 'HYMNS') {
        return {
            gradient: 'from-blue-600 to-indigo-600',
            text: 'text-blue-700',
            bg: 'bg-blue-50',
            border: 'border-blue-100'
        };
    }
    if (collection.includes('CANTICLE')) {
        return {
            gradient: 'from-purple-600 to-fuchsia-600',
            text: 'text-purple-700',
            bg: 'bg-purple-50',
            border: 'border-purple-100'
        };
    }
    if (collection === 'CAN' || collection === 'LOCAL' || collection === 'GHANA') {
        return {
            gradient: 'from-teal-500 to-emerald-600',
            text: 'text-teal-700',
            bg: 'bg-teal-50',
            border: 'border-teal-100'
        };
    }
    // Default
    return {
        gradient: 'from-slate-500 to-gray-600',
        text: 'text-slate-700',
        bg: 'bg-slate-50',
        border: 'border-slate-100'
    };
};

const BUNDLED_HYMN_STORIES = normalizeHymnStories([
    ...(Array.isArray(localWesleyHymnStories) ? localWesleyHymnStories : []),
    ...(Array.isArray(localWesleyCanticleStories) ? localWesleyCanticleStories : []),
]);

const SONG_BATCH_SIZE = 1000;

const COLLECTION_ORDER: Record<string, number> = {
    MHB: 1,
    HYMNS: 1,
    GENERAL: 1,
    SONGS: 1,
    CANTICLES_EN: 2,
    CANTICLES: 2,
    CANTICLE: 2,
    CANTICLES_FANTE: 3,
    CAN: 4,
    LOCAL: 4,
    GHANA: 4,
};

const normalizeCollectionKey = (value: string | null | undefined) => String(value ?? '').trim().toUpperCase();
const normalizeSongCode = (value: string | null | undefined) => String(value ?? '').trim().toUpperCase();
const normalizeSongTitle = (value: string | null | undefined) => String(value ?? '').toLowerCase().replace(/\s+/gu, ' ').trim();

const toPositiveSongNumber = (value: number | null | undefined) => {
    if (Number.isInteger(value) && Number(value) > 0) {
        return Number(value);
    }

    return null;
};

const buildSongIdentityKey = (song: Song) => {
    const collection = normalizeCollectionKey(song.collection);
    const code = normalizeSongCode(song.code);
    const number = toPositiveSongNumber(song.number);

    if (collection && code && number !== null) {
        return `CODE_NUMBER|${collection}|${code}|${number}`;
    }

    if (collection && code) {
        return `CODE|${collection}|${code}`;
    }

    if (collection && number !== null) {
        return `NUMBER|${collection}|${number}`;
    }

    return `TITLE|${collection}|${normalizeSongTitle(song.title)}`;
};

const hasLyrics = (value: string | null | undefined) => Boolean(String(value ?? '').trim());

const selectPreferredSong = (currentSong: Song, candidateSong: Song) => {
    const currentHasLyrics = hasLyrics(currentSong.lyrics);
    const candidateHasLyrics = hasLyrics(candidateSong.lyrics);

    if (currentHasLyrics !== candidateHasLyrics) {
        return candidateHasLyrics ? candidateSong : currentSong;
    }

    return Number(candidateSong.id) < Number(currentSong.id) ? candidateSong : currentSong;
};

const dedupeSongs = (items: Song[]) => {
    const canonicalByIdentity = new Map<string, Song>();

    for (const song of items) {
        const identityKey = buildSongIdentityKey(song);
        const existingSong = canonicalByIdentity.get(identityKey);

        if (!existingSong) {
            canonicalByIdentity.set(identityKey, song);
            continue;
        }

        canonicalByIdentity.set(identityKey, selectPreferredSong(existingSong, song));
    }

    return [...canonicalByIdentity.values()];
};

const sortSongs = (left: Song, right: Song) => {
    const leftCollectionOrder = COLLECTION_ORDER[normalizeCollectionKey(left.collection)] ?? 99;
    const rightCollectionOrder = COLLECTION_ORDER[normalizeCollectionKey(right.collection)] ?? 99;

    if (leftCollectionOrder !== rightCollectionOrder) {
        return leftCollectionOrder - rightCollectionOrder;
    }

    const leftNumber = left.number ?? Number.MAX_SAFE_INTEGER;
    const rightNumber = right.number ?? Number.MAX_SAFE_INTEGER;
    if (leftNumber !== rightNumber) {
        return leftNumber - rightNumber;
    }

    return left.title.localeCompare(right.title);
};

const normalizeSearchText = (value: string | number | null | undefined) =>
    String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/gu, '')
        .replace(/[ɛƐ]/gu, 'e')
        .replace(/[ɔƆ]/gu, 'o')
        .replace(/[ŋŊ]/gu, 'n')
        .replace(/[ɖƉ]/gu, 'd')
        .replace(/&/gu, ' and ')
        .replace(/['’`]/gu, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .toLowerCase()
        .replace(/\s+/gu, ' ')
        .trim();

const getUniqueQueryTokens = (value: string) => Array.from(new Set(normalizeSearchText(value).split(' ').filter(Boolean)));

const buildSongSearchIndex = (song: Song) => {
    const title = normalizeSearchText(song.title);
    const rawTitle = normalizeSearchText(song.raw_title);
    const lyrics = normalizeSearchText(song.lyrics);
    const preview = normalizeSearchText(getPreviewText(song.lyrics));
    const code = normalizeSearchText(song.code);
    const collection = normalizeSearchText(song.collection);
    const number = normalizeSearchText(song.number);
    const author = normalizeSearchText(song.author);
    const tags = normalizeSearchText(song.tags);
    const referenceNumber = normalizeSearchText(song.reference_number);

    const fields = [title, rawTitle, preview, lyrics, code, collection, number, author, tags, referenceNumber].filter(Boolean);
    const tokenSet = new Set(fields.flatMap((field) => field.split(' ').filter(Boolean)));

    return {
        title,
        rawTitle,
        lyrics,
        preview,
        code,
        collection,
        number,
        author,
        tags,
        referenceNumber,
        combined: fields.join(' '),
        tokenSet,
    };
};

const getSongSearchScore = (song: Song, rawQuery: string) => {
    const normalizedQuery = normalizeSearchText(rawQuery);
    if (!normalizedQuery) {
        return 0;
    }

    const queryTokens = getUniqueQueryTokens(rawQuery);
    const searchIndex = buildSongSearchIndex(song);

    const tokenMatches = queryTokens.filter((token) => {
        if (searchIndex.tokenSet.has(token)) {
            return true;
        }

        for (const candidateToken of searchIndex.tokenSet) {
            if (candidateToken.startsWith(token) || token.startsWith(candidateToken)) {
                return true;
            }
        }

        return false;
    });

    const allTokensMatch = queryTokens.length > 0 && tokenMatches.length === queryTokens.length;

    let score = 0;

    if (searchIndex.code === normalizedQuery) score += 1000;
    if (searchIndex.number === normalizedQuery) score += 950;
    if (searchIndex.title === normalizedQuery || searchIndex.rawTitle === normalizedQuery) score += 900;
    if (searchIndex.title.startsWith(normalizedQuery) || searchIndex.rawTitle.startsWith(normalizedQuery)) score += 760;
    if (searchIndex.title.includes(normalizedQuery) || searchIndex.rawTitle.includes(normalizedQuery)) score += 680;
    if (searchIndex.preview.includes(normalizedQuery)) score += 560;
    if (searchIndex.lyrics.includes(normalizedQuery)) score += 520;
    if (searchIndex.code.includes(normalizedQuery)) score += 480;
    if (searchIndex.referenceNumber.includes(normalizedQuery)) score += 360;
    if (searchIndex.author.includes(normalizedQuery) || searchIndex.tags.includes(normalizedQuery)) score += 320;
    if (allTokensMatch) score += 240;
    score += tokenMatches.length * 45;

    return score;
};

type HymnalNavigationSelection = {
        songId: number;
        collection: string;
        code: string;
        number: number | null;
        title: string;
        targetTab: 'hymns' | 'canticles' | 'can' | 'all' | 'favorites';
};

const Hymnal: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'hymns' | 'canticles' | 'can' | 'all' | 'favorites'>('hymns');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [songs, setSongs] = useState<Song[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Song | null>(null);
  const [fontSize, setFontSize] = useState(20);
    const [showHymnStory, setShowHymnStory] = useState(false);
    const [pendingSelection, setPendingSelection] = useState<HymnalNavigationSelection | null>(null);

    const routeSelection = ((location.state as { hymnSelection?: HymnalNavigationSelection } | null)?.hymnSelection) ?? null;

  // Toast State
  const [toast, setToast] = useState<{message: string, visible: boolean}>({ message: '', visible: false });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

    useEffect(() => {
        if (!routeSelection) {
                return;
        }

        setPendingSelection(routeSelection);
        setSearchQuery(routeSelection.code || routeSelection.title || '');

        if (routeSelection.targetTab !== activeTab) {
                setActiveTab(routeSelection.targetTab);
        }
    }, [routeSelection, activeTab]);

    useEffect(() => {
        setShowHymnStory(false);
    }, [selectedItem?.id]);

    useEffect(() => {
        if (!pendingSelection || loading) {
                return;
        }

        const matchedSong = songs.find((song) => {
                if (song.id === pendingSelection.songId) {
                        return true;
                }

                return normalizeCollectionKey(song.collection) === normalizeCollectionKey(pendingSelection.collection)
                        && normalizeSongCode(song.code) === normalizeSongCode(pendingSelection.code)
                        && (song.number ?? null) === pendingSelection.number;
        });

        if (!matchedSong) {
                return;
        }

        setSelectedItem(matchedSong);
        setPendingSelection(null);
        navigate('/hymnal', { replace: true, state: {} });
    }, [pendingSelection, songs, loading, navigate]);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    let collections: string[] = [];

    // Inclusive filtering logic
    if (activeTab === 'hymns') {
        collections = ['MHB', 'General', 'HYMNS', 'SONGS'];
    } else if (activeTab === 'canticles') {
        collections = ['CANTICLES_EN', 'CANTICLES_FANTE', 'CANTICLES', 'CANTICLE'];
    } else if (activeTab === 'can') {
        collections = ['CAN', 'LOCAL', 'GHANA'];
    }
    // 'all' and 'favorites' don't use the 'in' filter on collection

    try {
        const loadedSongs: Song[] = [];
        let from = 0;

        while (true) {
            let query = supabase
                .from('songs')
                .select('*')
                .order('number', { ascending: true })
                .order('id', { ascending: true })
                .range(from, from + SONG_BATCH_SIZE - 1);

            if (activeTab === 'favorites') {
                query = query.eq('is_favorite', true);
            } else if (activeTab !== 'all') {
                query = query.in('collection', collections);
            }

            const { data, error } = await query;
            if (error) throw error;

            if (!data?.length) {
                break;
            }

            loadedSongs.push(...data);

            if (data.length < SONG_BATCH_SIZE) {
                break;
            }

            from += SONG_BATCH_SIZE;
        }

        setSongs(dedupeSongs(loadedSongs).sort(sortSongs));
    } catch (err: any) {
        console.error("Error fetching songs:", err);
        const msg = err.message || err.error_description || JSON.stringify(err);
        setErrorMsg(msg);
    } finally {
        setLoading(false);
    }
  };

  const getFilteredItems = () => {
    if (!searchQuery) return songs;

        return songs
            .map((song) => ({
                song,
                score: getSongSearchScore(song, searchQuery),
            }))
            .filter(({ score }) => score > 0)
            .sort((left, right) => {
                if (left.score !== right.score) {
                        return right.score - left.score;
                }

                return sortSongs(left.song, right.song);
            })
            .map(({ song }) => song);
  };

  const filteredItems = getFilteredItems();
    const matchedSelectedStory = findHymnStoryForSong(selectedItem, BUNDLED_HYMN_STORIES);
        const selectedStoryReferenceLabels = matchedSelectedStory
                ? getStoryReferenceLabels(matchedSelectedStory, selectedItem?.collection)
                : [];

  const showToast = (msg: string) => {
    setToast({ message: msg, visible: true });
    setTimeout(() => setToast({ ...toast, visible: false }), 2000);
  };

  const toggleFavorite = async (e: React.MouseEvent, song: Song) => {
    e.stopPropagation(); // Prevent opening song details
    
    const newStatus = !song.is_favorite;

    // 1. Optimistic Update (Local State)
    const updatedSongs = songs.map(s => 
        s.id === song.id ? { ...s, is_favorite: newStatus } : s
    );
    
    // If we are in "Favorites" tab and unstarring, remove it from view
    if (activeTab === 'favorites' && !newStatus) {
        setSongs(songs.filter(s => s.id !== song.id));
    } else {
        setSongs(updatedSongs);
    }
    
    if (selectedItem?.id === song.id) {
        setSelectedItem({ ...selectedItem, is_favorite: newStatus });
    }

    // 2. Feedback
    showToast(newStatus ? "Added to Favorites" : "Removed from Favorites");

    // 3. Database Update
    try {
        const { error } = await supabase
            .from('songs')
            .update({ is_favorite: newStatus })
            .eq('id', song.id);
            
        if (error) throw error;
    } catch (err) {
        console.error("Error updating favorite:", err);
        // Revert optimistic update on error
        setSongs(songs);
        showToast("Error updating favorite");
    }
  };

  // --- Component: Tab Button ---
  const TabButton = ({ id, label, icon: Icon, colorClass }: { id: string, label: string, icon: any, colorClass: string }) => (
    <button 
        onClick={() => { setActiveTab(id as any); setSearchQuery(''); }}
        className={`
            relative flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-full text-sm font-bold transition-all duration-300 whitespace-nowrap
            ${activeTab === id 
                ? `${colorClass} text-white shadow-md transform scale-100` 
                : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100 hover:scale-[1.02]'
            }
        `}
    >
        <Icon className={`w-4 h-4 ${activeTab === id ? 'text-white' : 'text-gray-400'}`} />
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{label.split(' ')[0]}</span>
    </button>
  );

  // --- Render Reading View (Overlay) ---
  if (selectedItem) {
      const stanzas = parseStanzas(selectedItem.lyrics);
      const styles = getCollectionStyle(selectedItem.collection);

      return (
          <div className="fixed inset-0 z-50 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex flex-col overflow-hidden">
              {/* Animated Background Blobs */}
              <div className="fixed inset-0 overflow-hidden pointer-events-none">
                  <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
                  <div className="absolute top-40 right-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
                  <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
              </div>

              {/* Reading Header */}
              <div className="relative bg-white/70 backdrop-blur-xl border-b border-white/20 px-4 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
                  <button 
                    onClick={() => setSelectedItem(null)} 
                    className="flex items-center gap-2 text-white bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 px-5 py-2.5 rounded-full transition-all duration-300 font-semibold text-sm shadow-lg hover:shadow-xl hover:scale-105"
                  >
                      <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  
                  <div className="flex items-center gap-3">
                                            {matchedSelectedStory && (
                                                <button
                                                    onClick={() => setShowHymnStory((current) => !current)}
                                                    className={`px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 border shadow-md hover:scale-105 ${showHymnStory ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white border-amber-400/40' : 'bg-white/70 backdrop-blur-md text-slate-700 border-white/30 hover:bg-white'}`}
                                                >
                                                    {showHymnStory ? 'Hide Hymn Story' : 'Story Behind This Hymn'}
                                                </button>
                                            )}

                      <div className="flex items-center gap-2 bg-white/60 backdrop-blur-md p-1.5 rounded-full border border-white/30 shadow-sm hover:bg-white/80 transition-all">
                          <button 
                            onClick={() => setFontSize(Math.max(14, fontSize - 2))} 
                            className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-all duration-200 hover:scale-110"
                          >
                            <ZoomOut className="w-4 h-4"/>
                          </button>
                          <span className="text-xs font-bold w-8 text-center text-slate-700 bg-slate-50 rounded px-1 py-0.5">{fontSize}</span>
                          <button 
                            onClick={() => setFontSize(Math.min(48, fontSize + 2))} 
                            className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-all duration-200 hover:scale-110"
                          >
                            <ZoomIn className="w-4 h-4"/>
                          </button>
                      </div>

                      <button 
                        onClick={(e) => toggleFavorite(e, selectedItem)}
                        className={`p-2.5 rounded-full transition-all duration-300 border shadow-md hover:scale-110 ${selectedItem.is_favorite 
                            ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-white border-amber-300 shadow-amber-200/50' 
                            : 'bg-white/60 backdrop-blur-md text-slate-400 border-white/30 hover:text-amber-500 hover:from-amber-50 hover:to-amber-50'}`}
                      >
                         <Star className={`w-5 h-5 ${selectedItem.is_favorite ? 'fill-white' : ''}`} />
                      </button>
                  </div>
              </div>

              {/* Reading Content */}
              <div className="flex-1 overflow-y-auto relative z-10">
                  <div className="max-w-3xl mx-auto min-h-full bg-white/80 backdrop-blur-xl shadow-2xl my-6 md:my-10 rounded-3xl overflow-hidden border border-white/40">
                      {/* Song Title Header - Modern Gradient */}
                      <div className={`bg-gradient-to-br ${styles.gradient} text-white relative px-8 pt-12 pb-8 text-center`}>
                          {/* Decorative elements */}
                          <div className="absolute top-0 left-0 w-40 h-40 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
                          <div className="absolute bottom-0 right-0 w-40 h-40 bg-white/10 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl"></div>

                          <div className="relative z-10">
                              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 shadow-lg border border-white/30 bg-white/20 backdrop-blur-sm`}>
                                 <span className="text-xs font-bold tracking-wider uppercase opacity-90">
                                    {selectedItem.code || selectedItem.collection}
                                 </span>
                                 <span className="text-lg font-black">
                                    #{selectedItem.number}
                                 </span>
                              </div>
                              
                              <h1 className="text-4xl md:text-5xl font-serif font-black text-white leading-tight mb-3 drop-shadow-lg">
                                  {selectedItem.title}
                              </h1>
                              
                              {selectedItem.author && (
                                <p className="text-white/90 italic text-sm font-medium drop-shadow">
                                    {selectedItem.author}
                                </p>
                              )}

                                                            {matchedSelectedStory && (
                                                                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                                                                    {selectedStoryReferenceLabels.slice(0, 4).map((label) => (
                                                                        <span
                                                                            key={label}
                                                                            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-white/15 text-white border border-white/25 backdrop-blur-sm"
                                                                        >
                                                                            {label}
                                                                        </span>
                                                                    ))}
                                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-white/15 text-white border border-white/25 backdrop-blur-sm">
                                                                        Story available
                                                                    </span>
                                                                </div>
                                                            )}
                          </div>
                      </div>

                      {/* Lyrics Body - Stanza Mapped */}
                      <div className="px-8 pb-16 pt-10 md:px-16 md:pb-20">
                        <div className="max-w-2xl mx-auto">
                            {stanzas.map((lines, i) => (
                                <div key={i} className="mb-10 last:mb-0 text-center animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                                    {lines.map((line, j) => (
                                        <div 
                                            key={j} 
                                            className="font-serif text-slate-800 leading-relaxed"
                                            style={{ 
                                                fontSize: `${fontSize}px`, 
                                                lineHeight: '1.6', 
                                                marginBottom: '0.5em' 
                                            }}
                                        >
                                            {line}
                                        </div>
                                    ))}
                                </div>
                            ))}

                            {matchedSelectedStory && showHymnStory && (
                                <div className="mt-12 rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 shadow-lg overflow-hidden animate-fade-in">
                                    <div className="px-6 py-4 border-b border-amber-200 bg-white/60 backdrop-blur-sm flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs uppercase tracking-[0.24em] text-amber-700/80 font-semibold">Story Behind This Hymn</p>
                                            <p className="text-sm text-slate-600 mt-1 font-medium">{matchedSelectedStory.writer} • {matchedSelectedStory.firstPublished}</p>
                                        </div>
                                        <a
                                            href={matchedSelectedStory.source}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs text-amber-700 hover:text-amber-900 underline underline-offset-2 font-semibold"
                                        >
                                            View source
                                        </a>
                                    </div>

                                    <div className="px-6 py-6 space-y-5 text-left">
                                        <div className="flex flex-wrap gap-2">
                                            {matchedSelectedStory.themes.map((theme) => (
                                                <span
                                                    key={theme}
                                                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-white text-amber-800 border border-amber-200"
                                                >
                                                    {theme}
                                                </span>
                                            ))}
                                        </div>

                                        <div className="font-serif text-slate-800 leading-8 text-[16px]">
                                            {matchedSelectedStory.story}
                                        </div>

                                        <div className="rounded-2xl border border-amber-200 bg-white/80 p-4">
                                            <p className="text-xs uppercase tracking-[0.2em] text-amber-800/80 font-semibold mb-2">Methodist Connection</p>
                                            <p className="font-serif text-slate-800 leading-7">{matchedSelectedStory.methodistConnection}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                      </div>

                      {/* Footer Metadata */}
                      {(selectedItem.tags || selectedItem.copyright) && (
                          <div className="bg-gradient-to-r from-slate-50 to-blue-50 p-6 text-center text-xs text-slate-500 border-t border-slate-100">
                              {selectedItem.copyright && <p className="mb-1 font-medium">© {selectedItem.copyright}</p>}
                          </div>
                      )}
                  </div>
              </div>

               {/* Toast */}
                <div className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${toast.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                    <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 font-bold text-sm border border-amber-400/50 backdrop-blur-sm">
                        <Star className="w-4 h-4 fill-white" />
                        {toast.message}
                    </div>
                </div>
          </div>
      )
  }

  // --- Render Main List View ---
  return (
    <div className="h-full flex flex-col bg-slate-50/50">
      
      {/* 1. Header Section */}
      <div className="sticky top-0 z-30 shadow-sm">
          {/* Hero Gradient Area */}
          <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white pt-6 pb-6 px-4 md:px-6">
              <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                      <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20 shadow-inner">
                          <Music className="w-8 h-8 text-blue-200" />
                      </div>
                      <div>
                          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                              Canticles & Hymns
                          </h1>
                          <p className="text-sm md:text-base text-blue-200 font-medium">
                              Methodist Church Ghana • {songs.length} Songs
                          </p>
                      </div>
                  </div>
              </div>
          </div>

          {/* Controls Bar (Tabs & Search) */}
          <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-4">
              <div className="max-w-5xl mx-auto space-y-4">
                  {/* Tabs */}
                  <div className="flex gap-2 p-1 bg-gray-50 rounded-full border border-gray-100 overflow-x-auto scrollbar-hide">
                      <TabButton id="favorites" label="Favorites" icon={Star} colorClass="bg-gradient-to-r from-amber-500 to-yellow-600" />
                      <TabButton id="hymns" label="MHB" icon={BookOpen} colorClass="bg-gradient-to-r from-blue-600 to-indigo-600" />
                      <TabButton id="canticles" label="Canticles" icon={PlayCircle} colorClass="bg-gradient-to-r from-purple-600 to-fuchsia-600" />
                      <TabButton id="can" label="CAN / Local" icon={Globe} colorClass="bg-gradient-to-r from-teal-500 to-emerald-600" />
                      <TabButton id="all" label="All Songs" icon={List} colorClass="bg-gradient-to-r from-gray-700 to-slate-800" />
                  </div>

                  {/* Search */}
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input 
                        type="text"
                        placeholder={activeTab === 'canticles' ? "Search canticles by title, code, or phrase..." : "Search by number, title, code, or any lyric phrase..."}
                        className="block w-full pl-12 pr-4 py-3 bg-slate-50 border-none text-gray-900 placeholder-gray-400 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:shadow-lg transition-all duration-300 text-base shadow-inner"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button 
                            onClick={() => setSearchQuery('')}
                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-5 h-5 bg-gray-200 rounded-full p-1" />
                        </button>
                    )}
                  </div>
              </div>
          </div>
      </div>

      {/* 2. Error Message */}
      {errorMsg && (
        <div className="max-w-5xl mx-auto px-4 mt-6">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-700 shadow-sm">
                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                    <h3 className="font-bold text-sm">Error Loading Songs</h3>
                    <p className="text-sm mt-1">{errorMsg}</p>
                </div>
            </div>
        </div>
      )}

      {/* 3. Song Grid */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-5xl mx-auto min-h-full">
              {loading ? (
                  <div className="flex flex-col items-center justify-center h-64">
                      <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4"/>
                      <p className="text-slate-400 font-medium">Loading hymnal...</p>
                  </div>
              ) : filteredItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                          {activeTab === 'favorites' ? <Star className="w-8 h-8 text-slate-300" /> : <Music className="w-8 h-8 text-slate-300" />}
                      </div>
                      <h3 className="text-lg font-bold text-slate-700 mb-1">
                          {activeTab === 'favorites' ? 'No favorites yet' : 'No songs found'}
                      </h3>
                      <p className="text-slate-500 text-sm">
                          {activeTab === 'favorites' ? 'Star songs to see them here.' : 'Try searching for something else.'}
                      </p>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
                      {filteredItems.map((item) => {
                          const styles = getCollectionStyle(item.collection);
                          const storyMatch = findHymnStoryForSong(item, BUNDLED_HYMN_STORIES);
                          return (
                              <div 
                                key={item.id} 
                                onClick={() => setSelectedItem(item)}
                                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-blue-100 hover:-translate-y-1 transition-all duration-300 cursor-pointer group flex items-start gap-4 relative"
                              >
                                  {/* Left: Gradient Badge */}
                                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${styles.gradient} text-white shadow-md flex flex-col items-center justify-center flex-shrink-0`}>
                                      <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">
                                          {item.collection === 'CANTICLES_EN' ? 'CANT' : (item.collection === 'General' ? 'GEN' : item.collection)}
                                      </span>
                                      <span className="text-lg font-black leading-none mt-0.5">
                                          {item.number}
                                      </span>
                                  </div>

                                  {/* Center: Info */}
                                  <div className="flex-1 min-w-0 py-0.5 pr-8">
                                      <h3 className={`text-base font-semibold text-gray-800 group-hover:${styles.text} transition-colors truncate mb-1`}>
                                          {item.title}
                                      </h3>
                                      <p className="text-xs text-gray-400 font-medium line-clamp-1">
                                          {getPreviewText(item.lyrics)}
                                      </p>
                                      {storyMatch && (
                                          <p className="text-[11px] text-amber-700 font-semibold mt-2 inline-flex items-center gap-1 bg-amber-50 border border-amber-100 px-2 py-1 rounded-full">
                                              <BookOpen className="w-3.5 h-3.5" /> Story available
                                          </p>
                                      )}
                                  </div>

                                  {/* Star Button */}
                                  <button 
                                      onClick={(e) => toggleFavorite(e, item)}
                                      className={`absolute top-4 right-4 p-1.5 rounded-full transition-colors z-10 
                                        ${item.is_favorite 
                                            ? 'text-amber-400 hover:bg-amber-50' 
                                            : 'text-gray-200 hover:text-amber-400 hover:bg-gray-50'
                                        }`}
                                  >
                                      <Star className={`w-5 h-5 ${item.is_favorite ? 'fill-amber-400' : ''}`} />
                                  </button>
                              </div>
                          );
                      })}
                  </div>
              )}
          </div>
      </div>

       {/* Toast */}
        <div className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${toast.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
            <div className="bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 font-medium text-sm">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                {toast.message}
            </div>
        </div>

    </div>
  );
};

export default Hymnal;

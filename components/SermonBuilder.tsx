
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Sermon, Song, ServiceHymnAiGuidance, ServiceHymnPlanRecord, ServiceHymnSelection, ServiceHymnSlot } from '../types';
import { generateServiceHymnGuidance, generateSermonOutline, generateSermonSection, getAiErrorMessage, getAiFeatureStatus, ServiceHymnAiPlan } from '../services/geminiService';
import { 
  BookOpen, Mic, MicOff, Wand2, Save, Trash2,
  Plus, X, Loader2, ChevronLeft, PenTool, Download,
  Scroll, FileText, Calendar, Sparkles, MoreHorizontal,
    ChevronRight, Book, Music, RefreshCw, CheckCircle2
} from 'lucide-react';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

type SuggestedHymnOption = {
    song: {
        id: number;
        collection: string;
        code: string;
        number: number | null;
        title: string;
        lyrics: string;
    };
    score: number;
    reasons: string[];
};

type ServiceHymnSlotState = {
    options: SuggestedHymnOption[];
    selectedSongId: number | null;
    visibleStart: number;
};

type ServiceHymnPlan = Record<ServiceHymnSlot, ServiceHymnSlotState>;

type ServiceHymnSlotMeta = {
    label: string;
    shortLabel: string;
    description: string;
    keywords: string[];
};

type HymnalNavigationSelection = {
    songId: number;
    collection: string;
    code: string;
    number: number | null;
    title: string;
    targetTab: 'hymns' | 'canticles' | 'can' | 'all' | 'favorites';
};

const HYMN_FETCH_BATCH_SIZE = 1000;
const HYMN_OPTION_LIMIT = 12;
const HYMN_OPTION_PAGE_SIZE = 4;

const SERVICE_HYMN_SLOT_ORDER: ServiceHymnSlot[] = ['opening', 'scripture', 'sermon', 'closing'];

const SERVICE_HYMN_SLOT_META: Record<ServiceHymnSlot, ServiceHymnSlotMeta> = {
    opening: {
        label: 'Opening Hymn of Adoration',
        shortLabel: 'Opening',
        description: 'Begin worship with praise, holiness, thanksgiving, and adoration.',
        keywords: ['adoration', 'adore', 'worship', 'praise', 'glory', 'holy', 'hallelujah', 'thanksgiving', 'bless', 'majesty', 'king', 'lord'],
    },
    scripture: {
        label: 'Scripture Reading Hymn',
        shortLabel: 'Scripture',
        description: 'Prepare the congregation to hear the Word of God with reverence and attentiveness.',
        keywords: ['word', 'scripture', 'speak', 'voice', 'truth', 'light', 'lamp', 'teach', 'wisdom', 'hear', 'open', 'guide', 'gospel', 'bible'],
    },
    sermon: {
        label: 'Sermon Hymn',
        shortLabel: 'Sermon',
        description: 'Reinforce the sermon theme, reading, and call to response.',
        keywords: ['faith', 'grace', 'hope', 'love', 'cross', 'jesus', 'spirit', 'salvation', 'trust', 'walk', 'follow', 'victory', 'mercy', 'repentance'],
    },
    closing: {
        label: 'Closing Hymn',
        shortLabel: 'Closing',
        description: 'Send the congregation out in commitment, dedication, prayer, and mission.',
        keywords: ['commitment', 'dedication', 'send', 'service', 'guide', 'follow', 'walk', 'lead', 'go', 'mission', 'take my life', 'benediction', 'blessing'],
    },
};

const HYMN_COLLECTION_PRIORITY: Record<string, number> = {
    MHB: 40,
    HYMNS: 40,
    GENERAL: 36,
    SONGS: 30,
    CAN: 28,
    LOCAL: 24,
    GHANA: 24,
};

const HYMN_SEARCH_STOP_WORDS = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'ours', 'their', 'have', 'will', 'shall', 'when', 'then', 'them', 'they', 'unto', 'upon', 'about', 'through', 'there', 'here', 'were', 'been', 'being', 'than', 'over', 'under', 'more', 'most', 'very', 'also', 'does', 'did', 'our', 'you', 'his', 'her', 'its', 'who', 'what', 'where', 'why', 'how', 'let', 'come'
]);

const createEmptyServiceHymnPlan = (): ServiceHymnPlan => ({
    opening: { options: [], selectedSongId: null, visibleStart: 0 },
    scripture: { options: [], selectedSongId: null, visibleStart: 0 },
    sermon: { options: [], selectedSongId: null, visibleStart: 0 },
    closing: { options: [], selectedSongId: null, visibleStart: 0 },
});

const normalizeHymnPlannerText = (value: string | number | null | undefined) =>
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

const tokenizeHymnPlannerText = (value: string | number | null | undefined) =>
    normalizeHymnPlannerText(value)
        .split(' ')
        .filter((token) => token.length > 2 && !/^\d+$/u.test(token) && !HYMN_SEARCH_STOP_WORDS.has(token));

const normalizeHymnCollection = (value: string | null | undefined) => String(value ?? '').trim().toUpperCase();

const isCanticleCollection = (value: string | null | undefined) => normalizeHymnCollection(value).includes('CANTICLE');

const compareSuggestedHymnSongs = (left: SuggestedHymnOption, right: SuggestedHymnOption) => {
    if (left.score !== right.score) {
        return right.score - left.score;
    }

    const leftCollectionPriority = HYMN_COLLECTION_PRIORITY[normalizeHymnCollection(left.song.collection)] ?? 0;
    const rightCollectionPriority = HYMN_COLLECTION_PRIORITY[normalizeHymnCollection(right.song.collection)] ?? 0;
    if (leftCollectionPriority !== rightCollectionPriority) {
        return rightCollectionPriority - leftCollectionPriority;
    }

    const leftNumber = left.song.number ?? Number.MAX_SAFE_INTEGER;
    const rightNumber = right.song.number ?? Number.MAX_SAFE_INTEGER;
    if (leftNumber !== rightNumber) {
        return leftNumber - rightNumber;
    }

    return left.song.title.localeCompare(right.song.title);
};

const getHymnReferenceLabel = (song: Pick<SuggestedHymnOption['song'], 'collection' | 'code' | 'number'>) => {
    if (song.code) return song.code;
    if (song.number !== null && song.number !== undefined) return `${song.collection} ${song.number}`;
    return song.collection;
};

const getFirstMeaningfulLyricLine = (lyrics: string | null | undefined) => {
    const lines = String(lyrics ?? '').split(/\r?\n/u);

    for (const line of lines) {
        let text = line.trim();
        if (!text) continue;
        if (/^[-0-9\s]*(Verse|Stanza|Hymn)\s*\d*/iu.test(text)) continue;
        if (/^\d+\.?$/u.test(text)) continue;
        if (/^[-]\d+/u.test(text)) {
            text = text.replace(/^[-]\d+/u, '').trim();
        }
        if (text) return text;
    }

    return '';
};

const getVisibleSuggestedHymns = (slotState: ServiceHymnSlotState) => {
    if (slotState.options.length <= HYMN_OPTION_PAGE_SIZE) {
        return slotState.options;
    }

    const end = slotState.visibleStart + HYMN_OPTION_PAGE_SIZE;
    if (end <= slotState.options.length) {
        return slotState.options.slice(slotState.visibleStart, end);
    }

    return [
        ...slotState.options.slice(slotState.visibleStart),
        ...slotState.options.slice(0, end - slotState.options.length),
    ];
};

const matchesPlannerToken = (text: string, tokenSet: Set<string>, token: string) => {
    if (!token) return false;
    if (tokenSet.has(token)) return true;
    if (text.includes(token)) return true;

    for (const candidateToken of tokenSet) {
        if (candidateToken.startsWith(token) || token.startsWith(candidateToken)) {
            return true;
        }
    }

    return false;
};

const SermonBuilder: React.FC = () => {
    const navigate = useNavigate();
  const [mode, setMode] = useState<'list' | 'edit'>('list');
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [loading, setLoading] = useState(false);
    const aiFeatureStatus = getAiFeatureStatus();
  
  // Loading states
  const [fullAiLoading, setFullAiLoading] = useState(false);
  const [generatingSection, setGeneratingSection] = useState<string | null>(null); // Tracks which specific field is loading
  
  const [listeningField, setListeningField] = useState<string | null>(null);

  // Form State initialized with 12-point structure
  const [currentSermon, setCurrentSermon] = useState<Partial<Sermon>>({
    title: '',
    theme: '',
    main_scripture: '',
    introduction: '',
    background_context: '',
    main_point_1: '',
    main_point_2: '',
    main_point_3: '',
    application_points: [],
    gospel_connection: '',
    conclusion: '',
    prayer_points: [],
    altar_call: ''
  });
    const [hymnLibrary, setHymnLibrary] = useState<Song[]>([]);
    const [hymnPlannerLoading, setHymnPlannerLoading] = useState(false);
    const [hymnPlannerAiLoading, setHymnPlannerAiLoading] = useState(false);
    const [hymnPlannerError, setHymnPlannerError] = useState<string | null>(null);
    const [serviceHymnPlan, setServiceHymnPlan] = useState<ServiceHymnPlan>(() => createEmptyServiceHymnPlan());
    const [hymnPlanContextSignature, setHymnPlanContextSignature] = useState('');
    const [serviceHymnAiPlan, setServiceHymnAiPlan] = useState<ServiceHymnAiPlan | null>(null);
    const [isHymnPlannerCollapsed, setIsHymnPlannerCollapsed] = useState(false);

    const currentHymnContextSignature = normalizeHymnPlannerText([
        currentSermon.title,
        currentSermon.theme,
        currentSermon.main_scripture,
    ].filter(Boolean).join(' | '));

    const hasGeneratedHymnPlan = SERVICE_HYMN_SLOT_ORDER.some((slot) => serviceHymnPlan[slot].options.length > 0);
    const hymnPlanIsStale = hasGeneratedHymnPlan && hymnPlanContextSignature !== currentHymnContextSignature;

    const getSelectedHymnOption = (slot: ServiceHymnSlot) =>
        serviceHymnPlan[slot].options.find((option) => option.song.id === serviceHymnPlan[slot].selectedSongId) ?? null;

    const selectedServiceHymns = SERVICE_HYMN_SLOT_ORDER.flatMap((slot) => {
        const selectedOption = getSelectedHymnOption(slot);
        return selectedOption
            ? [{ slot, selectedOption, meta: SERVICE_HYMN_SLOT_META[slot] }]
            : [];
    });
    const hasSelectedServiceHymns = selectedServiceHymns.length > 0;

    const resetHymnPlanner = () => {
        setServiceHymnPlan(createEmptyServiceHymnPlan());
        setHymnPlannerError(null);
        setHymnPlanContextSignature('');
        setServiceHymnAiPlan(null);
        setIsHymnPlannerCollapsed(false);
    };

    const getHymnalTabForCollection = (collection: string | null | undefined): HymnalNavigationSelection['targetTab'] => {
        const normalizedCollection = normalizeHymnCollection(collection);

        if (normalizedCollection === 'MHB' || normalizedCollection === 'HYMNS' || normalizedCollection === 'GENERAL' || normalizedCollection === 'SONGS') {
            return 'hymns';
        }

        if (normalizedCollection.includes('CANTICLE')) {
            return 'canticles';
        }

        if (normalizedCollection === 'CAN' || normalizedCollection === 'LOCAL' || normalizedCollection === 'GHANA') {
            return 'can';
        }

        return 'all';
    };

    const openSuggestedHymnInHymnal = (option: SuggestedHymnOption) => {
        const selection: HymnalNavigationSelection = {
            songId: option.song.id,
            collection: option.song.collection,
            code: option.song.code,
            number: option.song.number,
            title: option.song.title,
            targetTab: getHymnalTabForCollection(option.song.collection),
        };

        navigate('/hymnal', {
            state: {
                hymnSelection: selection,
            },
        });
    };

    const buildPersistedServiceHymns = (): ServiceHymnPlanRecord | null => {
        if (!selectedServiceHymns.length) {
            return null;
        }

        const selections: ServiceHymnSelection[] = selectedServiceHymns.map(({ slot, selectedOption }) => ({
            slot,
            songId: selectedOption.song.id,
            collection: selectedOption.song.collection,
            code: selectedOption.song.code,
            number: selectedOption.song.number,
            title: selectedOption.song.title,
            previewLine: getFirstMeaningfulLyricLine(selectedOption.song.lyrics) || null,
            reasons: selectedOption.reasons,
        }));

        const aiGuidance = serviceHymnAiPlan
            ? SERVICE_HYMN_SLOT_ORDER.reduce<Partial<Record<ServiceHymnSlot, ServiceHymnAiGuidance>>>((accumulator, slot) => {
                accumulator[slot] = serviceHymnAiPlan[slot];
                return accumulator;
            }, {})
            : undefined;

        return {
            selections,
            generatedAt: new Date().toISOString(),
            generatedFrom: {
                title: currentSermon.title || '',
                theme: currentSermon.theme || '',
                main_scripture: currentSermon.main_scripture || '',
            },
            aiAssisted: Boolean(serviceHymnAiPlan),
            ...(aiGuidance ? { aiGuidance } : {}),
        };
    };

    const restoreHymnPlanFromRecord = (record: ServiceHymnPlanRecord | null | undefined) => {
        if (!record?.selections?.length) {
            resetHymnPlanner();
            return;
        }

        const nextPlan = createEmptyServiceHymnPlan();
        for (const selection of record.selections) {
            nextPlan[selection.slot] = {
                options: [
                    {
                        song: {
                            id: selection.songId,
                            collection: selection.collection,
                            code: selection.code,
                            number: selection.number,
                            title: selection.title,
                            lyrics: selection.previewLine || '',
                        },
                        score: 1,
                        reasons: selection.reasons ?? [],
                    },
                ],
                selectedSongId: selection.songId,
                visibleStart: 0,
            };
        }

        setServiceHymnPlan(nextPlan);
        setServiceHymnAiPlan(record.aiGuidance ? ({ ...record.aiGuidance } as ServiceHymnAiPlan) : null);
        setHymnPlannerError(null);
        setIsHymnPlannerCollapsed(true);
        setHymnPlanContextSignature(normalizeHymnPlannerText([
            record.generatedFrom?.title,
            record.generatedFrom?.theme,
            record.generatedFrom?.main_scripture,
        ].filter(Boolean).join(' | ')));
    };

  useEffect(() => {
    fetchSermons();
  }, []);

  const fetchSermons = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sermons')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data && !error) setSermons(data);
    setLoading(false);
  };

    const loadHymnLibrary = async () => {
        if (hymnLibrary.length) {
            return hymnLibrary;
        }

        const loadedSongs: Song[] = [];

        for (let from = 0; ; from += HYMN_FETCH_BATCH_SIZE) {
            const { data, error } = await supabase
                .from('songs')
                .select('id, collection, code, number, title, raw_title, lyrics, author, tags, reference_number')
                .order('number', { ascending: true })
                .order('id', { ascending: true })
                .range(from, from + HYMN_FETCH_BATCH_SIZE - 1);

            if (error) {
                throw error;
            }

            if (!data?.length) {
                break;
            }

            loadedSongs.push(...(data as Song[]));

            if (data.length < HYMN_FETCH_BATCH_SIZE) {
                break;
            }
        }

        const filteredSongs = loadedSongs.filter((song) => !isCanticleCollection(song.collection));
        setHymnLibrary(filteredSongs);
        return filteredSongs;
    };

    const buildSuggestedOptionsForSlot = (slot: ServiceHymnSlot, songs: Song[], aiGuidance?: ServiceHymnAiGuidance | null) => {
        const slotMeta = SERVICE_HYMN_SLOT_META[slot];
        const titlePhrase = normalizeHymnPlannerText(currentSermon.title);
        const themePhrase = normalizeHymnPlannerText(currentSermon.theme);
        const scripturePhrase = normalizeHymnPlannerText(currentSermon.main_scripture);
        const contextTokens = Array.from(new Set([
            ...tokenizeHymnPlannerText(currentSermon.title),
            ...tokenizeHymnPlannerText(currentSermon.theme),
            ...tokenizeHymnPlannerText(currentSermon.main_scripture),
        ]));
        const aiFocusText = normalizeHymnPlannerText(aiGuidance?.focus);
        const aiRationaleText = normalizeHymnPlannerText(aiGuidance?.rationale);
        const aiKeywords = (aiGuidance?.keywords ?? []).map((keyword) => normalizeHymnPlannerText(keyword)).filter(Boolean);

        const matchedOptions = songs
            .map((song) => {
                const collectionKey = normalizeHymnCollection(song.collection);
                const titleText = normalizeHymnPlannerText(song.title);
                const rawTitleText = normalizeHymnPlannerText(song.raw_title);
                const lyricsText = normalizeHymnPlannerText(song.lyrics);
                const codeText = normalizeHymnPlannerText(song.code);
                const authorText = normalizeHymnPlannerText(song.author);
                const tagsText = normalizeHymnPlannerText(song.tags);
                const referenceText = normalizeHymnPlannerText(song.reference_number);
                const combinedText = [titleText, rawTitleText, lyricsText, codeText, collectionKey.toLowerCase(), authorText, tagsText, referenceText]
                    .filter(Boolean)
                    .join(' ');
                const tokenSet = new Set(combinedText.split(' ').filter(Boolean));
                const normalizedSlotKeywords = Array.from(new Set([
                    ...slotMeta.keywords.map((keyword) => normalizeHymnPlannerText(keyword)).filter(Boolean),
                    ...aiKeywords,
                    ...tokenizeHymnPlannerText(aiFocusText),
                    ...tokenizeHymnPlannerText(aiRationaleText),
                ]));

                const roleMatches = normalizedSlotKeywords.filter((keyword) => matchesPlannerToken(combinedText, tokenSet, keyword));
                const contextMatches = contextTokens.filter((token) => matchesPlannerToken(combinedText, tokenSet, token));
                const aiFocusMatch = Boolean(aiFocusText) && combinedText.includes(aiFocusText);
                const aiRationaleMatch = Boolean(aiRationaleText) && combinedText.includes(aiRationaleText);
                const themePhraseMatch = Boolean(themePhrase) && (titleText.includes(themePhrase) || lyricsText.includes(themePhrase) || combinedText.includes(themePhrase));
                const titlePhraseMatch = Boolean(titlePhrase) && titlePhrase.length > 3 && (titleText.includes(titlePhrase) || lyricsText.includes(titlePhrase));
                const scripturePhraseMatch = Boolean(scripturePhrase) && scripturePhrase.length > 3 && combinedText.includes(scripturePhrase);
                const titleRoleMatches = roleMatches.filter((keyword) => titleText.includes(keyword) || rawTitleText.includes(keyword));
                const hasSignal = roleMatches.length > 0 || contextMatches.length > 0 || themePhraseMatch || titlePhraseMatch || scripturePhraseMatch || aiFocusMatch || aiRationaleMatch;

                let score = HYMN_COLLECTION_PRIORITY[collectionKey] ?? 10;
                score += roleMatches.length * (slot === 'opening' || slot === 'closing' ? 55 : 40);
                score += titleRoleMatches.length * 24;
                score += contextMatches.length * (slot === 'sermon' ? 42 : 26);
                if (themePhraseMatch) score += slot === 'sermon' ? 180 : 90;
                if (titlePhraseMatch) score += slot === 'sermon' ? 140 : 70;
                if (scripturePhraseMatch) score += slot === 'scripture' ? 120 : 55;
                if (aiFocusMatch) score += 70;
                if (aiRationaleMatch) score += 40;

                const reasons = Array.from(new Set([
                    roleMatches.length > 0 ? `Fits ${slotMeta.shortLabel.toLowerCase()} worship tone` : '',
                    themePhraseMatch && currentSermon.theme ? `Theme: ${currentSermon.theme}` : '',
                    titlePhraseMatch && currentSermon.title ? `Title: ${currentSermon.title}` : '',
                    scripturePhraseMatch && currentSermon.main_scripture ? `Reading: ${currentSermon.main_scripture}` : '',
                    aiGuidance?.focus ? `AI focus: ${aiGuidance.focus}` : '',
                    !themePhraseMatch && !titlePhraseMatch && contextMatches.length > 0 ? `Matches: ${contextMatches.slice(0, 2).join(', ')}` : '',
                ].filter(Boolean))).slice(0, 3);

                return {
                    song: {
                        id: song.id,
                        collection: song.collection,
                        code: song.code,
                        number: song.number,
                        title: song.title,
                        lyrics: song.lyrics,
                    },
                    score: hasSignal ? score : -1,
                    reasons,
                } satisfies SuggestedHymnOption;
            })
            .filter((option) => option.score > 0)
            .sort(compareSuggestedHymnSongs)
            .slice(0, HYMN_OPTION_LIMIT);

        if (matchedOptions.length > 0) {
            return matchedOptions;
        }

        return songs
            .map((song) => ({
                song: {
                    id: song.id,
                    collection: song.collection,
                    code: song.code,
                    number: song.number,
                    title: song.title,
                    lyrics: song.lyrics,
                },
                score: HYMN_COLLECTION_PRIORITY[normalizeHymnCollection(song.collection)] ?? 10,
                reasons: [`General ${slotMeta.shortLabel.toLowerCase()} hymn option`],
            }))
            .sort(compareSuggestedHymnSongs)
            .slice(0, HYMN_OPTION_LIMIT);
    };

    const generateHymnSuggestions = async (aiPlan?: ServiceHymnAiPlan | null) => {
        if (!currentSermon.title && !currentSermon.theme && !currentSermon.main_scripture) {
            alert('Add at least a sermon title, theme, or scripture before generating hymn suggestions.');
            return;
        }

        setHymnPlannerLoading(true);
        setHymnPlannerError(null);

        try {
            const songs = await loadHymnLibrary();
            if (!songs.length) {
                throw new Error('No hymns were found in the songs table for suggestions.');
            }

            const nextPlan = createEmptyServiceHymnPlan();
            const usedSongIds = new Set<number>();

            for (const slot of SERVICE_HYMN_SLOT_ORDER) {
                const options = buildSuggestedOptionsForSlot(slot, songs, aiPlan?.[slot] ?? null);
                const initialSelection = options.find((option) => !usedSongIds.has(option.song.id)) ?? options[0] ?? null;

                if (initialSelection) {
                    usedSongIds.add(initialSelection.song.id);
                }

                nextPlan[slot] = {
                    options,
                    selectedSongId: initialSelection?.song.id ?? null,
                    visibleStart: 0,
                };
            }

            setServiceHymnPlan(nextPlan);
            setHymnPlanContextSignature(currentHymnContextSignature);
        } catch (error: any) {
            console.error('Hymn suggestion error:', error);
            setHymnPlannerError(error.message || 'Could not load hymn suggestions right now.');
        } finally {
            setHymnPlannerLoading(false);
        }
    };

    const handleGenerateHymnSuggestions = async () => {
        setServiceHymnAiPlan(null);
        await generateHymnSuggestions(null);
    };

    const handleGenerateAiHymnSuggestions = async () => {
        if (!currentSermon.title && !currentSermon.theme && !currentSermon.main_scripture) {
            alert('Add at least a sermon title, theme, or scripture before generating hymn suggestions.');
            return;
        }

        setHymnPlannerAiLoading(true);
        setHymnPlannerError(null);

        try {
            const aiPlan = await generateServiceHymnGuidance(
                currentSermon.title || '',
                currentSermon.theme || '',
                currentSermon.main_scripture || ''
            );

            if (!aiPlan) {
                throw new Error(getAiErrorMessage('Could not generate AI hymn guidance right now.'));
            }

            setServiceHymnAiPlan(aiPlan);
            await generateHymnSuggestions(aiPlan);
        } catch (error: any) {
            console.error('AI hymn suggestion error:', error);
            setHymnPlannerError(error.message || 'Could not generate AI hymn guidance right now.');
        } finally {
            setHymnPlannerAiLoading(false);
        }
    };

    const selectSuggestedHymn = (slot: ServiceHymnSlot, songId: number) => {
        setServiceHymnPlan((prev) => ({
            ...prev,
            [slot]: {
                ...prev[slot],
                selectedSongId: songId,
            },
        }));
    };

    const showNextSuggestedHymns = (slot: ServiceHymnSlot) => {
        setServiceHymnPlan((prev) => {
            const slotState = prev[slot];
            if (slotState.options.length <= HYMN_OPTION_PAGE_SIZE) {
                return prev;
            }

            return {
                ...prev,
                [slot]: {
                    ...slotState,
                    visibleStart: (slotState.visibleStart + HYMN_OPTION_PAGE_SIZE) % slotState.options.length,
                },
            };
        });
    };

  // --- Word Export Logic ---
  const handleExportWord = () => {
    const s = currentSermon;
        const selectedHymnSummary = selectedServiceHymns.length
            ? `
                <h2>Suggested Service Hymns</h2>
                <ul>
                    ${selectedServiceHymns.map(({ meta, selectedOption }) => `<li><strong>${meta.label}:</strong> ${getHymnReferenceLabel(selectedOption.song)} - ${selectedOption.song.title}</li>`).join('')}
                </ul>
            `
            : '';
    
    // Construct HTML suitable for Word
    const content = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${s.title}</title>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; }
          h1 { font-size: 16pt; text-align: center; font-weight: bold; margin-bottom: 24pt; text-transform: uppercase; }
          h2 { font-size: 14pt; font-weight: bold; margin-top: 18pt; margin-bottom: 6pt; }
          h3 { font-size: 13pt; font-weight: bold; margin-top: 12pt; }
          p { margin-bottom: 12pt; }
          .church-header { text-align: center; font-weight: bold; margin-bottom: 40px; }
          .section-label { font-weight: bold; text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="church-header">
          THE METHODIST CHURCH GHANA<br>
          NORTH AMERICA DIOCESE<br>
          CANADA CIRCUIT
        </div>

        <h1>${s.title || 'Untitled Sermon'}</h1>

        <p><span class="section-label">2. Scripture Text:</span> ${s.main_scripture || ''}</p>
        <p><span class="section-label">Theme:</span> ${s.theme || ''}</p>
        ${selectedHymnSummary}

        <h2>3. Introduction</h2>
        <p>${(s.introduction || '').replace(/\n/g, '<br>')}</p>

        <h2>4. Background / Context</h2>
        <p>${(s.background_context || '').replace(/\n/g, '<br>')}</p>

        <h2>5. Main Point 1 — Explain the text</h2>
        <p>${(s.main_point_1 || '').replace(/\n/g, '<br>')}</p>

        <h2>6. Main Point 2 — Show how it applies</h2>
        <p>${(s.main_point_2 || '').replace(/\n/g, '<br>')}</p>

        <h2>7. Main Point 3 — Call to transformation</h2>
        <p>${(s.main_point_3 || '').replace(/\n/g, '<br>')}</p>

        <h2>8. Practical Applications</h2>
        <ul>
          ${(s.application_points || []).map(p => `<li>${p}</li>`).join('')}
        </ul>

        <h2>9. Gospel Connection</h2>
        <p>${(s.gospel_connection || '').replace(/\n/g, '<br>')}</p>

        <h2>10. Conclusion</h2>
        <p>${(s.conclusion || '').replace(/\n/g, '<br>')}</p>

        <h2>11. Closing Prayer</h2>
        <ul>
          ${(s.prayer_points || []).map(p => `<li>${p}</li>`).join('')}
        </ul>

        <h2>12. Altar Call / Response</h2>
        <p>${(s.altar_call || '').replace(/\n/g, '<br>')}</p>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', content], {
      type: 'application/msword'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${s.title || 'sermon'}.doc`; // .doc opens nicely in Word
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Voice to Text Logic ---
  const toggleListening = (fieldName: string) => {
    if (listeningField === fieldName) {
      stopListening();
    } else {
      startListening(fieldName);
    }
  };

  const startListening = (fieldName: string) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setListeningField(fieldName);
    };

    recognition.onend = () => {
      setListeningField(null);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      handleVoiceInput(fieldName, transcript);
    };

    recognition.start();
  };

  const stopListening = () => {
    setListeningField(null);
  };

  const handleVoiceInput = (fieldName: string, text: string) => {
    // Array handling
    if (fieldName === 'application_points' || fieldName === 'prayer_points') {
       const listKey = fieldName as keyof Sermon;
       const currentList = (currentSermon[listKey] as string[]) || [];
       setCurrentSermon(prev => ({ ...prev, [listKey]: [...currentList, text] }));
       return;
    }
    
    // Text handling
    setCurrentSermon(prev => ({
      ...prev,
      [fieldName]: (prev[fieldName as keyof Sermon] as string || '') + ' ' + text
    }));
  };

  // --- AI Generation (Full) ---
  const handleFullAiGenerate = async () => {
    if (!currentSermon.title || !currentSermon.main_scripture) {
      alert("Please enter a Title and Scripture to generate an outline.");
      return;
    }

    setFullAiLoading(true);
    try {
        const result = await generateSermonOutline(
          currentSermon.title, 
          currentSermon.theme || 'General', 
          currentSermon.main_scripture
        );

        if (result) {
          setCurrentSermon(prev => ({
              ...prev,
              ...result
          }));
        } else {
            alert(getAiErrorMessage('AI outline generation failed. Please try again.'));
        }
    } catch (e) {
        console.error(e);
        alert(getAiErrorMessage('An error occurred during generation.'));
    }
    setFullAiLoading(false);
  };

  // --- AI Generation (Section) ---
  const handleSectionAi = async (field: keyof Sermon, sectionLabel: string) => {
    if (!currentSermon.title || !currentSermon.main_scripture) {
        alert("Please enter a Title and Scripture first, so the AI knows the context.");
        return;
    }

    setGeneratingSection(field as string);
    const currentText = currentSermon[field] as string || '';
    
    try {
        const result = await generateSermonSection(
            currentSermon.title, 
            currentSermon.theme || '', 
            currentSermon.main_scripture, 
            sectionLabel, 
            currentText
        );

        if (result) {
            setCurrentSermon(prev => ({
                ...prev,
                [field]: result
            }));
        } else {
            alert(getAiErrorMessage('Could not generate this sermon section right now.'));
        }
    } catch (e) {
        console.error(e);
        alert(getAiErrorMessage('Could not generate this sermon section right now.'));
    }
    setGeneratingSection(null);
  };

  // --- Database Ops ---
  const handleSave = async () => {
    if (!currentSermon.title) {
        alert("Title is required.");
        return;
    }

    try {
        const sermonPayload: Partial<Sermon> = {
            ...currentSermon,
            service_hymns: buildPersistedServiceHymns(),
        };

        if (currentSermon.id) {
            // Update
            const { error } = await supabase.from('sermons').update(sermonPayload).eq('id', currentSermon.id);
            if (error) throw error;
            fetchSermons();
            setMode('list');
        } else {
            // Create
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, ...newSermonData } = sermonPayload;
            const { error } = await supabase.from('sermons').insert([newSermonData]);
            if (error) throw error;
            fetchSermons();
            setMode('list');
        }
    } catch (err: any) {
        console.error("Save Error:", err);
        const message = String(err?.message || 'Unknown save error');
        if (/service_hymns/iu.test(message) && /column|schema cache/iu.test(message)) {
            alert(`Failed to save hymn selections because the sermons table does not have the service_hymns column yet. Run sql/sermons_service_hymns.sql, then save again.\n\nFull error: ${message}`);
            return;
        }

        alert("Failed to save sermon: " + message);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if(!window.confirm("Delete this sermon?")) return;
      await supabase.from('sermons').delete().eq('id', id);
      fetchSermons();
  };

  const createNew = () => {
      setCurrentSermon({
        title: '', theme: '', main_scripture: '', introduction: '', background_context: '',
        main_point_1: '', main_point_2: '', main_point_3: '',
        application_points: [], gospel_connection: '', conclusion: '',
                prayer_points: [], altar_call: '', service_hymns: null,
      });
      resetHymnPlanner();
      setMode('edit');
  };

  const editSermon = (sermon: Sermon) => {
      setCurrentSermon(sermon);
            restoreHymnPlanFromRecord(sermon.service_hymns);
      setMode('edit');
  };

  // --- Array Helper Functions ---
  const updateList = (key: keyof Sermon, index: number, value: string) => {
    const list = [...(currentSermon[key] as string[])];
    list[index] = value;
    setCurrentSermon({...currentSermon, [key]: list});
  };

  const addToList = (key: keyof Sermon) => {
    const list = [...((currentSermon[key] as string[]) || [])];
    list.push('');
    setCurrentSermon({...currentSermon, [key]: list});
  };

  const removeFromList = (key: keyof Sermon, index: number) => {
    const list = [...(currentSermon[key] as string[])];
    list.splice(index, 1);
    setCurrentSermon({...currentSermon, [key]: list});
  };

  // --- Render ---

  if (mode === 'list') {
      return (
          <div className="max-w-[1600px] mx-auto pb-16 animate-fade-in space-y-10">
              
              {/* 1. Inspirational Header */}
              <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 text-white shadow-2xl min-h-[220px] flex items-center">
                  {/* Decorative Texture */}
                  <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/leather.png')]"></div>
                  <div className="absolute top-0 right-0 p-12 opacity-5 transform rotate-12 translate-x-10 -translate-y-10">
                      <Scroll className="w-64 h-64 text-white" />
                  </div>

                  <div className="relative z-10 w-full p-8 md:p-12 flex flex-col md:flex-row justify-between items-center gap-6">
                      <div>
                          <div className="flex items-center gap-3 mb-3 text-indigo-300 font-medium tracking-widest text-xs uppercase">
                              <PenTool className="w-4 h-4" /> 
                              Methodist Pulpit Planner
                          </div>
                          <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-2 tracking-tight">
                              Sermon Builder
                          </h1>
                          <p className="text-indigo-200 text-lg font-light max-w-xl">
                              Prepare messages of hope, truth, and transformation.
                          </p>
                      </div>

                      <button 
                          onClick={createNew} 
                          className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-amber-500 hover:bg-amber-400 text-amber-950 rounded-full font-bold text-lg shadow-lg hover:shadow-amber-500/30 transition-all transform hover:-translate-y-1 active:translate-y-0 overflow-hidden"
                      >
                          <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                          <Plus className="w-6 h-6" /> 
                          <span>Start New Sermon</span>
                      </button>
                  </div>
              </div>

              {/* 2. Content Grid */}
              {loading ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-4">
                      <Loader2 className="w-10 h-10 animate-spin text-indigo-600"/>
                      <p className="text-slate-400 font-serif text-lg">Loading manuscripts...</p>
                  </div>
              ) : sermons.length === 0 ? (
                  /* Empty State */
                  <div className="flex flex-col items-center justify-center py-20 px-6 bg-white rounded-3xl border border-dashed border-slate-200 text-center shadow-sm">
                      <div className="bg-amber-50 p-6 rounded-full mb-6">
                          <BookOpen className="w-12 h-12 text-amber-500" />
                      </div>
                      <h3 className="text-2xl font-serif font-bold text-slate-800 mb-2">The Pulpit Awaits</h3>
                      <p className="text-slate-500 text-lg max-w-md mb-8">
                          "Preach the word; be ready in season and out of season..." <br/> 
                          <span className="text-sm opacity-70 italic">- 2 Timothy 4:2</span>
                      </p>
                      <button onClick={createNew} className="text-indigo-600 font-bold hover:underline hover:text-indigo-800 text-lg">
                          Create your first sermon draft &rarr;
                      </button>
                  </div>
              ) : (
                  /* Sermon Cards Grid */
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {sermons.map((s, idx) => (
                          <div 
                              key={s.id} 
                              onClick={() => editSermon(s)}
                              className="group relative bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl border border-stone-100 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col"
                          >
                              {/* Accent Line */}
                              <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${idx % 2 === 0 ? 'from-indigo-400 to-violet-600' : 'from-amber-400 to-orange-500'}`}></div>
                              
                              <div className="pl-3 mb-4 flex justify-between items-start">
                                  <div className="flex flex-col">
                                     <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
                                        {new Date(s.created_at || Date.now()).toLocaleDateString()}
                                     </span>
                                     <h3 className="text-xl font-serif font-bold text-slate-800 leading-tight group-hover:text-indigo-700 transition-colors line-clamp-2">
                                         {s.title || 'Untitled Message'}
                                     </h3>
                                  </div>
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                     <button 
                                        onClick={(e) => handleDelete(s.id, e)}
                                        className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Delete"
                                     >
                                        <Trash2 className="w-4 h-4" />
                                     </button>
                                  </div>
                              </div>

                              <div className="pl-3 flex-1">
                                  {s.main_scripture ? (
                                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-sm font-medium border border-slate-100 mb-3">
                                          <Book className="w-3.5 h-3.5 text-slate-400" />
                                          {s.main_scripture}
                                      </div>
                                  ) : (
                                      <div className="inline-block px-3 py-1 bg-stone-50 text-stone-400 rounded-lg text-xs italic mb-3">
                                          No scripture set
                                      </div>
                                  )}
                                  
                                  {s.theme && (
                                      <div className="flex items-center gap-2 text-sm text-stone-500">
                                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                          <span className="italic">{s.theme}</span>
                                      </div>
                                  )}
                              </div>

                              <div className="pl-3 pt-4 mt-4 border-t border-stone-50 flex justify-between items-center text-xs font-medium text-stone-400">
                                   <span>
                                       {s.main_point_1 ? 'Outline Started' : 'Drafting'}
                                   </span>
                                   <div className="flex items-center gap-1 group-hover:translate-x-1 transition-transform text-indigo-400">
                                       Open <ChevronRight className="w-3.5 h-3.5" />
                                   </div>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      );
  }

  // Edit Mode
  return (
      <div className="max-w-4xl mx-auto pb-20">
          <div className="flex items-center justify-between mb-8 sticky top-0 bg-gray-50 z-20 py-4 border-b">
              <button onClick={() => setMode('list')} className="text-gray-500 hover:text-gray-800 flex items-center gap-2 font-medium">
                  <ChevronLeft className="w-5 h-5"/> Back
              </button>
              <h2 className="text-xl font-bold text-gray-700 hidden sm:block">
                  {currentSermon.id ? 'Edit Sermon' : 'New Sermon'}
              </h2>
              <div className="flex gap-2">
                <button 
                    onClick={handleExportWord}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors border border-gray-200"
                    title="Export to Word"
                >
                    <Download className="w-4 h-4"/>
                    <span className="hidden sm:inline">Export</span>
                </button>
                <button 
                    onClick={handleFullAiGenerate}
                    disabled={fullAiLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 font-medium transition-colors"
                >
                    {fullAiLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4"/>}
                    <span className="hidden sm:inline">AI Generate All</span>
                </button>
                <button 
                    onClick={handleSave}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
                >
                    <Save className="w-4 h-4"/> Save
                </button>
              </div>
          </div>

          <div className="bg-white p-8 md:p-12 rounded-2xl shadow-lg border border-gray-100 animate-fade-in max-w-4xl mx-auto">
              
              {/* Official Header */}
              <div className="text-center mb-12 border-b-2 border-black/10 pb-8">
                  <h1 className="text-lg font-bold text-gray-900 tracking-wide">THE METHODIST CHURCH GHANA</h1>
                  <h2 className="text-md font-bold text-gray-700 tracking-wider mt-1">NORTH AMERICA DIOCESE</h2>
                  <h3 className="text-sm font-bold text-gray-500 tracking-widest mt-1">CANADA CIRCUIT</h3>
              </div>

              {/* 1. Title */}
              <div className="mb-8">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">1. Title</label>
                  <div className="relative">
                    <input 
                        type="text" 
                        className="w-full text-4xl font-serif font-bold text-gray-900 border-none border-b-2 border-gray-200 focus:border-indigo-600 focus:ring-0 px-0 py-2 placeholder-gray-300"
                        placeholder="e.g. Walking in the Light"
                        value={currentSermon.title}
                        onChange={e => setCurrentSermon({...currentSermon, title: e.target.value})}
                    />
                    <button onClick={() => toggleListening('title')} className={`absolute right-0 bottom-4 ${listeningField === 'title' ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-gray-600'}`}>
                        {listeningField === 'title' ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                    </button>
                  </div>
              </div>

              {/* 2. Scripture */}
              <div className="grid md:grid-cols-2 gap-8 mb-10">
                  <div className="relative">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">2. Scripture Text</label>
                      <input 
                          type="text" 
                          className="w-full p-4 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-600 text-lg font-serif"
                          placeholder="e.g. John 8:12"
                          value={currentSermon.main_scripture}
                          onChange={e => setCurrentSermon({...currentSermon, main_scripture: e.target.value})}
                      />
                  </div>
                  <div className="relative">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Theme</label>
                      <input 
                          type="text" 
                          className="w-full p-4 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-600 text-lg"
                          placeholder="e.g. Guidance, Hope"
                          value={currentSermon.theme}
                          onChange={e => setCurrentSermon({...currentSermon, theme: e.target.value})}
                      />
                  </div>
              </div>

              {/* Service Hymn Planner */}
              <div className="mb-12 rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-sky-50 p-6 md:p-8 shadow-sm">
                  <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5 mb-6">
                      <div className="max-w-2xl">
                          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.28em] text-amber-700 mb-3">
                              <Music className="w-4 h-4" /> Methodist Service Hymn Planner
                          </div>
                          <h3 className="text-2xl font-serif font-bold text-slate-900 mb-2">Suggested Hymns for the Service</h3>
                          <p className="text-sm md:text-base text-slate-600 leading-7">
                              A typical Methodist service often includes four hymns: an opening hymn of adoration, a scripture reading hymn,
                              a sermon hymn, and a closing hymn. Generate options from your sermon title, theme, and reading, then choose the ones that best fit the service.
                          </p>
                          <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                              {currentSermon.title && <span className="px-3 py-1 rounded-full bg-white border border-slate-200">Title: {currentSermon.title}</span>}
                              {currentSermon.theme && <span className="px-3 py-1 rounded-full bg-white border border-slate-200">Theme: {currentSermon.theme}</span>}
                              {currentSermon.main_scripture && <span className="px-3 py-1 rounded-full bg-white border border-slate-200">Reading: {currentSermon.main_scripture}</span>}
                          </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                          <button
                              onClick={() => setIsHymnPlannerCollapsed((current) => !current)}
                              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                          >
                              <ChevronRight className={`w-4 h-4 transition-transform ${isHymnPlannerCollapsed ? '' : 'rotate-90'}`} />
                              {isHymnPlannerCollapsed ? 'Show Hymn Selector' : 'Collapse Hymn Selector'}
                          </button>
                          <button
                              onClick={handleGenerateHymnSuggestions}
                              disabled={hymnPlannerLoading || hymnPlannerAiLoading}
                              className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-3 text-sm font-bold text-amber-950 shadow-sm transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                              {hymnPlannerLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                              {hasGeneratedHymnPlan ? 'Refresh Hymn Suggestions' : 'Generate Hymn Suggestions'}
                          </button>
                          <button
                              onClick={handleGenerateAiHymnSuggestions}
                              disabled={hymnPlannerLoading || hymnPlannerAiLoading}
                              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                              {hymnPlannerAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                              {serviceHymnAiPlan ? 'Refresh AI Suggestions' : 'AI Assist Suggestions'}
                          </button>
                      </div>
                  </div>

                  {!aiFeatureStatus.available && (
                      <div className="mb-5 rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-700">
                          {aiFeatureStatus.message}
                      </div>
                  )}

                  {hymnPlannerError && (
                      <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                          {hymnPlannerError}
                      </div>
                  )}

                  {hymnPlanIsStale && !hymnPlannerLoading && (
                      <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-100/70 px-4 py-3 text-sm text-amber-900">
                          Sermon inputs changed after the last hymn search. Refresh the suggestions so they match the latest title, theme, and scripture.
                      </div>
                  )}

                  {hasSelectedServiceHymns && (
                      <div className="mb-6 rounded-3xl border border-indigo-200 bg-white/85 p-4 shadow-sm backdrop-blur-sm">
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-4">
                              <div>
                                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-indigo-500">Selected for This Sermon</p>
                                  <p className="text-sm text-slate-600 mt-1">
                                      Your hymn choices stay visible here while you continue writing the sermon.
                                  </p>
                              </div>
                              {isHymnPlannerCollapsed && (
                                  <p className="text-xs font-medium text-slate-500">Expand the selector only when you want to change the hymns.</p>
                              )}
                          </div>

                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                              {selectedServiceHymns.map(({ slot, meta, selectedOption }) => (
                                  <div key={slot} className="rounded-2xl border border-indigo-100 bg-white px-4 py-4 shadow-sm">
                                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-indigo-500 mb-2">{meta.shortLabel}</p>
                                      <p className="text-sm font-bold text-slate-900">{selectedOption.song.title}</p>
                                      <p className="text-xs text-slate-500 mt-1">{getHymnReferenceLabel(selectedOption.song)}</p>
                                      <button
                                          onClick={() => openSuggestedHymnInHymnal(selectedOption)}
                                          className="mt-3 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
                                      >
                                          <BookOpen className="w-3.5 h-3.5" /> Open in Hymnal
                                      </button>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}

                  {!isHymnPlannerCollapsed && (
                      <div className="grid gap-4 xl:grid-cols-2">
                          {SERVICE_HYMN_SLOT_ORDER.map((slot) => {
                              const slotState = serviceHymnPlan[slot];
                              const slotMeta = SERVICE_HYMN_SLOT_META[slot];
                              const selectedOption = getSelectedHymnOption(slot);
                              const visibleOptions = getVisibleSuggestedHymns(slotState);

                              return (
                                  <div key={slot} className="rounded-3xl border border-white/70 bg-white/80 backdrop-blur-sm p-5 shadow-sm">
                                      <div className="flex items-start justify-between gap-3">
                                          <div>
                                              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400 mb-1">{slotMeta.shortLabel}</p>
                                              <h4 className="text-lg font-serif font-bold text-slate-900">{slotMeta.label}</h4>
                                              <p className="text-sm text-slate-600 mt-1 leading-6">{slotMeta.description}</p>
                                              {serviceHymnAiPlan?.[slot] && (
                                                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500 mb-1">AI Guidance</p>
                                                      <p className="text-sm font-semibold text-slate-800">{serviceHymnAiPlan[slot]?.focus}</p>
                                                      {serviceHymnAiPlan[slot]?.keywords?.length ? (
                                                          <div className="mt-2 flex flex-wrap gap-2">
                                                              {serviceHymnAiPlan[slot]?.keywords.slice(0, 5).map((keyword) => (
                                                                  <span key={`${slot}-${keyword}`} className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                                                      {keyword}
                                                                  </span>
                                                              ))}
                                                          </div>
                                                      ) : null}
                                                  </div>
                                              )}
                                          </div>
                                          <button
                                              onClick={() => showNextSuggestedHymns(slot)}
                                              disabled={slotState.options.length <= HYMN_OPTION_PAGE_SIZE || hymnPlannerLoading}
                                              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                          >
                                              <RefreshCw className="w-3.5 h-3.5" /> Another
                                          </button>
                                      </div>

                                      {selectedOption ? (
                                          <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50/70 px-4 py-4">
                                              <div className="flex items-start justify-between gap-3">
                                                  <div>
                                                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-500 mb-1">Selected</p>
                                                      <h5 className="text-base font-bold text-slate-900">{selectedOption.song.title}</h5>
                                                      <p className="text-xs text-slate-500 mt-1">{getHymnReferenceLabel(selectedOption.song)}</p>
                                                      {getFirstMeaningfulLyricLine(selectedOption.song.lyrics) && (
                                                          <p className="text-sm text-slate-600 mt-3 leading-6 line-clamp-3">{getFirstMeaningfulLyricLine(selectedOption.song.lyrics)}</p>
                                                      )}
                                                  </div>
                                                  <CheckCircle2 className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-1" />
                                              </div>

                                              {selectedOption.reasons.length > 0 && (
                                                  <div className="mt-3 flex flex-wrap gap-2">
                                                      {selectedOption.reasons.map((reason) => (
                                                          <span key={reason} className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-indigo-700 border border-indigo-100">
                                                              {reason}
                                                          </span>
                                                      ))}
                                                  </div>
                                              )}

                                              <button
                                                  onClick={() => openSuggestedHymnInHymnal(selectedOption)}
                                                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
                                              >
                                                  <BookOpen className="w-3.5 h-3.5" /> Open in Hymnal
                                              </button>
                                          </div>
                                      ) : (
                                          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                                              Generate suggestions to choose a hymn for this moment in the service.
                                          </div>
                                      )}

                                      <div className="mt-4 space-y-2">
                                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Choose one of these</p>
                                          {visibleOptions.length > 0 ? visibleOptions.map((option) => {
                                              const isSelected = option.song.id === slotState.selectedSongId;

                                              return (
                                                  <button
                                                      key={`${slot}-${option.song.id}`}
                                                      onClick={() => selectSuggestedHymn(slot, option.song.id)}
                                                      className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${isSelected ? 'border-indigo-300 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
                                                  >
                                                      <div className="flex items-start justify-between gap-3">
                                                          <div>
                                                              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400 mb-1">{getHymnReferenceLabel(option.song)}</p>
                                                              <p className="text-sm font-bold text-slate-900">{option.song.title}</p>
                                                              {getFirstMeaningfulLyricLine(option.song.lyrics) && (
                                                                  <p className="text-xs text-slate-500 mt-2 leading-5 line-clamp-2">{getFirstMeaningfulLyricLine(option.song.lyrics)}</p>
                                                              )}
                                                          </div>
                                                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                              {isSelected ? 'Selected' : 'Choose'}
                                                          </span>
                                                      </div>
                                                  </button>
                                              );
                                          }) : (
                                              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500 bg-white">
                                                  No hymn options yet. Use the button above to generate suggestions.
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  )}
              </div>

              {/* 3. Introduction */}
              <div className="mb-10 relative group">
                  <label className="block text-lg font-bold text-gray-800 mb-2">3. Introduction</label>
                  <p className="text-sm text-gray-500 mb-2">Greeting, state the problem, introduce big idea.</p>
                  <div className="relative">
                      <textarea 
                          rows={5}
                          className="w-full p-4 rounded-xl border border-gray-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 resize-y"
                          placeholder="Start with a warm greeting..."
                          value={currentSermon.introduction || ''}
                          onChange={e => setCurrentSermon({...currentSermon, introduction: e.target.value})}
                      />
                       <button onClick={() => toggleListening('introduction')} className={`absolute right-12 top-2 p-2 rounded-full hover:bg-gray-100 ${listeningField === 'introduction' ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>
                            <Mic className="w-4 h-4" />
                       </button>
                       <button 
                           onClick={() => handleSectionAi('introduction', 'Introduction')} 
                           className={`absolute right-2 top-2 p-2 rounded-full hover:bg-purple-50 ${generatingSection === 'introduction' ? 'text-purple-500' : 'text-purple-400'}`}
                           title="Generate or Expand"
                        >
                            {generatingSection === 'introduction' ? <Loader2 className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4" />}
                       </button>
                  </div>
              </div>

              {/* 4. Background */}
              <div className="mb-10 relative group">
                  <label className="block text-lg font-bold text-gray-800 mb-2">4. Background / Context</label>
                  <div className="relative">
                      <textarea 
                          rows={4}
                          className="w-full p-4 rounded-xl border border-gray-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 resize-y bg-gray-50/50"
                          placeholder="Who wrote the text? Historical context..."
                          value={currentSermon.background_context || ''}
                          onChange={e => setCurrentSermon({...currentSermon, background_context: e.target.value})}
                      />
                      <button onClick={() => toggleListening('background_context')} className={`absolute right-12 top-2 p-2 rounded-full hover:bg-gray-100 ${listeningField === 'background_context' ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>
                            <Mic className="w-4 h-4" />
                      </button>
                      <button 
                           onClick={() => handleSectionAi('background_context', 'Background and Context')} 
                           className={`absolute right-2 top-2 p-2 rounded-full hover:bg-purple-50 ${generatingSection === 'background_context' ? 'text-purple-500' : 'text-purple-400'}`}
                        >
                            {generatingSection === 'background_context' ? <Loader2 className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4" />}
                       </button>
                  </div>
              </div>

              {/* 5, 6, 7. Main Points */}
              <div className="space-y-8 border-l-4 border-blue-100 pl-6 mb-12">
                  <div className="relative">
                      <label className="block text-lg font-bold text-blue-900 mb-2">5. Main Point 1 — Explain the Text</label>
                      <div className="relative">
                        <textarea 
                            rows={4}
                            className="w-full p-4 rounded-xl border border-gray-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 resize-y"
                            placeholder="Break down key phrases..."
                            value={currentSermon.main_point_1 || ''}
                            onChange={e => setCurrentSermon({...currentSermon, main_point_1: e.target.value})}
                        />
                         <button 
                           onClick={() => handleSectionAi('main_point_1', 'Main Point 1 (Exegesis)')} 
                           className={`absolute right-2 top-2 p-2 rounded-full hover:bg-purple-50 ${generatingSection === 'main_point_1' ? 'text-purple-500' : 'text-purple-400'}`}
                        >
                            {generatingSection === 'main_point_1' ? <Loader2 className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4" />}
                       </button>
                      </div>
                  </div>
                  <div className="relative">
                      <label className="block text-lg font-bold text-blue-900 mb-2">6. Main Point 2 — Show How It Applies</label>
                      <div className="relative">
                        <textarea 
                            rows={4}
                            className="w-full p-4 rounded-xl border border-gray-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 resize-y"
                            placeholder="Connect to real-life struggles..."
                            value={currentSermon.main_point_2 || ''}
                            onChange={e => setCurrentSermon({...currentSermon, main_point_2: e.target.value})}
                        />
                         <button 
                           onClick={() => handleSectionAi('main_point_2', 'Main Point 2 (Application)')} 
                           className={`absolute right-2 top-2 p-2 rounded-full hover:bg-purple-50 ${generatingSection === 'main_point_2' ? 'text-purple-500' : 'text-purple-400'}`}
                        >
                            {generatingSection === 'main_point_2' ? <Loader2 className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4" />}
                       </button>
                      </div>
                  </div>
                  <div className="relative">
                      <label className="block text-lg font-bold text-blue-900 mb-2">7. Main Point 3 — Call to Transformation</label>
                      <div className="relative">
                        <textarea 
                            rows={4}
                            className="w-full p-4 rounded-xl border border-gray-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 resize-y"
                            placeholder="Challenge and inspire action..."
                            value={currentSermon.main_point_3 || ''}
                            onChange={e => setCurrentSermon({...currentSermon, main_point_3: e.target.value})}
                        />
                         <button 
                           onClick={() => handleSectionAi('main_point_3', 'Main Point 3 (Transformation)')} 
                           className={`absolute right-2 top-2 p-2 rounded-full hover:bg-purple-50 ${generatingSection === 'main_point_3' ? 'text-purple-500' : 'text-purple-400'}`}
                        >
                            {generatingSection === 'main_point_3' ? <Loader2 className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4" />}
                       </button>
                      </div>
                  </div>
              </div>

              {/* 8. Applications */}
              <div className="mb-10 p-6 bg-green-50 rounded-2xl border border-green-100">
                  <div className="flex justify-between items-center mb-4">
                      <label className="block text-lg font-bold text-green-900">8. Practical Applications</label>
                      <button onClick={() => addToList('application_points')} className="text-sm text-green-700 font-medium hover:underline flex items-center gap-1">
                          <Plus className="w-4 h-4"/> Add Step
                      </button>
                  </div>
                  <ul className="space-y-3">
                    {(currentSermon.application_points as string[] || []).map((item, idx) => (
                        <li key={idx} className="flex gap-2 items-start">
                            <div className="w-6 h-6 rounded-full bg-green-200 text-green-800 flex items-center justify-center text-xs font-bold mt-2 flex-shrink-0">{idx+1}</div>
                            <textarea 
                                className="flex-1 bg-white rounded-lg p-3 text-gray-800 border border-green-200 resize-none focus:ring-1 focus:ring-green-500"
                                rows={2}
                                value={item}
                                onChange={e => updateList('application_points', idx, e.target.value)}
                                placeholder="Specific action step..."
                            />
                            <button onClick={() => removeFromList('application_points', idx)} className="text-gray-400 hover:text-red-500 mt-2"><X className="w-4 h-4"/></button>
                        </li>
                    ))}
                  </ul>
              </div>

              {/* 9. Gospel Connection */}
              <div className="mb-10 relative">
                  <label className="block text-lg font-bold text-gray-800 mb-2">9. Gospel Connection</label>
                  <div className="relative">
                    <textarea 
                        rows={3}
                        className="w-full p-4 rounded-xl border border-gray-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 resize-y"
                        placeholder="How does Jesus fulfill this?"
                        value={currentSermon.gospel_connection || ''}
                        onChange={e => setCurrentSermon({...currentSermon, gospel_connection: e.target.value})}
                    />
                     <button 
                           onClick={() => handleSectionAi('gospel_connection', 'Gospel Connection')} 
                           className={`absolute right-2 top-2 p-2 rounded-full hover:bg-purple-50 ${generatingSection === 'gospel_connection' ? 'text-purple-500' : 'text-purple-400'}`}
                        >
                            {generatingSection === 'gospel_connection' ? <Loader2 className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4" />}
                       </button>
                  </div>
              </div>

              {/* 10. Conclusion */}
              <div className="mb-10 relative">
                  <label className="block text-lg font-bold text-gray-800 mb-2">10. Conclusion</label>
                  <div className="relative">
                    <textarea 
                        rows={4}
                        className="w-full p-4 rounded-xl border border-gray-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 resize-y"
                        placeholder="Summarize and reinforce takeaway..."
                        value={currentSermon.conclusion || ''}
                        onChange={e => setCurrentSermon({...currentSermon, conclusion: e.target.value})}
                    />
                    <button 
                           onClick={() => handleSectionAi('conclusion', 'Conclusion')} 
                           className={`absolute right-2 top-2 p-2 rounded-full hover:bg-purple-50 ${generatingSection === 'conclusion' ? 'text-purple-500' : 'text-purple-400'}`}
                        >
                            {generatingSection === 'conclusion' ? <Loader2 className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4" />}
                       </button>
                  </div>
              </div>

              {/* 11. Closing Prayer */}
              <div className="mb-10">
                  <div className="flex justify-between items-center mb-4">
                      <label className="block text-lg font-bold text-gray-800">11. Closing Prayer Points</label>
                      <button onClick={() => addToList('prayer_points')} className="text-sm text-indigo-600 font-medium hover:underline flex items-center gap-1">
                          <Plus className="w-4 h-4"/> Add Point
                      </button>
                  </div>
                  <ul className="space-y-3">
                    {(currentSermon.prayer_points as string[] || []).map((item, idx) => (
                        <li key={idx} className="flex gap-2 items-center">
                            <span className="text-gray-400">•</span>
                            <input 
                                className="flex-1 bg-gray-50 border-none rounded p-2 focus:ring-1 focus:ring-indigo-600"
                                value={item}
                                onChange={e => updateList('prayer_points', idx, e.target.value)}
                                placeholder="Prayer focus..."
                            />
                            <button onClick={() => removeFromList('prayer_points', idx)} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4"/></button>
                        </li>
                    ))}
                  </ul>
              </div>

              {/* 12. Altar Call */}
              <div className="mb-10 relative p-6 bg-red-50 rounded-2xl border border-red-100">
                  <label className="block text-lg font-bold text-red-900 mb-2">12. Altar Call / Response</label>
                  <div className="relative">
                    <textarea 
                        rows={3}
                        className="w-full p-4 rounded-xl border border-red-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 resize-y bg-white"
                        placeholder="Invitation to salvation or recommitment..."
                        value={currentSermon.altar_call || ''}
                        onChange={e => setCurrentSermon({...currentSermon, altar_call: e.target.value})}
                    />
                     <button 
                           onClick={() => handleSectionAi('altar_call', 'Altar Call')} 
                           className={`absolute right-2 top-2 p-2 rounded-full hover:bg-purple-50 ${generatingSection === 'altar_call' ? 'text-purple-500' : 'text-purple-400'}`}
                        >
                            {generatingSection === 'altar_call' ? <Loader2 className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4" />}
                       </button>
                  </div>
              </div>

          </div>
      </div>
  );
};

export default SermonBuilder;

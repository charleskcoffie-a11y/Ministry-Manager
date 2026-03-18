import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookMarked,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Church,
  Loader2,
  Quote,
  RefreshCw,
  Scroll,
  Search,
  Sparkles,
} from 'lucide-react';
import { getWesleyQuotes, WesleyQuote } from '../services/geminiService';
import { supabase } from '../supabaseClient';
import localWesleySermons from '../public/wesley/sermons.json';

interface WesleySermonRecord {
  number: number;
  title: string;
  scripture: string;
  source: string;
  text: string;
}

const WESLEY_QUOTES: WesleyQuote[] = [
  { quote: 'Though we cannot think alike, may we not love alike?', source: 'Catholic Spirit', theme: 'Love' },
  { quote: 'If your heart is as my heart, give me your hand.', source: 'Catholic Spirit', theme: 'Love' },
  { quote: 'I look upon all the world as my parish.', source: 'Journal, June 11, 1739', theme: 'Mission' },
  { quote: 'Earn all you can, save all you can, give all you can.', source: 'The Use of Money', theme: 'Stewardship' },
  { quote: 'The gospel of Christ knows of no religion but social; no holiness but social holiness.', source: 'Preface to Hymns and Sacred Poems', theme: 'Holiness' },
  { quote: 'Best of all, God is with us.', source: 'Last Words', theme: 'Faith' },
  { quote: 'Give me one hundred preachers who fear nothing but sin and desire nothing but God, and I care not a straw whether they be clergymen or laymen.', source: 'Letter to Alexander Mather', theme: 'Zeal' },
  { quote: 'As a man reasoneth, so he is; and as he chooseth, so he doth.', source: 'Sermons on Several Occasions', theme: 'Discipleship' },
];

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

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

const JohnWesley: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sermons' | 'quotes'>('sermons');
  const [sermons, setSermons] = useState<WesleySermonRecord[]>([]);
  const [sermonsLoading, setSermonsLoading] = useState(true);
  const [sermonsError, setSermonsError] = useState('');
  const [sermonQuery, setSermonQuery] = useState('');
  const [selectedSermonNumber, setSelectedSermonNumber] = useState<number | null>(null);

  const [quotes, setQuotes] = useState<WesleyQuote[]>(WESLEY_QUOTES);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quoteQuery, setQuoteQuery] = useState('');
  const [quoteIdx, setQuoteIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadSermons = async () => {
      setSermonsLoading(true);
      setSermonsError('');

      try {
        const { data, error } = await supabase
          .from('john_wesley_sermons')
          .select('sermon_number, title, scripture, source_url, sermon_text')
          .order('sermon_number', { ascending: true });

        if (!error && data && data.length > 0) {
          const normalized = data.map(row => {
            const sermon: WesleySermonRecord = {
              number: row.sermon_number,
              title: row.title,
              scripture: row.scripture,
              source: row.source_url,
              text: row.sermon_text,
            };
            return {
              ...sermon,
              text: normalizeSermonText(sermon),
            };
          });

          if (cancelled) return;
          setSermons(normalized);
          setSelectedSermonNumber(normalized[0]?.number ?? null);
          return;
        }

        // Fallback for first-time setup before SQL seed is applied.
        const viteBaseUrl = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
        const fallbackUrls = [
          `${viteBaseUrl}wesley/sermons.json`,
          '/wesley/sermons.json',
        ];

        let fallbackData: WesleySermonRecord[] | null = null;
        for (const url of fallbackUrls) {
          const response = await fetch(url);
          if (response.ok) {
            fallbackData = (await response.json()) as WesleySermonRecord[];
            break;
          }
        }

        if (!fallbackData) {
          fallbackData = localWesleySermons as WesleySermonRecord[];
        }

        if (cancelled) return;

        const normalized = fallbackData.map(sermon => ({
          ...sermon,
          text: normalizeSermonText(sermon),
        }));

        setSermons(normalized);
        setSelectedSermonNumber(normalized[0]?.number ?? null);
      } catch (error) {
        if (cancelled) return;
        setSermonsError(error instanceof Error ? error.message : 'Could not load Wesley sermons.');
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
  }, []);

  const loadQuotes = useCallback(async () => {
    setQuotesLoading(true);
    try {
      const result = await getWesleyQuotes(6);
      if (result.length > 0) {
        setQuotes(prev => {
          const seen = new Set(prev.map(item => `${item.quote}|${item.source}`));
          const merged = [...prev];
          for (const item of result) {
            const key = `${item.quote}|${item.source}`;
            if (!seen.has(key)) {
              seen.add(key);
              merged.push(item);
            }
          }
          return merged;
        });
      }
    } finally {
      setQuotesLoading(false);
    }
  }, []);

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

  useEffect(() => {
    if (quoteIdx >= filteredQuotes.length) {
      setQuoteIdx(0);
    }
  }, [filteredQuotes.length, quoteIdx]);

  const activeQuote = filteredQuotes[quoteIdx] ?? null;

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
            <p className="text-amber-200/50 text-xs mt-2 max-w-2xl leading-relaxed">
              The sermon library below now reads from a local public-domain corpus, so the original Wesley text remains available even without Gemini.
            </p>
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
            <div className="md:w-80 shrink-0">
              <div className="flex items-center justify-between px-1 mb-3">
                <p className="text-amber-400/60 text-xs font-semibold uppercase tracking-wider">Sermon Library (Database or Local)</p>
                <span className="text-amber-600/50 text-xs">{filteredSermons.length} found</span>
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
                      <span className="text-xs font-medium leading-snug line-clamp-2">{sermon.title}</span>
                      {selectedSermon?.number === sermon.number && <ChevronRight className="w-3 h-3 ml-auto shrink-0 text-amber-300" />}
                    </div>
                    <p className="text-xs text-amber-600/50 mt-0.5 ml-8">{sermon.scripture}</p>
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
                          Original text · database/local source
                        </span>
                      </div>
                      <h2 className="text-xl font-serif font-bold text-amber-100 leading-tight mb-2">{selectedSermon.title}</h2>
                      <div className="flex items-center gap-2 text-amber-400/80 text-sm font-medium">
                        <BookOpen className="w-3.5 h-3.5 text-amber-500/60" />
                        <span>{selectedSermon.scripture}</span>
                      </div>
                      <p className="text-amber-500/50 text-xs mt-3">From Supabase when available, otherwise local CCEL public-domain backup.</p>
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
            <button
              onClick={loadQuotes}
              disabled={quotesLoading}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-semibold text-sm text-amber-950 transition-opacity hover:opacity-90 shadow-lg disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #ffd700, #b8860b)' }}
            >
              {quotesLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {quotesLoading ? 'Loading...' : 'Add Gemini Quotes'}
            </button>
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
                  <div className="flex gap-1.5">
                    {filteredQuotes.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setQuoteIdx(index)}
                        className={`w-2 h-2 rounded-full transition-all ${index === quoteIdx ? 'bg-amber-400 w-5' : 'bg-amber-700/50 hover:bg-amber-600/70'}`}
                      />
                    ))}
                  </div>
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

              <div className="flex justify-center">
                <button
                  onClick={loadQuotes}
                  disabled={quotesLoading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-amber-700/40 text-amber-400/70 hover:text-amber-300 hover:border-amber-600/60 text-sm transition-colors disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${quotesLoading ? 'animate-spin' : ''}`} /> Load More
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default JohnWesley;

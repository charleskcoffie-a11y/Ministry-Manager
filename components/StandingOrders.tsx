
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import * as React from 'react';
import { supabase } from '../supabaseClient';
import { StandingOrder } from '../types';
import { 
  Search, BookOpen, ChevronRight, ChevronLeft, Bot, FileText, X, ArrowLeft, 
  AlignJustify, Scale, Bookmark, Gavel, ScrollText, CheckCircle2, 
  Library, PanelLeftClose
} from 'lucide-react';
import { explainStandingOrder } from '../services/geminiService';
import { useLocation, useNavigate } from 'react-router-dom';

interface DocContent {
  id: string;
  text: string;
  page?: number;
}

interface DocBookmark {
  id: string;
  text: string;
  page?: number;
  note: string;
  soLabel: string | null;
  createdAt: string;
}

const DOC_BOOKMARKS_KEY = 'standing_orders_doc_bookmarks_v1';
const DOC_BOOKMARKS_DOC_ID = 'standing_orders_bookmarks';

const normalizeDocBookmarks = (value: unknown): DocBookmark[] => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const normalized: DocBookmark[] = [];

  for (const raw of value as Array<Record<string, unknown>>) {
    const id = String(raw.id ?? '').trim();
    const text = String(raw.text ?? '').trim();
    if (!id || !text || seen.has(id)) continue;
    seen.add(id);

    normalized.push({
      id,
      text,
      page: typeof raw.page === 'number' ? raw.page : undefined,
      note: String(raw.note ?? '').trim(),
      soLabel: typeof raw.soLabel === 'string' && raw.soLabel.trim() ? raw.soLabel.trim() : null,
      createdAt: typeof raw.createdAt === 'string' && raw.createdAt.trim() ? raw.createdAt : new Date().toISOString(),
    });
  }

  return normalized;
};

const mergeDocBookmarks = (localItems: DocBookmark[], remoteItems: DocBookmark[]) => {
  const merged = new Map<string, DocBookmark>();

  for (const item of [...remoteItems, ...localItems]) {
    const existing = merged.get(item.id);
    if (!existing) {
      merged.set(item.id, item);
      continue;
    }

    const existingTime = Date.parse(existing.createdAt);
    const nextTime = Date.parse(item.createdAt);
    const nextIsNewer = Number.isFinite(nextTime) && (!Number.isFinite(existingTime) || nextTime >= existingTime);

    if (nextIsNewer) {
      merged.set(item.id, item);
    }
  }

  return Array.from(merged.values());
};

const StandingOrders = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const initialQuery = searchParams.get('q') || '';

  const [orders, setOrders] = useState<StandingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const [docMode, setDocMode] = useState(false);
  const [docVersion, setDocVersion] = useState<'main' | 'draft'>('main');
  const [docContent, setDocContent] = useState<DocContent[]>([]);
  const [docFileName, setDocFileName] = useState<string>('');
  const [mainDocContent, setMainDocContent] = useState<DocContent[]>([]);
  const [mainDocFileName, setMainDocFileName] = useState<string>('');
  const [draftDocContent, setDraftDocContent] = useState<DocContent[]>([]);
  const [draftDocFileName, setDraftDocFileName] = useState<string>('');

  const [parsing, setParsing] = useState(false);
  const [showFullDoc, setShowFullDoc] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedOrder, setSelectedOrder] = useState<StandingOrder | null>(null);
  const [selectedDocItem, setSelectedDocItem] = useState<DocContent | null>(null);
  
  const [aiExplanation, setAiExplanation] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [docBookmarks, setDocBookmarks] = useState<DocBookmark[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = window.localStorage.getItem(DOC_BOOKMARKS_KEY);
      if (!stored) return [];
      return normalizeDocBookmarks(JSON.parse(stored));
    } catch {
      return [];
    }
  });
  const [showDocBookmarksOnly, setShowDocBookmarksOnly] = useState(false);
  const [bookmarkNoteDraft, setBookmarkNoteDraft] = useState('');
  const [bookmarksReadyForSync, setBookmarksReadyForSync] = useState(false);

  // Initialize ref explicitly
  const fullDocViewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const newSearch = searchQuery ? `q=${encodeURIComponent(searchQuery)}` : '';
    navigate({ search: newSearch }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const reloadDraftContent = useCallback(async () => {
    try {
      const { data: draftMeta, error: draftMetaError } = await supabase
        .from('uploaded_documents')
        .select('*', { count: 'exact', head: false })
        .eq('id', 'standing_orders_draft')
        .single();

      if (draftMetaError && draftMetaError.code !== 'PGRST116') {
        console.error('Error fetching draft constitution:', draftMetaError);
        return;
      }

      if (draftMeta?.content && Array.isArray(draftMeta.content) && draftMeta.content.length > 0) {
        const normalizedDraft = (draftMeta.content as DocContent[]).map(item => ({
          ...item,
          id: item.id.startsWith('draft-') ? item.id : `draft-${item.id}`,
        }));
        setDraftDocFileName(draftMeta.filename || 'Draft Constitution');
        setDraftDocContent(normalizedDraft);
        console.log('Draft content loaded:', normalizedDraft.length, 'items');
      }
    } catch (err) {
      console.error('Error reloading draft:', err);
    }
  }, []);

  useEffect(() => {
    const fetchSavedDocument = async () => {
      try {
        setParsing(true);
        const { data, error } = await supabase
          .from('uploaded_documents')
          .select('*')
          .eq('id', 'standing_orders')
          .single();

        if (error && error.code !== 'PGRST116') {
           console.error("Error fetching saved document:", error);
        }

        if (data && data.content) {
          console.log("Restored document:", data.filename);
          setMainDocFileName(data.filename);
          setMainDocContent(data.content);
          setDocFileName(data.filename);
          setDocContent(data.content);
          setDocMode(true);
        }

        // Load persisted draft constitution (parsed content)
        await reloadDraftContent();

        const { data: bookmarkData, error: bookmarkError } = await supabase
          .from('uploaded_documents')
          .select('content')
          .eq('id', DOC_BOOKMARKS_DOC_ID)
          .single();

        if (bookmarkError && bookmarkError.code !== 'PGRST116') {
          console.error('Error fetching saved bookmarks:', bookmarkError);
        }

        if (bookmarkData?.content) {
          const remoteBookmarks = normalizeDocBookmarks(bookmarkData.content);
          setDocBookmarks(prev => mergeDocBookmarks(prev, remoteBookmarks));
        }
      } catch (err) {
        console.error("Unexpected error loading document:", err);
      } finally {
        setParsing(false);
        setLoading(false);
        setBookmarksReadyForSync(true);
      }
    };

    fetchSavedDocument();
  }, [reloadDraftContent]);

  // Reload draft content when switching to draft view in case it was updated in Settings
  useEffect(() => {
    if (docVersion === 'draft' && draftDocContent.length === 0) {
      reloadDraftContent();
    }
  }, [docVersion, draftDocContent.length, reloadDraftContent]);

  const extractSoNumber = (input: string) => {
    // Match "SO 60", "S.O 60", "s.o. 60", "60" at start, etc.
    const match = input.trim().match(/^(?:s\.?\s*o\.?\s*)?(\d+)$/i);
    return match ? match[1] : null;
  };

  const extractSoLabel = (input: string) => {
    // Find SO reference anywhere in text (S.O, S. O, SO, s.o, etc.)
    const looseMatch = input.match(/s\.?\s*o\.?\s*(\d+)/i);
    return looseMatch ? `SO ${looseMatch[1]}` : null;
  };

  const getSoSearchPatterns = (soNumber: string) => [
    `\\bS\\.O\\.?\\s*${soNumber}\\b`,
    `\\bS\\s*O\\s*${soNumber}\\b`,
    `\\bSO\\s*${soNumber}\\b`,
    `(?:^|\\s|\\()${soNumber}\\.(?=\\s|$)`,
    `(?:^|\\s)${soNumber}(?=\\s*[–-])`,
  ];

  const findSoMatchIndex = (text: string, soNumber: string): number => {
    for (const pattern of getSoSearchPatterns(soNumber)) {
      const regex = new RegExp(pattern, 'i');
      const match = regex.exec(text);
      if (!match || match.index === undefined) continue;

      const numberOffset = match[0].indexOf(soNumber);
      return match.index + Math.max(numberOffset, 0);
    }

    return -1;
  };

  const getDocResultLabel = (text: string) => {
    const soNumber = extractSoNumber(searchQuery);
    if (soNumber && findSoMatchIndex(text, soNumber) >= 0) {
      return `SO ${soNumber}`;
    }

    return extractSoLabel(text);
  };

  const getDocExcerptText = (text: string) => {
    if (!searchQuery.trim()) return text;

    const soNumber = extractSoNumber(searchQuery);
    const matchIndex = soNumber
      ? findSoMatchIndex(text, soNumber)
      : text.toLowerCase().indexOf(searchQuery.toLowerCase());

    if (matchIndex < 0) return text;

    const snippetRadius = 220;
    const start = Math.max(0, matchIndex - snippetRadius);
    const end = Math.min(text.length, matchIndex + snippetRadius);
    const prefix = start > 0 ? '... ' : '';
    const suffix = end < text.length ? ' ...' : '';

    return `${prefix}${text.slice(start, end).trim()}${suffix}`;
  };

  const soMatchesInText = (text: string, soNumber: string): boolean => {
    return findSoMatchIndex(text, soNumber) >= 0;
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(DOC_BOOKMARKS_KEY, JSON.stringify(docBookmarks));
  }, [docBookmarks]);

  useEffect(() => {
    if (!bookmarksReadyForSync) return;

    const syncBookmarks = async () => {
      const { error } = await supabase
        .from('uploaded_documents')
        .upsert(
          {
            id: DOC_BOOKMARKS_DOC_ID,
            filename: 'standing_orders_bookmarks.json',
            content: docBookmarks,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

      if (error) {
        console.error('Error syncing constitution bookmarks:', error);
      }
    };

    syncBookmarks();
  }, [docBookmarks, bookmarksReadyForSync]);

  const docBookmarkMap = React.useMemo(() => {
    const map = new Map<string, DocBookmark>();
    docBookmarks.forEach(bookmark => map.set(bookmark.id, bookmark));
    return map;
  }, [docBookmarks]);

  const selectedDocBookmark = React.useMemo(() => {
    if (!selectedDocItem) return null;
    return docBookmarkMap.get(selectedDocItem.id) || null;
  }, [selectedDocItem, docBookmarkMap]);

  useEffect(() => {
    if (!selectedDocItem) {
      setBookmarkNoteDraft('');
      return;
    }
    setBookmarkNoteDraft(selectedDocBookmark?.note || '');
  }, [selectedDocItem, selectedDocBookmark]);

  const upsertDocBookmark = (item: DocContent, noteText: string) => {
    const normalizedNote = noteText.trim();
    setDocBookmarks(prev => {
      const existing = prev.find(bookmark => bookmark.id === item.id);
      if (existing) {
        return prev.map(bookmark =>
          bookmark.id === item.id
            ? {
                ...bookmark,
                text: item.text,
                page: item.page,
                note: normalizedNote,
                soLabel: extractSoLabel(item.text),
              }
            : bookmark
        );
      }

      return [
        {
          id: item.id,
          text: item.text,
          page: item.page,
          note: normalizedNote,
          soLabel: extractSoLabel(item.text),
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ];
    });
  };

  const removeDocBookmark = (id: string) => {
    setDocBookmarks(prev => prev.filter(bookmark => bookmark.id !== id));
  };

  const toggleDocBookmark = (item: DocContent) => {
    if (docBookmarkMap.has(item.id)) {
      removeDocBookmark(item.id);
      return;
    }

    upsertDocBookmark(item, item.id === selectedDocItem?.id ? bookmarkNoteDraft : '');
  };

  const fetchOrders = useCallback(async () => {
    if (docMode) return;

    setLoading(true);
    let query = supabase.from('standing_orders').select('*');

    const codeNumber = extractSoNumber(searchQuery);

    if (codeNumber) {
      query = query.ilike('code', `%${codeNumber}%`); 
    } else if (searchQuery.trim().length > 0) {
      query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
    }

    if (showFavoritesOnly) {
      query = query.eq('is_favorite', true);
    }

    const { data, error } = await query.order('code', { ascending: true });
    
    if (!error && data) setOrders(data);
    setLoading(false);
  }, [searchQuery, docMode, showFavoritesOnly]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchOrders();
    }, 500); 
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, fetchOrders, showFavoritesOnly]);

  const toggleFavorite = async (e: React.MouseEvent, order: StandingOrder) => {
    e.stopPropagation();
    
    const newStatus = !order.is_favorite;
    
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, is_favorite: newStatus } : o));
    if (selectedOrder?.id === order.id) {
      setSelectedOrder({ ...selectedOrder, is_favorite: newStatus });
    }

    try {
      await supabase.from('standing_orders').update({ is_favorite: newStatus }).eq('id', order.id);
    } catch (err) {
      console.error("Error updating favorite", err);
      fetchOrders(); 
    }
  };

  const handleAskAI = async (text: string, code: string = 'Reference') => {
    setAiExplanation('');
    setAiLoading(true);
    const result = await explainStandingOrder(code, text);
    setAiExplanation(result || 'Could not generate explanation right now.');
    setAiLoading(false);
  }

  const filteredDocContent = docContent.filter(item => {
    if (!searchQuery) return true;
    
    // Try to extract SO number from search input
    const soNumber = extractSoNumber(searchQuery);
    if (soNumber) {
      // Search by SO number with all format variations
      return soMatchesInText(item.text, soNumber);
    }
    
    // Fall back to keyword search (case insensitive)
    return item.text.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredBookmarkedContent = docBookmarks
    .filter(item => {
      if (!searchQuery) return true;
      
      const soNumber = extractSoNumber(searchQuery);
      if (soNumber) {
        // Search by SO number in text or note
        return soMatchesInText(item.text, soNumber) || soMatchesInText(item.note || '', soNumber);
      }
      
      // Fall back to keyword search in text or note
      return item.text.toLowerCase().includes(searchQuery.toLowerCase()) || (item.note || '').toLowerCase().includes(searchQuery.toLowerCase());
    })
    .map(({ id, text, page }) => ({ id, text, page }));

  const visibleDocContent = showDocBookmarksOnly ? filteredBookmarkedContent : filteredDocContent;

  const indexedPageCount = useMemo(() => {
    const pages = new Set<number>();
    docContent.forEach(item => {
      if (typeof item.page === 'number') pages.add(item.page);
    });
    return pages.size;
  }, [docContent]);

  const hasSelection = Boolean(selectedOrder || selectedDocItem);
  const listHeading = docMode
    ? showDocBookmarksOnly
      ? 'Bookmarked Passages'
      : 'Constitution Index'
    : showFavoritesOnly
      ? 'Saved Sections'
      : 'Standing Order Library';
  const listSummaryLabel = docMode
    ? showDocBookmarksOnly
      ? `${visibleDocContent.length} bookmarked passages`
      : `${visibleDocContent.length} passages in view`
    : showFavoritesOnly
      ? `${orders.length} saved sections`
      : `${orders.length} sections in view`;
  const selectedDocSummaryLabel = selectedDocItem
    ? selectedDocBookmark?.soLabel || getDocResultLabel(selectedDocItem.text) || (selectedDocItem.page ? `Page ${selectedDocItem.page}` : 'Document Excerpt')
    : 'Document Excerpt';
  const selectedDocExcerptText = selectedDocItem ? getDocExcerptText(selectedDocItem.text) : '';
  const isSelectedDocBookmarked = selectedDocItem ? docBookmarkMap.has(selectedDocItem.id) : false;

  useEffect(() => {
    if (!showFullDoc || !docMode || !selectedDocItem) return;

    const container = fullDocViewRef.current;
    if (!container) return;

    const scrollToSelected = () => {
      const target = document.getElementById(selectedDocItem.id);
      if (!target) return;
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      container.scrollTop += targetRect.top - containerRect.top - 112;
    };

    const timer = window.setTimeout(scrollToSelected, 250);
    return () => window.clearTimeout(timer);
  }, [showFullDoc, docMode, selectedDocItem, docContent]);

  if (showFullDoc && docMode) {
    return (
      <div className="relative h-[calc(100vh-100px)] overflow-hidden rounded-[2rem] border border-stone-200/80 bg-[radial-gradient(circle_at_top_right,_rgba(217,119,6,0.12),_transparent_24%),linear-gradient(135deg,_#f8fafc_0%,_#fffbeb_45%,_#ffffff_100%)] shadow-[0_35px_100px_rgba(15,23,42,0.14)] animate-fade-in">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-10 right-8 h-48 w-48 rounded-full bg-amber-200/30 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-slate-200/40 blur-3xl" />
        </div>

        <div className="relative flex h-full flex-col">
          <div className="border-b border-stone-200/80 bg-white/80 px-5 py-5 backdrop-blur-xl md:px-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-5">
                <button
                  onClick={() => setShowFullDoc(false)}
                  className="inline-flex items-center gap-2 self-start rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-600 shadow-sm transition hover:border-stone-300 hover:bg-stone-50"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Search
                </button>
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.26em] text-amber-700">
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] text-amber-800">Full Constitution</span>
                    {selectedDocItem?.page && (
                      <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] text-stone-600">Page {selectedDocItem.page}</span>
                    )}
                  </div>
                  <h2 className="mt-3 text-3xl font-serif font-bold text-slate-900 md:text-4xl">Full Context Reader</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600 md:text-base">
                    Read the constitution in a calmer paper-style layout. The selected search result is highlighted automatically so you can keep context while reading.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:flex">
                <div className="rounded-2xl border border-stone-200 bg-white/90 px-4 py-3 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-stone-400">Passages</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{docContent.length}</p>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-white/90 px-4 py-3 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-stone-400">Pages</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{indexedPageCount || 'N/A'}</p>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-white/90 px-4 py-3 shadow-sm col-span-2 sm:col-span-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-stone-400">Jump Target</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{selectedDocItem ? selectedDocSummaryLabel : 'Manual reading'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-8" ref={fullDocViewRef}>
            <div className="mx-auto max-w-5xl rounded-[2rem] border border-stone-200/80 bg-white/75 p-3 shadow-[0_25px_80px_rgba(15,23,42,0.10)] backdrop-blur">
              <div className="rounded-[30px] border border-stone-200 bg-[linear-gradient(180deg,_#fffdf8_0%,_#ffffff_100%)] px-6 py-8 md:px-12 md:py-12">
                <div className="mb-10 border-b border-stone-200 pb-6">
                  <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-stone-400">Constitution Reading Copy</p>
                  <h3 className="mt-3 text-2xl font-serif font-bold text-slate-900 md:text-3xl">Full Text Reference</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                    This view is meant for extended reading. Search results remain highlighted so you can scan surrounding clauses without losing your place.
                  </p>
                </div>

                {docContent.length === 0 && (
                  <p className="mt-10 text-center font-serif text-xl italic text-stone-400">No content loaded.</p>
                )}

                {docContent.map((item, index) => (
                  <div
                    key={item.id}
                    id={item.id}
                    className={`scroll-mt-28 mb-7 rounded-[24px] px-5 py-5 transition-all duration-500 md:px-7 ${selectedDocItem?.id === item.id ? 'bg-amber-50/80 ring-1 ring-amber-200 shadow-sm' : ''}`}
                  >
                    {item.page && index > 0 && docContent[index - 1].page !== item.page && (
                      <div className="my-8 flex items-center gap-4 opacity-70">
                        <div className="h-px flex-1 bg-stone-300" />
                        <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-stone-500">Page {item.page}</span>
                        <div className="h-px flex-1 bg-stone-300" />
                      </div>
                    )}
                    <p className="whitespace-pre-wrap font-serif text-[1.06rem] leading-9 tracking-[0.01em] text-stone-700 md:text-[1.12rem]">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-100px)] overflow-hidden rounded-[2rem] border border-stone-200/80 bg-[radial-gradient(circle_at_top_right,_rgba(217,119,6,0.10),_transparent_24%),linear-gradient(135deg,_#f8fafc_0%,_#fffbeb_38%,_#ffffff_100%)] p-3 shadow-[0_35px_100px_rgba(15,23,42,0.10)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-16 right-8 h-56 w-56 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-slate-200/30 blur-3xl" />
      </div>

      <div className="relative flex h-full flex-col gap-4">
        <div className="overflow-hidden rounded-[28px] border border-slate-900/10 bg-[linear-gradient(135deg,_#0f172a_0%,_#1e293b_58%,_#7c2d12_100%)] p-6 text-white shadow-[0_30px_80px_rgba(15,23,42,0.35)] md:p-8">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-2.5 backdrop-blur-sm">
              <Gavel className="w-6 h-6 text-amber-400" />
            </div>
            <div className="hidden rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-200 backdrop-blur-sm md:inline-flex">
              Constitution Workspace
            </div>
            <h1 className="truncate text-2xl font-serif font-bold tracking-tight text-white md:text-4xl">
              Standing Orders & Constitution
            </h1>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
          <div className={`shrink-0 flex flex-col overflow-hidden rounded-[28px] border border-stone-200/80 bg-white/80 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all duration-300 ${navCollapsed ? 'w-12' : `w-full md:w-[380px] lg:w-[420px] xl:w-[460px] ${hasSelection ? 'hidden md:flex' : 'flex'}`}`}>
            {navCollapsed ? (
              <div className="flex h-full flex-col items-center py-4 gap-3">
                <button
                  onClick={() => setNavCollapsed(false)}
                  className="p-2.5 rounded-full bg-stone-100 hover:bg-amber-50 hover:text-amber-700 text-stone-500 transition"
                  title="Expand navigation"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-stone-300 [writing-mode:vertical-rl]">
                    {listHeading}
                  </span>
                </div>
              </div>
            ) : (
            <>
            <div className="border-b border-stone-200/80 bg-white/85 p-5 backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-stone-400">Navigator</p>
                  <h2 className="mt-2 text-2xl font-serif font-bold text-slate-900">{listHeading}</h2>
                </div>
                <div className="flex items-center gap-2">
                  {docMode && (
                    <div className="flex overflow-hidden rounded-full border border-stone-200 bg-stone-100 p-0.5">
                      <button
                        onClick={() => {
                          setDocVersion('main');
                          setDocContent(mainDocContent);
                          setDocFileName(mainDocFileName);
                          setSelectedDocItem(null);
                        }}
                        className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] transition ${
                          docVersion === 'main' ? 'bg-white text-slate-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                        }`}
                      >
                        Main
                      </button>
                      <button
                        onClick={() => {
                          setDocVersion('draft');
                          setDocContent(draftDocContent);
                          setDocFileName(draftDocFileName || 'Draft Constitution');
                          setSelectedDocItem(null);
                        }}
                        title={draftDocContent.length > 0 ? draftDocFileName : 'Upload draft in Settings'}
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] transition ${
                          docVersion === 'draft' ? 'bg-amber-500 text-white shadow-sm' : 'text-stone-500 hover:text-stone-700'
                        }`}
                      >
                        Draft {draftDocContent.length === 0 && <FileText className="w-3 h-3 opacity-60" />}
                      </button>
                    </div>
                  )}
                  {docMode ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {docVersion === 'draft' ? (draftDocContent.length > 0 ? 'Draft Saved' : 'No Draft Saved') : 'Synced'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-stone-600">
                      <Scale className="w-3.5 h-3.5" /> Library
                    </span>
                  )}
                  <button
                    onClick={() => setNavCollapsed(true)}
                    className="p-2 rounded-full hover:bg-stone-100 text-stone-400 transition"
                    title="Collapse navigation"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="relative mt-4">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search section, rule, passage, or SO number..."
                  className="w-full rounded-2xl border border-stone-200 bg-white pl-11 pr-4 py-3.5 text-sm font-medium text-stone-700 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 placeholder:text-stone-400"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {!docMode && (
                  <button
                    onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition ${showFavoritesOnly ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50'}`}
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-amber-600' : ''}`} /> Favorites
                  </button>
                )}
                {docMode && (
                  <button
                    onClick={() => setShowDocBookmarksOnly(!showDocBookmarksOnly)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition ${showDocBookmarksOnly ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50'}`}
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${showDocBookmarksOnly ? 'fill-amber-600' : ''}`} /> Bookmarks ({docBookmarks.length})
                  </button>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3 shadow-inner shadow-stone-100/60">
                <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-stone-400">Current View</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{listSummaryLabel}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3">
              {!docMode && (
                <>
                  {loading ? (
                    <div className="flex h-full min-h-[240px] flex-col items-center justify-center rounded-[24px] border border-dashed border-stone-200 bg-white/70 text-center">
                      <Scale className="mb-3 h-10 w-10 text-stone-300 animate-pulse" />
                      <p className="font-serif text-lg italic text-stone-400">Loading statutes...</p>
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="flex h-full min-h-[240px] flex-col items-center justify-center rounded-[24px] border border-dashed border-stone-200 bg-white/70 px-6 text-center">
                      <Scale className="mb-4 h-10 w-10 text-stone-300" />
                      <p className="font-semibold text-stone-600">No sections found.</p>
                      <p className="mt-2 text-sm leading-6 text-stone-400">Try a broader search or switch off the favorites filter.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {orders.map(order => (
                        <div
                          key={order.id}
                          onClick={() => {
                            setSelectedOrder(order);
                            setAiExplanation('');
                          }}
                          className={`group cursor-pointer rounded-[24px] border px-4 py-4 shadow-sm transition-all ${selectedOrder?.id === order.id ? 'border-amber-200 bg-amber-50/80 shadow-[0_16px_45px_rgba(217,119,6,0.12)]' : 'border-white bg-white/90 hover:-translate-y-0.5 hover:border-stone-200 hover:shadow-[0_14px_36px_rgba(15,23,42,0.08)]'}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`rounded-2xl px-3 py-2 text-center ${selectedOrder?.id === order.id ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                              <span className="block text-[10px] font-bold uppercase tracking-[0.22em]">SO</span>
                              <span className="block text-sm font-bold">{order.code}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <h3 className="font-serif text-lg font-bold leading-snug text-slate-900">{order.title}</h3>
                                <button
                                  onClick={(e) => toggleFavorite(e, order)}
                                  className={`rounded-full p-2 transition-colors ${order.is_favorite ? 'text-amber-500' : 'text-stone-300 hover:bg-stone-100 hover:text-stone-500'}`}
                                >
                                  <Bookmark className={`w-4 h-4 ${order.is_favorite ? 'fill-amber-500' : ''}`} />
                                </button>
                              </div>
                              <p className="mt-2 line-clamp-3 text-sm leading-6 text-stone-500">{order.content}</p>
                              <div className="mt-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                                <span>{order.is_favorite ? 'Saved section' : 'Tap to read'}</span>
                                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {docMode && (
                <>
                  {visibleDocContent.length === 0 ? (
                    <div className="flex h-full min-h-[240px] flex-col items-center justify-center rounded-[24px] border border-dashed border-stone-200 bg-white/70 px-6 text-center">
                      <FileText className="mb-4 h-10 w-10 text-stone-300" />
                      <p className="font-semibold text-stone-600">
                        {showDocBookmarksOnly
                          ? 'No bookmarked passages found.'
                          : docVersion === 'draft'
                            ? 'No draft constitution saved yet.'
                            : 'No document matches found.'}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-stone-400">
                        {docVersion === 'draft'
                          ? 'Upload Draft Constitution in Settings, then return to this page.'
                          : 'Refine your search or switch back to the full constitution view.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {visibleDocContent.map(item => {
                        const bookmark = docBookmarkMap.get(item.id);

                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              setSelectedDocItem(item);
                              setAiExplanation('');
                            }}
                            className={`group cursor-pointer rounded-[24px] border px-4 py-4 shadow-sm transition-all ${selectedDocItem?.id === item.id ? 'border-amber-200 bg-amber-50/80 shadow-[0_16px_45px_rgba(217,119,6,0.12)]' : 'border-white bg-white/90 hover:-translate-y-0.5 hover:border-stone-200 hover:shadow-[0_14px_36px_rgba(15,23,42,0.08)]'}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`rounded-2xl px-3 py-2 text-center ${selectedDocItem?.id === item.id ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>
                                <span className="block text-[10px] font-bold uppercase tracking-[0.22em]">{item.page ? 'Page' : 'Text'}</span>
                                <span className="block text-sm font-bold">{item.page ?? 'Excerpt'}</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">{getDocResultLabel(item.text) || 'Constitution passage'}</p>
                                    <p className="mt-2 line-clamp-3 font-serif text-base leading-7 text-slate-800">{getDocExcerptText(item.text)}</p>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleDocBookmark(item);
                                    }}
                                    className={`rounded-full p-2 transition-colors ${bookmark ? 'text-amber-500' : 'text-stone-300 hover:bg-stone-100 hover:text-stone-500'}`}
                                    title={bookmark ? 'Remove bookmark' : 'Add bookmark'}
                                  >
                                    <Bookmark className={`w-4 h-4 ${bookmark ? 'fill-amber-500' : ''}`} />
                                  </button>
                                </div>

                                <div className="mt-3 flex items-center justify-between gap-3">
                                  {bookmark?.note ? (
                                    <p className="line-clamp-2 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-700">
                                      Note: {bookmark.note}
                                    </p>
                                  ) : (
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Open excerpt</p>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedDocItem(item);
                                        setAiExplanation('');
                                        setShowFullDoc(true);
                                      }}
                                      className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-stone-600 transition hover:border-stone-300 hover:bg-stone-50"
                                      title="Read this result in full-page context"
                                    >
                                      <AlignJustify className="w-3.5 h-3.5" /> Full Page
                                    </button>
                                    <ChevronRight className="w-4 h-4 shrink-0 text-stone-400 transition-transform group-hover:translate-x-0.5" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
            </>
            )}
          </div>

          <div className={`relative min-h-[420px] flex-1 ${hasSelection ? 'flex' : 'hidden md:flex'} flex-col overflow-hidden rounded-[28px] border border-stone-200/80 bg-white/75 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl`}>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.03]">
              <Scale className="w-96 h-96 text-slate-900" />
            </div>

            <div className="border-b border-stone-200/80 bg-white/80 px-4 py-4 backdrop-blur-xl md:hidden">
              <button
                onClick={() => {
                  setSelectedOrder(null);
                  setSelectedDocItem(null);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-600 shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" /> Back to List
              </button>
            </div>

            <div className="relative z-0 flex-1 overflow-y-auto px-5 py-6 md:px-8 md:py-8">
              {selectedOrder && !docMode && (
                <div className="mx-auto max-w-4xl space-y-6">
                  <div className="rounded-[30px] border border-stone-200 bg-[linear-gradient(135deg,_rgba(255,251,235,0.95),_rgba(255,255,255,0.98))] p-6 shadow-[0_22px_60px_rgba(15,23,42,0.08)] md:p-8">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="max-w-2xl">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-700">
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">Standing Order</span>
                          {selectedOrder.is_favorite && <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-amber-700">Saved</span>}
                        </div>
                        <h2 className="mt-4 font-serif text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">{selectedOrder.code}</h2>
                        <p className="mt-4 text-lg leading-8 text-stone-600">{selectedOrder.title}</p>
                      </div>

                      <div className="flex flex-wrap gap-3 lg:justify-end">
                        <button
                          onClick={(e) => toggleFavorite(e, selectedOrder)}
                          className={`inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold transition ${selectedOrder.is_favorite ? 'border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-200' : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50'}`}
                        >
                          <Bookmark className={`w-4 h-4 ${selectedOrder.is_favorite ? 'fill-amber-700' : ''}`} />
                          {selectedOrder.is_favorite ? 'Saved Section' : 'Save Section'}
                        </button>
                        <button
                          onClick={() => handleAskAI(selectedOrder.content, selectedOrder.code)}
                          disabled={aiLoading}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {aiLoading ? <BookOpen className="w-4 h-4 animate-pulse" /> : <Bot className="w-4 h-4" />}
                          {aiLoading ? 'Explaining...' : 'Explain Clearly'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <article className="rounded-[34px] border border-stone-200 bg-white px-6 py-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)] md:px-10 md:py-12">
                    <div className="mb-8 border-b border-stone-200 pb-6">
                      <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-stone-400">Official Text</p>
                      <h3 className="mt-3 font-serif text-2xl font-bold text-slate-900 md:text-3xl">{selectedOrder.title}</h3>
                    </div>

                    <p className="whitespace-pre-wrap font-serif text-[1.08rem] leading-9 tracking-[0.01em] text-stone-700">{selectedOrder.content}</p>

                    {selectedOrder.tags && (
                      <div className="mt-10 flex flex-wrap gap-2 border-t border-stone-200 pt-6">
                        {selectedOrder.tags.map(tag => (
                          <span key={tag} className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-stone-600">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                </div>
              )}

              {selectedDocItem && docMode && (
                <div className="mx-auto max-w-4xl space-y-6">
                  <div className="rounded-[30px] border border-stone-200 bg-[linear-gradient(135deg,_rgba(236,253,245,0.9),_rgba(255,255,255,0.98))] p-6 shadow-[0_22px_60px_rgba(15,23,42,0.08)] md:p-8">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="max-w-2xl">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700">
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">Constitution Excerpt</span>
                          {selectedDocItem.page && <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-stone-600">Page {selectedDocItem.page}</span>}
                          {selectedDocBookmark?.soLabel && <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">{selectedDocBookmark.soLabel}</span>}
                        </div>
                        <h2 className="mt-4 font-serif text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">{selectedDocSummaryLabel}</h2>
                        <p className="mt-3 text-sm leading-7 text-stone-600 md:text-base">
                          Read this excerpt in a calmer format, save a note to your bookmark, or jump straight into the full constitution context.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3 xl:justify-end">
                        <button
                          onClick={() => {
                            setSelectedDocItem(null);
                            setAiExplanation('');
                          }}
                          className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
                        >
                          <ArrowLeft className="w-4 h-4" /> Back to Results
                        </button>
                        <button
                          onClick={() => setShowFullDoc(true)}
                          className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
                        >
                          <AlignJustify className="w-4 h-4" /> Read Full Page
                        </button>
                        <button
                          onClick={() => toggleDocBookmark(selectedDocItem)}
                          className={`inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold transition ${isSelectedDocBookmarked ? 'border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-200' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'}`}
                        >
                          <Bookmark className={`w-4 h-4 ${isSelectedDocBookmarked ? 'fill-amber-700' : ''}`} />
                          {isSelectedDocBookmarked ? 'Bookmarked' : 'Bookmark'}
                        </button>
                        <button
                          onClick={() => handleAskAI(selectedDocItem.text, 'Document Excerpt')}
                          disabled={aiLoading}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {aiLoading ? <BookOpen className="w-4 h-4 animate-pulse" /> : <Bot className="w-4 h-4" />}
                          {aiLoading ? 'Explaining...' : 'Explain Clearly'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <article className="rounded-[34px] border border-amber-200/70 bg-[linear-gradient(180deg,_rgba(255,251,235,0.8),_rgba(255,255,255,1))] p-2 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
                    <div className="rounded-[28px] bg-white px-6 py-8 md:px-10 md:py-12">
                      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-5">
                        <div className="flex items-center gap-2 text-stone-500">
                          <ScrollText className="w-5 h-5 text-amber-600" />
                          <span className="text-sm font-semibold">Selected excerpt</span>
                        </div>
                        {selectedDocItem.page && (
                          <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-stone-600">Page {selectedDocItem.page}</span>
                        )}
                      </div>

                      <p className="whitespace-pre-wrap font-serif text-[1.14rem] leading-9 tracking-[0.01em] text-stone-700 md:text-[1.18rem]">{selectedDocExcerptText}</p>
                    </div>
                  </article>

                  <div className={`grid gap-4 ${isSelectedDocBookmarked ? 'xl:grid-cols-[1.25fr_0.95fr]' : ''}`}>
                    {isSelectedDocBookmarked && (
                    <div className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-stone-400">Bookmark Note</p>
                          <h4 className="mt-2 text-lg font-semibold text-slate-900">Personal reflection or follow-up</h4>
                        </div>
                        {selectedDocBookmark?.soLabel && (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-700">{selectedDocBookmark.soLabel}</span>
                        )}
                      </div>

                      <textarea
                        value={bookmarkNoteDraft}
                        onChange={(e) => setBookmarkNoteDraft(e.target.value)}
                        placeholder="Add a note for why this section matters, how it applies, or what needs follow-up."
                        className="mt-4 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-7 text-stone-700 outline-none transition focus:border-amber-300 focus:bg-white focus:ring-2 focus:ring-amber-100"
                        rows={5}
                      />

                      <div className="mt-4 flex flex-wrap justify-end gap-3">
                        <button
                          onClick={() => upsertDocBookmark(selectedDocItem, bookmarkNoteDraft)}
                          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          <Bookmark className="w-4 h-4" /> Save Bookmark Note
                        </button>
                        <button
                          onClick={() => removeDocBookmark(selectedDocItem.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          <X className="w-4 h-4" /> Remove Bookmark
                        </button>
                      </div>
                    </div>
                    )}

                    <div className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-stone-400">Reading Tools</p>
                      <div className="mt-4 space-y-4 text-sm leading-7 text-stone-600">
                        {!isSelectedDocBookmarked && (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                            <p className="font-semibold text-amber-800">Bookmark to add notes</p>
                            <p className="mt-1 text-amber-700">The follow-up note panel appears after this excerpt is bookmarked.</p>
                          </div>
                        )}
                        <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                          <p className="font-semibold text-slate-900">Context jump</p>
                          <p className="mt-1">Use Full Context to read surrounding pages without losing this selected clause.</p>
                        </div>
                        <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                          <p className="font-semibold text-slate-900">Selected reference</p>
                          <p className="mt-1">{selectedDocBookmark?.soLabel || (selectedDocItem.page ? `Page ${selectedDocItem.page}` : 'General excerpt')}.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!selectedOrder && !selectedDocItem && (
                <div className="flex h-full items-center justify-center px-4 py-8">
                  <div className="w-full max-w-3xl rounded-[36px] border border-stone-200 bg-white/90 px-8 py-10 text-center shadow-[0_25px_80px_rgba(15,23,42,0.08)]">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[28px] bg-slate-900 text-white shadow-lg">
                      <Library className="w-10 h-10" />
                    </div>
                    <h3 className="font-serif text-3xl font-bold text-slate-900">{docMode ? 'Select a passage to start reading' : 'Select a section to open the reader'}</h3>
                    <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-stone-500 md:text-base">
                      {docMode
                        ? 'Choose any constitution passage from the left to read it in a paper-style layout, save a bookmark, add notes, or open the full document around it.'
                        : 'Choose a standing order from the library to read the full text, save it for later, or ask AI for a simpler explanation.'}
                    </p>
                    <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">
                      <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-stone-400">Search</p>
                        <p className="mt-2 text-sm leading-6 text-stone-600">Use the navigator to search by section title, content, or SO number.</p>
                      </div>
                      <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-stone-400">Save</p>
                        <p className="mt-2 text-sm leading-6 text-stone-600">Bookmark sections that need quick return during meetings or pastoral planning.</p>
                      </div>
                      <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-stone-400">Explain</p>
                        <p className="mt-2 text-sm leading-6 text-stone-600">Use AI explanation for plainer interpretation when language is dense or formal.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(selectedOrder || selectedDocItem) && (
                <div className="mx-auto mt-8 max-w-4xl">
                  {aiLoading && (
                    <div className="flex items-center gap-3 rounded-[26px] border border-slate-200 bg-white px-6 py-5 shadow-sm animate-pulse">
                      <Bot className="w-5 h-5 text-slate-400" />
                      <span className="font-medium text-slate-500">Analyzing legal text and simplifying the meaning...</span>
                    </div>
                  )}
                  {aiExplanation && !aiLoading && (
                    <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(135deg,_rgba(248,250,252,1),_rgba(255,251,235,0.55))] p-6 shadow-[0_22px_60px_rgba(15,23,42,0.08)] md:p-8">
                      <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">
                        <Bot className="w-4 h-4 text-amber-600" /> AI Simplification
                      </h4>
                      <p className="mt-4 text-sm leading-8 text-slate-700 md:text-base">{aiExplanation}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StandingOrders;

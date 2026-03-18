import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { DiaryEntry, DiaryCategory, DiarySpiritualTone } from '../types';
import {
  BookHeart, Plus, Search, Loader2, Trash2, Edit2, X,
  Lock, Unlock, BookOpen, Star, Flame,
  Cloud, Zap, Heart, Wind, Sparkles, HelpCircle, Filter, Bell, PenLine, ChevronLeft, ChevronRight
} from 'lucide-react';

// â”€â”€ Spiritual tone config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TONE_CONFIG: Record<DiarySpiritualTone, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  Peaceful:   { label: 'Peaceful',   color: 'text-sky-600',    bg: 'bg-sky-50 border-sky-200',    icon: Cloud },
  Joyful:     { label: 'Joyful',     color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', icon: Star },
  Burdened:   { label: 'Burdened',   color: 'text-slate-600',  bg: 'bg-slate-50 border-slate-200', icon: Wind },
  Wrestling:  { label: 'Wrestling',  color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', icon: Zap },
  Grateful:   { label: 'Grateful',   color: 'text-green-600',  bg: 'bg-green-50 border-green-200', icon: Heart },
  Weary:      { label: 'Weary',      color: 'text-rose-600',   bg: 'bg-rose-50 border-rose-200',  icon: Flame },
  Inspired:   { label: 'Inspired',   color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200', icon: Sparkles },
  Uncertain:  { label: 'Uncertain',  color: 'text-gray-600',   bg: 'bg-gray-50 border-gray-200',  icon: HelpCircle },
};

// â”€â”€ Category config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CATEGORY_COLORS: Record<DiaryCategory, string> = {
  'Appointment':               'bg-rose-100 text-rose-700',
  'Church Program':            'bg-cyan-100 text-cyan-700',
  'Prayer Journal':            'bg-indigo-100 text-indigo-700',
  'Personal Reflection':       'bg-purple-100 text-purple-700',
  'Vision & Calling':          'bg-yellow-100 text-yellow-800',
  'Testimony':                 'bg-green-100 text-green-700',
  'Congregational Observation':'bg-blue-100 text-blue-700',
  'Spiritual Warfare':         'bg-red-100 text-red-700',
  'Gratitude':                 'bg-teal-100 text-teal-700',
  'Ministry Milestone':        'bg-orange-100 text-orange-700',
  'Other':                     'bg-gray-100 text-gray-600',
};

const CATEGORIES: DiaryCategory[] = [
  'Appointment', 'Church Program',
  'Prayer Journal', 'Personal Reflection', 'Vision & Calling', 'Testimony',
  'Congregational Observation', 'Spiritual Warfare', 'Gratitude', 'Ministry Milestone', 'Other',
];

const TONES: DiarySpiritualTone[] = [
  'Peaceful', 'Joyful', 'Burdened', 'Wrestling', 'Grateful', 'Weary', 'Inspired', 'Uncertain',
];

const BLANK_ENTRY: Omit<DiaryEntry, 'id' | 'created_at'> = {
  entry_date: new Date().toISOString().split('T')[0],
  title: '',
  category: 'Personal Reflection',
  spiritual_tone: 'Peaceful',
  body: '',
  scripture_ref: '',
  prayer_response: '',
  is_private: false,
  remind_on: '',
};

// â”€â”€ Reminder urgency helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function reminderUrgency(remindOn?: string | null): { label: string; cls: string } | null {
  if (!remindOn) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(remindOn + 'T00:00:00');
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { label: 'Overdue', cls: 'bg-red-100 text-red-700 border-red-200' };
  if (diff === 0) return { label: 'Today', cls: 'bg-rose-100 text-rose-700 border-rose-200' };
  if (diff === 1) return { label: 'Tomorrow', cls: 'bg-orange-100 text-orange-700 border-orange-200' };
  if (diff <= 7) return { label: `In ${diff} days`, cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
  return { label: remindOn, cls: 'bg-gray-100 text-gray-500 border-gray-200' };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
}
function excerpt(text: string, max = 120) {
  return text.length > max ? text.slice(0, max).trimEnd() + 'â€¦' : text;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const MinisterDiary: React.FC = () => {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  // Modal / editor
  const [modalOpen, setModalOpen]     = useState(false);
  const [viewEntry, setViewEntry]     = useState<DiaryEntry | null>(null);
  const [draft, setDraft]             = useState<Partial<DiaryEntry>>({ ...BLANK_ENTRY });
  const [isEditing, setIsEditing]     = useState(false);

  // Filters
  const [search, setSearch]           = useState('');
  const [filterCat, setFilterCat]     = useState<string>('All');
  const [filterTone, setFilterTone]   = useState<string>('All');
  const [filterPrivate, setFilterPrivate] = useState<'All' | 'Private' | 'Public'>('All');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd]     = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // â”€â”€ Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => { fetchEntries(); }, []);

  const fetchEntries = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('diary_entries')
      .select('*')
      .order('entry_date', { ascending: false });
    if (!error && data) setEntries(data as DiaryEntry[]);
    setLoading(false);
  };

  // â”€â”€ Filtered list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter(e => {
      if (q && !e.title.toLowerCase().includes(q) && !e.body.toLowerCase().includes(q) && !(e.scripture_ref || '').toLowerCase().includes(q)) return false;
      if (filterCat !== 'All' && e.category !== filterCat) return false;
      if (filterTone !== 'All' && e.spiritual_tone !== filterTone) return false;
      if (filterPrivate === 'Private' && !e.is_private) return false;
      if (filterPrivate === 'Public' && e.is_private) return false;
      if (filterStart && e.entry_date < filterStart) return false;
      if (filterEnd && e.entry_date > filterEnd) return false;
      return true;
    });
  }, [entries, search, filterCat, filterTone, filterPrivate, filterStart, filterEnd]);

  // â”€â”€ CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openNew = () => {
    setDraft({ ...BLANK_ENTRY });
    setIsEditing(false);
    setModalOpen(true);
  };

  const openEdit = (entry: DiaryEntry) => {
    setDraft({ ...entry });
    setIsEditing(true);
    setViewEntry(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!draft.title?.trim() || !draft.body?.trim() || !draft.entry_date) {
      alert('Please fill in the date, title, and entry body.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        entry_date: draft.entry_date,
        title: draft.title.trim(),
        category: draft.category,
        spiritual_tone: draft.spiritual_tone,
        body: draft.body.trim(),
        scripture_ref: draft.scripture_ref?.trim() || null,
        prayer_response: draft.prayer_response?.trim() || null,
        is_private: draft.is_private ?? false,
        remind_on: draft.remind_on?.trim() || null,
      };

      if (isEditing && draft.id) {
        const { error } = await supabase.from('diary_entries').update(payload).eq('id', draft.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('diary_entries').insert([payload]);
        if (error) throw error;
      }
      await fetchEntries();
      setModalOpen(false);
    } catch (err: any) {
      alert('Failed to save entry: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Permanently delete this diary entry?')) return;
    const { error } = await supabase.from('diary_entries').delete().eq('id', id);
    if (!error) {
      setEntries(prev => prev.filter(e => e.id !== id));
      setViewEntry(null);
    } else {
      alert('Failed to delete: ' + error.message);
    }
  };

  const ToneIcon = ({ tone }: { tone: DiarySpiritualTone }) => {
    const cfg = TONE_CONFIG[tone];
    return <cfg.icon className={`w-4 h-4 ${cfg.color}`} />;
  };
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  return (
    <div className="min-h-screen p-4 md:p-6" style={{ background: 'linear-gradient(135deg, #f5f0e8 0%, #ede8dc 50%, #e8e0d0 100%)' }}>

      {/* â”€â”€ Diary Cover Header â”€â”€ */}
      <div className="max-w-4xl mx-auto mb-6">
        <div className="relative rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: 'linear-gradient(135deg, #2c1810 0%, #4a2c1a 40%, #6b3d2a 100%)' }}>
          {/* Leather texture lines */}
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)' }} />
          <div className="relative px-8 py-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-400/20 border-2 border-amber-400/40 flex items-center justify-center">
                <BookHeart className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <p className="text-amber-300/70 text-xs font-semibold tracking-widest uppercase">Private & Confidential</p>
                <h1 className="text-2xl font-serif font-bold text-amber-100">Minister's Diary</h1>
                <p className="text-amber-200/60 text-xs mt-0.5">{entries.length} {entries.length === 1 ? 'entry' : 'entries'} Â· {new Date().getFullYear()}</p>
              </div>
            </div>
            <button onClick={openNew}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-100 rounded-xl font-medium text-sm transition-all backdrop-blur-sm">
              <PenLine className="w-4 h-4" /> New Entry
            </button>
          </div>
          {/* Gold binding strip */}
          <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #b8860b, #ffd700, #b8860b)' }} />
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* â”€â”€ Search + Filter bar â”€â”€ */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-sm border border-amber-200/50 p-4 mb-5 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-600/50" />
              <input type="text" placeholder="Search your entriesâ€¦" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-amber-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-amber-50/50 font-serif placeholder:text-amber-400/60" />
            </div>
            <button onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${showFilters ? 'bg-amber-700 text-white border-amber-700' : 'border-amber-200 text-amber-700 hover:bg-amber-50'}`}>
              <Filter className="w-4 h-4" /> Filters
            </button>
          </div>
          {showFilters && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-1">
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                className="col-span-2 sm:col-span-1 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-900 bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-300">
                <option value="All">All Categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterTone} onChange={e => setFilterTone(e.target.value)}
                className="border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-900 bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-300">
                <option value="All">All Tones</option>
                {TONES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={filterPrivate} onChange={e => setFilterPrivate(e.target.value as any)}
                className="border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-900 bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-300">
                <option value="All">All Entries</option>
                <option value="Private">Private Only</option>
                <option value="Public">Public Only</option>
              </select>
              <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)}
                className="border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-900 bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-300" />
              <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)}
                className="border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-900 bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
          )}
        </div>

        {/* â”€â”€ Entries â€” notebook page layout â”€â”€ */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-amber-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-24 h-32 rounded-lg shadow-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #f9f3e6, #f0e8d0)', border: '1px solid #d4b896' }}>
              <BookHeart className="w-10 h-10 text-amber-300" />
            </div>
            <p className="text-amber-700/60 text-sm font-serif italic">
              {entries.length === 0 ? '"The unexamined life is not worth living." â€” Begin your first entry.' : 'No entries match your search.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((entry, idx) => {
              const tone = TONE_CONFIG[entry.spiritual_tone];
              const urgency = reminderUrgency(entry.remind_on);
              // Alternate slight rotation for realism
              const tilt = idx % 3 === 0 ? '-rotate-[0.3deg]' : idx % 3 === 1 ? 'rotate-[0.2deg]' : 'rotate-0';
              return (
                <div key={entry.id} onClick={() => setViewEntry(entry)}
                  className={`relative cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${tilt}`}
                  style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.12))' }}>
                  {/* Notebook page */}
                  <div className="rounded-lg overflow-hidden"
                    style={{ background: 'linear-gradient(180deg, #fefcf7 0%, #fdf8ee 100%)', borderLeft: '4px solid #c8860a' }}>
                    {/* Margin line */}
                    <div className="flex">
                      {/* Left margin with hole punches */}
                      <div className="w-8 shrink-0 flex flex-col items-center gap-8 pt-4 pb-4"
                        style={{ borderRight: '1px solid #f0c080', background: 'rgba(255,200,100,0.08)' }}>
                        <div className="w-3 h-3 rounded-full bg-amber-100 border border-amber-300/60 shadow-inner" />
                        <div className="w-3 h-3 rounded-full bg-amber-100 border border-amber-300/60 shadow-inner" />
                      </div>

                      {/* Page content */}
                      <div className="flex-1 p-4 relative"
                        style={{ backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, #e8d5b0 27px, #e8d5b0 28px)', backgroundPositionY: '14px' }}>
                        {/* Date tab */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-serif text-xs text-amber-700/70 italic">{formatDate(entry.entry_date)}</span>
                            {entry.is_private && (
                              <span className="flex items-center gap-0.5 text-rose-400 text-xs">
                                <Lock className="w-3 h-3" /> Private
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {urgency && (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${urgency.cls}`}>
                                <Bell className="w-3 h-3" /> {urgency.label}
                              </span>
                            )}
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[entry.category]}`}>
                              {entry.category}
                            </span>
                          </div>
                        </div>

                        {/* Title â€” handwriting style */}
                        <h3 className="font-serif font-bold text-amber-950 text-lg leading-tight mb-2 hover:text-amber-800 transition-colors">
                          {entry.title}
                        </h3>

                        {/* Body lines */}
                        <p className="font-serif text-sm text-stone-700 leading-7 line-clamp-3">{excerpt(entry.body, 180)}</p>

                        {/* Scripture */}
                        {entry.scripture_ref && (
                          <p className="mt-2 font-serif text-xs text-amber-700 italic flex items-center gap-1">
                            <BookOpen className="w-3 h-3" /> {entry.scripture_ref}
                          </p>
                        )}

                        {/* Footer tone */}
                        <div className="flex items-center gap-2 mt-3 pt-2" style={{ borderTop: '1px dashed #e8d5b0' }}>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${tone.bg} ${tone.color}`}>
                            <ToneIcon tone={entry.spiritual_tone} /> {entry.spiritual_tone}
                          </span>
                          <span className="ml-auto text-xs text-amber-400/60 font-serif italic">tap to read â†’</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* â•â• View Entry â€” Open Book Modal â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {viewEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setViewEntry(null)}>
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl"
            style={{ background: 'linear-gradient(180deg, #fefcf7 0%, #fdf8ee 100%)', border: '2px solid #c8860a' }}
            onClick={e => e.stopPropagation()}>
            {/* Book top bar */}
            <div className="h-2 w-full rounded-t-2xl" style={{ background: 'linear-gradient(90deg, #b8860b, #ffd700, #b8860b)' }} />

            {/* Header */}
            <div className="sticky top-0 bg-amber-50/95 backdrop-blur-sm px-6 py-4 flex items-start justify-between gap-4"
              style={{ borderBottom: '1px solid #e8d5b0' }}>
              <div className="flex-1 min-w-0">
                <p className="font-serif text-xs text-amber-600/70 italic mb-0.5">{formatDate(viewEntry.entry_date)}</p>
                <h2 className="font-serif text-xl font-bold text-amber-950 leading-snug">{viewEntry.title}</h2>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openEdit(viewEntry)} className="p-2 text-amber-600/60 hover:text-amber-800 hover:bg-amber-100 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(viewEntry.id)} className="p-2 text-amber-600/60 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                <button onClick={() => setViewEntry(null)} className="p-2 text-amber-600/60 hover:text-amber-900 hover:bg-amber-100 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Meta */}
            <div className="px-6 py-3 flex flex-wrap gap-2" style={{ borderBottom: '1px dashed #e8d5b0' }}>
              <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${CATEGORY_COLORS[viewEntry.category]}`}>{viewEntry.category}</span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border ${TONE_CONFIG[viewEntry.spiritual_tone].bg} ${TONE_CONFIG[viewEntry.spiritual_tone].color}`}>
                <ToneIcon tone={viewEntry.spiritual_tone} /> {viewEntry.spiritual_tone}
              </span>
              {viewEntry.is_private && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-rose-50 text-rose-600 border border-rose-100"><Lock className="w-3 h-3" /> Private</span>
              )}
              {viewEntry.remind_on && (() => {
                const u = reminderUrgency(viewEntry.remind_on);
                return u ? (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold border ${u.cls}`}><Bell className="w-3 h-3" /> Reminder: {u.label}</span>
                ) : null;
              })()}
            </div>

            {/* Body â€” lined paper */}
            <div className="px-8 py-6 space-y-5"
              style={{ backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, #e8d5b0 31px, #e8d5b0 32px)', backgroundPositionY: '16px', minHeight: '200px' }}>
              <p className="font-serif text-base text-stone-800 leading-8 whitespace-pre-wrap">{viewEntry.body}</p>

              {viewEntry.scripture_ref && (
                <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-xl px-4 py-3 mt-4">
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-0.5">Scripture</p>
                  <p className="font-serif text-sm font-medium text-amber-900">{viewEntry.scripture_ref}</p>
                </div>
              )}

              {viewEntry.prayer_response && (
                <div className="bg-purple-50/60 border-l-4 border-purple-400 rounded-r-xl px-4 py-3 mt-2">
                  <p className="text-xs font-semibold text-purple-500 uppercase tracking-wider mb-0.5">Prayer Response</p>
                  <p className="font-serif text-sm text-purple-900 whitespace-pre-wrap leading-7">{viewEntry.prayer_response}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* â•â• Editor Modal â€” Cream Paper â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[95vh] overflow-y-auto flex flex-col rounded-2xl shadow-2xl"
            style={{ background: 'linear-gradient(180deg, #fefcf7 0%, #fdf8ee 100%)', border: '2px solid #c8860a' }}>
            <div className="h-1.5 w-full rounded-t-2xl" style={{ background: 'linear-gradient(90deg, #b8860b, #ffd700, #b8860b)' }} />

            <div className="sticky top-0 bg-amber-50/95 backdrop-blur-sm px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid #e8d5b0' }}>
              <div className="flex items-center gap-2">
                <PenLine className="w-5 h-5 text-amber-700" />
                <h2 className="font-serif text-lg font-bold text-amber-950">{isEditing ? 'Edit Entry' : 'New Diary Entry'}</h2>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-2 text-amber-600/60 hover:text-amber-900 hover:bg-amber-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-5 flex-1">
              {/* Dates + Privacy */}
              <div className="flex gap-3 items-end flex-wrap">
                <div className="flex-1 min-w-[130px]">
                  <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1.5">Entry Date</label>
                  <input type="date" value={draft.entry_date || ''}
                    onChange={e => setDraft(d => ({ ...d, entry_date: e.target.value }))}
                    className="w-full border border-amber-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-amber-50 font-serif" />
                </div>
                <div className="flex-1 min-w-[130px]">
                  <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1.5">Reminder Date <span className="text-amber-300 font-normal">(optional)</span></label>
                  <input type="date" value={draft.remind_on || ''}
                    onChange={e => setDraft(d => ({ ...d, remind_on: e.target.value || null }))}
                    className="w-full border border-amber-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 bg-amber-50 font-serif" />
                </div>
                <button type="button" onClick={() => setDraft(d => ({ ...d, is_private: !d.is_private }))}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${draft.is_private ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-amber-50 border-amber-200 text-amber-600 hover:border-rose-200 hover:text-rose-500'}`}>
                  {draft.is_private ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  {draft.is_private ? 'Private' : 'Public'}
                </button>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1.5">Title</label>
                <input type="text" placeholder="Give this entry a titleâ€¦" value={draft.title || ''}
                  onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                  className="w-full border border-amber-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-amber-50 font-serif" />
              </div>

              {/* Category + Tone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1.5">Category</label>
                  <select value={draft.category || 'Personal Reflection'}
                    onChange={e => setDraft(d => ({ ...d, category: e.target.value as DiaryCategory }))}
                    className="w-full border border-amber-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-amber-50">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1.5">Spiritual Tone</label>
                  <select value={draft.spiritual_tone || 'Peaceful'}
                    onChange={e => setDraft(d => ({ ...d, spiritual_tone: e.target.value as DiarySpiritualTone }))}
                    className="w-full border border-amber-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-amber-50">
                    {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Scripture */}
              <div>
                <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1.5">Scripture Reference <span className="text-amber-300 font-normal">(optional)</span></label>
                <input type="text" placeholder="e.g. Psalm 46:1 or Isaiah 40:28-31" value={draft.scripture_ref || ''}
                  onChange={e => setDraft(d => ({ ...d, scripture_ref: e.target.value }))}
                  className="w-full border border-amber-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-amber-50 font-serif" />
              </div>

              {/* Body */}
              <div>
                <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1.5">Entry</label>
                <textarea rows={9} placeholder="Write your thoughts, reflections, observations, or prayers hereâ€¦"
                  value={draft.body || ''} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))}
                  className="w-full border border-amber-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-amber-50/60 font-serif resize-y leading-8"
                  style={{ backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, #f0d9a0 31px, #f0d9a0 32px)', backgroundPositionY: '16px' }} />
              </div>

              {/* Prayer Response */}
              <div>
                <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1.5">Prayer Response <span className="text-amber-300 font-normal">(optional)</span></label>
                <textarea rows={3} placeholder="How did you pray? What did God speak to you?"
                  value={draft.prayer_response || ''} onChange={e => setDraft(d => ({ ...d, prayer_response: e.target.value }))}
                  className="w-full border border-amber-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-amber-50 font-serif resize-y" />
              </div>
            </div>

            <div className="sticky bottom-0 bg-amber-50/95 backdrop-blur-sm px-6 py-4 flex justify-end gap-3 rounded-b-2xl"
              style={{ borderTop: '1px solid #e8d5b0' }}>
              <button onClick={() => setModalOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-amber-200 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-opacity disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #b8860b, #8b6914)' }}>
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Savingâ€¦' : isEditing ? 'Save Changes' : 'Save Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MinisterDiary;

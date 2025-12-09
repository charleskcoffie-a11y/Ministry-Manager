
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { CounselingSession, CaseType, CounselingStatus } from '../types';
import { APP_CONSTANTS } from '../constants';
import { 
  ShieldCheck, Lock, Unlock, Eye, EyeOff, User, 
  Plus, Search, Calendar, Activity, Heart, Users, 
  Baby, Cross, Brain, Sparkles, X, Save, Clock, KeyRound,
  HeartHandshake, Leaf, ArrowRight, BookOpen
} from 'lucide-react';

const CASE_TYPES: CaseType[] = ['Marriage', 'Family', 'Addiction', 'Youth', 'Bereavement', 'Spiritual', 'Other'];
const STATUSES: CounselingStatus[] = ['Open', 'In Progress', 'Closed'];

const CounselingManager: React.FC = () => {
  // Security State
  const [isLocked, setIsLocked] = useState(true);
  const [blurMode, setBlurMode] = useState(true);
  const [inputCode, setInputCode] = useState('');
  const [lockError, setLockError] = useState('');

  // Data State
  const [sessions, setSessions] = useState<CounselingSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | CounselingStatus>('All');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Partial<CounselingSession>>({
    initials: '',
    case_type: 'Spiritual',
    status: 'Open',
    summary: '',
    key_issues: '',
    scriptures_used: '',
    action_steps: '',
    prayer_points: '',
    follow_up_date: ''
  });
  const [createReminder, setCreateReminder] = useState(false);

  useEffect(() => {
    if (!isLocked) {
      fetchSessions();
    }
  }, [isLocked]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode === APP_CONSTANTS.COUNSELING_MASTER_CODE) {
      setIsLocked(false);
      setLockError('');
      setInputCode('');
    } else {
      setLockError('Incorrect Master Code');
      setInputCode('');
    }
  };

  const fetchSessions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('counseling_sessions')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data && !error) setSessions(data);
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession.initials || !editingSession.case_type) return;

    let savedSessionId = editingSession.id;

    if (editingSession.id) {
      // Update
      const { error } = await supabase
        .from('counseling_sessions')
        .update(editingSession)
        .eq('id', editingSession.id);
      if (!error) fetchSessions();
    } else {
      // Create
      const { data, error } = await supabase
        .from('counseling_sessions')
        .insert([editingSession])
        .select()
        .single();
      
      if (data) savedSessionId = data.id;
      if (!error) fetchSessions();
    }

    // Handle Reminder Creation
    if (createReminder && editingSession.follow_up_date && savedSessionId) {
        const { error: reminderError } = await supabase
            .from('reminders')
            .insert([{
                title: `Counseling Follow-up: ${editingSession.initials}`,
                category: 'Counseling',
                frequency: 'One-time',
                start_date: editingSession.follow_up_date,
                notes: `Follow up on case regarding ${editingSession.case_type}.`,
                is_active: true
            }]);
        
        if (reminderError) console.error("Failed to create reminder", reminderError);
        else alert("Reminder created successfully!");
    }

    closeModal();
  };

  const openNewModal = () => {
    setEditingSession({
        initials: '',
        case_type: 'Spiritual',
        status: 'Open',
        summary: '',
        key_issues: '',
        scriptures_used: '',
        action_steps: '',
        prayer_points: '',
        follow_up_date: ''
    });
    setCreateReminder(false);
    setIsModalOpen(true);
  };

  const openEditModal = (session: CounselingSession) => {
    setEditingSession({
        ...session,
        follow_up_date: session.follow_up_date ? new Date(session.follow_up_date).toISOString().slice(0, 16) : ''
    });
    setCreateReminder(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
      setIsModalOpen(false);
      setEditingSession({});
  };

  // --- Helpers ---
  const getTypeIcon = (type: CaseType) => {
      switch(type) {
          case 'Marriage': return <Heart className="w-4 h-4 text-rose-500" />;
          case 'Family': return <Users className="w-4 h-4 text-blue-500" />;
          case 'Youth': return <Baby className="w-4 h-4 text-emerald-500" />;
          case 'Addiction': return <Activity className="w-4 h-4 text-amber-500" />;
          case 'Bereavement': return <Cross className="w-4 h-4 text-purple-500" />;
          case 'Spiritual': return <Sparkles className="w-4 h-4 text-indigo-500" />;
          default: return <Brain className="w-4 h-4 text-gray-500" />;
      }
  };

  const getStatusColor = (status: CounselingStatus) => {
      switch(status) {
          case 'Open': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
          case 'In Progress': return 'bg-blue-100 text-blue-700 border-blue-200';
          case 'Closed': return 'bg-gray-100 text-gray-500 border-gray-200';
          default: return 'bg-gray-50 text-gray-600';
      }
  };

  const filteredSessions = sessions.filter(s => {
      const matchSearch = s.initials.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.summary?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = filterStatus === 'All' ? true : s.status === filterStatus;
      return matchSearch && matchStatus;
  });

  // --- LOCKED VIEW ---
  if (isLocked) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[70vh] animate-fade-in p-6">
              <div className="bg-white p-10 rounded-3xl shadow-xl border border-slate-100 max-w-md w-full text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-slate-700 to-slate-900"></div>
                  
                  <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 mx-auto border-4 border-white shadow-sm">
                      <Lock className="w-10 h-10 text-slate-400" />
                  </div>
                  
                  <h2 className="text-3xl font-serif font-bold text-slate-800 mb-2">Confidential Notes</h2>
                  <p className="text-slate-500 mb-8 text-sm leading-relaxed">
                      This area is protected to ensure the privacy of pastoral counseling records. 
                  </p>
                  
                  <form onSubmit={handleUnlock} className="flex flex-col gap-4">
                      <div className="relative">
                          <KeyRound className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                          <input 
                              type="password" 
                              placeholder="Enter Master Code"
                              className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-slate-400 focus:bg-white transition-all outline-none font-medium text-slate-800 placeholder-slate-400"
                              value={inputCode}
                              onChange={(e) => setInputCode(e.target.value)}
                              autoFocus
                          />
                      </div>
                      
                      {lockError && (
                          <div className="text-rose-500 text-sm font-medium bg-rose-50 py-2 rounded-lg flex items-center justify-center gap-2">
                              <ShieldCheck className="w-4 h-4"/> {lockError}
                          </div>
                      )}

                      <button 
                        type="submit"
                        className="w-full py-3.5 bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition-all font-medium flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform active:scale-[0.98]"
                      >
                          <Unlock className="w-5 h-5" /> Access Records
                      </button>
                  </form>
              </div>
          </div>
      );
  }

  // --- SECURE VIEW ---
  return (
    <div className="max-w-6xl mx-auto pb-16 animate-fade-in space-y-8">
      
      {/* 1. Header & Actions (Pastoral Theme) */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-white rounded-3xl p-8 border border-emerald-100/50 shadow-sm relative overflow-hidden">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10">
              <HeartHandshake className="w-64 h-64 text-emerald-600" />
          </div>

          <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                    <span className="bg-emerald-100/80 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Secure Area
                    </span>
                    {blurMode && (
                        <span className="bg-indigo-100/80 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                            <EyeOff className="w-3 h-3" /> Privacy Mode On
                        </span>
                    )}
                </div>
                <h1 className="text-4xl font-serif font-bold text-emerald-950 flex items-center gap-3">
                    Counseling Journal
                </h1>
                <p className="text-emerald-800/60 mt-2 text-lg font-light max-w-lg">
                    A safe space for documenting pastoral care, guidance, and prayerful support.
                </p>
              </div>

              {/* Primary Actions */}
              <div className="flex flex-wrap gap-3">
                 <button 
                    onClick={() => setBlurMode(!blurMode)}
                    className={`flex items-center gap-2 px-5 py-3 rounded-full font-semibold transition-all shadow-sm active:scale-95 ${
                        blurMode 
                        ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 ring-1 ring-indigo-200' 
                        : 'bg-white text-slate-600 hover:bg-slate-50 ring-1 ring-slate-200'
                    }`}
                 >
                     {blurMode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                     <span className="hidden sm:inline">{blurMode ? 'Hidden' : 'Visible'}</span>
                 </button>

                 <button 
                    onClick={openNewModal}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 font-semibold transition-all shadow-md hover:shadow-lg shadow-emerald-200 active:scale-95"
                 >
                     <Plus className="w-5 h-5" /> 
                     <span>New Case</span>
                 </button>

                 <button 
                    onClick={() => setIsLocked(true)}
                    className="flex items-center gap-2 px-5 py-3 bg-white text-rose-600 border border-rose-100 rounded-full hover:bg-rose-50 font-semibold transition-all shadow-sm hover:border-rose-200 active:scale-95"
                    title="Lock Screen"
                 >
                     <Lock className="w-5 h-5" />
                 </button>
              </div>
          </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
          {/* Search */}
          <div className="relative w-full md:flex-1 group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
              </div>
              <input 
                type="text"
                placeholder="Search by initials or case notes..."
                className="w-full pl-12 pr-4 py-4 bg-white border-none rounded-full shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500/50 text-gray-700 placeholder-gray-400 transition-all"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
          </div>

          {/* Filter Tabs */}
          <div className="bg-slate-100 p-1.5 rounded-full flex gap-1 overflow-x-auto max-w-full md:w-auto">
              {['All', ...STATUSES].map(status => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status as any)}
                    className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 whitespace-nowrap ${
                        filterStatus === status 
                        ? 'bg-white text-emerald-800 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                    }`}
                  >
                      {status}
                  </button>
              ))}
          </div>
      </div>

      {/* 3. Case Grid or Empty State */}
      {loading ? (
          <div className="flex justify-center py-24">
              <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                  <p className="text-emerald-600/60 font-medium animate-pulse">Retrieving secure records...</p>
              </div>
          </div>
      ) : filteredSessions.length === 0 ? (
          /* New Comforting Empty State */
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-white rounded-3xl border border-dashed border-slate-200 shadow-sm">
             <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
                 <HeartHandshake className="w-10 h-10 text-emerald-400" />
             </div>
             <h3 className="text-2xl font-serif font-bold text-slate-800 mb-2">Pastoral Care</h3>
             <p className="text-slate-500 max-w-md text-lg leading-relaxed mb-8">
                 No counseling records found matching your criteria. <br/>
                 When you begin a case, it will appear here as a secure journal.
             </p>
             <button 
                onClick={openNewModal}
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-50 text-emerald-700 rounded-full font-semibold hover:bg-emerald-100 transition-colors"
             >
                 <Plus className="w-5 h-5"/> Start a New Record
             </button>
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSessions.map(session => (
                  <div 
                    key={session.id} 
                    onClick={() => openEditModal(session)}
                    className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-lg hover:border-emerald-100 transition-all cursor-pointer group flex flex-col h-full"
                  >
                      {/* Card Header */}
                      <div className="flex justify-between items-start mb-5">
                          <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-inner ${blurMode ? 'bg-slate-100 text-slate-400 blur-[2px]' : 'bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-700'}`}>
                                  {session.initials.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                  <h3 className={`font-bold text-lg text-slate-800 ${blurMode ? 'blur-sm select-none' : ''}`}>
                                      {session.initials}
                                  </h3>
                                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mt-0.5">
                                      {getTypeIcon(session.case_type)}
                                      <span>{session.case_type}</span>
                                  </div>
                              </div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(session.status)}`}>
                              {session.status}
                          </span>
                      </div>

                      {/* Summary Preview */}
                      <div className={`flex-1 text-sm text-slate-600 mb-6 leading-relaxed ${blurMode ? 'blur-sm select-none opacity-40' : ''}`}>
                          {session.summary ? (
                              <p className="line-clamp-3">{session.summary}</p>
                          ) : (
                              <p className="italic text-slate-400">No summary provided.</p>
                          )}
                      </div>

                      {/* Card Footer */}
                      <div className="flex items-center justify-between text-xs pt-4 border-t border-slate-50 mt-auto">
                          <div className="flex items-center gap-1.5 text-slate-400">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>{new Date(session.created_at!).toLocaleDateString()}</span>
                          </div>
                          
                          {session.follow_up_date ? (
                              <div className={`flex items-center gap-1.5 font-bold ${new Date(session.follow_up_date) < new Date() && session.status !== 'Closed' ? 'text-rose-500' : 'text-blue-500'}`}>
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>{new Date(session.follow_up_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                              </div>
                          ) : (
                              <div className="text-slate-300 flex items-center gap-1">
                                  <span>No Follow-up</span>
                              </div>
                          )}
                      </div>
                  </div>
              ))}
          </div>
      )}

      {/* --- MODAL --- */}
      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-white/20">
                  {/* Modal Header */}
                  <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-emerald-50/50 to-white">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700">
                             <ShieldCheck className="w-5 h-5" />
                          </div>
                          <div>
                              <h3 className="font-serif font-bold text-xl text-slate-800">{editingSession.id ? 'Edit Case Journal' : 'New Confidential Case'}</h3>
                              <p className="text-xs text-slate-500">Secure Record</p>
                          </div>
                      </div>
                      <button type="button" onClick={closeModal} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                          <X className="w-6 h-6" />
                      </button>
                  </div>

                  {/* Modal Body */}
                  <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-8 space-y-8">
                      {/* Identity Section */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                              <label className="block text-sm font-bold text-slate-700 mb-2">Subject Initials <span className="text-rose-500">*</span></label>
                              <div className="relative">
                                  <User className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                                  <input 
                                    required
                                    type="text" 
                                    maxLength={5}
                                    className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none uppercase font-bold tracking-widest text-slate-800"
                                    placeholder="J.D."
                                    value={editingSession.initials}
                                    onChange={e => setEditingSession({...editingSession, initials: e.target.value.toUpperCase()})}
                                  />
                              </div>
                              <p className="text-xs text-slate-400 mt-1 ml-1">Use initials only for privacy.</p>
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-slate-700 mb-2">Case Context</label>
                              <select 
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-white text-slate-700 font-medium"
                                value={editingSession.case_type}
                                onChange={e => setEditingSession({...editingSession, case_type: e.target.value as CaseType})}
                              >
                                  {CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                          </div>
                      </div>

                      {/* Status Section */}
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                              <label className="block text-sm font-bold text-slate-700 mb-2">Current Status</label>
                              <div className="relative">
                                  <Activity className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                                  <select 
                                    className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-white font-medium"
                                    value={editingSession.status}
                                    onChange={e => setEditingSession({...editingSession, status: e.target.value as CounselingStatus})}
                                  >
                                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                              </div>
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-slate-700 mb-2">Next Follow-up</label>
                              <div className="relative">
                                  <Calendar className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                                  <input 
                                    type="datetime-local"
                                    className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-white"
                                    value={editingSession.follow_up_date || ''}
                                    onChange={e => setEditingSession({...editingSession, follow_up_date: e.target.value})}
                                  />
                              </div>
                              {editingSession.follow_up_date && (
                                  <label className="flex items-center gap-2 mt-3 text-sm text-emerald-700 font-bold cursor-pointer bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                                      <input 
                                        type="checkbox" 
                                        checked={createReminder}
                                        onChange={e => setCreateReminder(e.target.checked)}
                                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300"
                                      />
                                      <span>Add to Reminder System</span>
                                  </label>
                              )}
                          </div>
                      </div>

                      {/* Notes Section */}
                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Case Summary</label>
                          <textarea 
                            rows={3}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-y text-slate-700 leading-relaxed"
                            placeholder="Overview of the situation..."
                            value={editingSession.summary || ''}
                            onChange={e => setEditingSession({...editingSession, summary: e.target.value})}
                          />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div>
                              <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                  <Brain className="w-4 h-4 text-slate-400" /> Key Issues
                              </label>
                              <textarea 
                                rows={4}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none text-sm"
                                placeholder="• Bullet points..."
                                value={editingSession.key_issues || ''}
                                onChange={e => setEditingSession({...editingSession, key_issues: e.target.value})}
                              />
                           </div>
                           <div>
                              <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                  <BookOpen className="w-4 h-4 text-slate-400" /> Scriptures & Guidance
                              </label>
                              <textarea 
                                rows={4}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none text-sm"
                                placeholder="e.g. Psalm 23, 1 Cor 13..."
                                value={editingSession.scriptures_used || ''}
                                onChange={e => setEditingSession({...editingSession, scriptures_used: e.target.value})}
                              />
                           </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div>
                              <label className="block text-sm font-bold text-blue-800 mb-2">Action Steps</label>
                              <div className="bg-blue-50/50 p-1 rounded-xl">
                                  <textarea 
                                    rows={4}
                                    className="w-full px-4 py-3 border border-blue-100 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none bg-white text-sm"
                                    placeholder="Next steps for counsellee..."
                                    value={editingSession.action_steps || ''}
                                    onChange={e => setEditingSession({...editingSession, action_steps: e.target.value})}
                                  />
                              </div>
                           </div>
                           <div>
                              <label className="block text-sm font-bold text-purple-800 mb-2">Prayer Points</label>
                              <div className="bg-purple-50/50 p-1 rounded-xl">
                                  <textarea 
                                    rows={4}
                                    className="w-full px-4 py-3 border border-purple-100 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none resize-none bg-white text-sm"
                                    placeholder="Specific prayer needs..."
                                    value={editingSession.prayer_points || ''}
                                    onChange={e => setEditingSession({...editingSession, prayer_points: e.target.value})}
                                  />
                              </div>
                           </div>
                      </div>
                  </form>

                  {/* Modal Footer */}
                  <div className="px-8 py-5 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
                      <button type="button" onClick={closeModal} className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-200 rounded-full transition-colors">
                          Cancel
                      </button>
                      <button onClick={handleSave} className="px-8 py-3 bg-slate-800 text-white font-bold hover:bg-slate-900 rounded-full transition-transform active:scale-95 shadow-md flex items-center gap-2">
                          <Save className="w-4 h-4" /> Save Record
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default CounselingManager;

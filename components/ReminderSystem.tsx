
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Reminder, ReminderCategory, ReminderFrequency } from '../types';
import { suggestPastoralReminders } from '../services/geminiService';
import { 
  Bell, CalendarClock, User, BookOpen, HeartHandshake, Mic2, 
  Users, Sparkles, Plus, Trash2, Edit2, X, RefreshCw, Loader2, Check 
} from 'lucide-react';

const CATEGORIES: ReminderCategory[] = [
  'Sermon Preparation', 'Visitation', 'Counseling', 'Prayer & Fasting', 'Meeting', 'Personal Devotion', 'Other'
];

const FREQUENCIES: ReminderFrequency[] = ['One-time', 'Daily', 'Weekly', 'Monthly', 'Yearly'];

const ReminderSystem: React.FC = () => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'inactive'>('active');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Partial<Reminder>>({
    title: '',
    category: 'Personal Devotion',
    frequency: 'One-time',
    start_date: new Date().toISOString().slice(0, 16), // current datetime local format
    notes: '',
    is_active: true
  });

  // AI State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetchReminders();
  }, []);

  const fetchReminders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .order('start_date', { ascending: true });
    
    if (data && !error) setReminders(data);
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReminder.title) return;

    const reminderData = { ...editingReminder };

    if (editingReminder.id) {
      const { error } = await supabase.from('reminders').update(reminderData).eq('id', editingReminder.id);
      if (!error) fetchReminders();
    } else {
      const { error } = await supabase.from('reminders').insert([reminderData]);
      if (!error) fetchReminders();
    }
    closeModal();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this reminder?")) return;
    const { error } = await supabase.from('reminders').delete().eq('id', id);
    if (!error) fetchReminders();
  };

  const toggleStatus = async (reminder: Reminder) => {
    const { error } = await supabase
      .from('reminders')
      .update({ is_active: !reminder.is_active })
      .eq('id', reminder.id);
    
    if (!error) fetchReminders();
  };

  const openNewModal = () => {
    setEditingReminder({
      title: '',
      category: 'Sermon Preparation',
      frequency: 'One-time',
      start_date: new Date().toISOString().slice(0, 16),
      notes: '',
      is_active: true
    });
    setIsModalOpen(true);
  };

  const openEditModal = (r: Reminder) => {
    setEditingReminder({
        ...r,
        start_date: new Date(r.start_date).toISOString().slice(0, 16) // Format for input datetime-local
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingReminder({});
  };

  // --- AI Logic ---
  const handleAiSuggest = async () => {
    setIsAiModalOpen(true);
    setAiLoading(true);
    setAiSuggestions([]);

    try {
        // 1. Fetch Context (Tasks & Programs)
        const { data: tasks } = await supabase.from('tasks').select('*').limit(10);
        const { data: programs } = await supabase.from('church_programs').select('*').limit(5);

        const context = JSON.stringify({
            tasks: tasks || [],
            programs: programs || [],
            current_date: new Date().toISOString()
        });

        // 2. Call Service
        const suggestions = await suggestPastoralReminders(context);
        setAiSuggestions(suggestions);

    } catch (e) {
        console.error("AI Suggestion failed", e);
    }
    setAiLoading(false);
  };

  const acceptSuggestion = async (suggestion: any) => {
     const { error } = await supabase.from('reminders').insert([{
         ...suggestion,
         is_active: true
     }]);
     if (!error) {
         setAiSuggestions(prev => prev.filter(s => s !== suggestion));
         fetchReminders();
     }
  };

  // --- Helpers ---
  const getCategoryIcon = (cat: ReminderCategory) => {
    switch(cat) {
        case 'Sermon Preparation': return <BookOpen className="w-5 h-5 text-indigo-500" />;
        case 'Visitation': return <User className="w-5 h-5 text-green-500" />;
        case 'Counseling': return <HeartHandshake className="w-5 h-5 text-pink-500" />;
        case 'Prayer & Fasting': return <Sparkles className="w-5 h-5 text-purple-500" />;
        case 'Meeting': return <Users className="w-5 h-5 text-blue-500" />;
        case 'Personal Devotion': return <Mic2 className="w-5 h-5 text-amber-500" />; // Mic2 used as 'Quiet Time' symbol
        default: return <Bell className="w-5 h-5 text-gray-400" />;
    }
  };

  const filteredReminders = reminders.filter(r => filter === 'active' ? r.is_active : !r.is_active);

  return (
    <div className="max-w-6xl mx-auto pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div>
           <h1 className="text-4xl font-bold text-gray-800 flex items-center gap-3">
              <Bell className="w-10 h-10 text-primary" />
              Pastoral Reminders
           </h1>
           <p className="text-gray-500 mt-2">Manage spiritual habits, ministry duties, and recurring events.</p>
        </div>

        <div className="flex gap-3 w-full md:w-auto">
             <button 
                onClick={handleAiSuggest}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-100 text-purple-700 rounded-xl hover:bg-purple-200 font-medium transition-colors flex-1 md:flex-none"
             >
                 <Sparkles className="w-5 h-5" /> AI Suggest
             </button>
             <button 
                onClick={openNewModal}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-primary text-white rounded-xl hover:bg-blue-700 font-medium transition-colors shadow-sm flex-1 md:flex-none"
             >
                 <Plus className="w-5 h-5" /> Add Reminder
             </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-200">
         <button 
            onClick={() => setFilter('active')}
            className={`pb-3 text-sm font-semibold transition-colors ${filter === 'active' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`}
         >
            Active Reminders
         </button>
         <button 
            onClick={() => setFilter('inactive')}
            className={`pb-3 text-sm font-semibold transition-colors ${filter === 'inactive' ? 'text-gray-800 border-b-2 border-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
         >
            Inactive / Archived
         </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-gray-300" /></div>
      ) : filteredReminders.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <CalendarClock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No reminders found.</p>
            <button onClick={openNewModal} className="text-primary hover:underline mt-2">Create one now</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReminders.map(r => (
                <div key={r.id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all p-5 group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-50 rounded-lg">
                                {getCategoryIcon(r.category)}
                            </div>
                            <div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">{r.category}</span>
                                <h3 className="font-bold text-gray-800 leading-tight">{r.title}</h3>
                            </div>
                        </div>
                        <div className={`px-2 py-1 rounded text-xs font-bold uppercase ${r.frequency === 'One-time' ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-600'}`}>
                            {r.frequency}
                        </div>
                    </div>

                    <div className="mb-4">
                         <div className="text-sm text-gray-600 flex items-center gap-2 mb-1">
                             <CalendarClock className="w-4 h-4 text-gray-400" />
                             {new Date(r.start_date).toLocaleString(undefined, { 
                                 weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' 
                             })}
                         </div>
                         {r.notes && <p className="text-sm text-gray-500 italic truncate mt-2">{r.notes}</p>}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                        <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer select-none">
                            <div 
                                onClick={() => toggleStatus(r)}
                                className={`w-10 h-6 rounded-full p-1 transition-colors ${r.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${r.is_active ? 'translate-x-4' : ''}`}></div>
                            </div>
                            {r.is_active ? 'Active' : 'Paused'}
                        </label>
                        
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEditModal(r)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600">
                                <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(r.id)} className="p-2 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      )}

      {/* --- Add/Edit Modal --- */}
      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
              <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
                  <form onSubmit={handleSave}>
                      <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                          <h3 className="font-bold text-lg text-gray-800">{editingReminder.id ? 'Edit Reminder' : 'New Reminder'}</h3>
                          <button type="button" onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                              <X className="w-5 h-5" />
                          </button>
                      </div>
                      
                      <div className="p-6 space-y-4">
                          <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">Title</label>
                              <input 
                                required
                                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary outline-none"
                                placeholder="e.g. Prepare Sermon Slides"
                                value={editingReminder.title}
                                onChange={e => setEditingReminder({...editingReminder, title: e.target.value})}
                              />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
                                  <select 
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-primary outline-none bg-white"
                                    value={editingReminder.category}
                                    onChange={e => setEditingReminder({...editingReminder, category: e.target.value as ReminderCategory})}
                                  >
                                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                  </select>
                              </div>
                              
                              <div>
                                  <label className="block text-sm font-semibold text-gray-700 mb-1">Frequency</label>
                                  <select 
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-primary outline-none bg-white"
                                    value={editingReminder.frequency}
                                    onChange={e => setEditingReminder({...editingReminder, frequency: e.target.value as ReminderFrequency})}
                                  >
                                      {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                                  </select>
                              </div>
                          </div>

                          <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">Start Date & Time</label>
                              <input 
                                type="datetime-local"
                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-primary outline-none"
                                value={editingReminder.start_date}
                                onChange={e => setEditingReminder({...editingReminder, start_date: e.target.value})}
                              />
                          </div>

                          <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">Notes (Optional)</label>
                              <textarea 
                                rows={3}
                                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary outline-none resize-none"
                                placeholder="Add specific details..."
                                value={editingReminder.notes || ''}
                                onChange={e => setEditingReminder({...editingReminder, notes: e.target.value})}
                              />
                          </div>
                      </div>

                      <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
                          <button type="button" onClick={closeModal} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-xl transition-colors">
                              Cancel
                          </button>
                          <button type="submit" className="px-5 py-2.5 bg-primary text-white font-medium hover:bg-blue-700 rounded-xl transition-colors shadow-sm">
                              Save
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* --- AI Suggestions Modal --- */}
      {isAiModalOpen && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
              <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                  <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-purple-50 to-white">
                      <div className="flex items-center gap-2">
                          <Sparkles className="w-6 h-6 text-purple-600" />
                          <h3 className="font-bold text-lg text-gray-800">AI Suggested Reminders</h3>
                      </div>
                      <button onClick={() => setIsAiModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
                      {aiLoading ? (
                          <div className="flex flex-col items-center justify-center py-12">
                              <Loader2 className="w-10 h-10 animate-spin text-purple-500 mb-4" />
                              <p className="text-gray-600 font-medium">Analyzing schedule and tasks...</p>
                          </div>
                      ) : aiSuggestions.length === 0 ? (
                          <div className="text-center py-10">
                              <p className="text-gray-500">No suggestions found. Try adding more tasks first.</p>
                          </div>
                      ) : (
                          <div className="space-y-4">
                              {aiSuggestions.map((suggestion, idx) => (
                                  <div key={idx} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:border-purple-200 transition-colors flex gap-4">
                                      <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-1">
                                              <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">{suggestion.category}</span>
                                              <span className="text-xs text-gray-400">• {suggestion.frequency}</span>
                                          </div>
                                          <h4 className="font-bold text-gray-800 text-lg">{suggestion.title}</h4>
                                          <p className="text-sm text-gray-500 mt-1">{suggestion.notes}</p>
                                          <div className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                              <CalendarClock className="w-3 h-3"/>
                                              Suggested: {new Date(suggestion.start_date).toLocaleString()}
                                          </div>
                                      </div>
                                      <button 
                                        onClick={() => acceptSuggestion(suggestion)}
                                        className="self-center bg-gray-100 hover:bg-green-100 hover:text-green-700 text-gray-600 p-3 rounded-full transition-colors"
                                        title="Add to Reminders"
                                      >
                                          <Plus className="w-6 h-6" />
                                      </button>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
           </div>
      )}
    </div>
  );
};

export default ReminderSystem;

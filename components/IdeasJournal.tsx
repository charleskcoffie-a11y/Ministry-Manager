
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Idea } from '../types';
import { 
  Lightbulb, Plus, MapPin, Loader2, Sparkles, X, 
  Search, Calendar, Filter, Edit2, Trash2, ArrowRight 
} from 'lucide-react';
import { expandIdea } from '../services/geminiService';

const IdeasJournal: React.FC = () => {
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const [favorites, setFavorites] = useState<string[]>(() => {
        const saved = localStorage.getItem('idea-favorites');
        return saved ? JSON.parse(saved) : [];
    });
    // Favorite toggle
    const toggleFavorite = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        let next;
        if (favorites.includes(id)) next = favorites.filter(f => f !== id);
        else next = [...favorites, id];
        setFavorites(next);
        localStorage.setItem('idea-favorites', JSON.stringify(next));
    };
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterYear, setFilterYear] = useState<string>('All');
  const [filterMonth, setFilterMonth] = useState<string>('All');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');

  // Editor State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentIdea, setCurrentIdea] = useState<Partial<Idea>>({ 
    title: '',
    idea_date: new Date().toISOString().split('T')[0],
    place: '',
    note: ''
  });
  
  // AI State
  const [aiContent, setAiContent] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetchIdeas();
  }, []);

  const fetchIdeas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ideas')
      .select('*')
      .order('idea_date', { ascending: false }); // Primary sort by date desc
    
    if (!error && data) setIdeas(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!currentIdea.note || !currentIdea.idea_date) {
        alert("Please add at least a note and date.");
        return;
    }

    try {
        if (currentIdea.id) {
            // Update
            const { error } = await supabase.from('ideas').update(currentIdea).eq('id', currentIdea.id);
            if (error) throw error;
        } else {
            // Insert
            const { error } = await supabase.from('ideas').insert([currentIdea]);
            if (error) throw error;
        }
        await fetchIdeas();
        closeModal();
    } catch (err: any) {
        console.error("Error saving idea:", err);
        alert("Failed to save entry: " + err.message);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if(!window.confirm("Are you sure you want to permanently delete this entry?")) return;
      
      try {
          const { error } = await supabase.from('ideas').delete().eq('id', id);
          
          if (error) throw error;
          
          setIdeas(prev => prev.filter(i => i.id !== id));
          window.alert("Entry deleted successfully.");
      } catch (err: any) {
          console.error("Delete error:", err);
          window.alert("Failed to delete entry: " + (err.message || "Unknown error"));
      }
  };

  const handleAiExpand = async () => {
    if (!currentIdea.note) return;
    setAiLoading(true);
    setAiContent('');
    
    const content = await expandIdea(currentIdea.note, currentIdea.title);
    setAiContent(content);
    setAiLoading(false);
  };

  const openNewIdea = () => {
      setCurrentIdea({ 
        title: '',
        idea_date: new Date().toISOString().split('T')[0], 
        place: '', 
        note: '' 
      });
      setAiContent('');
      setIsModalOpen(true);
  };

  const openEditIdea = (idea: Idea) => {
      setCurrentIdea(idea);
      setAiContent('');
      setIsModalOpen(true);
  };

  const closeModal = () => {
      setIsModalOpen(false);
  };

  // --- Filtering Logic ---
  
  // Extract unique years for dropdown
  const uniqueYears = useMemo(() => {
      const years = new Set(ideas.map(i => new Date(i.idea_date).getFullYear()));
      return Array.from(years).sort((a: number, b: number) => b - a);
  }, [ideas]);

  const filteredIdeas = useMemo(() => {
      return ideas.filter(idea => {
          const d = new Date(idea.idea_date);
          
          // Search Query
          const q = searchQuery.toLowerCase();
          const matchesSearch = !searchQuery || 
              (idea.title && idea.title.toLowerCase().includes(q)) ||
              idea.note.toLowerCase().includes(q) ||
              (idea.place && idea.place.toLowerCase().includes(q));

          // Date Range
          const matchesStart = !filterStart || idea.idea_date >= filterStart;
          const matchesEnd = !filterEnd || idea.idea_date <= filterEnd;

          // Year/Month
          const matchesYear = filterYear === 'All' || d.getFullYear().toString() === filterYear;
          const matchesMonth = filterMonth === 'All' || (d.getMonth() + 1).toString() === filterMonth;

          return matchesSearch && matchesStart && matchesEnd && matchesYear && matchesMonth;
      });
  }, [ideas, searchQuery, filterStart, filterEnd, filterYear, filterMonth]);

  // Helper to extract a title if none exists (legacy data support)
  const getDisplayTitle = (idea: Idea) => {
      if (idea.title) return idea.title;
      const firstLine = idea.note.split('\n')[0];
      return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
  };

  return (
        <div className="max-w-[1600px] mx-auto pb-24 h-[calc(100vh-100px)] flex flex-col">
            {/* 1. Header & Actions */}
            <div className="relative flex flex-col md:flex-row justify-between items-end gap-6 mb-6 overflow-visible">
                {/* Animated Gradient BG */}
                <div className="absolute -top-10 -left-10 w-[120%] h-40 bg-gradient-to-r from-amber-200 via-pink-100 to-amber-100 opacity-60 blur-2xl rounded-3xl pointer-events-none animate-gradient-x z-0" />
                <div className="relative z-10">
                     <div className="flex items-center gap-2 mb-2 text-amber-600 font-bold uppercase text-xs tracking-widest animate-fade-in">
                             <Lightbulb className="w-4 h-4 animate-bounce" /> Ministry Thoughts
                     </div>
                     <h1 className="text-4xl font-serif font-bold text-gray-900 drop-shadow-sm animate-fade-in">Ideas Journal</h1>
                     <p className="text-gray-500 mt-2 animate-fade-in">Capture sermons, visions, and spiritual insights.</p>
                </div>

                <button 
                    onClick={openNewIdea}
                    className="relative z-10 bg-amber-500 text-white px-6 py-3 rounded-full hover:bg-amber-600 flex items-center gap-2 shadow-lg hover:shadow-amber-500/30 transition-all transform active:scale-95 font-bold animate-pulse group"
                    title="Add a new idea entry"
                >
                    <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300"/> New Entry
                    <span className="absolute -top-2 -right-2 bg-pink-400 text-white text-xs px-2 py-0.5 rounded-full shadow animate-bounce">New</span>
                </button>
            </div>

      {/* 2. Filter Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6 grid grid-cols-1 md:grid-cols-12 gap-4">
         {/* Search */}
         <div className="md:col-span-4 relative">
             <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
             <input 
                type="text" 
                placeholder="Search topics, verses..." 
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-amber-500/50"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
             />
         </div>

         {/* Date Filters */}
         <div className="md:col-span-8 flex flex-wrap gap-3 items-center">
             <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl">
                 <Calendar className="w-4 h-4 text-gray-400" />
                 <input type="date" className="bg-transparent border-none p-0 text-sm focus:ring-0" value={filterStart} onChange={e => setFilterStart(e.target.value)} />
                 <span className="text-gray-400">-</span>
                 <input type="date" className="bg-transparent border-none p-0 text-sm focus:ring-0" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} />
             </div>

             <select 
                className="bg-gray-50 border-none rounded-xl py-2.5 pl-3 pr-8 text-sm focus:ring-2 focus:ring-amber-500/50"
                value={filterYear}
                onChange={e => setFilterYear(e.target.value)}
             >
                 <option value="All">All Years</option>
                 {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
             </select>

             <select 
                className="bg-gray-50 border-none rounded-xl py-2.5 pl-3 pr-8 text-sm focus:ring-2 focus:ring-amber-500/50"
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
             >
                 <option value="All">All Months</option>
                 {Array.from({length: 12}, (_, i) => (
                     <option key={i} value={i+1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
                 ))}
             </select>
             
             {(searchQuery || filterStart || filterEnd || filterYear !== 'All' || filterMonth !== 'All') && (
                 <button 
                    onClick={() => { setSearchQuery(''); setFilterStart(''); setFilterEnd(''); setFilterYear('All'); setFilterMonth('All'); }}
                    className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg ml-auto"
                 >
                     Clear
                 </button>
             )}
         </div>
      </div>

      {/* 3. List Content */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {loading ? (
             <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-amber-500"/></div>
          ) : filteredIdeas.length === 0 ? (
             <div className="text-center py-20 opacity-50">
                 <Lightbulb className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                 <p className="text-lg">No entries found matching your filters.</p>
             </div>
          ) : (
             <div className="space-y-3">
                 {filteredIdeas.map(idea => (
                     <div 
                        key={idea.id} 
                        onClick={() => openEditIdea(idea)}
                        className={`relative bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-amber-300 transition-all cursor-pointer group flex items-start gap-4 overflow-visible ${favorites.includes(idea.id) ? 'ring-2 ring-amber-400' : ''}`}
                        tabIndex={0}
                        title={getDisplayTitle(idea)}
                     >
                         {/* Favorite Star */}
                         <button
                           className={`absolute top-2 right-2 z-10 p-1 rounded-full bg-white/80 hover:bg-amber-100 border border-amber-200 shadow transition-colors`}
                           onClick={e => toggleFavorite(idea.id, e)}
                           aria-label={favorites.includes(idea.id) ? 'Unfavorite' : 'Mark as favorite'}
                           tabIndex={0}
                           type="button"
                           title={favorites.includes(idea.id) ? 'Unfavorite' : 'Mark as favorite'}
                         >
                           <Sparkles className={`w-5 h-5 ${favorites.includes(idea.id) ? 'text-amber-500 fill-amber-400' : 'text-gray-300'} transition-all`} />
                         </button>
                         {/* Date Badge */}
                         <div className="hidden md:flex flex-col items-center justify-center bg-amber-50 text-amber-800 rounded-lg p-3 min-w-[4.5rem]">
                             <span className="text-xs font-bold uppercase">{new Date(idea.idea_date).toLocaleDateString('default', { month: 'short' })}</span>
                             <span className="text-xl font-bold leading-none">{new Date(idea.idea_date).getDate()}</span>
                             <span className="text-[10px] opacity-60">{new Date(idea.idea_date).getFullYear()}</span>
                         </div>

                         {/* Mobile Date */}
                         <div className="md:hidden text-xs font-bold text-amber-600 whitespace-nowrap pt-1">
                             {new Date(idea.idea_date).toLocaleDateString()}
                         </div>

                         {/* Content */}
                         <div className="flex-1 min-w-0">
                             <div className="flex justify-between items-start">
                                 <h3 className="font-bold text-gray-900 text-lg truncate group-hover:text-amber-700 transition-colors">
                                     {getDisplayTitle(idea)}
                                 </h3>
                                 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity pl-2">
                                     <button onClick={(e) => { e.stopPropagation(); openEditIdea(idea); }} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg" title="Edit">
                                         <Edit2 className="w-4 h-4" />
                                     </button>
                                     <button onClick={(e) => handleDelete(idea.id, e)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                                         <Trash2 className="w-4 h-4" />
                                     </button>
                                 </div>
                             </div>

                             <p className="text-gray-600 text-sm line-clamp-2 mb-2 leading-relaxed">
                                 {idea.note}
                             </p>
                             
                             {idea.place && (
                                 <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                                     <MapPin className="w-3.5 h-3.5" />
                                     {idea.place}
                                 </div>
                             )}
                         </div>
                     </div>
                 ))}
             </div>
          )}
      </div>

      {/* 4. Editor Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                  {/* Modal Header */}
                  <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-amber-50">
                      <h3 className="font-bold text-xl text-amber-900 flex items-center gap-2">
                          {currentIdea.id ? <Edit2 className="w-5 h-5"/> : <Plus className="w-5 h-5"/>}
                          {currentIdea.id ? 'Edit Entry' : 'New Thought'}
                      </h3>
                      <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full">
                          <X className="w-6 h-6" />
                      </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 overflow-y-auto flex-1 space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
                              <input 
                                type="date" 
                                className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-amber-500"
                                value={currentIdea.idea_date}
                                onChange={e => setCurrentIdea({...currentIdea, idea_date: e.target.value})}
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Location / Context</label>
                              <div className="relative">
                                  <MapPin className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
                                  <input 
                                    type="text" 
                                    placeholder="e.g. Prayer Walk"
                                    className="w-full pl-9 pr-3 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-amber-500"
                                    value={currentIdea.place || ''}
                                    onChange={e => setCurrentIdea({...currentIdea, place: e.target.value})}
                                  />
                              </div>
                          </div>
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
                          <input 
                            type="text" 
                            placeholder="Give this thought a name..."
                            className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-amber-500 text-lg font-bold text-gray-800"
                            value={currentIdea.title || ''}
                            onChange={e => setCurrentIdea({...currentIdea, title: e.target.value})}
                          />
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Journal Note</label>
                          <textarea 
                            rows={8}
                            className="w-full p-4 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-amber-500 leading-relaxed resize-none"
                            placeholder="Write your idea, scripture, or sermon outline here..."
                            value={currentIdea.note || ''}
                            onChange={e => setCurrentIdea({...currentIdea, note: e.target.value})}
                          />
                      </div>

                      {/* AI Expansion Area */}
                      <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                          <div className="flex justify-between items-center mb-2">
                              <h4 className="text-sm font-bold text-purple-800 flex items-center gap-2">
                                  <Sparkles className="w-4 h-4" /> AI Assistant
                              </h4>
                              {currentIdea.note && !aiContent && (
                                  <button 
                                    onClick={handleAiExpand}
                                    disabled={aiLoading}
                                    className="text-xs font-bold text-purple-600 hover:text-purple-800 hover:underline"
                                  >
                                      {aiLoading ? 'Thinking...' : 'Expand this thought'}
                                  </button>
                              )}
                          </div>
                          
                          {aiLoading ? (
                              <div className="flex items-center gap-2 text-purple-500 text-sm p-2">
                                  <Loader2 className="w-4 h-4 animate-spin" /> Generating sermon outline...
                              </div>
                          ) : aiContent ? (
                              <div className="prose prose-sm prose-purple mt-2 max-h-40 overflow-y-auto custom-scrollbar">
                                  <div className="whitespace-pre-wrap text-slate-700">{aiContent}</div>
                              </div>
                          ) : (
                              <p className="text-xs text-purple-400 italic">
                                  Write a note above and click expand to generate a sermon outline or action plan.
                              </p>
                          )}
                      </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                      <button onClick={closeModal} className="px-5 py-2.5 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-colors">
                          Cancel
                      </button>
                      <button onClick={handleSave} className="px-6 py-2.5 bg-gray-900 text-white font-bold hover:bg-black rounded-xl shadow-lg transition-transform active:scale-95">
                          Save Entry
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default IdeasJournal;

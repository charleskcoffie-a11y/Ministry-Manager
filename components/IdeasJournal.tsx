import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Idea } from '../types';
import { Lightbulb, Plus, MapPin, Loader2, Sparkles, X } from 'lucide-react';
import { expandIdea } from '../services/geminiService';

const IdeasJournal: React.FC = () => {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newIdea, setNewIdea] = useState<Partial<Idea>>({ idea_date: new Date().toISOString().split('T')[0] });
  
  // AI State
  const [aiExpandedId, setAiExpandedId] = useState<string | null>(null);
  const [aiContent, setAiContent] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetchIdeas();
  }, []);

  const fetchIdeas = async () => {
    const { data, error } = await supabase
      .from('ideas')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) setIdeas(data);
  };

  const handleSave = async () => {
    if (!newIdea.note || !newIdea.idea_date) return;

    const { error } = await supabase.from('ideas').insert([newIdea]);
    if (!error) {
      setNewIdea({ idea_date: new Date().toISOString().split('T')[0], place: '', note: '' });
      setIsAdding(false);
      fetchIdeas();
    }
  };

  const handleExpandIdea = async (idea: Idea) => {
    if (aiExpandedId === idea.id) {
        setAiExpandedId(null); // Toggle off
        return;
    }
    
    setAiExpandedId(idea.id);
    setAiLoading(true);
    setAiContent('');
    
    const content = await expandIdea(idea.note);
    setAiContent(content);
    setAiLoading(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-bold text-gray-800">Ministry Ideas Journal</h1>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-primary text-white px-6 py-3 rounded-xl hover:bg-blue-700 flex items-center gap-3 shadow text-lg font-medium"
        >
          {isAdding ? <X className="w-5 h-5"/> : <Plus className="w-5 h-5"/>} 
          {isAdding ? 'Close' : 'New Idea'}
        </button>
      </div>

      {isAdding && (
        <div className="bg-yellow-50 border border-yellow-200 p-8 rounded-xl animate-fade-in shadow-inner">
           <h3 className="font-semibold text-yellow-800 mb-6 flex items-center gap-3 text-2xl">
             <Lightbulb className="w-6 h-6"/> Capture a thought
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
               <label className="block text-lg text-yellow-800 mb-2">Date</label>
               <input 
                 type="date" 
                 className="w-full border-yellow-300 rounded p-3 text-lg focus:ring-yellow-500 bg-white"
                 value={newIdea.idea_date}
                 onChange={e => setNewIdea({...newIdea, idea_date: e.target.value})}
               />
             </div>
             <div>
               <label className="block text-lg text-yellow-800 mb-2">Location / Context</label>
               <input 
                 type="text" 
                 placeholder="e.g., During prayer meeting"
                 className="w-full border-yellow-300 rounded p-3 text-lg focus:ring-yellow-500 bg-white"
                 value={newIdea.place || ''}
                 onChange={e => setNewIdea({...newIdea, place: e.target.value})}
               />
             </div>
             <div className="md:col-span-2">
               <label className="block text-lg text-yellow-800 mb-2">The Idea</label>
               <textarea 
                 rows={3}
                 className="w-full border-yellow-300 rounded p-3 text-lg focus:ring-yellow-500 bg-white"
                 placeholder="Write your idea here..."
                 value={newIdea.note || ''}
                 onChange={e => setNewIdea({...newIdea, note: e.target.value})}
               />
             </div>
           </div>
           <div className="mt-6 flex justify-end">
             <button onClick={handleSave} className="bg-yellow-600 text-white px-8 py-3 rounded hover:bg-yellow-700 text-lg">
               Save to Journal
             </button>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {ideas.map(idea => (
          <div key={idea.id} className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow border border-gray-100 flex flex-col">
            <div className="p-6 flex-1">
              <div className="flex items-center text-sm text-gray-500 mb-4 gap-3">
                <span className="bg-gray-100 px-3 py-1 rounded">{new Date(idea.idea_date).toLocaleDateString()}</span>
                {idea.place && (
                  <span className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> {idea.place}
                  </span>
                )}
              </div>
              <p className="text-gray-800 text-2xl leading-relaxed font-medium">
                {idea.note}
              </p>
            </div>
            
            {/* AI Section */}
            {aiExpandedId === idea.id && (
                <div className="px-6 pb-6 animate-fade-in">
                    <div className="bg-purple-50 rounded-lg p-4 text-base text-purple-900 border border-purple-100">
                        {aiLoading ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="w-5 h-5 animate-spin"/> Generative thinking...
                            </div>
                        ) : (
                            <div className="prose prose-purple prose-lg">
                                <h5 className="font-bold text-sm uppercase tracking-wider mb-2 opacity-70">AI Suggestions</h5>
                                {aiContent}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 rounded-b-xl flex justify-end">
                <button 
                  onClick={() => handleExpandIdea(idea)}
                  className={`text-base flex items-center gap-2 transition-colors ${aiExpandedId === idea.id ? 'text-purple-700 font-bold' : 'text-purple-600 hover:text-purple-800'}`}
                >
                    <Sparkles className="w-5 h-5" /> 
                    {aiExpandedId === idea.id ? 'Close AI' : 'Expand with AI'}
                </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IdeasJournal;
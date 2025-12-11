
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { SermonNote, SermonPoint } from '../types';
import { 
  ChevronLeft, Save, Plus, Trash2, Calendar, MapPin, 
  User, Book, PenTool, LayoutList, ChevronDown, ChevronUp,
  Loader2, List
} from 'lucide-react';

const SermonNotes: React.FC = () => {
  const [mode, setMode] = useState<'list' | 'edit'>('list');
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<SermonNote[]>([]);
  const [saving, setSaving] = useState(false);

  // Initial State for a fresh note
  const initialNote: SermonNote = {
    id: '',
    preacher: '',
    note_date: new Date().toISOString().split('T')[0],
    location: '',
    sermon_title: '',
    main_scripture: '',
    opening_remarks: '',
    passage_context: '',
    key_themes: '',
    key_doctrines: '',
    theological_strengths: '',
    theological_questions: '',
    tone_atmosphere: '',
    use_of_scripture: '',
    use_of_stories: '',
    audience_engagement: '',
    flow_transitions: '',
    memorable_phrases: '',
    minister_lessons: '',
    personal_challenge: '',
    application_to_preaching: '',
    pastoral_insights: '',
    calls_to_action: '',
    spiritual_challenges: '',
    practical_applications: '',
    prayer_points: '',
    closing_scripture: '',
    central_message_summary: '',
    final_memorable_line: '',
    followup_scriptures: '',
    followup_topics: '',
    followup_people: '',
    followup_ministry_ideas: '',
    points: [
      { point_number: 1, main_point: '', supporting_scripture: '', key_quotes: '', illustrations: '', ministry_emphasis: '' },
      { point_number: 2, main_point: '', supporting_scripture: '', key_quotes: '', illustrations: '', ministry_emphasis: '' },
      { point_number: 3, main_point: '', supporting_scripture: '', key_quotes: '', illustrations: '', ministry_emphasis: '' }
    ]
  };

  const [currentNote, setCurrentNote] = useState<SermonNote>(initialNote);
  // Accordion State for Mobile Friendliness
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({ 1: true, 2: false, 3: true, 4: false, 5: false, 6: false, 7: false, 8: false, 9: false });

  const toggleSection = (num: number) => {
    setOpenSections(prev => ({ ...prev, [num]: !prev[num] }));
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sermon_talk_notes')
      .select('*')
      .order('note_date', { ascending: false });
    
    if (data && !error) setNotes(data);
    setLoading(false);
  };

  const fetchNoteDetails = async (noteId: string) => {
    setLoading(true);
    // 1. Fetch Parent
    const { data: note, error: noteError } = await supabase
      .from('sermon_talk_notes')
      .select('*')
      .eq('id', noteId)
      .single();

    if (noteError || !note) {
      alert("Error fetching note details.");
      setLoading(false);
      return;
    }

    // 2. Fetch Points
    const { data: points, error: pointsError } = await supabase
      .from('sermon_talk_points')
      .select('*')
      .eq('note_id', noteId)
      .order('point_number', { ascending: true });

    setCurrentNote({
      ...note,
      points: points || []
    });
    setMode('edit');
    setLoading(false);
  };

  const handleSave = async () => {
    if (!currentNote.sermon_title && !currentNote.preacher) {
      alert("Please enter at least a Title or Preacher.");
      return;
    }
    setSaving(true);

    try {
      // 1. Upsert Parent Note
      // Exclude 'points' array from the parent upsert payload
      const { points, id, created_at, ...noteData } = currentNote;
      
      let noteId = id;
      
      const { data: savedNote, error: noteError } = await supabase
        .from('sermon_talk_notes')
        .upsert(id ? { id, ...noteData } : noteData)
        .select()
        .single();

      if (noteError) throw noteError;
      noteId = savedNote.id;

      // 2. Handle Points (Delete existing for this note, then re-insert to handle reordering/deletions easily)
      if (noteId) {
        // Delete old points
        await supabase.from('sermon_talk_points').delete().eq('note_id', noteId);

        // Insert new points
        if (currentNote.points && currentNote.points.length > 0) {
          const pointsToInsert = currentNote.points.map((p, idx) => ({
            note_id: noteId,
            point_number: idx + 1,
            main_point: p.main_point || '',
            supporting_scripture: p.supporting_scripture || '',
            key_quotes: p.key_quotes || '',
            illustrations: p.illustrations || '',
            ministry_emphasis: p.ministry_emphasis || ''
          }));
          
          const { error: pointsError } = await supabase.from('sermon_talk_points').insert(pointsToInsert);
          if (pointsError) throw pointsError;
        }
      }

      alert("Note saved successfully.");
      setMode('list');
      fetchNotes();

    } catch (err: any) {
      console.error("Save Error:", err);
      alert("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(!confirm("Are you sure you want to delete this note?")) return;
    
    await supabase.from('sermon_talk_notes').delete().eq('id', id);
    fetchNotes();
  };

  // --- Point Management ---
  const updatePoint = (index: number, field: keyof SermonPoint, value: any) => {
    const newPoints = [...(currentNote.points || [])];
    newPoints[index] = { ...newPoints[index], [field]: value };
    setCurrentNote({ ...currentNote, points: newPoints });
  };

  const addPoint = () => {
    setCurrentNote({
      ...currentNote,
      points: [...(currentNote.points || []), { point_number: (currentNote.points?.length || 0) + 1, main_point: '', supporting_scripture: '', key_quotes: '', illustrations: '', ministry_emphasis: '' }]
    });
  };

  const removePoint = (index: number) => {
    const newPoints = [...(currentNote.points || [])];
    newPoints.splice(index, 1);
    setCurrentNote({ ...currentNote, points: newPoints });
  };

  const movePoint = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === (currentNote.points?.length || 0) - 1) return;
    
    const newPoints = [...(currentNote.points || [])];
    const temp = newPoints[index];
    newPoints[index] = newPoints[index + (direction === 'up' ? -1 : 1)];
    newPoints[index + (direction === 'up' ? -1 : 1)] = temp;
    
    setCurrentNote({ ...currentNote, points: newPoints });
  };

  // --- Render ---

  if (mode === 'list') {
    return (
      <div className="max-w-4xl mx-auto pb-20 animate-fade-in space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
           <div>
              <h1 className="text-3xl font-serif font-bold text-slate-800 flex items-center gap-3">
                 <PenTool className="w-8 h-8 text-indigo-600" /> Sermon Notes
              </h1>
              <p className="text-slate-500 mt-1">Capture insights, theology, and reflections.</p>
           </div>
           <button 
             onClick={() => { setCurrentNote(initialNote); setMode('edit'); setOpenSections({1: true, 2: false, 3: true, 4: false, 5: false, 6: false, 7: false, 8: false, 9: false}); }}
             className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 font-bold shadow-md transition-all active:scale-95"
           >
             <Plus className="w-5 h-5" /> New Note
           </button>
        </div>

        {loading ? (
           <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-300"/></div>
        ) : notes.length === 0 ? (
           <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
              <Book className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No sermon notes yet.</p>
           </div>
        ) : (
           <div className="grid gap-4">
              {notes.map(note => (
                 <div 
                   key={note.id} 
                   onClick={() => fetchNoteDetails(note.id)}
                   className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group flex justify-between items-center"
                 >
                    <div className="flex-1">
                       <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(note.note_date).toLocaleDateString()}
                          {note.location && <><span className="text-slate-300">•</span> {note.location}</>}
                       </div>
                       <h3 className="text-lg font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                          {note.sermon_title || 'Untitled Sermon'}
                       </h3>
                       <div className="flex items-center gap-2 mt-2 text-sm text-slate-600">
                          <User className="w-4 h-4 text-indigo-400" />
                          {note.preacher || 'Unknown Preacher'}
                       </div>
                    </div>
                    <button 
                       onClick={(e) => handleDelete(note.id, e)}
                       className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                    >
                       <Trash2 className="w-5 h-5" />
                    </button>
                 </div>
              ))}
           </div>
        )}
      </div>
    );
  }

  // --- EDITOR VIEW ---
  return (
    <div className="max-w-3xl mx-auto pb-24 animate-fade-in">
       <div className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur-sm border-b border-gray-200 py-3 mb-6 flex justify-between items-center">
          <button 
            onClick={() => setMode('list')}
            className="flex items-center gap-1 text-slate-600 hover:text-slate-900 px-2 py-1 rounded-lg hover:bg-slate-200 transition-colors"
          >
             <ChevronLeft className="w-5 h-5" /> Back
          </button>
          <span className="font-bold text-slate-700 hidden sm:block">
             {currentNote.id ? 'Edit Note' : 'New Note'}
          </span>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50"
          >
             {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
             Save
          </button>
       </div>

       <div className="space-y-4">
          
          {/* Section 1: Basic Info */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <button onClick={() => toggleSection(1)} className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors">
                <span className="font-bold text-slate-700 flex items-center gap-2">1. Basic Information</span>
                {openSections[1] ? <ChevronUp className="w-5 h-5 text-slate-400"/> : <ChevronDown className="w-5 h-5 text-slate-400"/>}
             </button>
             {openSections[1] && (
                <div className="p-5 space-y-4 animate-fade-in">
                   <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Preacher</label>
                      <input 
                        className="w-full p-3 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-indigo-500" 
                        value={currentNote.preacher} onChange={e => setCurrentNote({...currentNote, preacher: e.target.value})} placeholder="Name of speaker" 
                      />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                        <input type="date" className="w-full p-3 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-indigo-500" 
                           value={currentNote.note_date} onChange={e => setCurrentNote({...currentNote, note_date: e.target.value})} 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Location</label>
                        <input className="w-full p-3 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-indigo-500" 
                           value={currentNote.location} onChange={e => setCurrentNote({...currentNote, location: e.target.value})} placeholder="Event or Church" 
                        />
                      </div>
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Title</label>
                      <input className="w-full p-3 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-indigo-500 text-lg font-bold text-slate-800" 
                         value={currentNote.sermon_title} onChange={e => setCurrentNote({...currentNote, sermon_title: e.target.value})} placeholder="Sermon Title" 
                      />
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Main Scripture(s)</label>
                      <input className="w-full p-3 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-indigo-500" 
                         value={currentNote.main_scripture} onChange={e => setCurrentNote({...currentNote, main_scripture: e.target.value})} placeholder="e.g. John 3:16" 
                      />
                   </div>
                </div>
             )}
          </div>

          {/* Section 2: Opening & Context */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <button onClick={() => toggleSection(2)} className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors">
                <span className="font-bold text-slate-700 flex items-center gap-2">2. Opening & Context</span>
                {openSections[2] ? <ChevronUp className="w-5 h-5 text-slate-400"/> : <ChevronDown className="w-5 h-5 text-slate-400"/>}
             </button>
             {openSections[2] && (
                <div className="p-5 space-y-4 animate-fade-in">
                   <TextArea label="Opening Remarks / Story" value={currentNote.opening_remarks} onChange={v => setCurrentNote({...currentNote, opening_remarks: v})} />
                   <TextArea label="Context of Passage" value={currentNote.passage_context} onChange={v => setCurrentNote({...currentNote, passage_context: v})} />
                   <TextArea label="Key Themes (Bullets)" value={currentNote.key_themes} onChange={v => setCurrentNote({...currentNote, key_themes: v})} />
                </div>
             )}
          </div>

          {/* Section 3: Structure (Repeating) */}
          <div className="bg-white rounded-xl shadow-sm border border-indigo-100 overflow-hidden">
             <button onClick={() => toggleSection(3)} className="w-full flex items-center justify-between p-4 bg-indigo-50 hover:bg-indigo-100 transition-colors">
                <span className="font-bold text-indigo-900 flex items-center gap-2"><List className="w-4 h-4"/> 3. Sermon Structure</span>
                {openSections[3] ? <ChevronUp className="w-5 h-5 text-indigo-400"/> : <ChevronDown className="w-5 h-5 text-indigo-400"/>}
             </button>
             {openSections[3] && (
                <div className="p-5 space-y-6 animate-fade-in bg-slate-50/50">
                   {currentNote.points?.map((point, index) => (
                      <div key={index} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative">
                         <div className="flex justify-between items-center mb-3">
                            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded">Point {index + 1}</span>
                            <div className="flex gap-2">
                                <button onClick={() => movePoint(index, 'up')} disabled={index===0} className="p-1 hover:bg-slate-100 rounded text-slate-400 disabled:opacity-30"><ChevronUp className="w-4 h-4"/></button>
                                <button onClick={() => movePoint(index, 'down')} disabled={index===(currentNote.points?.length||0)-1} className="p-1 hover:bg-slate-100 rounded text-slate-400 disabled:opacity-30"><ChevronDown className="w-4 h-4"/></button>
                                <button onClick={() => removePoint(index)} className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded"><Trash2 className="w-4 h-4"/></button>
                            </div>
                         </div>
                         <div className="space-y-3">
                            <TextArea label="Main Point" value={point.main_point} onChange={v => updatePoint(index, 'main_point', v)} rows={2} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div><label className="text-xs font-bold text-slate-400 uppercase">Scripture</label><input className="w-full p-2 bg-slate-50 border rounded text-sm" value={point.supporting_scripture} onChange={e => updatePoint(index, 'supporting_scripture', e.target.value)} /></div>
                                <div><label className="text-xs font-bold text-slate-400 uppercase">Emphasis</label><input className="w-full p-2 bg-slate-50 border rounded text-sm" value={point.ministry_emphasis} onChange={e => updatePoint(index, 'ministry_emphasis', e.target.value)} /></div>
                            </div>
                            <TextArea label="Quotes / Insights" value={point.key_quotes} onChange={v => updatePoint(index, 'key_quotes', v)} rows={2} />
                            <TextArea label="Illustrations" value={point.illustrations} onChange={v => updatePoint(index, 'illustrations', v)} rows={2} />
                         </div>
                      </div>
                   ))}
                   <button onClick={addPoint} className="w-full py-3 border-2 border-dashed border-indigo-200 rounded-xl text-indigo-500 font-bold hover:bg-indigo-50 transition-colors flex justify-center items-center gap-2">
                      <Plus className="w-5 h-5"/> Add Main Point
                   </button>
                </div>
             )}
          </div>

          {/* Section 4: Theological */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <button onClick={() => toggleSection(4)} className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors">
                <span className="font-bold text-slate-700">4. Theological Highlights</span>
                {openSections[4] ? <ChevronUp className="w-5 h-5 text-slate-400"/> : <ChevronDown className="w-5 h-5 text-slate-400"/>}
             </button>
             {openSections[4] && (
                <div className="p-5 space-y-4 animate-fade-in">
                   <TextArea label="Key Doctrines Taught" value={currentNote.key_doctrines} onChange={v => setCurrentNote({...currentNote, key_doctrines: v})} />
                   <TextArea label="Theological Strengths" value={currentNote.theological_strengths} onChange={v => setCurrentNote({...currentNote, theological_strengths: v})} />
                   <TextArea label="Areas for Study / Clarification" value={currentNote.theological_questions} onChange={v => setCurrentNote({...currentNote, theological_questions: v})} />
                </div>
             )}
          </div>

          {/* Section 5: Preaching Style */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <button onClick={() => toggleSection(5)} className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors">
                <span className="font-bold text-slate-700">5. Preaching Style & Delivery</span>
                {openSections[5] ? <ChevronUp className="w-5 h-5 text-slate-400"/> : <ChevronDown className="w-5 h-5 text-slate-400"/>}
             </button>
             {openSections[5] && (
                <div className="p-5 space-y-4 animate-fade-in">
                   <TextArea label="Tone & Atmosphere" value={currentNote.tone_atmosphere} onChange={v => setCurrentNote({...currentNote, tone_atmosphere: v})} />
                   <TextArea label="Use of Scripture" value={currentNote.use_of_scripture} onChange={v => setCurrentNote({...currentNote, use_of_scripture: v})} />
                   <TextArea label="Use of Stories / Examples" value={currentNote.use_of_stories} onChange={v => setCurrentNote({...currentNote, use_of_stories: v})} />
                   <TextArea label="Audience Engagement" value={currentNote.audience_engagement} onChange={v => setCurrentNote({...currentNote, audience_engagement: v})} />
                   <TextArea label="Flow & Transitions" value={currentNote.flow_transitions} onChange={v => setCurrentNote({...currentNote, flow_transitions: v})} />
                   <TextArea label="Memorable Phrases" value={currentNote.memorable_phrases} onChange={v => setCurrentNote({...currentNote, memorable_phrases: v})} />
                </div>
             )}
          </div>

          {/* Section 6: Personal Reflections */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <button onClick={() => toggleSection(6)} className="w-full flex items-center justify-between p-4 bg-purple-50 hover:bg-purple-100 transition-colors">
                <span className="font-bold text-purple-900">6. Personal Reflections (Minister's Lens)</span>
                {openSections[6] ? <ChevronUp className="w-5 h-5 text-purple-400"/> : <ChevronDown className="w-5 h-5 text-purple-400"/>}
             </button>
             {openSections[6] && (
                <div className="p-5 space-y-4 animate-fade-in">
                   <TextArea label="Ministerial Lessons Learned" value={currentNote.minister_lessons} onChange={v => setCurrentNote({...currentNote, minister_lessons: v})} />
                   <TextArea label="Personal Challenge / Blessing" value={currentNote.personal_challenge} onChange={v => setCurrentNote({...currentNote, personal_challenge: v})} />
                   <TextArea label="Application to my Preaching" value={currentNote.application_to_preaching} onChange={v => setCurrentNote({...currentNote, application_to_preaching: v})} />
                   <TextArea label="Pastoral Insights" value={currentNote.pastoral_insights} onChange={v => setCurrentNote({...currentNote, pastoral_insights: v})} />
                </div>
             )}
          </div>

          {/* Section 7: Application */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <button onClick={() => toggleSection(7)} className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors">
                <span className="font-bold text-slate-700">7. Application & Response</span>
                {openSections[7] ? <ChevronUp className="w-5 h-5 text-slate-400"/> : <ChevronDown className="w-5 h-5 text-slate-400"/>}
             </button>
             {openSections[7] && (
                <div className="p-5 space-y-4 animate-fade-in">
                   <TextArea label="Calls to Action" value={currentNote.calls_to_action} onChange={v => setCurrentNote({...currentNote, calls_to_action: v})} />
                   <TextArea label="Spiritual Challenges" value={currentNote.spiritual_challenges} onChange={v => setCurrentNote({...currentNote, spiritual_challenges: v})} />
                   <TextArea label="Practical Applications" value={currentNote.practical_applications} onChange={v => setCurrentNote({...currentNote, practical_applications: v})} />
                   <TextArea label="Prayer Points" value={currentNote.prayer_points} onChange={v => setCurrentNote({...currentNote, prayer_points: v})} />
                </div>
             )}
          </div>

          {/* Section 8: Closing */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <button onClick={() => toggleSection(8)} className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors">
                <span className="font-bold text-slate-700">8. Closing</span>
                {openSections[8] ? <ChevronUp className="w-5 h-5 text-slate-400"/> : <ChevronDown className="w-5 h-5 text-slate-400"/>}
             </button>
             {openSections[8] && (
                <div className="p-5 space-y-4 animate-fade-in">
                   <TextArea label="Closing Scripture / Benediction" value={currentNote.closing_scripture} onChange={v => setCurrentNote({...currentNote, closing_scripture: v})} rows={2} />
                   <TextArea label="Summary of Central Message" value={currentNote.central_message_summary} onChange={v => setCurrentNote({...currentNote, central_message_summary: v})} />
                   <TextArea label="Final Memorable Line" value={currentNote.final_memorable_line} onChange={v => setCurrentNote({...currentNote, final_memorable_line: v})} rows={2} />
                </div>
             )}
          </div>

          {/* Section 9: Follow-up */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <button onClick={() => toggleSection(9)} className="w-full flex items-center justify-between p-4 bg-green-50 hover:bg-green-100 transition-colors">
                <span className="font-bold text-green-900">9. Follow-Up (For Minister)</span>
                {openSections[9] ? <ChevronUp className="w-5 h-5 text-green-600"/> : <ChevronDown className="w-5 h-5 text-green-600"/>}
             </button>
             {openSections[9] && (
                <div className="p-5 space-y-4 animate-fade-in">
                   <TextArea label="Scripture to Study Deeper" value={currentNote.followup_scriptures} onChange={v => setCurrentNote({...currentNote, followup_scriptures: v})} />
                   <TextArea label="Topics for Future Sermons" value={currentNote.followup_topics} onChange={v => setCurrentNote({...currentNote, followup_topics: v})} />
                   <TextArea label="People to Follow Up With" value={currentNote.followup_people} onChange={v => setCurrentNote({...currentNote, followup_people: v})} />
                   <TextArea label="Ideas for Ministry/Leadership" value={currentNote.followup_ministry_ideas} onChange={v => setCurrentNote({...currentNote, followup_ministry_ideas: v})} />
                </div>
             )}
          </div>

       </div>
    </div>
  );
};

// Sub-component for inputs
const TextArea = ({ label, value, onChange, rows = 3 }: { label: string, value: string, onChange: (v: string) => void, rows?: number }) => (
  <div>
    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{label}</label>
    <textarea 
      rows={rows}
      className="w-full p-3 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm leading-relaxed"
      value={value || ''}
      onChange={e => onChange(e.target.value)}
    />
  </div>
);

export default SermonNotes;

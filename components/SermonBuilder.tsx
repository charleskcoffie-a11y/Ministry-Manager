
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Sermon } from '../types';
import { generateSermonOutline, generateSermonSection } from '../services/geminiService';
import { 
  BookOpen, Mic, MicOff, Wand2, Save, Trash2,
  Plus, X, Loader2, ChevronLeft, PenTool, Download
} from 'lucide-react';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const SermonBuilder: React.FC = () => {
  const [mode, setMode] = useState<'list' | 'edit'>('list');
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [loading, setLoading] = useState(false);
  
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

  // --- Word Export Logic ---
  const handleExportWord = () => {
    const s = currentSermon;
    
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
            alert("AI Generation failed. Please check your API key.");
        }
    } catch (e) {
        console.error(e);
        alert("An error occurred during generation.");
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
        }
    } catch (e) {
        console.error(e);
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
        if (currentSermon.id) {
            // Update
            const { error } = await supabase.from('sermons').update(currentSermon).eq('id', currentSermon.id);
            if (error) throw error;
            fetchSermons();
            setMode('list');
        } else {
            // Create
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, ...newSermonData } = currentSermon;
            const { error } = await supabase.from('sermons').insert([newSermonData]);
            if (error) throw error;
            fetchSermons();
            setMode('list');
        }
    } catch (err: any) {
        console.error("Save Error:", err);
        alert("Failed to save sermon: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
      if(!window.confirm("Delete this sermon?")) return;
      await supabase.from('sermons').delete().eq('id', id);
      fetchSermons();
  };

  const createNew = () => {
      setCurrentSermon({
        title: '', theme: '', main_scripture: '', introduction: '', background_context: '',
        main_point_1: '', main_point_2: '', main_point_3: '',
        application_points: [], gospel_connection: '', conclusion: '',
        prayer_points: [], altar_call: ''
      });
      setMode('edit');
  };

  const editSermon = (sermon: Sermon) => {
      setCurrentSermon(sermon);
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
          <div className="max-w-5xl mx-auto space-y-6">
              <div className="flex justify-between items-center border-b pb-6">
                  <div>
                    <h1 className="text-4xl font-bold text-gray-800 flex items-center gap-3">
                        <PenTool className="w-8 h-8 text-primary" /> Sermon Builder
                    </h1>
                    <p className="text-gray-500 mt-2">Methodist Pulpit Planner</p>
                  </div>
                  <button onClick={createNew} className="bg-primary text-white px-6 py-3 rounded-xl flex items-center gap-2 font-medium hover:bg-blue-700">
                      <Plus className="w-5 h-5" /> New Sermon
                  </button>
              </div>

              {loading ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-400"/></div>
              ) : sermons.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                      <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4"/>
                      <p className="text-gray-500">No sermons drafted yet.</p>
                  </div>
              ) : (
                  <div className="grid gap-4">
                      {sermons.map(s => (
                          <div key={s.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center group hover:shadow-md transition-shadow">
                              <div>
                                  <h3 className="text-xl font-bold text-gray-800 mb-1">{s.title || 'Untitled Sermon'}</h3>
                                  <p className="text-sm text-gray-500 flex items-center gap-3">
                                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-bold uppercase">{s.main_scripture || 'No Text'}</span>
                                      {s.theme && <span className="text-gray-400">|</span>} {s.theme}
                                  </p>
                              </div>
                              <div className="flex gap-2">
                                  <button onClick={() => editSermon(s)} className="p-2 text-gray-400 hover:text-primary hover:bg-blue-50 rounded-lg transition-colors">
                                      <PenTool className="w-5 h-5" />
                                  </button>
                                  <button onClick={() => handleDelete(s.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                      <Trash2 className="w-5 h-5" />
                                  </button>
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
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
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
                        className="w-full text-4xl font-serif font-bold text-gray-900 border-none border-b-2 border-gray-200 focus:border-primary focus:ring-0 px-0 py-2 placeholder-gray-300"
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
                          className="w-full p-4 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-primary text-lg font-serif"
                          placeholder="e.g. John 8:12"
                          value={currentSermon.main_scripture}
                          onChange={e => setCurrentSermon({...currentSermon, main_scripture: e.target.value})}
                      />
                  </div>
                  <div className="relative">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Theme</label>
                      <input 
                          type="text" 
                          className="w-full p-4 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-primary text-lg"
                          placeholder="e.g. Guidance, Hope"
                          value={currentSermon.theme}
                          onChange={e => setCurrentSermon({...currentSermon, theme: e.target.value})}
                      />
                  </div>
              </div>

              {/* 3. Introduction */}
              <div className="mb-10 relative group">
                  <label className="block text-lg font-bold text-gray-800 mb-2">3. Introduction</label>
                  <p className="text-sm text-gray-500 mb-2">Greeting, state the problem, introduce big idea.</p>
                  <div className="relative">
                      <textarea 
                          rows={5}
                          className="w-full p-4 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary resize-y"
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
                          className="w-full p-4 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary resize-y bg-gray-50/50"
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
                            className="w-full p-4 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary resize-y"
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
                            className="w-full p-4 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary resize-y"
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
                            className="w-full p-4 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary resize-y"
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
                        className="w-full p-4 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary resize-y"
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
                        className="w-full p-4 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary resize-y"
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
                      <button onClick={() => addToList('prayer_points')} className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
                          <Plus className="w-4 h-4"/> Add Point
                      </button>
                  </div>
                  <ul className="space-y-3">
                    {(currentSermon.prayer_points as string[] || []).map((item, idx) => (
                        <li key={idx} className="flex gap-2 items-center">
                            <span className="text-gray-400">•</span>
                            <input 
                                className="flex-1 bg-gray-50 border-none rounded p-2 focus:ring-1 focus:ring-primary"
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

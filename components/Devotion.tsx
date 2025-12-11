
import React, { useState, useMemo, useEffect } from 'react';
import { Heart, Sparkles, Loader2, Save, Calendar, Filter, ChevronRight, BookOpen, Sun, Moon, Leaf, Snowflake, Lightbulb, ArrowLeft } from 'lucide-react';
import { generateDevotional, DevotionalResponse } from '../services/geminiService';
import { supabase } from '../supabaseClient';
import { DailyVersePlan } from '../utils/dailyVersePlan';
import { getVerseByReference } from '../services/dailyVerseService';
import { DailyVerse } from '../types';
import { useLocation } from 'react-router-dom';

// --- Configuration Data ---
const DEVOTION_CONFIG = {
  settings: {
    year: 2026,
    allowDateFilter: true,
    allowSeasonFilter: true
  },
  seasons: [
    { id: "EPIPHANY", name: "Epiphany", icon: Sun, color: "text-yellow-600", bg: "bg-yellow-50" },
    { id: "LENT", name: "Lent", icon: Moon, color: "text-purple-600", bg: "bg-purple-50" },
    { id: "HOLY_WEEK", name: "Holy Week", icon: BookOpen, color: "text-red-800", bg: "bg-red-50" },
    { id: "EASTER", name: "Easter Season", icon: Sun, color: "text-yellow-500", bg: "bg-yellow-100" },
    { id: "PENTECOST", name: "Pentecost", icon: Sparkles, color: "text-red-500", bg: "bg-orange-50" },
    { id: "ORDINARY_TIME", name: "Ordinary Time", icon: Leaf, color: "text-green-600", bg: "bg-green-50" },
    { id: "ADVENT", name: "Advent", icon: Snowflake, color: "text-blue-600", bg: "bg-blue-50" },
    { id: "CHRISTMAS", name: "Christmas Season", icon: StarIcon, color: "text-yellow-400", bg: "bg-slate-800" }
  ],
  // Special fixed date plans can still live here
  specialDays: [
    {
      date: "2026-01-01",
      scripture: "Psalm 90:12",
      theme: "Number Our Days",
      seasonId: "ORDINARY_TIME",
      calendarTag: "New Year’s Day",
      importance: "special"
    },
    {
      date: "2026-02-18",
      scripture: "Joel 2:12-13",
      theme: "Return to Me",
      seasonId: "LENT",
      calendarTag: "Ash Wednesday",
      importance: "major"
    },
    {
      date: "2026-03-29",
      scripture: "Matthew 21:1-11",
      theme: "Welcoming the King",
      seasonId: "HOLY_WEEK",
      calendarTag: "Palm Sunday",
      importance: "major"
    },
    {
      date: "2026-04-03",
      scripture: "Isaiah 53:4-6",
      theme: "The Suffering Servant",
      seasonId: "HOLY_WEEK",
      calendarTag: "Good Friday",
      importance: "major"
    },
    {
      date: "2026-04-05",
      scripture: "Matthew 28:5-6",
      theme: "He Is Risen",
      seasonId: "EASTER",
      calendarTag: "Resurrection Sunday",
      importance: "major"
    },
    {
      date: "2026-12-25",
      scripture: "Luke 2:10-11",
      theme: "Good News of Great Joy",
      seasonId: "CHRISTMAS",
      calendarTag: "Christmas Day",
      importance: "major"
    }
  ]
};

// Helper component for icon fallback
function StarIcon(props: any) {
  return <Sparkles {...props} />;
}

const Devotion: React.FC = () => {
  const location = useLocation();
  
  // Modes: 'today', 'date', 'season'
  const [mode, setMode] = useState<'today' | 'date' | 'season'>('today');
  const [view, setView] = useState<'flash' | 'full'>('flash');
  
  // State
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [customTopic, setCustomTopic] = useState('');
  
  // Generation State
  const [generatedContent, setGeneratedContent] = useState<DevotionalResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Daily Verse Data (fetched from Supabase)
  const [dailyVerse, setDailyVerse] = useState<DailyVerse | null>(null);
  const [verseLoading, setVerseLoading] = useState(false);

  // Check for auto-generation from Home page
  useEffect(() => {
      if (location.state && location.state.autoGenerate) {
          const { scripture, theme } = location.state;
          // Trigger generation immediately
          handleGenerate({
              scripture: scripture,
              theme: theme,
              date: new Date().toISOString().split('T')[0],
              seasonId: 'ORDINARY_TIME'
          });
          // Optional: Clean up history state if desired, but React Router handles navigation well.
      }
  }, [location.state]);

  // Computed
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Logic to determine active plan
  const activePlan = useMemo(() => {
    const targetDate = mode === 'today' ? todayStr : selectedDate;
    
    // 1. Check special days first
    const specialMatch = DEVOTION_CONFIG.specialDays.find(p => p.date === targetDate);
    if (specialMatch) return specialMatch;

    // 2. Use Daily Verse Plan for normal days
    if (mode === 'today' || mode === 'date') {
        const verseRef = DailyVersePlan.verseForDate(new Date(targetDate));
        return {
            date: targetDate,
            scripture: verseRef,
            theme: "Verse of the Day", // Generic theme, to be refined by verse content or AI
            seasonId: "ORDINARY_TIME", // Could calculate proper season here if needed
            calendarTag: "Daily Word",
            importance: "normal"
        };
    }
    
    return null;
  }, [mode, selectedDate, todayStr]);

  // Fetch verse content when active plan changes
  useEffect(() => {
      if (activePlan && activePlan.scripture) {
          const loadVerse = async () => {
              setVerseLoading(true);
              const data = await getVerseByReference(activePlan.scripture);
              setDailyVerse(data);
              setVerseLoading(false);
          };
          loadVerse();
      } else {
          setDailyVerse(null);
      }
  }, [activePlan]);

  // Find entries for a season (currently only using special days for list, could expand)
  const seasonEntries = useMemo(() => {
    if (!selectedSeasonId) return [];
    return DEVOTION_CONFIG.specialDays.filter(p => p.seasonId === selectedSeasonId);
  }, [selectedSeasonId]);

  const getSeasonInfo = (id: string) => DEVOTION_CONFIG.seasons.find(s => s.id === id);

  const handleGenerate = async (params: any = {}) => {
    setLoading(true);
    
    // Build parameters based on mode and state
    let finalParams = { ...params };

    if (!finalParams.scripture && !finalParams.theme) {
        if (activePlan) {
            finalParams = { ...activePlan };
        } else if (customTopic) {
            finalParams.topic = customTopic;
            finalParams.seasonId = 'ORDINARY_TIME';
        } else {
            finalParams.date = mode === 'today' ? todayStr : selectedDate;
            finalParams.seasonId = selectedSeasonId || 'ORDINARY_TIME';
        }
    }

    const result = await generateDevotional(finalParams);
    if (result) {
        setGeneratedContent(result);
        setView('full');
    } else {
        alert("Could not generate devotion. Please check your API key or try again.");
    }
    setLoading(false);
  };

  const saveToIdeas = async () => {
    if (!generatedContent) return;
    setSaving(true);
    
    const noteContent = `SCRIPTURE DEVOTION
Date: ${generatedContent.date}
Title: ${generatedContent.title}

Scripture:
${generatedContent.scripture}

Reflection:
${generatedContent.content}

Question: ${generatedContent.reflectionQuestion}

Prayer:
${generatedContent.prayer}`;

    const { error } = await supabase.from('ideas').insert([{
        idea_date: new Date().toISOString().split('T')[0],
        place: 'Devotional Generator',
        note: noteContent
    }]);

    setSaving(false);
    if (!error) alert('Saved to your Ideas Journal!');
    else alert('Failed to save.');
  };

  const handleReset = () => {
      setView('flash');
  };

  // --- Render Components ---

  const renderFlashCard = (plan: typeof DEVOTION_CONFIG.specialDays[0]) => {
      const season = getSeasonInfo(plan.seasonId);
      const SeasonIcon = season?.icon || Leaf;

      // Check if we have an image from Supabase
      const bgImage = dailyVerse?.image_url;
      const hasBgImage = !!bgImage;

      // Default background logic if no image
      const bgStyle = season?.id === 'CHRISTMAS' || season?.id === 'ADVENT' 
        ? "bg-gradient-to-br from-slate-800 to-slate-900 text-white" 
        : "bg-white text-gray-900";

      return (
        <div className={`relative rounded-2xl shadow-xl overflow-hidden transform transition-all duration-500 hover:shadow-2xl ${hasBgImage ? 'text-white' : bgStyle} min-h-[400px] flex flex-col`}>
             {/* Background Image Layer */}
             {hasBgImage ? (
                 <>
                    <div className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 hover:scale-105" style={{ backgroundImage: `url(${bgImage})` }}></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/30"></div>
                 </>
             ) : (
                 <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1507692049790-de58293a469d?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
             )}
             
             {/* Content Container */}
             <div className="relative z-10 flex-1 flex flex-col p-8 md:p-10">
                
                {/* Header: Date & Season */}
                <div className="flex justify-between items-start mb-8">
                    <div className="flex flex-col">
                         <span className="text-xs font-bold uppercase tracking-widest opacity-70 mb-1">Date</span>
                         <span className="text-xl font-bold font-serif">{new Date(plan.date).toLocaleDateString()}</span>
                    </div>
                    {plan.calendarTag && (
                        <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-sm bg-black/20 text-white border border-white/20`}>
                           {plan.calendarTag}
                        </div>
                    )}
                </div>

                {/* Main: Title & Scripture */}
                <div className="flex-1 flex flex-col justify-center space-y-6 text-center">
                    <div>
                         <span className="text-xs font-bold uppercase tracking-widest opacity-70 mb-2 block">Verse of the Day</span>
                         <h2 className="text-3xl md:text-5xl font-serif font-bold leading-tight">{plan.scripture}</h2>
                    </div>
                    
                    <div className="w-16 h-1 bg-current mx-auto opacity-30 rounded-full"></div>

                    <div>
                         {verseLoading ? (
                             <div className="flex justify-center"><Loader2 className="w-6 h-6 animate-spin opacity-50"/></div>
                         ) : dailyVerse?.text ? (
                             <p className="text-lg md:text-xl font-medium opacity-90 leading-relaxed max-w-2xl mx-auto">
                                "{dailyVerse.text}"
                             </p>
                         ) : (
                             <p className="text-sm opacity-60 italic">
                                Verse text unavailable. Click below to read devotion.
                             </p>
                         )}
                    </div>
                </div>

                {/* Footer: Action */}
                <div className="mt-8 pt-6 border-t border-current/10 text-center">
                    <button 
                        onClick={() => handleGenerate(plan)}
                        disabled={loading}
                        className={`inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg transition-transform active:scale-95 shadow-lg ${hasBgImage ? 'bg-white/20 backdrop-blur-md hover:bg-white/30 text-white border border-white/30' : 'bg-primary text-white hover:bg-blue-600'}`}
                    >
                        {loading ? <Loader2 className="animate-spin w-5 h-5"/> : <BookOpen className="w-5 h-5" />}
                        Read Full Devotion
                    </button>
                    {/* Season Tag Bottom */}
                    <div className="mt-4 flex items-center justify-center gap-2 opacity-60 text-sm">
                        <SeasonIcon className="w-4 h-4" />
                        <span>{season?.name}</span>
                    </div>
                </div>
             </div>
        </div>
      );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-16">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 border-b border-gray-200 pb-6">
            <div className="flex items-center gap-4">
                {view === 'full' && (
                    <button onClick={handleReset} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6 text-gray-600"/>
                    </button>
                )}
                <div>
                    <h1 className="text-4xl font-bold text-gray-800 flex items-center gap-3">
                        <Heart className="w-10 h-10 text-red-500 fill-red-50" />
                        Scripture Devotion
                    </h1>
                </div>
            </div>
            
            {/* Navigation Tabs - Hidden if viewing full content to focus reading */}
            {view === 'flash' && (
                <div className="flex bg-gray-100 p-1 rounded-lg self-start md:self-auto">
                    {[
                        { id: 'today', label: 'Today', icon: Sun },
                        { id: 'date', label: 'Pick Date', icon: Calendar },
                        { id: 'season', label: 'Season', icon: Filter }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setMode(tab.id as any); setGeneratedContent(null); setCustomTopic(''); }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            )}
        </div>

        {/* --- VIEW: FLASH SCREEN (DEFAULT) --- */}
        {view === 'flash' && (
            <div className="animate-fade-in">
                {mode === 'today' && (
                     activePlan ? renderFlashCard(activePlan) : (
                        // Fallback Flash Card for No Plan (Should rarely happen with DailyVersePlan)
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-10 text-center border border-blue-100 min-h-[300px] flex flex-col justify-center">
                            <Sun className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Open Devotion</h2>
                            <p className="text-gray-600 mb-8 max-w-lg mx-auto">
                                Enter a topic to generate a fresh devotion.
                            </p>
                            <div className="max-w-md mx-auto relative w-full">
                                <input 
                                    type="text"
                                    placeholder="e.g. Grace, Psalm 23..."
                                    className="w-full pl-4 pr-32 py-4 rounded-xl border-0 shadow-md focus:ring-2 focus:ring-blue-500"
                                    value={customTopic}
                                    onChange={e => setCustomTopic(e.target.value)}
                                />
                                <button 
                                    onClick={() => handleGenerate()}
                                    disabled={!customTopic && !loading}
                                    className="absolute right-2 top-2 bottom-2 bg-blue-600 text-white px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:bg-gray-400"
                                >
                                    {loading ? <Loader2 className="animate-spin"/> : 'Generate'}
                                </button>
                            </div>
                        </div>
                     )
                )}

                {mode === 'date' && (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                            <Calendar className="w-6 h-6 text-gray-400" />
                            <input 
                                type="date" 
                                value={selectedDate}
                                onChange={(e) => { setSelectedDate(e.target.value); setGeneratedContent(null); }}
                                className="flex-1 text-lg border-none focus:ring-0 text-gray-700 font-medium"
                            />
                        </div>
                        {activePlan ? renderFlashCard(activePlan) : (
                             <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                                <p className="text-gray-500 mb-4">No scheduled plan for this date.</p>
                                <button 
                                   onClick={() => handleGenerate()}
                                   className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium shadow-sm"
                                >
                                   Generate Standard Devotion
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {mode === 'season' && (
                    <div>
                        {!selectedSeasonId ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {DEVOTION_CONFIG.seasons.map(season => (
                                    <button
                                        key={season.id}
                                        onClick={() => setSelectedSeasonId(season.id)}
                                        className={`p-6 rounded-xl border text-left transition-all hover:shadow-md ${season.bg} border-transparent hover:border-gray-200`}
                                    >
                                        <season.icon className={`w-8 h-8 ${season.color} mb-3`} />
                                        <h3 className={`font-bold text-lg ${season.color}`}>{season.name}</h3>
                                        <p className="text-sm text-gray-500 mt-1">
                                            Select to view plans
                                        </p>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div>
                                <button 
                                    onClick={() => setSelectedSeasonId(null)}
                                    className="mb-6 flex items-center text-sm text-gray-500 hover:text-gray-800"
                                >
                                    &larr; Back to Seasons
                                </button>
                                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                                     {(() => {
                                         const s = getSeasonInfo(selectedSeasonId);
                                         const Icon = s?.icon || Filter;
                                         return <><Icon className={`w-6 h-6 ${s?.color}`}/> {s?.name}</>;
                                     })()}
                                </h2>
                                <div className="grid gap-4">
                                    {seasonEntries.length > 0 ? seasonEntries.map((plan, idx) => (
                                        <div key={idx} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center group hover:border-blue-200 transition-colors">
                                            <div>
                                                <div className="text-xs font-bold text-gray-400 uppercase mb-1">{new Date(plan.date).toLocaleDateString()}</div>
                                                <h3 className="text-lg font-bold text-gray-800">{plan.theme}</h3>
                                                <p className="text-gray-500 text-sm">{plan.scripture}</p>
                                            </div>
                                            <button 
                                                onClick={() => handleGenerate(plan)}
                                                className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition-all"
                                            >
                                                <ChevronRight className="w-5 h-5" />
                                            </button>
                                        </div>
                                    )) : (
                                        <div className="text-center py-10 text-gray-500 italic">No specific plans listed for this season yet.</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        )}

        {/* --- VIEW: FULL CONTENT --- */}
        {view === 'full' && generatedContent && (
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-fade-in ring-1 ring-black/5">
                <div className="bg-gradient-to-b from-white to-gray-50 p-8 md:p-12">
                    
                    {/* Header: Date & Title */}
                    <div className="mb-8 text-center">
                         <span className="inline-block mb-3 text-xs font-bold tracking-widest text-gray-400 uppercase">
                            {generatedContent.calendarTag || generatedContent.seasonId || generatedContent.date}
                         </span>
                         <h1 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-6 leading-tight">
                            {generatedContent.title}
                         </h1>
                         <div className="w-16 h-1 bg-red-500 mx-auto rounded-full"></div>
                    </div>

                    {/* Scripture Quote */}
                    <div className="bg-red-50/50 border-l-4 border-red-500 p-6 my-8 rounded-r-lg">
                        <p className="font-serif text-xl md:text-2xl text-red-900 italic leading-relaxed">
                            "{generatedContent.scripture}"
                        </p>
                    </div>

                    {/* Main Content */}
                    <div className="prose prose-lg prose-headings:font-serif prose-headings:font-bold prose-p:text-gray-700 prose-p:leading-relaxed max-w-none">
                        <div className="whitespace-pre-wrap">{generatedContent.content}</div>
                    </div>

                    {/* Reflection & Prayer Grid */}
                    <div className="grid md:grid-cols-2 gap-6 mt-12">
                        <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 relative">
                            <div className="absolute -top-3 -left-3 bg-white p-2 rounded-full border border-blue-100 shadow-sm">
                                <Lightbulb className="w-5 h-5 text-blue-600" />
                            </div>
                            <h3 className="font-bold text-blue-900 mb-2 ml-2">Reflection</h3>
                            <p className="text-blue-800 italic leading-relaxed">
                                {generatedContent.reflectionQuestion}
                            </p>
                        </div>
                        
                        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 relative">
                             <div className="absolute -top-3 -left-3 bg-white p-2 rounded-full border border-gray-200 shadow-sm">
                                <Heart className="w-5 h-5 text-red-500" />
                            </div>
                            <h3 className="font-bold text-gray-900 mb-2 ml-2">Prayer</h3>
                            <p className="text-gray-700 font-serif leading-relaxed">
                                {generatedContent.prayer}
                            </p>
                        </div>
                    </div>
                </div>
                
                {/* Footer Actions */}
                <div className="bg-gray-50 px-8 py-4 flex flex-col sm:flex-row justify-between items-center border-t border-gray-100 gap-4">
                    <span className="text-sm text-gray-400 italic">Generated by Ministry Manager AI</span>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button 
                            onClick={handleReset}
                            className="flex-1 sm:flex-none px-6 py-3 border border-gray-300 bg-white rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                        >
                            Close
                        </button>
                        <button 
                            onClick={saveToIdeas} 
                            disabled={saving} 
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-black font-medium shadow-sm transition-colors"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                            Save
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Devotion;

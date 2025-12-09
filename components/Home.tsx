import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CheckCircle2, BookOpen, Lightbulb, ArrowRight, Star, CalendarDays, AlertCircle, Loader2, MapPin } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { Task } from '../types';
import { explainStandingOrder } from '../services/geminiService';

interface Highlight {
  id: string;
  title: string;
  date: string;
  description: string;
  image: string | null;
}

interface DailyOrder {
    title: string;
    preview: string;
    linkQuery: string;
    isAiGenerated?: boolean;
}

const Home: React.FC = () => {
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loadingHighlights, setLoadingHighlights] = useState(true);
  const [dailyOrder, setDailyOrder] = useState<DailyOrder | null>(null);

  useEffect(() => {
    fetchRecentTasks();
    fetchHighlights();
    fetchDailyStandingOrder();
  }, []);

  const fetchRecentTasks = async () => {
    // Fetch high priority or impending tasks
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('is_completed', false)
      .order('task_date', { ascending: true })
      .limit(3);
    
    if (data) setRecentTasks(data);
  };

  const fetchHighlights = async () => {
    setLoadingHighlights(true);
    const today = new Date().toISOString().split('T')[0];

    // Fetch upcoming programs
    const { data, error } = await supabase
      .from('church_programs')
      .select('*')
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(3);

    if (data) {
      const mappedHighlights = data.map(program => ({
        id: program.id,
        title: program.activity_description,
        date: program.date,
        description: `Venue: ${program.venue || 'Main Auditorium'} • Lead: ${program.lead || 'Minister'}`,
        image: getImageForEvent(program.activity_description)
      }));
      setHighlights(mappedHighlights);
    }
    setLoadingHighlights(false);
  };

  const fetchDailyStandingOrder = async () => {
    const today = new Date();
    // Calculate Day of Year (1-365) to use as a seed
    const start = new Date(today.getFullYear(), 0, 0);
    const diff = today.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);

    try {
        // 1. Try DB first
        const { data: dbData } = await supabase.from('standing_orders').select('*');
        if (dbData && dbData.length > 0) {
            const idx = dayOfYear % dbData.length;
            setDailyOrder({ 
                title: dbData[idx].code, 
                preview: dbData[idx].content, 
                linkQuery: dbData[idx].code 
            });
            return;
        }

        // 2. Try Document if DB is empty
        const { data: docData } = await supabase.from('uploaded_documents').select('content').eq('id', 'standing_orders').single();
        if (docData && docData.content) {
            // Filter for substantial text that might be a standing order (heuristic: length > 50)
            const possibleOrders = (docData.content as any[]).filter((c: any) => c.text && c.text.length > 50);
            
            if (possibleOrders.length > 0) {
                const idx = dayOfYear % possibleOrders.length;
                const item = possibleOrders[idx];
                
                // Try to extract a code (e.g., "S.O 54" or "Section 3")
                const codeMatch = item.text.match(/(S\.?O\.?|SECTION|ARTICLE)\s*(\d+)/i);
                const title = codeMatch ? codeMatch[0].toUpperCase() : 'Constitution Excerpt';
                const linkQuery = codeMatch ? codeMatch[0] : item.text.substring(0, 15);
                
                // Initial set with raw text to prevent layout shift/empty space
                setDailyOrder({ 
                    title, 
                    preview: item.text, 
                    linkQuery,
                    isAiGenerated: false
                });

                // Fetch AI explanation in background to improve the text
                try {
                     explainStandingOrder(title, item.text).then(explanation => {
                         if (explanation && !explanation.includes("Error")) {
                            setDailyOrder(prev => prev ? { 
                                ...prev, 
                                preview: explanation,
                                isAiGenerated: true
                            } : null);
                         }
                     });
                } catch(err) {
                    console.log("AI Explanation failed", err);
                }
            }
        }
    } catch (e) {
        console.error("Error fetching daily order", e);
    }
  };

  const getImageForEvent = (title: string): string | null => {
    const lower = title.toLowerCase();
    
    // Worship & Music
    if (lower.match(/worship|praise|choir|music|song|concert|hymn/)) 
      return 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?q=80&w=2670&auto=format&fit=crop';
    
    // Prayer & Spiritual
    if (lower.match(/prayer|fasting|tarry|vigil|deliverance|holy|spirit/)) 
      return 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?q=80&w=2673&auto=format&fit=crop';
    
    // Youth & Children
    if (lower.match(/youth|teen|student|child|kid|sunday school/)) 
      return 'https://images.unsplash.com/photo-1529070538774-1843cb3265df?q=80&w=2670&auto=format&fit=crop';
    
    // Outreach & Evangelism
    if (lower.match(/outreach|evangelism|crusade|mission|soul|witness/)) 
      return 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?q=80&w=2670&auto=format&fit=crop';
    
    // Teaching & Bible
    if (lower.match(/bible|study|teaching|seminar|class|workshop|training/)) 
      return 'https://images.unsplash.com/photo-1491841550275-ad7854e35ca6?q=80&w=2670&auto=format&fit=crop';
    
    // Celebrations & Sacraments
    if (lower.match(/wedding|marriage|couple|matrimony/)) 
      return 'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?q=80&w=2670&auto=format&fit=crop';
    if (lower.match(/baptism|communion|naming|dedication/)) 
      return 'https://images.unsplash.com/photo-1518176258769-f227c798150e?q=80&w=2670&auto=format&fit=crop';
    
    // Social & Fellowship
    if (lower.match(/picnic|fellowship|lunch|dinner|breakfast|party|social/)) 
      return 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=2669&auto=format&fit=crop';
    
    // Leadership & Business
    if (lower.match(/meeting|committee|council|board|planning|leadership/)) 
      return 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=2670&auto=format&fit=crop';

    // Holidays
    if (lower.match(/christmas|xmas|carol/)) 
      return 'https://images.unsplash.com/photo-1512389142860-9c449dede134?q=80&w=2670&auto=format&fit=crop';
    if (lower.match(/easter|resurrection/)) 
      return 'https://images.unsplash.com/photo-1520188741366-65f799516d3e?q=80&w=2670&auto=format&fit=crop';

    // Somber
    if (lower.match(/funeral|burial|memorial/)) 
      return 'https://images.unsplash.com/photo-1499304620021-996417fa00dc?q=80&w=2670&auto=format&fit=crop';

    // Default: Return null to trigger the "No Placeholder" layout
    return null; 
  };

  return (
    <div className="space-y-12 animate-fade-in pb-10">
      {/* Hero Banner */}
      <div className="relative bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl overflow-hidden shadow-xl text-white">
        {/* Decorative Background Pattern */}
        <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1507692049790-de58293a469d?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        
        <div className="relative p-10 md:p-16 flex flex-col justify-center h-full min-h-[400px]">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 text-sm font-semibold uppercase tracking-wider">
              <Star className="w-4 h-4" /> Ministry Dashboard
            </div>
            <h1 className="text-5xl md:text-6xl font-bold leading-tight tracking-tight">
              Welcome to Rev. Minister's <br />
              <span className="text-primary text-blue-400">Ministry App</span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-200 max-w-2xl font-light">
              Empowering Kingdom Growth through Vision & Purpose.
            </p>
            <div className="pt-4">
              <Link 
                to="/programs" 
                className="inline-flex items-center gap-3 px-8 py-4 bg-primary hover:bg-blue-600 text-white rounded-xl text-xl font-medium transition-all transform hover:translate-y-[-2px] shadow-lg hover:shadow-primary/50"
              >
                View Details <ArrowRight className="w-6 h-6" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links Grid */}
      <div>
        <h2 className="text-3xl font-bold text-gray-800 mb-6 px-2">Quick Access</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link to="/programs" className="group bg-white p-8 rounded-xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-primary/30 transition-all duration-300">
            <div className="w-14 h-14 bg-blue-50 rounded-lg flex items-center justify-center mb-6 group-hover:bg-blue-600 transition-colors">
              <Calendar className="w-8 h-8 text-blue-600 group-hover:text-white transition-colors" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2 group-hover:text-blue-600">Programs</h3>
            <p className="text-gray-500 text-lg">Manage church events, schedules, and activities.</p>
          </Link>

          <Link to="/tasks" className="group bg-white p-8 rounded-xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-green-500/30 transition-all duration-300">
            <div className="w-14 h-14 bg-green-50 rounded-lg flex items-center justify-center mb-6 group-hover:bg-green-600 transition-colors">
              <CheckCircle2 className="w-8 h-8 text-green-600 group-hover:text-white transition-colors" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2 group-hover:text-green-600">Tasks</h3>
            <p className="text-gray-500 text-lg">Track your to-do list and ministry obligations.</p>
          </Link>

          <Link to="/standing-orders" className="group bg-white p-8 rounded-xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-purple-500/30 transition-all duration-300">
            <div className="w-14 h-14 bg-purple-50 rounded-lg flex items-center justify-center mb-6 group-hover:bg-purple-600 transition-colors">
              <BookOpen className="w-8 h-8 text-purple-600 group-hover:text-white transition-colors" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2 group-hover:text-purple-600">Constitution</h3>
            <p className="text-gray-500 text-lg">Reference standing orders and church policies.</p>
          </Link>

          <Link to="/ideas" className="group bg-white p-8 rounded-xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-yellow-500/30 transition-all duration-300">
            <div className="w-14 h-14 bg-yellow-50 rounded-lg flex items-center justify-center mb-6 group-hover:bg-yellow-500 transition-colors">
              <Lightbulb className="w-8 h-8 text-yellow-600 group-hover:text-white transition-colors" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2 group-hover:text-yellow-600">Ideas</h3>
            <p className="text-gray-500 text-lg">Journal thoughts and generate sermon outlines.</p>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Monthly Highlights Section */}
        <div className="xl:col-span-2">
            <div className="flex justify-between items-center mb-6 px-2">
              <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                <CalendarDays className="w-8 h-8 text-primary" /> Upcoming Highlights
              </h2>
              <Link to="/programs" className="text-primary hover:underline font-medium">View Calendar</Link>
            </div>
            
            {loadingHighlights ? (
               <div className="flex justify-center py-12 bg-white rounded-xl shadow-sm">
                 <div className="flex flex-col items-center">
                   <Loader2 className="w-10 h-10 animate-spin text-primary mb-2" />
                   <p className="text-gray-500">Loading schedule...</p>
                 </div>
               </div>
            ) : highlights.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {highlights.map((item, index) => (
                  <div key={index} className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 flex flex-col group h-full">
                    
                    {/* Image Header - Only rendered if image exists */}
                    {item.image ? (
                        <div className="h-48 overflow-hidden relative">
                            <img 
                            src={item.image} 
                            alt={item.title} 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60"></div>
                            <div className="absolute bottom-4 left-4 text-white">
                                <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-lg text-sm font-bold shadow-sm inline-block mb-2">
                                {new Date(item.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                </div>
                                <h3 className="text-xl font-bold leading-tight drop-shadow-sm">{item.title}</h3>
                            </div>
                        </div>
                    ) : (
                        // No Image Layout
                        <div className="p-6 bg-gradient-to-br from-blue-50 to-white border-b border-gray-100 flex justify-between items-start">
                             <div className="p-3 bg-white rounded-xl shadow-sm text-primary border border-blue-100">
                                 <Calendar className="w-8 h-8" />
                             </div>
                             <div className="text-right">
                                  <div className="text-sm font-bold text-gray-500 uppercase tracking-wider">{new Date(item.date).toLocaleDateString(undefined, { month: 'short' })}</div>
                                  <div className="text-4xl font-bold text-gray-800 leading-none">{new Date(item.date).getDate()}</div>
                                  <div className="text-xs text-gray-400 font-medium">{new Date(item.date).toLocaleDateString(undefined, { weekday: 'long' })}</div>
                             </div>
                        </div>
                    )}

                    <div className="p-5 flex-1 bg-white flex flex-col justify-center">
                        {/* Title is shown here if no image header */}
                        {!item.image && (
                            <h3 className="text-xl font-bold text-gray-800 mb-3 leading-tight border-l-4 border-primary pl-3">{item.title}</h3>
                        )}
                        <p className="text-gray-600 text-lg flex items-center gap-2">
                            {item.description}
                        </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-100">
                 <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                 <h3 className="text-xl font-semibold text-gray-700 mb-2">No upcoming programs</h3>
                 <p className="text-gray-500 mb-4">The schedule is clear for the coming days.</p>
                 <Link to="/programs" className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700">
                    Schedule an Event
                 </Link>
              </div>
            )}
        </div>

        {/* Right Sidebar */}
        <div className="xl:col-span-1 space-y-8">
             
             {/* 1. Standing Order of the Day */}
             <div>
                <h2 className="text-3xl font-bold text-gray-800 mb-6 px-2 flex items-center gap-3">
                    <BookOpen className="w-8 h-8 text-purple-600" /> Daily Order
                </h2>
                {dailyOrder ? (
                    <div className="bg-white rounded-xl shadow-md border border-purple-100 p-6 relative overflow-hidden group hover:shadow-lg transition-shadow">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-bl-full -mr-4 -mt-4 z-0"></div>
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-3">
                                <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 text-sm font-bold rounded-lg">
                                    {dailyOrder.title}
                                </span>
                                {dailyOrder.isAiGenerated && (
                                    <span className="text-xs text-purple-400 font-medium flex items-center gap-1 bg-white/80 px-2 py-1 rounded-full border border-purple-50">
                                        <Lightbulb className="w-3 h-3" /> Explained
                                    </span>
                                )}
                            </div>
                            <p className="text-gray-700 text-lg leading-relaxed mb-4 line-clamp-5">
                                {dailyOrder.preview}
                            </p>
                            <Link 
                                to={`/standing-orders?q=${encodeURIComponent(dailyOrder.linkQuery)}`} 
                                className="inline-flex items-center text-purple-600 font-medium hover:text-purple-800 group-hover:translate-x-1 transition-transform"
                            >
                                Read Full Section <ArrowRight className="w-4 h-4 ml-1" />
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center text-gray-400">
                        <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p>No document loaded.</p>
                        <Link to="/standing-orders" className="text-sm text-primary hover:underline">Upload one here</Link>
                    </div>
                )}
             </div>

             {/* 2. Pending Tasks */}
             <div>
                 <h2 className="text-3xl font-bold text-gray-800 mb-6 px-2 flex items-center gap-3">
                   <AlertCircle className="w-8 h-8 text-orange-500" /> Pending Tasks
                 </h2>
                 <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
                    {recentTasks.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20"/>
                            <p>No pending tasks found.</p>
                            <Link to="/tasks" className="text-primary mt-2 inline-block">Go to Tasks</Link>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {recentTasks.map(task => (
                                <div key={task.id} className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                                    <div className="mt-1">
                                        <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-800 text-lg">{task.message}</p>
                                        <p className="text-sm text-gray-500 mt-1">Due: {new Date(task.task_date).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            ))}
                            <Link to="/tasks" className="block text-center mt-4 pt-4 border-t text-primary font-medium hover:text-blue-700">
                                View All Tasks &rarr;
                            </Link>
                        </div>
                    )}
                 </div>
             </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
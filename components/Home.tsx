
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Calendar, CheckCircle2, BookOpen, Lightbulb, ArrowRight, Star, 
  CalendarDays, AlertCircle, Loader2, MapPin, ChevronRight,
  Crown, Scroll, Sparkles, ShieldCheck, Clock, Share2, Heart, Quote
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { Task } from '../types';
import { explainStandingOrder, getAiDailyVerse } from '../services/geminiService';
import { getTodayVerse } from '../services/dailyVerseService';

interface Highlight {
  id: string;
  title: string;
  date: string;
  description: string;
  image: string | null;
  venue: string;
  lead: string;
}

interface DailyOrder {
    title: string;
    preview: string;
    linkQuery: string;
    isAiGenerated?: boolean;
}

interface LiturgicalSeason {
  name: string;
  color: string;
  bg: string; // Tailwind class
  accent: string; // Tailwind class for contrast
  definition: string;
}

// --- Image Mapping for Verses ---
const VERSE_IMAGES: Record<string, string> = {
    'light': 'https://images.unsplash.com/photo-1507692049790-de58293a469d?q=80&w=2670&auto=format&fit=crop',
    'mountain': 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2670&auto=format&fit=crop',
    'water': 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=2674&auto=format&fit=crop',
    'sheep': 'https://images.unsplash.com/photo-1484557985045-edf25e08da73?q=80&w=2673&auto=format&fit=crop',
    'shepherd': 'https://images.unsplash.com/photo-1484557985045-edf25e08da73?q=80&w=2673&auto=format&fit=crop',
    'cross': 'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?q=80&w=2670&auto=format&fit=crop',
    'sky': 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=2670&auto=format&fit=crop',
    'peace': 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=2670&auto=format&fit=crop',
    'bread': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=2672&auto=format&fit=crop',
    'vine': 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?q=80&w=2670&auto=format&fit=crop',
    'default': 'https://images.unsplash.com/photo-1507692049790-de58293a469d?q=80&w=2670&auto=format&fit=crop'
};

const getVerseImage = (keyword?: string) => {
    if (!keyword) return VERSE_IMAGES['default'];
    const k = keyword.toLowerCase();
    for (const key in VERSE_IMAGES) {
        if (k.includes(key)) return VERSE_IMAGES[key];
    }
    return VERSE_IMAGES['default'];
};

// Helper: Calculate Liturgical Season
const getSeasonForDate = (date: Date): LiturgicalSeason => {
    const year = date.getFullYear();
    
    // Easter Calculation (Meeus/Jones/Butcher)
    const f = Math.floor,
        G = year % 19,
        C = f(year / 100),
        H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
        I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11)),
        J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7,
        L = I - J,
        month = 3 + f((L + 40) / 44),
        day = L + 28 - 31 * f(month / 4);
    const easter = new Date(year, month - 1, day);

    // Key Dates
    const christmas = new Date(year, 11, 25);
    const epiphany = new Date(year, 0, 6);
    
    // Ash Wednesday is 46 days before Easter
    const ashWednesday = new Date(easter);
    ashWednesday.setDate(easter.getDate() - 46);

    const palmSunday = new Date(easter);
    palmSunday.setDate(easter.getDate() - 7);

    const pentecost = new Date(easter);
    pentecost.setDate(easter.getDate() + 49);

    // Advent Start (Sunday nearest Nov 30, or 4th Sunday before Christmas)
    // Simplified: 4 Sundays before Dec 25
    const adventStart = new Date(christmas);
    adventStart.setDate(christmas.getDate() - christmas.getDay() - 21);
    
    // Normalize input date to midnight for comparison
    const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    // --- Logic ---

    // 1. Advent
    if (current >= adventStart && current < christmas) {
        return { 
            name: "Advent", 
            color: "Violet", 
            bg: "bg-purple-800", 
            accent: "bg-purple-600",
            definition: "A season of preparation and expectation." 
        };
    }

    // 2. Christmas Season (Dec 25 - Jan 5) OR (Jan 1 - Jan 5 of current year)
    // Note: Epiphany is Jan 6.
    const isJanChristmas = (current.getMonth() === 0 && current.getDate() <= 5);
    if ((current >= christmas) || isJanChristmas) {
        return { 
            name: "Christmas Season", 
            color: "White", 
            bg: "bg-yellow-600", 
            accent: "bg-yellow-500",
            definition: "Celebration of the birth of Christ." 
        };
    }

    // 3. Epiphany (Jan 6)
    if (current.getMonth() === 0 && current.getDate() === 6) {
         return { 
             name: "Epiphany", 
             color: "White", 
             bg: "bg-yellow-500", 
             accent: "bg-yellow-400",
             definition: "Christ revealed to the nations." 
        };
    }

    // 4. Season after Epiphany (Jan 7 to Ash Wednesday)
    const jan7 = new Date(year, 0, 7);
    if (current >= jan7 && current < ashWednesday) {
        return { 
            name: "Season after Epiphany", 
            color: "Green", 
            bg: "bg-green-700", 
            accent: "bg-green-600",
            definition: "Focus on Christ's early ministry." 
        };
    }

    // 5. Lent (Ash Wed to before Palm Sunday/Holy Week)
    if (current >= ashWednesday && current < palmSunday) {
        return { 
            name: "Lent", 
            color: "Violet", 
            bg: "bg-purple-800", 
            accent: "bg-purple-700",
            definition: "Forty days of penitence and preparation." 
        };
    }

    // 6. Holy Week (Palm Sunday to Holy Saturday)
    if (current >= palmSunday && current < easter) {
        return { 
            name: "Holy Week", 
            color: "Red (or Violet)", 
            bg: "bg-red-900", 
            accent: "bg-red-700",
            definition: "Recalling Christ’s passion and death." 
        };
    }

    // 7. Easter Season (Easter to Pentecost)
    if (current >= easter && current < pentecost) {
        return { 
            name: "Easter Season", 
            color: "White/Gold", 
            bg: "bg-yellow-500", 
            accent: "bg-yellow-400",
            definition: "Celebrating the resurrection of Jesus." 
        };
    }

    // 8. Pentecost Day
    if (current.getTime() === pentecost.getTime()) {
        return { 
            name: "Day of Pentecost", 
            color: "Red", 
            bg: "bg-red-700", 
            accent: "bg-red-600",
            definition: "Outpouring of the Holy Spirit." 
        };
    }
    
    // 9. Ordinary Time (After Pentecost until Advent)
    // Note: If current date is between pentecost and advent start
    if (current > pentecost && current < adventStart) {
        return { 
            name: "Ordinary Time", 
            color: "Green", 
            bg: "bg-green-700", 
            accent: "bg-green-600",
            definition: "The season of growth and teaching." 
        };
    }

    // Fallback (shouldn't be reached if logic covers full year, but safe default)
    return { 
        name: "Ordinary Time", 
        color: "Green", 
        bg: "bg-green-700", 
        accent: "bg-green-600",
        definition: "Walking in the light of Christ." 
    };
}

const Home: React.FC = () => {
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loadingHighlights, setLoadingHighlights] = useState(true);
  const [dailyOrder, setDailyOrder] = useState<DailyOrder | null>(null);
  const [currentSeason, setCurrentSeason] = useState<LiturgicalSeason | null>(null);
  const [todaysVerse, setTodaysVerse] = useState<{reference: string, text: string, keyword?: string} | null>(null);
  const [verseLoading, setVerseLoading] = useState(false);

  useEffect(() => {
    fetchRecentTasks();
    fetchHighlights();
    fetchDailyStandingOrder();
    setCurrentSeason(getSeasonForDate(new Date()));
    loadVerse();
  }, []);

  const loadVerse = async () => {
    setVerseLoading(true);
    const source = localStorage.getItem('dailyVerseSource') || 'plan';
    
    if (source === 'ai') {
        const v = await getAiDailyVerse();
        if (v) setTodaysVerse(v);
    } else {
        const v = await getTodayVerse();
        // If plan has no text, provide a default or placeholder
        setTodaysVerse({ 
            reference: v.reference, 
            text: v.text || "Tap to read full devotion text online or generate content.",
            keyword: 'light' // Default for planned verses if no keyword logic exists yet
        });
    }
    setVerseLoading(false);
  };

  const handleShareVerse = () => {
    if (!todaysVerse) return;
    
    // Requested Format:
    // Verse Text
    // Reference
    // #pulpit
    // Rev. Charles K. Coffie

    const textToShare = `${todaysVerse.text}\n${todaysVerse.reference}\n\n#pulpit\n\nRev. Charles K. Coffie`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Verse of the Day',
            text: textToShare
        }).catch(err => console.log('Share canceled', err));
    } else {
        navigator.clipboard.writeText(textToShare);
        alert("Verse copied to clipboard!");
    }
  };

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
        venue: program.venue,
        lead: program.lead,
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
    <div className="space-y-6 md:space-y-12 animate-fade-in pb-10">
      
      {/* 1. Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-slate-900 text-white shadow-xl md:shadow-2xl border border-white/5">
        {/* Background Gradients & Textures */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900 via-slate-900 to-slate-950"></div>
        <div className="absolute top-[-50%] left-[-20%] w-[80%] h-[150%] bg-indigo-500/10 blur-[120px] rounded-full mix-blend-screen pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[100%] bg-blue-500/10 blur-[100px] rounded-full mix-blend-screen pointer-events-none"></div>
        
        {/* Subtle Grain/Pattern */}
        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>

        <div className="relative z-10 px-6 py-8 md:p-16 flex flex-col items-center text-center md:items-start md:text-left">
           {/* Badge */}
           <div className="inline-flex items-center gap-2 px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-300 text-[10px] md:text-xs font-bold uppercase tracking-widest shadow-sm mb-4 md:mb-6 backdrop-blur-md">
              <Crown className="w-3 h-3 md:w-4 md:h-4" /> 
              Pastoral Workspace
           </div>

           {/* Title */}
           <h1 className="text-3xl md:text-6xl font-serif font-bold leading-tight mb-3 md:mb-4 tracking-tight text-white drop-shadow-sm">
              Ministry <br className="md:hidden" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-100 to-amber-200">
                 Suite
              </span>
           </h1>

           {/* Subtitle */}
           <p className="text-sm md:text-xl text-indigo-200/80 font-light max-w-2xl leading-relaxed mb-6 md:mb-8">
              Empowering Kingdom growth through vision, purpose, and organized leadership.
           </p>

           {/* Buttons */}
           <div className="flex flex-wrap gap-3 justify-center md:justify-start w-full md:w-auto">
              <Link to="/programs" className="group flex-1 md:flex-none relative px-6 py-3 md:px-8 md:py-4 bg-white text-indigo-950 rounded-full font-bold text-sm md:text-lg shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2 md:gap-3 overflow-hidden">
                  <span className="relative z-10">Schedule</span>
                  <ArrowRight className="w-4 h-4 md:w-5 md:h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                  <div className="absolute inset-0 bg-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </Link>
              <Link to="/sermons" className="flex-1 md:flex-none px-6 py-3 md:px-8 md:py-4 bg-indigo-900/40 border border-indigo-400/20 text-indigo-100 rounded-full font-bold text-sm md:text-lg hover:bg-indigo-800/40 transition-all flex items-center justify-center gap-2 md:gap-3 backdrop-blur-sm hover:border-indigo-400/40">
                  <Scroll className="w-4 h-4 md:w-5 md:h-5" />
                  Sermons
              </Link>
           </div>

           {/* Verse */}
           <div className="mt-8 pt-6 border-t border-white/5 w-full md:w-auto hidden md:block">
              <p className="text-sm font-serif italic text-slate-400 flex items-center justify-center md:justify-start gap-2">
                 <Sparkles className="w-3 h-3 text-amber-500/50" />
                 "Therefore encourage one another and build each other up." — 1 Thessalonians 5:11
              </p>
           </div>
        </div>
      </div>

      {/* Christian Season Banner */}
      {currentSeason && (
        <Link to="/christian-calendar" className="block transform hover:scale-[1.01] transition-transform duration-300">
            <div className={`relative overflow-hidden rounded-xl md:rounded-2xl shadow-md md:shadow-lg ${currentSeason.bg} text-white`}>
                <div className={`absolute top-0 right-0 w-24 md:w-32 h-full ${currentSeason.accent} transform skew-x-12 translate-x-8 md:translate-x-10 opacity-50`}></div>
                <div className="relative p-4 md:p-6 flex flex-row items-center justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 md:gap-3 mb-1">
                            <span className="text-[10px] md:text-sm font-medium opacity-90 uppercase tracking-wider">Today</span>
                        </div>
                        <h2 className="text-xl md:text-3xl font-bold mb-1 md:mb-2 flex items-center gap-2">
                            {currentSeason.name}
                        </h2>
                        <p className="text-white/90 text-xs md:text-lg max-w-2xl line-clamp-1 md:line-clamp-none">
                           {currentSeason.definition}
                        </p>
                    </div>
                    <div className="bg-white/20 p-1.5 md:p-2 rounded-full">
                        <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-white" />
                    </div>
                </div>
            </div>
        </Link>
      )}

      {/* Quick Links Grid - 2 Col Mobile */}
      <div>
        <h2 className="text-xl md:text-3xl font-bold text-gray-800 mb-4 md:mb-6 px-1 md:px-2">Quick Access</h2>
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          <Link to="/programs" className="group bg-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-primary/30 transition-all duration-300">
            <div className="w-10 h-10 md:w-14 md:h-14 bg-blue-50 rounded-lg flex items-center justify-center mb-3 md:mb-6 group-hover:bg-blue-600 transition-colors">
              <Calendar className="w-5 h-5 md:w-8 md:h-8 text-blue-600 group-hover:text-white transition-colors" />
            </div>
            <h3 className="text-base md:text-2xl font-bold text-gray-800 mb-1 md:mb-2 group-hover:text-blue-600">Programs</h3>
            <p className="text-gray-500 text-xs md:text-lg line-clamp-2">Manage church events & schedules.</p>
          </Link>

          <Link to="/tasks" className="group bg-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-green-500/30 transition-all duration-300">
            <div className="w-10 h-10 md:w-14 md:h-14 bg-green-50 rounded-lg flex items-center justify-center mb-3 md:mb-6 group-hover:bg-green-600 transition-colors">
              <CheckCircle2 className="w-5 h-5 md:w-8 md:h-8 text-green-600 group-hover:text-white transition-colors" />
            </div>
            <h3 className="text-base md:text-2xl font-bold text-gray-800 mb-1 md:mb-2 group-hover:text-green-600">Tasks</h3>
            <p className="text-gray-500 text-xs md:text-lg line-clamp-2">Track to-do list & ministry duties.</p>
          </Link>

          <Link to="/standing-orders" className="group bg-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-purple-500/30 transition-all duration-300">
            <div className="w-10 h-10 md:w-14 md:h-14 bg-purple-50 rounded-lg flex items-center justify-center mb-3 md:mb-6 group-hover:bg-purple-600 transition-colors">
              <BookOpen className="w-5 h-5 md:w-8 md:h-8 text-purple-600 group-hover:text-white transition-colors" />
            </div>
            <h3 className="text-base md:text-2xl font-bold text-gray-800 mb-1 md:mb-2 group-hover:text-purple-600">Constitution</h3>
            <p className="text-gray-500 text-xs md:text-lg line-clamp-2">Standing orders & policies.</p>
          </Link>

          <Link to="/ideas" className="group bg-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-yellow-500/30 transition-all duration-300">
            <div className="w-10 h-10 md:w-14 md:h-14 bg-yellow-50 rounded-lg flex items-center justify-center mb-3 md:mb-6 group-hover:bg-yellow-500 transition-colors">
              <Lightbulb className="w-5 h-5 md:w-8 md:h-8 text-yellow-600 group-hover:text-white transition-colors" />
            </div>
            <h3 className="text-base md:text-2xl font-bold text-gray-800 mb-1 md:mb-2 group-hover:text-yellow-600">Ideas</h3>
            <p className="text-gray-500 text-xs md:text-lg line-clamp-2">Journal thoughts & sermons.</p>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">
        {/* Monthly Highlights Section */}
        <div className="xl:col-span-2">
            <div className="flex justify-between items-center mb-4 md:mb-6 px-1 md:px-2">
              <h2 className="text-xl md:text-3xl font-bold text-gray-800 flex items-center gap-2 md:gap-3">
                <CalendarDays className="w-6 h-6 md:w-8 md:h-8 text-primary" /> Upcoming
              </h2>
              <Link to="/programs" className="text-primary hover:underline font-medium text-sm md:text-base">View Calendar</Link>
            </div>
            
            {loadingHighlights ? (
               <div className="flex justify-center py-12 bg-white rounded-xl shadow-sm">
                 <div className="flex flex-col items-center">
                   <Loader2 className="w-8 h-8 md:w-10 md:h-10 animate-spin text-primary mb-2" />
                   <p className="text-gray-500 text-sm">Loading schedule...</p>
                 </div>
               </div>
            ) : highlights.length > 0 ? (
              <div className="flex flex-col md:grid md:grid-cols-2 gap-3 md:gap-6">
                {highlights.map((item, index) => (
                  <div key={index} className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 flex flex-col group">
                    
                    {/* Desktop View: Image Card */}
                    <div className="hidden md:block">
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
                                    <h3 className="text-xl font-bold leading-tight drop-shadow-sm line-clamp-1">{item.title}</h3>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 bg-gradient-to-br from-blue-50 to-white border-b border-gray-100 flex justify-between items-start">
                                 <div className="p-3 bg-white rounded-xl shadow-sm text-primary border border-blue-100">
                                     <Calendar className="w-8 h-8" />
                                 </div>
                                 <div className="text-right">
                                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">{new Date(item.date).toLocaleDateString(undefined, { month: 'short' })}</div>
                                      <div className="text-4xl font-bold text-gray-800 leading-none">{new Date(item.date).getDate()}</div>
                                      <div className="text-xs text-gray-400 font-medium">{new Date(item.date).toLocaleDateString(undefined, { weekday: 'long' })}</div>
                                 </div>
                            </div>
                        )}
                        <div className="p-5 flex-1 bg-white">
                            {!item.image && (
                                <h3 className="text-xl font-bold text-gray-800 mb-3 leading-tight border-l-4 border-primary pl-3 line-clamp-1">{item.title}</h3>
                            )}
                            <p className="text-gray-500 text-lg flex items-center gap-2 line-clamp-1">
                                <MapPin className="w-4 h-4" />
                                {item.venue || 'Main Auditorium'}
                            </p>
                        </div>
                    </div>

                    {/* Mobile View: Compact List Item (No big images) */}
                    <div className="md:hidden flex items-center gap-4 p-4">
                        <div className="bg-blue-50 text-blue-700 rounded-lg p-2.5 flex flex-col items-center justify-center min-w-[3.5rem] border border-blue-100 shadow-sm">
                            <span className="text-xs font-bold uppercase">{new Date(item.date).toLocaleDateString(undefined, { month: 'short' })}</span>
                            <span className="text-xl font-bold leading-none">{new Date(item.date).getDate()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold text-gray-900 leading-snug line-clamp-1 mb-0.5">{item.title}</h3>
                            <div className="flex items-center text-xs text-gray-500 gap-3">
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {new Date(item.date).toLocaleDateString(undefined, { weekday: 'short' })}</span>
                                <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3"/> {item.venue || 'TBA'}</span>
                            </div>
                        </div>
                        <div className="text-gray-300">
                            <ChevronRight className="w-5 h-5" />
                        </div>
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
        <div className="xl:col-span-1 space-y-6 md:space-y-8">
             
             {/* 1. Daily Verse Widget */}
             <div>
                <h2 className="text-xl md:text-3xl font-bold text-gray-800 mb-4 md:mb-6 px-1 md:px-2 flex items-center gap-2 md:gap-3">
                    <Heart className="w-6 h-6 md:w-8 md:h-8 text-red-500" /> Verse of the Day
                </h2>
                <div className="bg-white rounded-xl shadow-md border border-red-50 overflow-hidden relative group hover:shadow-lg transition-shadow">
                    {verseLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-red-400"/>
                        </div>
                    ) : todaysVerse ? (
                        <>
                            {/* Image Header */}
                            <div className="h-32 w-full relative overflow-hidden">
                                <img 
                                    src={getVerseImage(todaysVerse.keyword)} 
                                    alt="Verse Background" 
                                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/50 to-transparent"></div>
                                <div className="absolute bottom-2 left-4">
                                    <div className="bg-white/80 backdrop-blur-sm px-3 py-1 rounded-lg text-xs font-bold text-red-800 shadow-sm border border-red-100 flex items-center gap-2">
                                        <Quote className="w-3 h-3" /> Daily Word
                                    </div>
                                </div>
                            </div>

                            <div className="p-5 md:p-6 relative z-10 -mt-2">
                                <div className="mb-4">
                                    <h3 className="font-bold text-red-800 text-lg mb-1 flex items-center gap-2">
                                        {todaysVerse.reference}
                                    </h3>
                                    <p className="text-gray-700 italic font-serif text-sm leading-relaxed border-l-2 border-red-200 pl-3">
                                        "{todaysVerse.text}"
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Link to="/devotion" className="flex-1 text-center bg-red-50 text-red-700 font-bold py-2 rounded-lg text-xs uppercase tracking-wider hover:bg-red-100 transition-colors">
                                        Read Devotion
                                    </Link>
                                    <button 
                                        onClick={handleShareVerse}
                                        className="px-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center"
                                        title="Share Verse"
                                    >
                                        <Share2 className="w-4 h-4"/>
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-8 text-gray-400 text-sm">
                            Verse unavailable. Check settings.
                        </div>
                    )}
                </div>
             </div>

             {/* 2. Standing Order of the Day */}
             <div>
                <h2 className="text-xl md:text-3xl font-bold text-gray-800 mb-4 md:mb-6 px-1 md:px-2 flex items-center gap-2 md:gap-3">
                    <BookOpen className="w-6 h-6 md:w-8 md:h-8 text-purple-600" /> Daily Order
                </h2>
                {dailyOrder ? (
                    <div className="bg-white rounded-xl shadow-md border border-purple-100 p-5 md:p-6 relative overflow-hidden group hover:shadow-lg transition-shadow">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-bl-full -mr-4 -mt-4 z-0"></div>
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-3">
                                <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 text-xs md:text-sm font-bold rounded-lg">
                                    {dailyOrder.title}
                                </span>
                                {dailyOrder.isAiGenerated && (
                                    <span className="text-[10px] md:text-xs text-purple-400 font-medium flex items-center gap-1 bg-white/80 px-2 py-1 rounded-full border border-purple-50">
                                        <Lightbulb className="w-3 h-3" /> Explained
                                    </span>
                                )}
                            </div>
                            <p className="text-gray-700 text-sm md:text-lg leading-relaxed mb-4 line-clamp-5">
                                {dailyOrder.preview}
                            </p>
                            <Link 
                                to={`/standing-orders?q=${encodeURIComponent(dailyOrder.linkQuery)}`} 
                                className="inline-flex items-center text-purple-600 text-sm font-medium hover:text-purple-800 group-hover:translate-x-1 transition-transform"
                            >
                                Read Full Section <ArrowRight className="w-4 h-4 ml-1" />
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center text-gray-400">
                        <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No document loaded.</p>
                        <Link to="/standing-orders" className="text-xs text-primary hover:underline">Upload one here</Link>
                    </div>
                )}
             </div>

             {/* 3. Pending Tasks */}
             <div>
                 <h2 className="text-xl md:text-3xl font-bold text-gray-800 mb-4 md:mb-6 px-1 md:px-2 flex items-center gap-2 md:gap-3">
                   <AlertCircle className="w-6 h-6 md:w-8 md:h-8 text-orange-500" /> Pending Tasks
                 </h2>
                 <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 md:p-6">
                    {recentTasks.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <CheckCircle2 className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-3 opacity-20"/>
                            <p className="text-sm">No pending tasks found.</p>
                            <Link to="/tasks" className="text-primary mt-2 inline-block text-sm">Go to Tasks</Link>
                        </div>
                    ) : (
                        <div className="space-y-3 md:space-y-4">
                            {recentTasks.map(task => (
                                <div key={task.id} className="flex items-start gap-3 md:gap-4 p-3 md:p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                                    <div className="mt-1.5">
                                        <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-orange-500"></div>
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-800 text-sm md:text-lg line-clamp-1">{task.message}</p>
                                        <p className="text-xs md:text-sm text-gray-500 mt-0.5">Due: {new Date(task.task_date).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            ))}
                            <Link to="/tasks" className="block text-center mt-3 md:mt-4 pt-3 md:pt-4 border-t text-primary text-sm font-medium hover:text-blue-700">
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

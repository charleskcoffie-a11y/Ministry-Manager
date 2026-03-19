
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Calendar, CheckCircle2, BookOpen, Lightbulb, ArrowRight, Star, 
  CalendarDays, AlertCircle, Loader2, MapPin, ChevronRight,
  Crown, Scroll, Sparkles, ShieldCheck, Clock, Share2, Heart, Quote,
  Bell, BookHeart
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { Task, DiaryEntry } from '../types';
import { explainStandingOrder, getAiDailyVerse, getAiFeatureStatus } from '../services/geminiService';
import { getTodayVerse } from '../services/dailyVerseService';



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

// --- Image Mapping for Verses (Updated with reliable IDs) ---
const VERSE_IMAGES: Record<string, string> = {
    'light': 'https://images.unsplash.com/photo-1507692049790-de58293a469d?q=80&w=2670&auto=format&fit=crop', // Sunrise
    'mountain': 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2670&auto=format&fit=crop',
    'water': 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=2674&auto=format&fit=crop',
    'sheep': 'https://images.unsplash.com/photo-1484557985045-edf25e08da73?q=80&w=2673&auto=format&fit=crop',
    'shepherd': 'https://images.unsplash.com/photo-1484557985045-edf25e08da73?q=80&w=2673&auto=format&fit=crop',
    'cross': 'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?q=80&w=2670&auto=format&fit=crop',
    'sky': 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=2670&auto=format&fit=crop',
    'peace': 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=2670&auto=format&fit=crop', // Calm lake
    'bread': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=2672&auto=format&fit=crop',
    'vine': 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?q=80&w=2670&auto=format&fit=crop',
    'love': 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=2670&auto=format&fit=crop',
    'strength': 'https://images.unsplash.com/photo-1524234599372-a5bd0194758d?q=80&w=2670&auto=format&fit=crop',
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
  const [upcomingDiary, setUpcomingDiary] = useState<DiaryEntry[]>([]);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const [dailyOrder, setDailyOrder] = useState<DailyOrder | null>(null);
  const [currentSeason, setCurrentSeason] = useState<LiturgicalSeason | null>(null);
  const [todaysVerse, setTodaysVerse] = useState<{reference: string, text: string, keyword?: string} | null>(null);
  const [verseLoading, setVerseLoading] = useState(false);
    const [verseNotice, setVerseNotice] = useState('');
  const [sharing, setSharing] = useState(false);
  
  // State to track if the images failed to load
  const [verseImageError, setVerseImageError] = useState(false);


  useEffect(() => {
    fetchRecentTasks();
    fetchDailyStandingOrder();
    fetchUpcomingDiary();
    setCurrentSeason(getSeasonForDate(new Date()));
    loadVerse();
  }, []);

  const loadVerse = async () => {
    setVerseLoading(true);
    setVerseImageError(false); // Reset error state on new load
    setVerseNotice('');
    const source = localStorage.getItem('dailyVerseSource') || (getAiFeatureStatus().available ? 'ai' : 'plan');
    
    if (source === 'ai') {
        const v = await getAiDailyVerse();
        if (v) {
            setTodaysVerse(v);
        } else {
            const plannedVerse = await getTodayVerse();
            setTodaysVerse({ 
                reference: plannedVerse.reference, 
                text: plannedVerse.text || "Tap to read full devotion text online or generate content.",
                keyword: 'light'
            });
            const aiStatus = getAiFeatureStatus();
            setVerseNotice(
                aiStatus.available
                    ? 'AI daily verse is temporarily unavailable. Showing the planned verse instead.'
                    : aiStatus.message
            );
        }
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

  const handleShareVerse = async () => {
    if (!todaysVerse) return;
    setSharing(true);
    
    const shareText = `"${todaysVerse.text}"\n\n${todaysVerse.reference}\n\nRev C. K. Coffie`;
    
    if (navigator.share) {
        try {
            // Attempt to fetch the image to share it as a file
            const imageUrl = getVerseImage(todaysVerse.keyword);
            let filesArray: File[] = [];

            try {
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                const file = new File([blob], 'verse-of-the-day.jpg', { type: blob.type });
                filesArray = [file];
            } catch (err) {
                console.warn("Could not fetch image for sharing, falling back to text only.", err);
            }

            if (filesArray.length > 0 && navigator.canShare && navigator.canShare({ files: filesArray })) {
                await navigator.share({
                    files: filesArray,
                    text: shareText
                });
            } else {
                // Fallback to text share if image sharing not supported or failed
                await navigator.share({
                    text: shareText
                });
            }
        } catch (err) {
            console.log('Share canceled or failed', err);
        }
    } else {
        navigator.clipboard.writeText(shareText);
        alert("Verse copied to clipboard!");
    }
    setSharing(false);
  };



  const fetchUpcomingDiary = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    const in14 = new Date(today);
    in14.setDate(today.getDate() + 14);
    const in14Str = in14.toISOString().split('T')[0];

    const { data } = await supabase
      .from('diary_entries')
      .select('*')
      .not('remind_on', 'is', null)
      .gte('remind_on', todayStr)
      .lte('remind_on', in14Str)
      .order('remind_on', { ascending: true })
      .limit(5);

    if (data) {
      setUpcomingDiary(data as DiaryEntry[]);
      fireNotifications(data as DiaryEntry[], todayStr);
    }
  };

  const fireNotifications = (items: DiaryEntry[], todayStr: string) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const sessionKey = 'diary-notified-' + todayStr;
    const alreadyNotified = new Set<string>(JSON.parse(sessionStorage.getItem(sessionKey) || '[]'));
    const today = new Date(); today.setHours(0,0,0,0);

    for (const entry of items) {
      if (!entry.remind_on || alreadyNotified.has(entry.id)) continue;
      const d = new Date(entry.remind_on + 'T00:00:00');
      const days = Math.round((d.getTime() - today.getTime()) / 86400000);
      const when = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
      new Notification(`📅 ${entry.category}: ${entry.title}`, {
        body: when + (entry.remind_on !== todayStr ? ` – ${entry.remind_on}` : ''),
        icon: '/Ministry-Manager/apple-touch-icon.png',
      });
      alreadyNotified.add(entry.id);
    }
    sessionStorage.setItem(sessionKey, JSON.stringify([...alreadyNotified]));
  };

  const requestNotifPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      const todayStr = new Date().toISOString().split('T')[0];
      fireNotifications(upcomingDiary, todayStr);
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
                     if (getAiFeatureStatus().available) {
                         explainStandingOrder(title, item.text).then(explanation => {
                             if (
                                 getAiFeatureStatus().available &&
                                 explanation &&
                                 !explanation.toLowerCase().startsWith('could not')
                             ) {
                                setDailyOrder(prev => prev ? { 
                                    ...prev, 
                                    preview: explanation,
                                    isAiGenerated: true
                                } : null);
                             }
                         });
                     }
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
    
    // Special Priority: Eucharist / Communion (Corrected to proper wine/bread image)
    // Using a clear chalice and bread image instead of the previous "beer-like" one
    if (lower.match(/eucharist|communion|lords supper|lord's supper/)) {
        return 'https://images.unsplash.com/photo-1545989253-02cc26577f8d?q=80&w=2670&auto=format&fit=crop';
    }

    // Special Priority: Sunday Service / Chapel (High Quality Church Interior)
    if (lower.match(/sunday service|chapel|church service|divine service/)) {
        return 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?q=80&w=2673&auto=format&fit=crop';
    }

    // Meeting / Committee (Professional Meeting)
    if (lower.match(/meeting|committee|council|board|planning|leadership/)) {
        return 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=2670&auto=format&fit=crop';
    }

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
    
    // Celebrations & Sacraments (Generic fallbacks if special priority didn't match)
    if (lower.match(/wedding|marriage|couple|matrimony/)) 
      return 'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?q=80&w=2670&auto=format&fit=crop';
    if (lower.match(/baptism|naming|dedication/)) 
      return 'https://images.unsplash.com/photo-1518176258769-f227c798150e?q=80&w=2670&auto=format&fit=crop';
    
    // Social & Fellowship
    if (lower.match(/picnic|fellowship|lunch|dinner|breakfast|party|social/)) 
      return 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=2669&auto=format&fit=crop';

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 pb-10">
      {/* Animated Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 space-y-6 md:space-y-8 animate-fade-in">
      
      {/* 1. Hero Banner */}
    <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white shadow-2xl border border-white/20">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 via-purple-500/20 to-pink-500/20 animate-pulse"></div>
        <div className="absolute top-0 left-0 w-40 h-40 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-40 h-40 bg-white/10 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl"></div>

        <div className="relative z-10 px-4 py-8 md:px-10 md:py-12 flex flex-col items-center text-center md:items-start md:text-left">
           {/* Badge */}
           <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-white/20 border border-white/30 text-white text-[10px] md:text-xs font-bold uppercase tracking-widest shadow-lg mb-4 md:mb-6 backdrop-blur-md">
              <Crown className="w-3 h-3 md:w-4 md:h-4" /> 
              Pastoral Workspace
           </div>

           {/* Title */}
           <h1 className="text-3xl md:text-7xl font-serif font-black leading-tight mb-3 md:mb-4 tracking-tight text-white drop-shadow-2xl">
              Ministry <br className="md:hidden" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-200 to-amber-200 animate-pulse">
                 Suite
              </span>
           </h1>

           {/* Subtitle */}
           <p className="text-sm md:text-2xl text-white/90 font-light max-w-2xl leading-relaxed md:leading-relaxed mb-6 md:mb-8 drop-shadow-lg">
              Empowering Kingdom growth through vision, purpose, and organized leadership.
           </p>

           {/* Buttons */}
           <div className="flex flex-wrap gap-3 md:gap-4 justify-center md:justify-start w-full md:w-auto">
              <Link to="/reminders" className="group flex-1 md:flex-none relative px-6 py-3 md:px-10 md:py-5 bg-white text-indigo-950 rounded-full font-bold text-sm md:text-lg shadow-2xl hover:shadow-[0_0_40px_rgba(255,255,255,0.5)] transition-all duration-300 hover:-translate-y-1 hover:scale-105 flex items-center justify-center gap-2 md:gap-3 overflow-hidden">
                  <span className="relative z-10">Reminders</span>
                  <ArrowRight className="w-4 h-4 md:w-5 md:h-5 relative z-10 group-hover:translate-x-2 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 to-purple-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </Link>
              <Link to="/sermons" className="flex-1 md:flex-none px-6 py-3 md:px-10 md:py-5 bg-white/20 border-2 border-white/40 text-white rounded-full font-bold text-sm md:text-lg hover:bg-white/30 transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2 md:gap-3 backdrop-blur-md hover:border-white/60 shadow-lg">
                  <Scroll className="w-4 h-4 md:w-5 md:h-5" />
                  Sermons
              </Link>
           </div>

           {/* Verse */}
           <div className="mt-8 pt-6 border-t border-white/20 w-full md:w-auto hidden md:block">
              <p className="text-sm md:text-base font-serif italic text-white/80 flex items-center justify-center md:justify-start gap-2">
                 <Sparkles className="w-4 h-4 text-amber-300" />
                 "Therefore encourage one another and build each other up." — 1 Thessalonians 5:11
              </p>
           </div>
        </div>
      </div>

      {/* Christian Season Banner */}
      {currentSeason && (
        <Link to="/christian-calendar" className="block transform hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300">
            <div className={`relative overflow-hidden rounded-2xl md:rounded-3xl shadow-xl hover:shadow-2xl ${currentSeason.bg} text-white border border-white/20`}>
                <div className={`absolute top-0 right-0 w-32 md:w-40 h-full ${currentSeason.accent} transform skew-x-12 translate-x-10 md:translate-x-12 opacity-40 blur-sm`}></div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/10"></div>
                <div className="relative p-5 md:p-8 flex flex-row items-center justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 md:gap-3 mb-2">
                            <span className="text-xs md:text-sm font-bold opacity-90 uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">Today</span>
                        </div>
                        <h2 className="text-2xl md:text-4xl font-black mb-2 md:mb-3 flex items-center gap-2 drop-shadow-lg">
                            {currentSeason.name}
                        </h2>
                        <p className="text-white/95 text-sm md:text-xl max-w-2xl line-clamp-2 md:line-clamp-none font-medium">
                           {currentSeason.definition}
                        </p>
                    </div>
                    <div className="bg-white/30 p-2 md:p-3 rounded-full backdrop-blur-sm border border-white/40 shadow-lg hover:bg-white/40 transition-colors">
                        <ChevronRight className="w-6 h-6 md:w-7 md:h-7 text-white" />
                    </div>
                </div>
            </div>
        </Link>
      )}

            {/* Quick Links Grid - Modern & Interactive */}
            <div>
                <h2 className="text-xl md:text-3xl font-bold text-gray-800 mb-4 md:mb-6 px-1 md:px-2 flex items-center gap-2">
                    Quick Access
                    <span className="ml-2 text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-full animate-pulse">New Look!</span>
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                    {[
                        {
                            to: "/tasks",
                            icon: CheckCircle2,
                            color: "green",
                            title: "Tasks",
                            desc: "Track to-do list & ministry duties.",
                            tooltip: "Your ministry to-dos and duties."
                        },
                        {
                            to: "/standing-orders",
                            icon: BookOpen,
                            color: "purple",
                            title: "Constitution",
                            desc: "Standing orders & policies.",
                            tooltip: "Church constitution and policies."
                        },
                        {
                            to: "/ideas",
                            icon: Lightbulb,
                            color: "yellow",
                            title: "Ideas",
                            desc: "Journal thoughts & sermons.",
                            tooltip: "Sermon and idea journal."
                        }
                    ].map((item, idx) => {
                        const [favorites, setFavorites] = React.useState(() => {
                            const saved = localStorage.getItem('quick-favorites');
                            return saved ? JSON.parse(saved) : [];
                        });
                        const isFav = favorites.includes(item.to);
                        const Icon = item.icon;
                        const handleFav = (e: React.MouseEvent) => {
                            e.preventDefault();
                            let next;
                            if (isFav) next = favorites.filter((f: string) => f !== item.to);
                            else next = [...favorites, item.to];
                            setFavorites(next);
                            localStorage.setItem('quick-favorites', JSON.stringify(next));
                        };
                        return (
                            <Link
                                key={item.to}
                                to={item.to}
                                className={`group relative bg-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-${item.color}-400/40 transition-all duration-300 overflow-visible focus:outline-none focus:ring-2 focus:ring-${item.color}-400`}
                                tabIndex={0}
                                aria-label={item.title}
                                title={item.tooltip}
                            >
                                {/* Favorite Star */}
                                <button
                                    className={`absolute top-2 right-2 z-10 p-1 rounded-full bg-white/80 hover:bg-${item.color}-100 border border-${item.color}-200 shadow transition-colors`}
                                    onClick={handleFav}
                                    aria-label={isFav ? `Unpin ${item.title}` : `Pin ${item.title}`}
                                    tabIndex={0}
                                    type="button"
                                >
                                    <Star className={`w-5 h-5 ${isFav ? `text-${item.color}-500 fill-${item.color}-400` : 'text-gray-300'} transition-all`} />
                                </button>
                                {/* Icon with animation */}
                                <div className={`w-10 h-10 md:w-14 md:h-14 bg-${item.color}-50 rounded-lg flex items-center justify-center mb-3 md:mb-6 group-hover:bg-${item.color}-600 transition-colors group-hover:scale-110 group-hover:rotate-3 duration-300`}
                                    style={{ transition: 'transform 0.3s' }}
                                >
                                    <Icon className={`w-5 h-5 md:w-8 md:h-8 text-${item.color}-600 group-hover:text-white transition-colors group-hover:animate-bounce`} />
                                </div>
                                <h3 className={`text-base md:text-2xl font-bold text-gray-800 mb-1 md:mb-2 group-hover:text-${item.color}-600 transition-colors`}>{item.title}</h3>
                                <p className="text-gray-500 text-xs md:text-lg line-clamp-2">{item.desc}</p>
                                {/* Tooltip */}
                                <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover:opacity-100 bg-gray-900 text-white text-xs rounded px-2 py-1 transition-opacity z-20 whitespace-nowrap shadow-lg">{item.tooltip}</span>
                            </Link>
                        );
                    })}
                </div>
            </div>

      <div className="grid grid-cols-1 gap-6 md:gap-8">
        {/* Right Sidebar */}
        <div className="space-y-6 md:space-y-8">
             
             {/* 0. Notification permission banner */}
             {notifPermission === 'default' && upcomingDiary.length > 0 && (
               <div className="flex items-center justify-between gap-3 bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-3">
                 <div className="flex items-center gap-2 text-sm text-indigo-700">
                   <Bell className="w-4 h-4 shrink-0" />
                   <span>Enable notifications to get reminders for upcoming diary events.</span>
                 </div>
                 <button
                   onClick={requestNotifPermission}
                   className="shrink-0 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                 >
                   Enable
                 </button>
               </div>
             )}

             {/* 1. Upcoming Diary Events */}
             {upcomingDiary.length > 0 && (
               <div>
                 <h2 className="text-2xl md:text-4xl font-black text-gray-900 mb-4 md:mb-6 px-1 md:px-2 flex items-center gap-3 md:gap-4">
                   <div className="p-2 bg-gradient-to-br from-rose-500 to-pink-500 rounded-xl shadow-lg">
                     <BookHeart className="w-6 h-6 md:w-8 md:h-8 text-white" />
                   </div>
                   Upcoming Diary
                 </h2>
                 <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/40 p-5 md:p-6 space-y-3">
                   {upcomingDiary.map(entry => {
                     const today = new Date(); today.setHours(0,0,0,0);
                     const d = new Date(entry.remind_on! + 'T00:00:00');
                     const days = Math.round((d.getTime() - today.getTime()) / 86400000);
                     const whenLabel = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
                     const urgentCls = days === 0 ? 'text-red-600 bg-red-50 border-red-200' :
                       days === 1 ? 'text-orange-600 bg-orange-50 border-orange-200' :
                       'text-yellow-700 bg-yellow-50 border-yellow-200';
                     return (
                       <Link key={entry.id} to="/diary"
                         className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 hover:bg-indigo-50 hover:border-indigo-100 border border-transparent transition-all group">
                         <div className={`shrink-0 mt-0.5 px-2 py-0.5 rounded-lg border text-xs font-bold ${urgentCls}`}>
                           {whenLabel}
                         </div>
                         <div className="flex-1 min-w-0">
                           <p className="font-semibold text-gray-800 text-sm line-clamp-1 group-hover:text-indigo-700 transition-colors">{entry.title}</p>
                           <p className="text-xs text-gray-400 mt-0.5">{entry.category} · {entry.remind_on}</p>
                         </div>
                         <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 shrink-0 mt-1 transition-colors" />
                       </Link>
                     );
                   })}
                   <Link to="/diary" className="block text-center pt-2 text-indigo-600 text-sm font-medium hover:text-indigo-800">
                     Open Diary →
                   </Link>
                 </div>
               </div>
             )}

             {/* 2. Daily Verse Widget */}
             <div>
                <h2 className="text-2xl md:text-4xl font-black text-gray-900 mb-4 md:mb-6 px-1 md:px-2 flex items-center gap-3 md:gap-4">
                    <div className="p-2 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl shadow-lg">
                        <Heart className="w-6 h-6 md:w-8 md:h-8 text-white" />
                    </div>
                    Verse of the Day
                </h2>
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/40 overflow-hidden relative group hover:shadow-2xl hover:scale-[1.01] transition-all duration-300">
                    {verseLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-red-400"/>
                        </div>
                    ) : todaysVerse ? (
                        <>
                            {/* Image Header with Robust Error Handling */}
                            {!verseImageError && (
                                <div className="h-32 w-full relative overflow-hidden transition-all duration-300">
                                    <img 
                                        src={getVerseImage(todaysVerse.keyword)} 
                                        alt="Verse Background" 
                                        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                                        onError={(e) => {
                                            // Collapse the image area immediately on error
                                            e.currentTarget.style.display = 'none';
                                            setVerseImageError(true);
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-white via-white/50 to-transparent"></div>
                                    <div className="absolute bottom-2 left-4">
                                        <div className="bg-white/80 backdrop-blur-sm px-3 py-1 rounded-lg text-xs font-bold text-red-800 shadow-sm border border-red-100 flex items-center gap-2">
                                            <Quote className="w-3 h-3" /> Daily Word
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className={`p-5 md:p-6 relative z-10 ${!verseImageError ? '-mt-2' : ''}`}>
                                <div className="mb-4">
                                    <h3 className="font-bold text-red-800 text-lg mb-1 flex items-center gap-2">
                                        {todaysVerse.reference}
                                    </h3>
                                    {verseNotice && (
                                        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                            <span>{verseNotice}</span>
                                        </div>
                                    )}
                                    <p className="text-gray-700 italic font-serif text-sm leading-relaxed border-l-2 border-red-200 pl-3">
                                        "{todaysVerse.text}"
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Link 
                                        to="/devotion" 
                                        state={{ 
                                            autoGenerate: true, 
                                            scripture: todaysVerse.reference, 
                                            theme: "Verse of the Day"
                                        }}
                                        className="flex-1 text-center bg-red-50 text-red-700 font-bold py-2 rounded-lg text-xs uppercase tracking-wider hover:bg-red-100 transition-colors"
                                    >
                                        Read Devotion
                                    </Link>
                                    <button 
                                        onClick={handleShareVerse}
                                        disabled={sharing}
                                        className="px-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center"
                                        title="Share Verse"
                                    >
                                        {sharing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Share2 className="w-4 h-4"/>}
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

             {/* 3. Standing Order of the Day */}
             <div>
                <h2 className="text-2xl md:text-4xl font-black text-gray-900 mb-4 md:mb-6 px-1 md:px-2 flex items-center gap-3 md:gap-4">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl shadow-lg">
                        <BookOpen className="w-6 h-6 md:w-8 md:h-8 text-white" />
                    </div>
                    Daily Order
                </h2>
                {dailyOrder ? (
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/40 p-6 md:p-8 relative overflow-hidden group hover:shadow-2xl hover:scale-[1.01] transition-all duration-300">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-bl-full -mr-6 -mt-6 z-0 opacity-50"></div>
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

             {/* 4. Pending Tasks */}
             <div>
                 <h2 className="text-2xl md:text-4xl font-black text-gray-900 mb-4 md:mb-6 px-1 md:px-2 flex items-center gap-3 md:gap-4">
                   <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl shadow-lg">
                       <AlertCircle className="w-6 h-6 md:w-8 md:h-8 text-white" />
                   </div>
                   Pending Tasks
                 </h2>
                 <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/40 p-5 md:p-8">
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
    </div>
  );
};

export default Home;

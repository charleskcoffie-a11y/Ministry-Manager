
import React, { useState } from 'react';
import { Calendar, Info, ChevronDown, ChevronUp, Circle, Clock, Flame, Sun, Moon, Leaf, BookOpen, Star, CalendarDays } from 'lucide-react';

const CALENDAR_DATA = {
  title: "Christian Calendar (Methodist – Ghana)",
  description: "Overview of the Christian year with liturgical colours used in worship.",
  seasons: [
    {
      id: "ADVENT",
      name: "Advent",
      order: 1,
      cycle: "Christmas Cycle",
      liturgicalColourPrimary: "Violet",
      liturgicalColourAlternate: "Blue",
      summary: "Four Sundays before Christmas; a season of preparation and expectation for the coming of Christ.",
      typicalStartHint: "Fourth Sunday before 25th December"
    },
    {
      id: "CHRISTMAS",
      name: "Christmas Season",
      order: 2,
      cycle: "Christmas Cycle",
      liturgicalColourPrimary: "White",
      liturgicalColourAlternate: "Gold",
      summary: "Celebration of the birth of Christ, beginning on Christmas Eve and continuing for twelve days.",
      typicalStartHint: "24/25th December"
    },
    {
      id: "EPIPHANY_SEASON",
      name: "Season after Epiphany",
      order: 3,
      cycle: "Christmas Cycle",
      liturgicalColourPrimary: "Green",
      liturgicalColourAlternate: null,
      summary: "Focuses on the revealing of Christ to the nations and His early ministry.",
      typicalStartHint: "From 6th January until the Sunday before Lent"
    },
    {
      id: "LENT",
      name: "Lent",
      order: 4,
      cycle: "Easter Cycle",
      liturgicalColourPrimary: "Violet",
      liturgicalColourAlternate: null,
      summary: "Forty days of penitence, self-examination, and preparation for Easter (excluding Sundays).",
      typicalStartHint: "Begins on Ash Wednesday"
    },
    {
      id: "HOLY_WEEK",
      name: "Holy Week",
      order: 5,
      cycle: "Easter Cycle",
      liturgicalColourPrimary: "Violet",
      liturgicalColourAlternate: "Red on some days",
      summary: "The week from Palm Sunday to Holy Saturday, recalling Christ’s passion and death.",
      typicalStartHint: "Sunday before Easter (Palm Sunday)"
    },
    {
      id: "EASTER_SEASON",
      name: "Easter Season",
      order: 6,
      cycle: "Easter Cycle",
      liturgicalColourPrimary: "White",
      liturgicalColourAlternate: "Gold",
      summary: "Fifty days celebrating the resurrection of Jesus, from Easter Day to Pentecost.",
      typicalStartHint: "Easter Sunday"
    },
    {
      id: "PENTECOST_DAY",
      name: "Day of Pentecost",
      order: 7,
      cycle: "Easter Cycle",
      liturgicalColourPrimary: "Red",
      liturgicalColourAlternate: null,
      summary: "Celebrates the outpouring of the Holy Spirit and the birth of the Church.",
      typicalStartHint: "Fiftieth day after Easter"
    },
    {
      id: "ORDINARY_TIME",
      name: "Time after Pentecost / Ordinary Time",
      order: 8,
      cycle: "Ordinary",
      liturgicalColourPrimary: "Green",
      liturgicalColourAlternate: null,
      summary: "The long teaching and growth season after Pentecost, sometimes called Kingdomtide in Methodist tradition.",
      typicalStartHint: "From the week after Pentecost until the eve of Advent"
    }
  ],
  keyDaysAndFeasts: [
    {
      id: "EPIPHANY",
      name: "Epiphany of the Lord",
      liturgicalColourPrimary: "White",
      seasonId: "EPIPHANY_SEASON",
      notes: "Celebrates Christ revealed to the Gentiles; commemorated on or around 6th January."
    },
    {
      id: "BAPTISM_OF_THE_LORD",
      name: "Baptism of the Lord",
      liturgicalColourPrimary: "White",
      seasonId: "EPIPHANY_SEASON",
      notes: "Marks the baptism of Jesus in the Jordan; early Sundays in the year."
    },
    {
      id: "TRANSFIGURATION",
      name: "Transfiguration Sunday",
      liturgicalColourPrimary: "White",
      seasonId: "EPIPHANY_SEASON",
      notes: "Sunday before Lent; recalls Christ’s glory on the mountain."
    },
    {
      id: "ASH_WEDNESDAY",
      name: "Ash Wednesday",
      liturgicalColourPrimary: "Violet",
      seasonId: "LENT",
      notes: "Beginning of Lent; emphasis on repentance and mortality."
    },
    {
      id: "PALM_SUNDAY",
      name: "Palm/Passion Sunday",
      liturgicalColourPrimary: "Violet",
      liturgicalColourAlternate: "Red (optional)",
      seasonId: "HOLY_WEEK",
      notes: "Entry of Jesus into Jerusalem and beginning of Holy Week."
    },
    {
      id: "MAUNDY_THURSDAY",
      name: "Maundy Thursday",
      liturgicalColourPrimary: "Violet",
      seasonId: "HOLY_WEEK",
      notes: "Commemorates the Last Supper and the new commandment of love."
    },
    {
      id: "GOOD_FRIDAY",
      name: "Good Friday",
      liturgicalColourPrimary: "Red",
      liturgicalColourAlternate: "Black",
      seasonId: "HOLY_WEEK",
      notes: "Remembers the crucifixion and death of Christ."
    },
    {
      id: "HOLY_SATURDAY",
      name: "Holy Saturday",
      liturgicalColourPrimary: "Violet",
      seasonId: "HOLY_WEEK",
      notes: "A day of waiting at the tomb, in silence and hope."
    },
    {
      id: "EASTER_DAY",
      name: "Easter Day (Resurrection of the Lord)",
      liturgicalColourPrimary: "White",
      liturgicalColourAlternate: "Gold",
      seasonId: "EASTER_SEASON",
      notes: "Central feast of the Christian year; celebration of the resurrection."
    },
    {
      id: "ASCENSION",
      name: "Ascension of the Lord",
      liturgicalColourPrimary: "White",
      seasonId: "EASTER_SEASON",
      notes: "Fortieth day after Easter; Christ’s ascension into heaven."
    },
    {
      id: "PENTECOST",
      name: "Pentecost Sunday",
      liturgicalColourPrimary: "Red",
      seasonId: "PENTECOST_DAY",
      notes: "Outpouring of the Holy Spirit; birth of the Church."
    },
    {
      id: "TRINITY_SUNDAY",
      name: "Trinity Sunday",
      liturgicalColourPrimary: "White",
      seasonId: "ORDINARY_TIME",
      notes: "First Sunday after Pentecost; celebration of the Holy Trinity."
    },
    {
      id: "ALL_SAINTS",
      name: "All Saints’ Day / Sunday",
      liturgicalColourPrimary: "White",
      liturgicalColourAlternate: "Red (local usage)",
      seasonId: "ORDINARY_TIME",
      notes: "Remembers the saints in glory and the communion of saints."
    },
    {
      id: "CHRIST_THE_KING",
      name: "Christ the King / Reign of Christ",
      liturgicalColourPrimary: "White",
      seasonId: "ORDINARY_TIME",
      notes: "Final Sunday of the Christian year, affirming Christ’s lordship."
    },
    {
      id: "COVENANT_SUNDAY",
      name: "Covenant Sunday (Methodist)",
      liturgicalColourPrimary: "White",
      seasonId: "ORDINARY_TIME",
      notes: "Methodist tradition of renewing the Covenant, often early in the year."
    },
    {
      id: "WATCHNIGHT",
      name: "Watchnight / New Year’s Eve Service",
      liturgicalColourPrimary: "White",
      seasonId: "ORDINARY_TIME",
      notes: "Methodist tradition of prayer and thanksgiving at the turn of the year."
    }
  ]
};

// --- Themes & Visual Logic ---

const getLiturgicalTheme = (colour: string | null) => {
  if (!colour) return {
    bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-800', accent: 'bg-slate-500', icon: 'text-slate-400', pill: 'bg-slate-100 text-slate-600'
  };

  const c = colour.toLowerCase();
  
  // Violet / Purple (Advent, Lent)
  if (c.includes('violet') || c.includes('purple')) return {
    bg: 'bg-fuchsia-50/70', 
    border: 'border-fuchsia-100', 
    text: 'text-fuchsia-950', 
    accent: 'bg-fuchsia-700', 
    icon: 'text-fuchsia-400',
    pill: 'bg-fuchsia-100 text-fuchsia-800'
  };

  // Blue (Advent Alternate)
  if (c.includes('blue')) return {
    bg: 'bg-indigo-50/70', 
    border: 'border-indigo-100', 
    text: 'text-indigo-950', 
    accent: 'bg-indigo-600', 
    icon: 'text-indigo-400',
    pill: 'bg-indigo-100 text-indigo-800'
  };

  // Green (Ordinary Time)
  if (c.includes('green')) return {
    bg: 'bg-emerald-50/70', 
    border: 'border-emerald-100', 
    text: 'text-emerald-950', 
    accent: 'bg-emerald-600', 
    icon: 'text-emerald-500',
    pill: 'bg-emerald-100 text-emerald-800'
  };

  // Red (Pentecost, Passion)
  if (c.includes('red')) return {
    bg: 'bg-rose-50/70', 
    border: 'border-rose-100', 
    text: 'text-rose-950', 
    accent: 'bg-rose-600', 
    icon: 'text-rose-400',
    pill: 'bg-rose-100 text-rose-800'
  };

  // White / Gold (Christmas, Easter)
  if (c.includes('white') || c.includes('gold')) return {
    bg: 'bg-amber-50/60', 
    border: 'border-amber-100', 
    text: 'text-amber-950', 
    accent: 'bg-amber-400', 
    icon: 'text-amber-400',
    pill: 'bg-amber-100 text-amber-800'
  };

  // Black (Good Friday Alt)
  if (c.includes('black')) return {
    bg: 'bg-gray-100', 
    border: 'border-gray-200', 
    text: 'text-gray-900', 
    accent: 'bg-gray-800', 
    icon: 'text-gray-600',
    pill: 'bg-gray-200 text-gray-800'
  };
  
  return {
    bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-800', accent: 'bg-slate-500', icon: 'text-slate-400', pill: 'bg-slate-100 text-slate-600'
  };
};

const getSeasonIcon = (colour: string | null) => {
    if (!colour) return Circle;
    const c = colour.toLowerCase();
    if (c.includes('violet')) return Moon; // Night/Waiting
    if (c.includes('blue')) return Star; // Advent
    if (c.includes('green')) return Leaf; // Growth
    if (c.includes('red')) return Flame; // Spirit
    if (c.includes('white') || c.includes('gold')) return Sun; // Glory
    return Circle;
};

const ChristianCalendar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'seasons' | 'feasts'>('seasons');

  return (
    <div className="max-w-6xl mx-auto pb-16 animate-fade-in space-y-10">
      
      {/* 1. Liturgical Header */}
      <div className="relative rounded-3xl overflow-hidden shadow-xl bg-slate-900 text-white min-h-[160px] md:min-h-[200px] flex items-center">
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900"></div>
          
          {/* Decorative Pattern Overlay */}
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
          
          <div className="relative z-10 p-6 md:p-12 w-full flex flex-col md:flex-row items-center md:items-end justify-between gap-4">
              <div>
                  <div className="flex items-center gap-2 mb-2 opacity-80 justify-center md:justify-start">
                      <BookOpen className="w-5 h-5 text-yellow-400" />
                      <span className="text-sm font-bold tracking-widest uppercase text-yellow-100">Methodist Church Ghana</span>
                  </div>
                  <h1 className="text-3xl md:text-5xl font-serif font-bold text-white mb-2 tracking-tight text-center md:text-left">
                      Christian Calendar
                  </h1>
                  <p className="text-indigo-200 text-base md:text-xl font-light text-center md:text-left">
                      Walking through the liturgical year in worship & prayer.
                  </p>
              </div>
              
              <div className="hidden md:block">
                  <CalendarDays className="w-24 h-24 text-white opacity-10" />
              </div>
          </div>
      </div>
      
      {/* 2. Info Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 md:p-6 rounded-2xl border border-blue-100 shadow-sm flex items-start gap-4">
         <div className="p-2 md:p-3 bg-white rounded-full shadow-sm text-blue-600 flex-shrink-0">
            <Info className="w-5 h-5 md:w-6 md:h-6" />
         </div>
         <div>
             <h3 className="text-blue-900 font-bold text-base md:text-lg mb-1">About the Liturgical Colours</h3>
             <p className="text-blue-800/80 leading-relaxed text-sm md:text-base">
                 {CALENDAR_DATA.description}
             </p>
         </div>
      </div>

      {/* 3. Tabs */}
      <div className="flex justify-center">
          <div className="bg-gray-100 p-1.5 rounded-full inline-flex shadow-inner">
              <button 
                onClick={() => setActiveTab('seasons')}
                className={`px-6 md:px-8 py-2 md:py-3 rounded-full text-xs md:text-sm font-bold transition-all duration-300 ${
                    activeTab === 'seasons' 
                    ? 'bg-white text-indigo-900 shadow-md transform scale-105' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                }`}
              >
                Seasons
              </button>
              <button 
                onClick={() => setActiveTab('feasts')}
                className={`px-6 md:px-8 py-2 md:py-3 rounded-full text-xs md:text-sm font-bold transition-all duration-300 ${
                    activeTab === 'feasts' 
                    ? 'bg-white text-indigo-900 shadow-md transform scale-105' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                }`}
              >
                Key Feasts
              </button>
          </div>
      </div>

      {/* 4. Content: Seasons */}
      {activeTab === 'seasons' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 animate-fade-in">
          {CALENDAR_DATA.seasons.map((season) => {
            const theme = getLiturgicalTheme(season.liturgicalColourPrimary);
            
            return (
                <div key={season.id} className={`group relative rounded-2xl border ${theme.border} ${theme.bg} overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col`}>
                    
                    {/* Card Header */}
                    <div className="px-4 py-3 md:px-6 md:py-5 border-b border-black/5 bg-white/40 flex justify-between items-center">
                        <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest opacity-60 flex items-center gap-2">
                             {season.cycle}
                        </span>
                        <div className="flex gap-1.5">
                             <div className={`w-3 h-3 rounded-full ${theme.accent} shadow-sm ring-2 ring-white`}></div>
                             {season.liturgicalColourAlternate && (
                                 <div className={`w-3 h-3 rounded-full bg-slate-300 shadow-sm ring-2 ring-white opacity-50`}></div>
                             )}
                        </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-4 md:p-6 flex-1 flex flex-col">
                        <div className="mb-2 md:mb-4">
                            <h3 className={`text-xl md:text-2xl font-serif font-bold ${theme.text} mb-1 md:mb-2 group-hover:opacity-90 transition-opacity`}>
                                {season.name}
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                <span className={`px-2 py-0.5 md:px-2.5 md:py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border border-black/5 ${theme.pill}`}>
                                    {season.liturgicalColourPrimary}
                                </span>
                                {season.liturgicalColourAlternate && (
                                    <span className={`px-2 py-0.5 md:px-2.5 md:py-1 rounded-md text-[10px] font-bold uppercase tracking-wide bg-white/50 text-slate-500 border border-slate-100`}>
                                        or {season.liturgicalColourAlternate}
                                    </span>
                                )}
                            </div>
                        </div>
                        
                        <p className={`${theme.text} opacity-80 leading-relaxed mb-4 md:mb-6 font-medium text-sm md:text-base`}>
                            {season.summary}
                        </p>

                        {/* Footer Note */}
                        <div className="mt-auto bg-white/60 rounded-xl p-2 md:p-3 flex items-start gap-3 backdrop-blur-sm border border-white/50">
                            <Clock className={`w-4 h-4 mt-0.5 flex-shrink-0 ${theme.icon}`} />
                            <span className={`text-xs md:text-sm font-medium ${theme.text} opacity-75`}>
                                {season.typicalStartHint}
                            </span>
                        </div>
                    </div>
                </div>
            );
          })}
        </div>
      )}

      {/* 5. Content: Feasts */}
      {activeTab === 'feasts' && (
        <div className="animate-fade-in bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50/50">
                        <tr>
                            <th className="px-8 py-5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Feast Day</th>
                            <th className="px-8 py-5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Liturgical Colour</th>
                            <th className="px-8 py-5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Significance</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {CALENDAR_DATA.keyDaysAndFeasts.map((day) => {
                             const theme = getLiturgicalTheme(day.liturgicalColourPrimary);
                             return (
                                <tr key={day.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-8 py-5 whitespace-nowrap">
                                        <div className="font-serif font-bold text-lg text-gray-800">{day.name}</div>
                                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mt-1">
                                            {CALENDAR_DATA.seasons.find(s => s.id === day.seasonId)?.name}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-4 h-4 rounded-full ${theme.accent} shadow-sm border border-black/5`}></div>
                                            <span className={`text-sm font-medium ${theme.text}`}>
                                                {day.liturgicalColourPrimary}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <p className="text-sm text-gray-600 leading-relaxed max-w-lg">{day.notes}</p>
                                    </td>
                                </tr>
                             );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-100">
               {CALENDAR_DATA.keyDaysAndFeasts.map(day => {
                  const theme = getLiturgicalTheme(day.liturgicalColourPrimary);
                  return (
                    <div key={day.id} className="p-5 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                           <div>
                               <h3 className="font-serif font-bold text-gray-900 text-base leading-tight">{day.name}</h3>
                               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">
                                   {CALENDAR_DATA.seasons.find(s => s.id === day.seasonId)?.name}
                               </p>
                           </div>
                           <div className={`w-3 h-3 rounded-full ${theme.accent} shadow-sm flex-shrink-0 mt-1`}></div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mb-2 mt-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${theme.pill} border border-black/5`}>
                                {day.liturgicalColourPrimary}
                            </span>
                        </div>

                        <div className="text-xs text-gray-600 leading-relaxed pl-3 border-l-2 border-gray-100">
                           {day.notes}
                        </div>
                    </div>
                  );
               })}
            </div>
        </div>
      )}
    </div>
  );
};

export default ChristianCalendar;

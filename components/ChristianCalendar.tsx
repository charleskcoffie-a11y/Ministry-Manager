import React, { useState } from 'react';
import { Calendar, Info, ChevronDown, ChevronUp, Circle } from 'lucide-react';

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
      liturgicalColourAlternate: "Red on some days (e.g. Good Friday)",
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
      "name": "Watchnight / New Year’s Eve Service",
      liturgicalColourPrimary: "White",
      seasonId: "ORDINARY_TIME",
      notes: "Methodist tradition of prayer and thanksgiving at the turn of the year."
    }
  ]
};

const getLiturgicalStyle = (colour: string | null) => {
  if (!colour) return 'bg-gray-100 text-gray-700 border-gray-200';
  const c = colour.toLowerCase();
  
  if (c.includes('violet') || c.includes('purple')) return 'bg-purple-100 text-purple-800 border-purple-200';
  if (c.includes('blue')) return 'bg-blue-100 text-blue-800 border-blue-200';
  if (c.includes('green')) return 'bg-green-100 text-green-800 border-green-200';
  if (c.includes('red')) return 'bg-red-100 text-red-800 border-red-200';
  if (c.includes('white')) return 'bg-white text-gray-800 border-gray-200 shadow-sm ring-1 ring-gray-100';
  if (c.includes('gold')) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  if (c.includes('black')) return 'bg-gray-900 text-gray-100 border-gray-700';
  
  return 'bg-gray-100 text-gray-700 border-gray-200';
};

const getDotColor = (colour: string | null) => {
    if (!colour) return 'bg-gray-400';
    const c = colour.toLowerCase();
    if (c.includes('violet') || c.includes('purple')) return 'bg-purple-600';
    if (c.includes('blue')) return 'bg-blue-600';
    if (c.includes('green')) return 'bg-green-600';
    if (c.includes('red')) return 'bg-red-600';
    if (c.includes('white')) return 'bg-white border border-gray-300';
    if (c.includes('gold')) return 'bg-yellow-400';
    if (c.includes('black')) return 'bg-gray-900';
    return 'bg-gray-400';
};

const ChristianCalendar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'seasons' | 'feasts'>('seasons');

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-4 border-b border-gray-200 pb-6">
        <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 flex items-center gap-3">
                <Calendar className="w-8 h-8 md:w-10 md:h-10 text-primary" />
                Christian Calendar
            </h1>
            <p className="text-gray-500 mt-2 text-lg">Methodist – Ghana</p>
        </div>
      </div>
      
      {/* Description Panel */}
      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-blue-900 text-sm md:text-base">
         <div className="flex gap-2">
            <Info className="w-5 h-5 flex-shrink-0" />
            <p>{CALENDAR_DATA.description}</p>
         </div>
      </div>

      {/* Toggle Tabs (Segmented Control) */}
      <div className="bg-gray-100 p-1 rounded-xl flex">
          <button 
            onClick={() => setActiveTab('seasons')}
            className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-all shadow-sm ${activeTab === 'seasons' ? 'bg-white text-gray-900' : 'text-gray-500 hover:text-gray-700 shadow-none'}`}
          >
            Seasons & Cycles
          </button>
          <button 
            onClick={() => setActiveTab('feasts')}
            className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-all shadow-sm ${activeTab === 'feasts' ? 'bg-white text-gray-900' : 'text-gray-500 hover:text-gray-700 shadow-none'}`}
          >
            Key Days & Feasts
          </button>
      </div>

      {/* Content: Seasons */}
      {activeTab === 'seasons' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
          {CALENDAR_DATA.seasons.map((season) => (
            <div key={season.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all active:scale-[0.99]">
                <div className={`px-6 py-4 border-b flex justify-between items-center ${getLiturgicalStyle(season.liturgicalColourPrimary).split(' ')[0]} bg-opacity-20`}>
                    <span className="text-xs font-bold uppercase tracking-wider opacity-70">{season.cycle}</span>
                    <div className="flex items-center gap-2">
                         <div className={`w-3 h-3 rounded-full ${getDotColor(season.liturgicalColourPrimary)} shadow-sm`}></div>
                         {season.liturgicalColourAlternate && (
                             <div className={`w-3 h-3 rounded-full ${getDotColor(season.liturgicalColourAlternate)} shadow-sm`}></div>
                         )}
                    </div>
                </div>
                <div className="p-6">
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">{season.name}</h3>
                    <div className="flex flex-wrap gap-2 mb-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold border ${getLiturgicalStyle(season.liturgicalColourPrimary)}`}>
                            {season.liturgicalColourPrimary}
                        </span>
                        {season.liturgicalColourAlternate && (
                             <span className={`px-2 py-1 rounded text-xs font-semibold border ${getLiturgicalStyle(season.liturgicalColourAlternate)}`}>
                                Or {season.liturgicalColourAlternate}
                            </span>
                        )}
                    </div>
                    <p className="text-gray-600 mb-4 leading-relaxed text-base">{season.summary}</p>
                    <div className="flex items-start gap-2 text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{season.typicalStartHint}</span>
                    </div>
                </div>
            </div>
          ))}
        </div>
      )}

      {/* Content: Key Days */}
      {activeTab === 'feasts' && (
        <div className="animate-fade-in">
            {/* Mobile: List of Cards */}
            <div className="md:hidden space-y-4">
               {CALENDAR_DATA.keyDaysAndFeasts.map(day => (
                  <div key={day.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                     <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-gray-900 text-lg leading-tight">{day.name}</h3>
                        <div className={`w-4 h-4 rounded-full border border-black/10 shadow-sm flex-shrink-0 ml-2 ${getDotColor(day.liturgicalColourPrimary)}`}></div>
                     </div>
                     <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                        {CALENDAR_DATA.seasons.find(s => s.id === day.seasonId)?.name}
                     </p>
                     
                     <div className="flex flex-wrap gap-2 mb-4">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            {day.liturgicalColourPrimary}
                        </span>
                        {day.liturgicalColourAlternate && (
                             <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200">
                                Alt: {day.liturgicalColourAlternate}
                            </span>
                        )}
                     </div>

                     <div className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100">
                        {day.notes}
                     </div>
                  </div>
               ))}
            </div>

            {/* Desktop: Table */}
            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Day / Feast</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Liturgical Colour</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {CALENDAR_DATA.keyDaysAndFeasts.map((day) => (
                                <tr key={day.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-lg font-medium text-gray-900">{day.name}</div>
                                        <div className="text-sm text-gray-500">
                                            {CALENDAR_DATA.seasons.find(s => s.id === day.seasonId)?.name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-4 h-4 rounded-full border border-black/10 shadow-sm ${getDotColor(day.liturgicalColourPrimary)}`}></div>
                                            <span className="text-sm text-gray-700">{day.liturgicalColourPrimary}</span>
                                            {day.liturgicalColourAlternate && (
                                                <span className="text-xs text-gray-400">/ {day.liturgicalColourAlternate}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm text-gray-600 leading-relaxed">{day.notes}</p>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ChristianCalendar;
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Song } from '../types';
import { Search, Music, BookOpen, ChevronRight, ArrowLeft, Loader2, Database, ZoomIn, ZoomOut, Globe, List, X, AlertCircle, PlayCircle } from 'lucide-react';

// --- Helper: Lyric Cleaner ---
const cleanLyrics = (raw: string | undefined | null): string => {
    if (!raw) return '';
    
    // 1. Split into lines
    let lines = raw.split('\n');
    
    // 2. Filter and transform lines
    lines = lines.map(line => {
        let text = line;
        const trimmed = text.trim();
        
        // Rule: Remove 'Tahoma;' lines or similar font artifacts
        if (trimmed.toLowerCase().startsWith('tahoma')) return null;
        
        // Rule: Remove single punctuation lines (; : , .)
        if (/^[;:,.]+$/.test(trimmed)) return null;
        
        // Rule: Remove "Verse X", "Stanza X", "- 1 Verse" headers entirely
        if (/^[-0-9\s]*(Verse|Stanza|Hymn)\s*\d*/i.test(trimmed)) return null;
        
        // Rule: Remove lines that are just numbers
        if (/^\d+\.?$/.test(trimmed)) return null;

        // Rule: Clean up lines that start with artifacts but contain lyrics
        if (/^-\d+/.test(trimmed)) {
             text = text.replace(/^-\d+/, '');
        }

        return text;
    }).filter((line): line is string => line !== null);

    // 3. Join and collapse multiple empty lines
    return lines.join('\n').replace(/(\n\s*){3,}/g, '\n\n').trim();
};

// --- Helper: Collection Colors ---
const getCollectionStyle = (collection: string) => {
    if (collection === 'MHB' || collection === 'HYMNS') {
        return {
            gradient: 'from-blue-600 to-indigo-600',
            text: 'text-blue-700',
            bg: 'bg-blue-50',
            border: 'border-blue-100'
        };
    }
    if (collection.includes('CANTICLE')) {
        return {
            gradient: 'from-purple-600 to-fuchsia-600',
            text: 'text-purple-700',
            bg: 'bg-purple-50',
            border: 'border-purple-100'
        };
    }
    if (collection === 'CAN' || collection === 'LOCAL' || collection === 'GHANA') {
        return {
            gradient: 'from-teal-500 to-emerald-600',
            text: 'text-teal-700',
            bg: 'bg-teal-50',
            border: 'border-teal-100'
        };
    }
    // Default
    return {
        gradient: 'from-slate-500 to-gray-600',
        text: 'text-slate-700',
        bg: 'bg-slate-50',
        border: 'border-slate-100'
    };
};

const Hymnal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'hymns' | 'canticles' | 'can' | 'all'>('hymns');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [songs, setSongs] = useState<Song[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Song | null>(null);
  const [fontSize, setFontSize] = useState(20);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    let collections: string[] = [];

    // Inclusive filtering logic
    if (activeTab === 'hymns') {
        collections = ['MHB', 'General', 'HYMNS', 'SONGS'];
    } else if (activeTab === 'canticles') {
        collections = ['CANTICLES_EN', 'CANTICLES_FANTE', 'CANTICLES', 'CANTICLE'];
    } else if (activeTab === 'can') {
        collections = ['CAN', 'LOCAL', 'GHANA'];
    }

    try {
        let query = supabase.from('songs').select('*');
        
        if (activeTab !== 'all') {
            query = query.in('collection', collections);
        }
        
        // Sorting
        const { data, error } = await query.order('number', { ascending: true });

        if (error) throw error;
        
        if (data) {
            setSongs(data);
        }
    } catch (err: any) {
        console.error("Error fetching songs:", err);
        const msg = err.message || err.error_description || JSON.stringify(err);
        setErrorMsg(msg);
    } finally {
        setLoading(false);
    }
  };

  const getFilteredItems = () => {
    if (!searchQuery) return songs;
    const q = searchQuery.toLowerCase();
    
    return songs.filter(s => 
      s.title.toLowerCase().includes(q) || 
      (s.number && s.number.toString().includes(q)) ||
      (s.lyrics && s.lyrics.toLowerCase().includes(q)) ||
      (s.code && s.code.toLowerCase().includes(q))
    );
  };

  const filteredItems = getFilteredItems();

  const seedDatabase = async () => {
      setLoading(true);
      setErrorMsg(null);
      
      const sampleSongs: Song[] = [
          { 
              id: 4130, collection: "MHB", code: "MHB1", number: 1, 
              title: "O for a thousand tongues to sing", 
              lyrics: "O for a thousand tongues to sing\nMy great Redeemer's praise,\nThe glories of my God and King,\nThe triumphs of His grace!\n\nMy gracious Master and my God,\nAssist me to proclaim,\nTo spread through all the earth abroad\nThe honours of Thy name."
          },
          { 
              id: 4200, collection: "MHB", code: "MHB242", number: 242, 
              title: "And Can It Be", 
              lyrics: "And can it be that I should gain\nAn interest in the Savior's blood?\nDied He for me, who caused His pain—\nFor me, who Him to death pursued?\nAmazing love! How can it be,\nThat Thou, my God, shouldst die for me?" 
          },
          { 
              id: 5001, collection: "CANTICLES_EN", code: "CANT1", number: 1, 
              title: "Te Deum Laudamus", 
              lyrics: "We praise You, O God; we acknowledge You to be the Lord.\nAll the earth worships You, the Father everlasting.\nTo You all Angels cry aloud; the Heavens and all the Powers therein." 
          },
          { 
              id: 6001, collection: "CAN", code: "CAN1", number: 1, 
              title: "Dɛn na memfa nyi me Nyame ayɛ", 
              lyrics: "Dɛn na memfa nyi me Nyame ayɛ\nMe Pomfo kɛse no,\nMe Nyame na me Hene, n’enyimnyam,\nNa n’adom nkonim no!" 
          }
      ];

      try {
          const { error } = await supabase.from('songs').upsert(sampleSongs);
          if (error) throw error;
          
          alert("Sample data loaded into 'songs' table!");
          fetchData();
      } catch (err: any) {
          console.error("Seed error:", err);
          const msg = err.message || JSON.stringify(err);
          alert("Error inserting sample data: " + msg);
          setErrorMsg(msg);
      } finally {
          setLoading(false);
      }
  };

  // --- Component: Tab Button ---
  const TabButton = ({ id, label, icon: Icon, colorClass }: { id: string, label: string, icon: any, colorClass: string }) => (
    <button 
        onClick={() => { setActiveTab(id as any); setSearchQuery(''); }}
        className={`
            relative flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-full text-sm font-bold transition-all duration-300
            ${activeTab === id 
                ? `${colorClass} text-white shadow-md transform scale-100` 
                : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100 hover:scale-[1.02]'
            }
        `}
    >
        <Icon className={`w-4 h-4 ${activeTab === id ? 'text-white' : 'text-gray-400'}`} />
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{label.split(' ')[0]}</span>
    </button>
  );

  // --- Render Reading View (Overlay) ---
  if (selectedItem) {
      return (
          <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col animate-fade-in overflow-hidden">
              {/* Reading Header */}
              <div className="bg-white/90 backdrop-blur-md border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                  <button 
                    onClick={() => setSelectedItem(null)} 
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-full transition-colors font-medium text-sm"
                  >
                      <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full border border-gray-200">
                      <button onClick={() => setFontSize(Math.max(14, fontSize - 2))} className="p-2 hover:bg-white rounded-full text-slate-600 transition-all"><ZoomOut className="w-4 h-4"/></button>
                      <span className="text-xs font-bold w-8 text-center text-slate-500">{fontSize}</span>
                      <button onClick={() => setFontSize(Math.min(48, fontSize + 2))} className="p-2 hover:bg-white rounded-full text-slate-600 transition-all"><ZoomIn className="w-4 h-4"/></button>
                  </div>
              </div>

              {/* Reading Content */}
              <div className="flex-1 overflow-y-auto">
                  <div className="max-w-3xl mx-auto min-h-full bg-white shadow-2xl my-6 md:my-10 rounded-2xl overflow-hidden border border-gray-100">
                      {/* Song Title Header */}
                      <div className="bg-gradient-to-b from-slate-50 to-white px-8 pt-10 pb-6 text-center border-b border-slate-50">
                          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4 shadow-sm border ${getCollectionStyle(selectedItem.collection).bg} ${getCollectionStyle(selectedItem.collection).border}`}>
                             <span className={`text-xs font-bold tracking-wider uppercase ${getCollectionStyle(selectedItem.collection).text}`}>
                                {selectedItem.code || selectedItem.collection}
                             </span>
                             <span className={`text-sm font-black ${getCollectionStyle(selectedItem.collection).text}`}>
                                #{selectedItem.number}
                             </span>
                          </div>
                          
                          <h1 className="text-3xl md:text-4xl font-serif font-black text-slate-900 leading-tight mb-3">
                              {selectedItem.title}
                          </h1>
                          
                          {selectedItem.author && (
                            <p className="text-slate-500 italic text-sm font-medium">
                                {selectedItem.author}
                            </p>
                          )}
                      </div>

                      {/* Lyrics Body */}
                      <div className="px-8 pb-16 pt-6 md:px-16 md:pb-20">
                        <div 
                            className="whitespace-pre-wrap font-serif text-slate-800 leading-relaxed text-center mx-auto max-w-2xl selection:bg-blue-100"
                            style={{ fontSize: `${fontSize}px`, lineHeight: '1.7' }}
                        >
                            {cleanLyrics(selectedItem.lyrics)}
                        </div>
                      </div>

                      {/* Footer Metadata */}
                      {(selectedItem.tags || selectedItem.copyright) && (
                          <div className="bg-slate-50 p-6 text-center text-xs text-slate-400 border-t border-slate-100">
                              {selectedItem.copyright && <p className="mb-1">© {selectedItem.copyright}</p>}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )
  }

  // --- Render Main List View ---
  return (
    <div className="h-full flex flex-col bg-slate-50/50">
      
      {/* 1. Header Section */}
      <div className="sticky top-0 z-30 shadow-sm">
          {/* Hero Gradient Area */}
          <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white pt-6 pb-6 px-4 md:px-6">
              <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                      <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20 shadow-inner">
                          <Music className="w-8 h-8 text-blue-200" />
                      </div>
                      <div>
                          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                              Canticles & Hymns
                          </h1>
                          <p className="text-sm md:text-base text-blue-200 font-medium">
                              Methodist Church Ghana • {songs.length} Songs
                          </p>
                      </div>
                  </div>
                  
                  <button 
                    onClick={seedDatabase} 
                    className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/30 hover:bg-white/10 transition-colors text-xs font-semibold text-blue-100 hover:text-white"
                  >
                      <Database className="w-3 h-3" /> Load Sample
                  </button>
              </div>
          </div>

          {/* Controls Bar (Tabs & Search) */}
          <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-4">
              <div className="max-w-5xl mx-auto space-y-4">
                  {/* Tabs */}
                  <div className="flex gap-2 p-1 bg-gray-50 rounded-full border border-gray-100 overflow-x-auto">
                      <TabButton id="hymns" label="MHB" icon={BookOpen} colorClass="bg-gradient-to-r from-blue-600 to-indigo-600" />
                      <TabButton id="canticles" label="Canticles" icon={PlayCircle} colorClass="bg-gradient-to-r from-purple-600 to-fuchsia-600" />
                      <TabButton id="can" label="CAN / Local" icon={Globe} colorClass="bg-gradient-to-r from-teal-500 to-emerald-600" />
                      <TabButton id="all" label="All Songs" icon={List} colorClass="bg-gradient-to-r from-gray-700 to-slate-800" />
                  </div>

                  {/* Search */}
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input 
                        type="text"
                        placeholder={activeTab === 'canticles' ? "Search Canticles..." : "Search by Number, Title, or Lyrics..."}
                        className="block w-full pl-12 pr-4 py-3 bg-slate-50 border-none text-gray-900 placeholder-gray-400 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:shadow-lg transition-all duration-300 text-base shadow-inner"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button 
                            onClick={() => setSearchQuery('')}
                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-5 h-5 bg-gray-200 rounded-full p-1" />
                        </button>
                    )}
                  </div>
              </div>
          </div>
      </div>

      {/* 2. Error Message */}
      {errorMsg && (
        <div className="max-w-5xl mx-auto px-4 mt-6">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-700 shadow-sm">
                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                    <h3 className="font-bold text-sm">Error Loading Songs</h3>
                    <p className="text-sm mt-1">{errorMsg}</p>
                </div>
            </div>
        </div>
      )}

      {/* 3. Song Grid */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-5xl mx-auto min-h-full">
              {loading ? (
                  <div className="flex flex-col items-center justify-center h-64">
                      <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4"/>
                      <p className="text-slate-400 font-medium">Loading hymnal...</p>
                  </div>
              ) : filteredItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                          <Music className="w-8 h-8 text-slate-300" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-700 mb-1">No songs found</h3>
                      <p className="text-slate-500 text-sm">Try searching for something else.</p>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
                      {filteredItems.map((item) => {
                          const styles = getCollectionStyle(item.collection);
                          return (
                              <div 
                                key={item.id} 
                                onClick={() => setSelectedItem(item)}
                                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-blue-100 hover:-translate-y-1 transition-all duration-300 cursor-pointer group flex items-start gap-4"
                              >
                                  {/* Left: Gradient Badge */}
                                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${styles.gradient} text-white shadow-md flex flex-col items-center justify-center flex-shrink-0`}>
                                      <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">
                                          {item.collection === 'CANTICLES_EN' ? 'CANT' : (item.collection === 'General' ? 'GEN' : item.collection)}
                                      </span>
                                      <span className="text-lg font-black leading-none mt-0.5">
                                          {item.number}
                                      </span>
                                  </div>

                                  {/* Center: Info */}
                                  <div className="flex-1 min-w-0 py-0.5">
                                      <h3 className={`text-base font-semibold text-gray-800 group-hover:${styles.text} transition-colors truncate mb-1`}>
                                          {item.title}
                                      </h3>
                                      {item.lyrics && (
                                          <p className="text-xs text-gray-400 font-medium line-clamp-1">
                                              {cleanLyrics(item.lyrics).split('\n')[0]}
                                          </p>
                                      )}
                                  </div>

                                  {/* Right: Chevron */}
                                  <div className="self-center">
                                      <div className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-gray-100 flex items-center justify-center transition-colors">
                                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
                                      </div>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default Hymnal;
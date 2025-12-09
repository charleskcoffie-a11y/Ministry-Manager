import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Song } from '../types';
import { Search, Music, BookOpen, ChevronRight, ArrowLeft, Loader2, Database, ZoomIn, ZoomOut, Globe, List, X, AlertCircle } from 'lucide-react';

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
        // Matches: "Verse 1", "1 Verse 1", "-1 Verse 1", "Verse", "1" (if it's just a number on a line)
        if (/^[-0-9\s]*(Verse|Stanza|Hymn)\s*\d*/i.test(trimmed)) return null;
        
        // Rule: Remove lines that are just numbers (often verse numbers in raw text)
        // e.g. "1", "2", "1."
        if (/^\d+\.?$/.test(trimmed)) return null;

        // Rule: Clean up lines that start with artifacts but contain lyrics
        // (If there are any left that didn't match the removal rule above)
        if (/^-\d+/.test(trimmed)) {
             text = text.replace(/^-\d+/, '');
        }

        return text;
    }).filter((line): line is string => line !== null);

    // 3. Join and collapse multiple empty lines
    // We want at most one empty line between stanzas (which is \n\n)
    return lines.join('\n').replace(/(\n\s*){3,}/g, '\n\n').trim();
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

  // --- Helper: Tab Button ---
  const TabButton = ({ id, label, icon: Icon }: { id: string, label: string, icon: any }) => (
    <button 
        onClick={() => { setActiveTab(id as any); setSearchQuery(''); }}
        className={`
            relative flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-300
            ${activeTab === id 
                ? 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-200 transform scale-[1.02]' 
                : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'
            }
        `}
    >
        <Icon className={`w-4 h-4 ${activeTab === id ? 'text-blue-100' : 'text-gray-400'}`} />
        <span>{label}</span>
    </button>
  );

  // --- Render Reading View (Overlay) ---
  if (selectedItem) {
      return (
          <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col animate-fade-in overflow-hidden">
              {/* Reading Header */}
              <div className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                  <button 
                    onClick={() => setSelectedItem(null)} 
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-full transition-colors font-medium text-sm"
                  >
                      <ArrowLeft className="w-4 h-4" /> Back to List
                  </button>
                  
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                      <button onClick={() => setFontSize(Math.max(14, fontSize - 2))} className="p-2 hover:bg-white rounded-md text-slate-600 transition-all"><ZoomOut className="w-4 h-4"/></button>
                      <span className="text-xs font-bold w-8 text-center text-slate-500">{fontSize}px</span>
                      <button onClick={() => setFontSize(Math.min(48, fontSize + 2))} className="p-2 hover:bg-white rounded-md text-slate-600 transition-all"><ZoomIn className="w-4 h-4"/></button>
                  </div>
              </div>

              {/* Reading Content */}
              <div className="flex-1 overflow-y-auto">
                  <div className="max-w-3xl mx-auto min-h-full bg-white shadow-xl my-4 md:my-8 rounded-none md:rounded-2xl overflow-hidden">
                      {/* Song Title Header */}
                      {/* REDUCED PADDING: pb-4 (was pb-8), smaller top padding */}
                      <div className="bg-gradient-to-b from-slate-50 to-white px-8 pt-8 pb-4 md:px-12 md:pt-10 text-center border-b border-slate-50">
                          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full mb-3 border border-blue-100">
                             <span className="text-xs font-bold tracking-wider uppercase">
                                {selectedItem.code || selectedItem.collection}
                             </span>
                             <span className="text-sm font-black">
                                #{selectedItem.number}
                             </span>
                          </div>
                          
                          {/* REDUCED FONT SIZE: text-2xl md:text-3xl (was 3xl-5xl) */}
                          <h1 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 leading-tight mb-2">
                              {selectedItem.title}
                          </h1>
                          
                          {selectedItem.author && (
                            <p className="text-slate-500 italic text-sm">
                                Written by {selectedItem.author}
                            </p>
                          )}
                      </div>

                      {/* Lyrics Body */}
                      {/* REDUCED TOP PADDING: pt-4 (was pt-6 or pt-12) */}
                      <div className="px-8 pb-12 pt-4 md:px-16 md:pb-16 md:pt-4">
                        <div 
                            className="whitespace-pre-wrap font-serif text-slate-800 leading-relaxed text-center mx-auto max-w-2xl selection:bg-blue-100"
                            style={{ fontSize: `${fontSize}px`, lineHeight: '1.6' }}
                        >
                            {cleanLyrics(selectedItem.lyrics)}
                        </div>
                      </div>

                      {/* Footer Metadata */}
                      {(selectedItem.tags || selectedItem.copyright) && (
                          <div className="bg-slate-50 p-6 text-center text-xs text-slate-400 border-t border-slate-100">
                              {selectedItem.copyright && <p className="mb-1">© {selectedItem.copyright}</p>}
                              {selectedItem.tags && <p>Tags: {selectedItem.tags}</p>}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )
  }

  // --- Render Main List View ---
  return (
    <div className="h-full flex flex-col bg-slate-50">
      
      {/* 1. Sticky Header Section */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 md:px-6">
            {/* Title Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between py-6 gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-lg shadow-blue-200 text-white">
                        <Music className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600">
                            Canticles & Hymns
                        </h1>
                        <p className="text-xs md:text-sm text-slate-400 font-medium">Methodist Church Ghana • {songs.length} Songs</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={seedDatabase} 
                        className="text-xs font-semibold text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Database className="w-3 h-3"/> Load Sample
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="pb-4">
                <div className="flex flex-col sm:flex-row gap-2 bg-slate-50/80 p-1.5 rounded-2xl border border-slate-100">
                    <TabButton id="hymns" label="MHB" icon={Music} />
                    <TabButton id="canticles" label="Canticles" icon={BookOpen} />
                    <TabButton id="can" label="CAN / Local" icon={Globe} />
                    <TabButton id="all" label="All Songs" icon={List} />
                </div>
            </div>
            
            {/* Search Bar */}
            <div className="pb-6 relative">
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input 
                        type="text"
                        placeholder={activeTab === 'canticles' ? "Search Canticles..." : "Search by Number, Title, or Lyrics..."}
                        className="block w-full pl-12 pr-4 py-3.5 bg-gray-50 border-transparent text-gray-900 placeholder-gray-400 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:shadow-lg transition-all duration-300 text-base shadow-inner"
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
        <div className="max-w-5xl mx-auto px-4 mt-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-700 animate-fade-in shadow-sm">
                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                    <h3 className="font-bold text-sm">Error Loading Songs</h3>
                    <p className="text-sm mt-1">{errorMsg}</p>
                    {errorMsg.includes('does not exist') && (
                        <div className="mt-2 bg-white p-2 rounded text-xs border border-red-100 text-gray-600">
                            <strong>Possible Fix:</strong> The 'songs' table might be missing. Run the SQL script in README.md.
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* 3. Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
          <div className="max-w-5xl mx-auto min-h-full">
              {loading ? (
                  <div className="flex flex-col items-center justify-center h-64">
                      <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4"/>
                      <p className="text-slate-400 font-medium">Loading hymnal...</p>
                  </div>
              ) : filteredItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-96 text-center px-4">
                      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                          <Music className="w-10 h-10 text-slate-300" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-700 mb-2">No songs found</h3>
                      <p className="text-slate-500 max-w-sm mx-auto mb-6">
                          We couldn't find matches for "{searchQuery}". Try a different keyword or number.
                      </p>
                      <button onClick={() => setSearchQuery('')} className="text-blue-600 font-semibold hover:underline">
                          Clear Search
                      </button>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                      {filteredItems.map((item) => (
                          <div 
                            key={item.id} 
                            onClick={() => setSelectedItem(item)}
                            className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-200/50 hover:-translate-y-1 transition-all duration-300 cursor-pointer group flex items-start gap-4 relative overflow-hidden"
                          >
                              {/* Left: Badge (Album Art Style) */}
                              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 group-hover:from-blue-600 group-hover:to-indigo-600 text-slate-600 group-hover:text-white transition-all duration-300 flex flex-col items-center justify-center flex-shrink-0 shadow-inner group-hover:shadow-lg border border-slate-200 group-hover:border-transparent">
                                  <span className="text-[9px] font-bold uppercase tracking-wider opacity-60 group-hover:opacity-80">
                                      {item.collection === 'CANTICLES_EN' ? 'CANT' : (item.collection === 'General' ? 'GEN' : item.collection)}
                                  </span>
                                  <span className="text-lg font-black leading-none mt-0.5">
                                      {item.number}
                                  </span>
                              </div>

                              {/* Center: Info */}
                              <div className="flex-1 min-w-0 py-0.5">
                                  <h3 className="text-base font-bold text-slate-800 group-hover:text-blue-700 transition-colors truncate mb-1">
                                      {item.title}
                                  </h3>
                                  {item.lyrics && (
                                      <p className="text-xs text-slate-400 font-medium line-clamp-2 leading-relaxed">
                                          {cleanLyrics(item.lyrics).replace(/\n/g, ' ')}
                                      </p>
                                  )}
                              </div>

                              {/* Right: Action */}
                              <div className="self-center">
                                  <div className="w-8 h-8 rounded-full bg-slate-50 group-hover:bg-blue-50 flex items-center justify-center transition-colors">
                                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default Hymnal;
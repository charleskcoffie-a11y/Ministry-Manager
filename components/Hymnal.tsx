
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Song } from '../types';
import { Search, Music, BookOpen, ChevronRight, ArrowLeft, Loader2, Database, ZoomIn, ZoomOut, Globe, Filter, AlertCircle, List } from 'lucide-react';

const Hymnal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'hymns' | 'canticles' | 'can' | 'all'>('hymns');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [songs, setSongs] = useState<Song[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Song | null>(null);
  const [fontSize, setFontSize] = useState(18);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    let collections: string[] = [];

    // Inclusive filtering logic
    if (activeTab === 'hymns') {
        collections = ['MHB', 'General', 'HYMNS', 'SONGS']; // Include General in main tab
    } else if (activeTab === 'canticles') {
        collections = ['CANTICLES_EN', 'CANTICLES_FANTE', 'CANTICLES', 'CANTICLE'];
    } else if (activeTab === 'can') {
        collections = ['CAN', 'LOCAL', 'GHANA'];
    }
    // 'all' tab doesn't use the 'in' filter

    try {
        let query = supabase.from('songs').select('*');
        
        if (activeTab !== 'all') {
            query = query.in('collection', collections);
        }
        
        // Sorting: Try to sort numeric numbers correctly, but standard string sort is default in SQL
        const { data, error } = await query.order('number', { ascending: true });

        if (error) throw error;
        
        if (data) {
            setSongs(data);
        }
    } catch (err: any) {
        console.error("Error fetching songs:", err);
        // Supabase often returns { message: "..." } or { error: "..." }
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

  // --- Render Reading View ---
  if (selectedItem) {
      return (
          <div className="max-w-3xl mx-auto h-[calc(100vh-120px)] flex flex-col animate-fade-in">
              {/* Header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b">
                  <button onClick={() => setSelectedItem(null)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                      <ArrowLeft className="w-6 h-6" /> Back
                  </button>
                  <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                      <button onClick={() => setFontSize(Math.max(14, fontSize - 2))} className="p-2 hover:bg-white rounded"><ZoomOut className="w-4 h-4"/></button>
                      <span className="text-sm font-bold w-8 text-center">{fontSize}</span>
                      <button onClick={() => setFontSize(Math.min(32, fontSize + 2))} className="p-2 hover:bg-white rounded"><ZoomIn className="w-4 h-4"/></button>
                  </div>
              </div>

              {/* Content */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12 overflow-y-auto flex-1">
                  <div className="text-center mb-10">
                      <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 font-bold rounded-full mb-3 uppercase tracking-wider text-sm">
                          {selectedItem.code || `${selectedItem.collection} ${selectedItem.number}`}
                      </span>
                      <h1 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 leading-tight">
                          {selectedItem.title}
                      </h1>
                      {selectedItem.author && (
                        <p className="text-gray-500 mt-2 italic">By {selectedItem.author}</p>
                      )}
                  </div>

                  <div 
                    className="whitespace-pre-wrap font-serif text-gray-800 leading-relaxed text-center"
                    style={{ fontSize: `${fontSize}px`, lineHeight: '1.8' }}
                  >
                      {selectedItem.lyrics}
                  </div>

                  {(selectedItem.tags || selectedItem.copyright) && (
                      <div className="mt-12 pt-8 border-t text-center text-xs text-gray-400">
                          {selectedItem.copyright && <p>© {selectedItem.copyright}</p>}
                          {selectedItem.tags && <p className="mt-1">Tags: {selectedItem.tags}</p>}
                      </div>
                  )}
              </div>
          </div>
      )
  }

  // --- Render List View ---
  return (
    <div className="max-w-5xl mx-auto space-y-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-4xl font-bold text-gray-800 flex items-center gap-3">
            <Music className="w-10 h-10 text-primary" /> Canticles & Hymns
        </h1>
        
        <div className="flex items-center gap-2">
            {/* Helper to seed data */}
            <button onClick={seedDatabase} className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 text-sm font-medium">
                <Database className="w-4 h-4"/> Load Sample
            </button>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex flex-wrap bg-gray-100 p-1 rounded-lg">
              <button 
                onClick={() => { setActiveTab('hymns'); setSearchQuery(''); }}
                className={`flex-1 min-w-[120px] py-3 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'hymns' ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}
              >
                  <Music className="w-4 h-4"/> MHB
              </button>
              <button 
                onClick={() => { setActiveTab('canticles'); setSearchQuery(''); }}
                className={`flex-1 min-w-[120px] py-3 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'canticles' ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}
              >
                  <BookOpen className="w-4 h-4"/> Canticles
              </button>
              <button 
                onClick={() => { setActiveTab('can'); setSearchQuery(''); }}
                className={`flex-1 min-w-[120px] py-3 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'can' ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}
              >
                  <Globe className="w-4 h-4"/> CAN
              </button>
              <button 
                onClick={() => { setActiveTab('all'); setSearchQuery(''); }}
                className={`flex-1 min-w-[120px] py-3 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'all' ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}
              >
                  <List className="w-4 h-4"/> All Songs
              </button>
          </div>

          <div className="relative">
              <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
              <input 
                type="text"
                placeholder={activeTab === 'canticles' ? "Search Canticles..." : "Search by Number, Title, or Lyrics..."}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent text-lg"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
          </div>
      </div>

      {/* Error Message Display */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-700 animate-fade-in">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
                <h3 className="font-bold text-sm">Error Loading Songs</h3>
                <p className="text-sm mt-1">{errorMsg}</p>
                {errorMsg.includes('does not exist') && (
                    <div className="mt-2 bg-white p-2 rounded text-xs border border-red-100 text-gray-600">
                        <strong>Possible Fix:</strong> The 'songs' table might be missing. Please run the SQL script provided in README.md in your Supabase SQL Editor.
                    </div>
                )}
            </div>
        </div>
      )}

      {/* List Results */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          {loading ? (
              <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 animate-spin text-gray-300"/>
              </div>
          ) : filteredItems.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-10 text-center">
                  <Music className="w-16 h-16 mb-4 opacity-20"/>
                  <p className="text-xl font-medium">No results found.</p>
                  <div className="mt-4 flex flex-col gap-2 items-center text-sm">
                    {errorMsg ? (
                        <p className="text-red-400">Please check the error above.</p>
                    ) : (
                        <>
                            <p>Try searching for a different number or keyword.</p>
                            <button onClick={seedDatabase} className="text-primary hover:underline">
                                Load Sample Data
                            </button>
                        </>
                    )}
                  </div>
              </div>
          ) : (
              <div className="overflow-y-auto flex-1">
                  <ul className="divide-y divide-gray-50">
                      {filteredItems.map((item) => (
                          <li 
                            key={item.id} 
                            onClick={() => setSelectedItem(item)}
                            className="p-5 hover:bg-blue-50 cursor-pointer transition-colors group flex items-center justify-between"
                          >
                              <div className="flex items-center gap-4">
                                  <span className="w-14 h-14 rounded-lg bg-blue-50 text-blue-700 font-bold flex flex-col items-center justify-center text-sm group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                                      <span className="text-[10px] uppercase opacity-70 leading-none mb-1">
                                          {item.collection === 'CANTICLES_EN' ? 'CANT' : (item.collection === 'General' ? 'GEN' : item.collection)}
                                      </span>
                                      <span className="text-lg leading-none">{item.number}</span>
                                  </span>
                                  <div>
                                      <h3 className="text-lg font-bold text-gray-800">{item.title}</h3>
                                      {item.lyrics && (
                                          <p className="text-sm text-gray-500 line-clamp-1 opacity-70">
                                              {item.lyrics.substring(0, 60).replace(/\n/g, ' ')}...
                                          </p>
                                      )}
                                  </div>
                              </div>
                              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-primary"/>
                          </li>
                      ))}
                  </ul>
              </div>
          )}
      </div>
    </div>
  );
};

export default Hymnal;

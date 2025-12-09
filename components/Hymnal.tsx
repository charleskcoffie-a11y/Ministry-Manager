
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Hymn, Canticle } from '../types';
import { Search, Music, BookOpen, ChevronRight, ArrowLeft, Loader2, Database, ZoomIn, ZoomOut, Upload, FileJson } from 'lucide-react';

const Hymnal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'hymns' | 'canticles'>('hymns');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [canticles, setCanticles] = useState<Canticle[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Hymn | Canticle | null>(null);
  const [fontSize, setFontSize] = useState(18);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    if (activeTab === 'hymns') {
        const { data } = await supabase.from('hymns').select('*').order('number', { ascending: true });
        if (data) setHymns(data);
    } else {
        const { data } = await supabase.from('canticles').select('*').order('number', { ascending: true });
        if (data) setCanticles(data);
    }
    setLoading(false);
  };

  const filteredItems = activeTab === 'hymns' 
    ? hymns.filter(h => 
        h.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        h.number.toString().includes(searchQuery) ||
        h.lyrics.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : canticles.filter(c => 
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.number.toString().includes(searchQuery)
      );

  const handleJsonImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
        try {
            const jsonText = event.target?.result as string;
            const data = JSON.parse(jsonText);

            if (!Array.isArray(data)) {
                alert("Invalid JSON format. File must contain an array of objects.");
                setImporting(false);
                return;
            }

            if (data.length === 0) {
                alert("File is empty.");
                setImporting(false);
                return;
            }

            // Determine table and validate simple structure based on active tab
            const tableName = activeTab === 'hymns' ? 'hymns' : 'canticles';
            const requiredKey = activeTab === 'hymns' ? 'lyrics' : 'content';

            // Validate first item
            if (!data[0].number || !data[0].title || !data[0][requiredKey]) {
                alert(`Invalid JSON structure for ${activeTab}. Ensure objects have 'number', 'title', and '${requiredKey}'.`);
                setImporting(false);
                return;
            }

            // Batch Insert (50 at a time to be safe)
            const BATCH_SIZE = 50;
            let successCount = 0;

            for (let i = 0; i < data.length; i += BATCH_SIZE) {
                const batch = data.slice(i, i + BATCH_SIZE);
                // Sanitize: Remove IDs if present to let DB auto-generate them
                const sanitizedBatch = batch.map(({ id, created_at, ...rest }: any) => rest);
                
                const { error } = await supabase.from(tableName).insert(sanitizedBatch);
                if (error) {
                    console.error("Batch insert error:", error);
                    alert(`Error importing batch starting at index ${i}. Stopping import.`);
                    break;
                }
                successCount += batch.length;
            }

            alert(`Successfully imported ${successCount} ${activeTab}.`);
            fetchData(); // Refresh list

        } catch (err: any) {
            console.error("Import Error:", err);
            alert("Failed to parse JSON file. " + err.message);
        } finally {
            setImporting(false);
            e.target.value = ''; // Reset input
        }
    };

    reader.readAsText(file);
  };

  const seedDatabase = async () => {
      setLoading(true);
      
      const sampleHymns = [
          { number: 1, title: "O for a thousand tongues to sing", lyrics: "O for a thousand tongues to sing\nMy great Redeemer's praise,\nThe glories of my God and King,\nThe triumphs of His grace!\n\nMy gracious Master and my God,\nAssist me to proclaim,\nTo spread through all the earth abroad\nThe honours of Thy name.", category: "Adoration" },
          { number: 242, title: "And Can It Be", lyrics: "And can it be that I should gain\nAn interest in the Savior's blood?\nDied He for me, who caused His pain—\nFor me, who Him to death pursued?\nAmazing love! How can it be,\nThat Thou, my God, shouldst die for me?", category: "Passion" },
          { number: 427, title: "Through all the changing scenes of life", lyrics: "Through all the changing scenes of life,\nIn trouble and in joy,\nThe praises of my God shall still\nMy heart and tongue employ.\n\nOf His deliverance I will boast,\nTill all that are distressed\nFrom my example comfort take,\nAnd charm their griefs to rest.", category: "Faith" }
      ];

      const sampleCanticles = [
          { number: 1, title: "Te Deum Laudamus", content: "We praise You, O God; we acknowledge You to be the Lord.\nAll the earth worships You, the Father everlasting.\nTo You all Angels cry aloud; the Heavens and all the Powers therein.\nTo You Cherubim and Seraphim continually do cry,\nHoly, Holy, Holy, Lord God of Sabaoth;\nHeaven and earth are full of the Majesty of Your Glory." },
          { number: 2, title: "Benedictus", content: "Blessed be the Lord God of Israel;\nfor He has visited and redeemed His people;\nAnd has raised up a mighty salvation for us,\nin the house of His servant David;\nAs He spoke by the mouth of His holy Prophets,\nwhich have been since the world began;" },
          { number: 3, title: "Magnificat", content: "My soul magnifies the Lord,\nand my spirit rejoices in God my Savior.\nFor He has regarded the lowliness of His handmaiden.\nFor behold, from henceforth all generations shall call me blessed.\nFor He that is mighty has magnified me; and holy is His Name." }
      ];

      await supabase.from('hymns').insert(sampleHymns);
      await supabase.from('canticles').insert(sampleCanticles);
      
      fetchData();
      alert("Sample data loaded!");
  };

  // --- Render Reading View ---
  if (selectedItem) {
      const isHymn = 'lyrics' in selectedItem;
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
                          {isHymn ? `MHB ${selectedItem.number}` : `Canticle ${selectedItem.number}`}
                      </span>
                      <h1 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 leading-tight">
                          {selectedItem.title}
                      </h1>
                      {isHymn && selectedItem.category && <p className="text-gray-500 mt-2 italic">{selectedItem.category}</p>}
                  </div>

                  <div 
                    className="whitespace-pre-wrap font-serif text-gray-800 leading-relaxed text-center"
                    style={{ fontSize: `${fontSize}px`, lineHeight: '1.8' }}
                  >
                      {isHymn ? (selectedItem as Hymn).lyrics : (selectedItem as Canticle).content}
                  </div>
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
            {/* Import Button */}
            <label className={`flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg cursor-pointer hover:bg-green-100 transition-colors text-sm font-medium ${importing ? 'opacity-50 cursor-wait' : ''}`}>
                {importing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4"/>}
                <span>Import {activeTab === 'hymns' ? 'Hymns' : 'Canticles'} JSON</span>
                <input type="file" accept=".json" onChange={handleJsonImport} disabled={importing} className="hidden" />
            </label>

            {/* Helper to seed data if empty */}
            {((activeTab === 'hymns' && hymns.length === 0) || (activeTab === 'canticles' && canticles.length === 0)) && !loading && (
                <button onClick={seedDatabase} className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 text-sm font-medium">
                    <Database className="w-4 h-4"/> Load Sample
                </button>
            )}
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex bg-gray-100 p-1 rounded-lg">
              <button 
                onClick={() => { setActiveTab('hymns'); setSearchQuery(''); }}
                className={`flex-1 py-3 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'hymns' ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}
              >
                  <Music className="w-4 h-4"/> Methodist Hymns
              </button>
              <button 
                onClick={() => { setActiveTab('canticles'); setSearchQuery(''); }}
                className={`flex-1 py-3 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'canticles' ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}
              >
                  <BookOpen className="w-4 h-4"/> Canticles
              </button>
          </div>

          <div className="relative">
              <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
              <input 
                type="text"
                placeholder={activeTab === 'hymns' ? "Search by Number (e.g. 1) or Title..." : "Search Canticles..."}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent text-lg"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
          </div>
      </div>

      {/* List Results */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          {loading ? (
              <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 animate-spin text-gray-300"/>
              </div>
          ) : filteredItems.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-10 text-center">
                  <Music className="w-16 h-16 mb-4 opacity-20"/>
                  <p className="text-xl font-medium">No {activeTab} found.</p>
                  <div className="mt-4 flex flex-col gap-2 items-center text-sm">
                    <p>Try searching for a different number.</p>
                    <p className="text-gray-400">Or use the "Import JSON" button to bulk load your data.</p>
                  </div>
              </div>
          ) : (
              <div className="overflow-y-auto flex-1">
                  <ul className="divide-y divide-gray-50">
                      {filteredItems.map((item: any) => (
                          <li 
                            key={item.id} 
                            onClick={() => setSelectedItem(item)}
                            className="p-5 hover:bg-blue-50 cursor-pointer transition-colors group flex items-center justify-between"
                          >
                              <div className="flex items-center gap-4">
                                  <span className="w-12 h-12 rounded-lg bg-blue-50 text-blue-700 font-bold flex items-center justify-center text-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                      {item.number}
                                  </span>
                                  <div>
                                      <h3 className="text-lg font-bold text-gray-800">{item.title}</h3>
                                      {activeTab === 'hymns' && (
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

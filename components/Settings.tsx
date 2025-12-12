
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { APP_CONSTANTS } from '../constants';
import { 
  Settings as SettingsIcon, CheckCircle2, XCircle, Loader2, Database, 
  ShieldAlert, Upload, FileJson, Trash2, AlertTriangle, Play, FileText, 
  Lock, KeyRound, Save, Sparkles, Book
} from 'lucide-react';

const Settings: React.FC = () => {
  // Connection Test State
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // Import State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importStatusText, setImportStatusText] = useState(''); 
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);

  // Security / PIN State
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMessage, setPinMessage] = useState({ text: '', type: '' });

  // Verse Settings
  const [verseSource, setVerseSource] = useState('ai');

  useEffect(() => {
      setVerseSource(localStorage.getItem('dailyVerseSource') || 'ai');
  }, []);

  const handleVerseSourceChange = (val: string) => {
      setVerseSource(val);
      localStorage.setItem('dailyVerseSource', val);
  };

  // --- Connection Test Logic ---
  const testConnection = async () => {
    setStatus('loading');
    setMessage('');
    
    try {
      const { count, error } = await supabase
        .from('church_programs')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;
      
      const { error: songError } = await supabase
         .from('songs')
         .select('id')
         .limit(1);
         
      if (songError) {
          throw new Error("Connected, but 'songs' table is missing or inaccessible. " + songError.message);
      }

      setStatus('success');
      setMessage(`Connection successful! Database is online and accessible.`);
    } catch (err: any) {
      console.error("Connection Test Error:", err);
      setStatus('error');
      if (err.message?.includes('fetch')) {
        setMessage("Network Error: Could not reach Supabase. Check internet connection or URL.");
      } else if (err.code === 'PGRST301') {
        setMessage("Permission Error: RLS policies might be blocking access, but DB is reached.");
      } else if (err.code === '42P01') {
         const missingTable = err.message.includes('songs') ? 'songs' : 'church_programs';
         setMessage(`Table Error: '${missingTable}' table not found. Run the SQL script in README.`);
      } else {
        setMessage(`Error: ${err.message || 'Unknown connection error'}`);
      }
    }
  };

  // --- File Selection ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          if (file.type !== "application/json" && !file.name.endsWith('.json')) {
              alert("Please select a valid .json file");
              return;
          }
          setSelectedFile(file);
          setImportResult(null); 
          setImportStatusText('File ready to process.');
          e.target.value = ''; 
      }
  };

  // --- Import Logic ---
  const startImport = async () => {
    if (!selectedFile) {
        alert("No file selected.");
        return;
    }

    setImporting(true);
    setImportProgress({ current: 0, total: 0 });
    setImportStatusText('Initializing import process...');

    try {
        setImportStatusText('Reading file from disk...');
        const text = await selectedFile.text();
        
        setImportStatusText('Parsing JSON data...');
        let json;
        try {
            json = JSON.parse(text);
        } catch (e) {
            throw new Error("Invalid JSON syntax. Please check the file format.");
        }

        const findAndTagSongs = (obj: any, parentKey: string | null = null, depth = 0): any[] => {
            if (depth > 5) return [];
            if (!obj || typeof obj !== 'object') return [];

            if (Array.isArray(obj)) {
                 const hasSongs = obj.length > 0 && (
                     'title' in obj[0] || 'lyrics' in obj[0] || 'number' in obj[0]
                 );
                 
                 if (hasSongs) {
                     return obj.map((s: any) => {
                         let col = s.collection;
                         if (!col && parentKey) {
                             const k = parentKey.toUpperCase();
                             if (k.includes('MHB')) col = 'MHB';
                             else if (k.includes('CAN') && !k.includes('CANTICLE')) col = 'CAN';
                             else if (k.includes('CANTICLE')) col = 'CANTICLES_EN';
                             else col = parentKey;
                         }
                         return { ...s, collection: col || 'General' };
                     });
                 }
                 return obj.flatMap(item => findAndTagSongs(item, parentKey, depth + 1));
            }

            return Object.keys(obj).flatMap(key => {
                return findAndTagSongs(obj[key], key, depth + 1);
            });
        };

        setImportStatusText('Scanning and categorizing songs...');
        const songsArray = findAndTagSongs(json);

        const total = songsArray.length;
        if (total === 0) {
            throw new Error("Could not find any songs in the file.");
        }

        setImportStatusText('Checking database connection...');
        const { error: tableCheck } = await supabase.from('songs').select('id').limit(1);
        if (tableCheck && tableCheck.code === '42P01') {
             throw new Error("The 'songs' table does not exist in Supabase. Please run the SQL setup script.");
        }

        setImportProgress({ current: 0, total });
        setImportStatusText(`Found ${total} songs. Starting upload...`);

        const BATCH_SIZE = 50;
        let successCount = 0;
        let errorCount = 0;
        const totalBatches = Math.ceil(total / BATCH_SIZE);

        for (let i = 0; i < total; i += BATCH_SIZE) {
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            setImportStatusText(`Uploading batch ${batchNum} of ${totalBatches}...`);

            const batchRaw = songsArray.slice(i, i + BATCH_SIZE);
            
            const batch = batchRaw.map((s: any, idx: number) => {
                const fallbackId = Math.floor(Date.now() / 1000) + i + idx + Math.floor(Math.random() * 1000);
                return {
                    id: typeof s.id === 'number' ? s.id : fallbackId,
                    collection: s.collection || 'General',
                    code: s.code || `GEN${s.number || idx}`,
                    number: typeof s.number === 'number' ? s.number : 0,
                    title: s.title || 'Untitled Song',
                    raw_title: s.raw_title || null,
                    lyrics: s.lyrics || '',
                    author: s.author || null,
                    copyright: s.copyright || null,
                    tags: s.tags || null,
                    reference_number: s.reference_number || null
                };
            });

            const { error } = await supabase.from('songs').upsert(batch);
            
            if (error) {
                console.error('Batch import error:', error);
                errorCount += batch.length;
            } else {
                successCount += batch.length;
            }
            
            setImportProgress(prev => ({ ...prev, current: Math.min(i + BATCH_SIZE, total) }));
            await new Promise(r => setTimeout(r, 10));
        }

        setImportResult({ success: successCount, failed: errorCount });
        setImportStatusText('Import complete!');
        setSelectedFile(null); 

    } catch (err: any) {
        console.error("Import Process Error:", err);
        setImportStatusText('Error: ' + err.message);
        alert('Import failed: ' + err.message);
    } finally {
        setImporting(false);
    }
  };

  const clearSongs = async () => {
      if(!confirm("DANGER: This will delete ALL songs from the database. Are you sure?")) return;
      setImporting(true);
      setImportStatusText('Clearing database...');
      const { error } = await supabase.from('songs').delete().neq('id', 0);
      if (error) {
          alert("Error clearing table: " + error.message);
          setImportStatusText('Error clearing table');
      } else {
          setImportStatusText('Database cleared.');
          setImportResult(null); 
      }
      setImporting(false);
  };

  // --- PIN Change Logic ---
  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    setPinMessage({ text: '', type: '' });

    const storedPin = localStorage.getItem('ministryAppPIN') || APP_CONSTANTS.DEFAULT_PIN;

    if (oldPin !== storedPin) {
      setPinMessage({ text: 'Incorrect old PIN', type: 'error' });
      return;
    }

    if (newPin.length < 4 || newPin.length > 6) {
      setPinMessage({ text: 'New PIN must be 4-6 digits', type: 'error' });
      return;
    }

    if (newPin !== confirmPin) {
      setPinMessage({ text: 'New PINs do not match', type: 'error' });
      return;
    }

    localStorage.setItem('ministryAppPIN', newPin);
    setPinMessage({ text: 'PIN updated successfully!', type: 'success' });
    setOldPin('');
    setNewPin('');
    setConfirmPin('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-4 bg-white rounded-lg shadow-sm">
            <SettingsIcon className="w-8 h-8 text-gray-700" />
        </div>
        <div>
            <h1 className="text-4xl font-bold text-gray-800">System Settings</h1>
            <p className="text-lg text-gray-500">Manage application configuration and security</p>
        </div>
      </div>

      {/* 1. Daily Verse Settings */}
      <div className="bg-white rounded-lg shadow-md p-8 border border-gray-100">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-3 border-b pb-4">
          <Book className="w-6 h-6 text-indigo-600" />
          Daily Verse Preference
        </h2>
        
        <div className="bg-slate-50 p-6 rounded-lg border border-slate-100">
            <label className="block text-sm font-bold text-slate-700 mb-3">Verse Source</label>
            <div className="flex gap-4">
                <button 
                    onClick={() => handleVerseSourceChange('plan')}
                    className={`flex-1 p-4 rounded-xl border-2 transition-all text-left flex items-start gap-3 ${
                        verseSource === 'plan' 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900' 
                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                    }`}
                >
                    <div className={`p-2 rounded-full ${verseSource === 'plan' ? 'bg-indigo-200' : 'bg-slate-100'}`}>
                        <Database className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="font-bold block text-sm">Planned List (Supabase)</span>
                        <span className="text-xs opacity-80">Cycle through pre-entered verses from database.</span>
                    </div>
                </button>

                <button 
                    onClick={() => handleVerseSourceChange('ai')}
                    className={`flex-1 p-4 rounded-xl border-2 transition-all text-left flex items-start gap-3 ${
                        verseSource === 'ai' 
                        ? 'border-purple-600 bg-purple-50 text-purple-900' 
                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                    }`}
                >
                    <div className={`p-2 rounded-full ${verseSource === 'ai' ? 'bg-purple-200' : 'bg-slate-100'}`}>
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="font-bold block text-sm">Auto-generate (AI)</span>
                        <span className="text-xs opacity-80">Use AI to pick a fresh verse each day.</span>
                    </div>
                </button>
            </div>
        </div>
      </div>

      {/* 2. Security Settings */}
      <div className="bg-white rounded-lg shadow-md p-8 border border-gray-100">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-3 border-b pb-4">
          <Lock className="w-6 h-6 text-slate-800" />
          Security
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="bg-slate-50 p-6 rounded-lg border border-slate-100">
              <h3 className="font-bold text-slate-700 mb-2">App Lock Protection</h3>
              <p className="text-sm text-slate-500 mb-4">
                Change the PIN used to unlock the application at startup.
                Default PIN is <strong>{APP_CONSTANTS.DEFAULT_PIN}</strong>.
              </p>
              
              <form onSubmit={handleChangePin} className="space-y-4">
                 <div>
                    <input 
                      type="password" 
                      placeholder="Current PIN" 
                      className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-slate-400 outline-none"
                      value={oldPin}
                      onChange={e => setOldPin(e.target.value)}
                      maxLength={6}
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <input 
                      type="password" 
                      placeholder="New PIN" 
                      className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-slate-400 outline-none"
                      value={newPin}
                      onChange={e => setNewPin(e.target.value)}
                      maxLength={6}
                    />
                    <input 
                      type="password" 
                      placeholder="Confirm" 
                      className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-slate-400 outline-none"
                      value={confirmPin}
                      onChange={e => setConfirmPin(e.target.value)}
                      maxLength={6}
                    />
                 </div>
                 
                 <button type="submit" className="w-full py-2.5 bg-slate-800 text-white rounded-lg hover:bg-black font-medium transition-colors flex items-center justify-center gap-2">
                    <Save className="w-4 h-4" /> Update PIN
                 </button>

                 {pinMessage.text && (
                   <div className={`text-sm text-center font-medium py-2 rounded ${pinMessage.type === 'success' ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
                     {pinMessage.text}
                   </div>
                 )}
              </form>
           </div>

           <div className="bg-slate-50 p-6 rounded-lg border border-slate-100 flex flex-col justify-center items-center text-center">
              <ShieldAlert className="w-12 h-12 text-slate-300 mb-3" />
              <h3 className="font-bold text-slate-700 mb-1">Session Security</h3>
              <p className="text-sm text-slate-500 mb-4">
                The app automatically locks when you close the browser.
              </p>
              <button 
                onClick={() => {
                  sessionStorage.removeItem('ministryAppUnlocked');
                  window.location.reload();
                }}
                className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium shadow-sm transition-colors"
              >
                Lock App Now
              </button>
           </div>
        </div>
      </div>

      {/* 3. Database Connection Panel */}
      <div className="bg-white rounded-lg shadow-md p-8 border border-gray-100">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-3 border-b pb-4">
          <Database className="w-6 h-6 text-primary" />
          Database Connection
        </h2>
        
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Supabase URL</p>
                    <code className="text-lg font-mono text-gray-700 break-all block">
                        {(supabase as any).supabaseUrl || 'URL not found in client'}
                    </code>
                </div>
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                     <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Auth Status</p>
                     <div className="flex items-center gap-3">
                        <ShieldAlert className="w-5 h-5 text-gray-400"/>
                        <span className="text-lg text-gray-600">Anonymous / Public Mode</span>
                     </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-4">
                <button 
                    onClick={testConnection}
                    disabled={status === 'loading'}
                    className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-3 font-medium transition-all active:scale-95 text-lg"
                >
                    {status === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
                    Test Connection
                </button>

                {status === 'success' && (
                    <div className="flex items-center gap-3 text-green-700 bg-green-50 px-6 py-3 rounded-lg border border-green-200 text-lg font-medium animate-fade-in">
                        <CheckCircle2 className="w-6 h-6" />
                        {message}
                    </div>
                )}
                
                {status === 'error' && (
                    <div className="flex items-center gap-3 text-red-700 bg-red-50 px-6 py-3 rounded-lg border border-red-200 text-lg font-medium animate-fade-in">
                        <XCircle className="w-6 h-6" />
                        {message}
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* 4. Data Management Panel */}
      <div className="bg-white rounded-lg shadow-md p-8 border border-gray-100">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-3 border-b pb-4">
          <FileJson className="w-6 h-6 text-orange-600" />
          Data Management
        </h2>

        <div className="space-y-6">
                        {/* Constitution / Standing Orders Upload */}
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-6">
                                <h3 className="text-lg font-bold text-amber-900 mb-2">Upload Constitution / Standing Orders</h3>
                                <p className="text-amber-800 mb-4 text-sm">
                                    Upload a PDF or DOCX. The document will be parsed and saved to your database. You can then read and search it in Standing Orders.
                                </p>
                                <div className="flex items-start gap-4">
                                    <label className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 shadow-sm font-medium transition-colors">
                                        <Upload className="w-5 h-5 text-gray-600"/>
                                        <span>Select PDF/DOCX...</span>
                                        <input type="file" accept=".pdf,.docx" className="hidden" onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            try {
                                                // Basic parsing similar to StandingOrders
                                                let content: any[] = [];
                                                if (file.type === 'application/pdf' && (window as any).pdfjsLib) {
                                                    const arrayBuffer = await file.arrayBuffer();
                                                    const pdf = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                                                    for (let i = 1; i <= pdf.numPages; i++) {
                                                        const page = await pdf.getPage(i);
                                                        const textContent = await page.getTextContent();
                                                        const pageText = textContent.items.map((item: any) => item.str).join(' ');
                                                        if (pageText.trim()) content.push({ id: `p-${i}`, text: pageText, page: i });
                                                    }
                                                } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && (window as any).mammoth) {
                                                    const arrayBuffer = await file.arrayBuffer();
                                                    const result = await (window as any).mammoth.extractRawText({ arrayBuffer });
                                                    const lines = result.value.split('\n').filter((line: string) => line.trim().length > 0);
                                                    content = lines.map((line: string, idx: number) => ({ id: `d-${idx}`, text: line.trim() }));
                                                } else {
                                                    alert('Please upload a PDF or DOCX file.');
                                                    return;
                                                }

                                                const { error } = await (supabase as any)
                                                    .from('uploaded_documents')
                                                    .upsert({ filename: file.name, content }, { onConflict: 'filename' });
                                                if (error) {
                                                    alert('Failed to save document: ' + error.message);
                                                } else {
                                                    alert('Document uploaded and saved. Open Standing Orders to read it.');
                                                }
                                            } catch (err: any) {
                                                console.error(err);
                                                alert('Error uploading document.');
                                            }
                                        }} />
                                    </label>
                                    <button 
                                        onClick={() => { (window as any).location.hash = '#/standing-orders'; }}
                                        className="px-4 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium transition-colors"
                                    >
                                        Open Standing Orders
                                    </button>
                                </div>
                        </div>
            <div className="bg-orange-50 border border-orange-100 rounded-lg p-6">
                <h3 className="text-lg font-bold text-orange-900 mb-2">Import Songs Database</h3>
                <p className="text-orange-800 mb-6 text-base">
                    Upload the <code className="bg-white px-1 py-0.5 rounded border border-orange-200">methodist_songs_flat.json</code> file here to populate the Hymnal section. 
                </p>

                {importResult && (
                    <div className="mb-6 p-4 bg-white rounded-lg border border-green-200 flex items-center gap-4 animate-fade-in shadow-sm">
                        <div className="p-2 bg-green-100 rounded-full">
                            <CheckCircle2 className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <h4 className="font-bold text-green-800 text-lg">Import Successful!</h4>
                            <p className="text-green-700">
                                {importResult.success} songs uploaded successfully. 
                                {importResult.failed > 0 && <span className="text-red-600 ml-1">({importResult.failed} failed)</span>}
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-4">
                    {!importing && !selectedFile && (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <label className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 shadow-sm font-medium transition-colors">
                                <Upload className="w-5 h-5 text-gray-600"/>
                                <span>Select JSON File...</span>
                                <input type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
                            </label>
                            
                            <button onClick={clearSongs} className="flex items-center gap-2 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100">
                                <Trash2 className="w-5 h-5"/> Clear All Songs
                            </button>
                        </div>
                    )}

                    {!importing && selectedFile && (
                        <div className="bg-white p-4 rounded-lg border border-blue-200 animate-fade-in">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <FileText className="w-8 h-8 text-blue-500"/>
                                    <div>
                                        <p className="font-bold text-gray-800">{selectedFile.name}</p>
                                        <p className="text-sm text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedFile(null)} className="text-gray-400 hover:text-red-500">
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex gap-3">
                                <button 
                                    type="button"
                                    onClick={startImport}
                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
                                >
                                    <Play className="w-5 h-5 fill-white"/> Start Import
                                </button>
                                <button 
                                    onClick={() => setSelectedFile(null)}
                                    className="px-6 py-3 bg-white text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {importing && (
                        <div className="space-y-3 bg-white p-4 rounded-lg border border-orange-200">
                            <div className="flex items-center justify-between text-orange-800 font-medium">
                                <div className="flex items-center gap-3">
                                    <Loader2 className="w-5 h-5 animate-spin"/>
                                    {importStatusText}
                                </div>
                                <span>{Math.round((importProgress.current / (importProgress.total || 1)) * 100)}%</span>
                            </div>
                            <div className="w-full bg-orange-100 rounded-full h-2.5">
                                <div 
                                    className="bg-orange-600 h-2.5 rounded-full transition-all duration-300" 
                                    style={{ width: `${(importProgress.current / (importProgress.total || 1)) * 100}%` }}
                                ></div>
                            </div>
                            <p className="text-xs text-orange-600 text-right">
                                Processed {importProgress.current} of {importProgress.total} items
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

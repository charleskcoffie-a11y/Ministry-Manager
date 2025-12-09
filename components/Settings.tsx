
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Settings as SettingsIcon, CheckCircle2, XCircle, Loader2, Database, ShieldAlert, Upload, FileJson, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';

const Settings: React.FC = () => {
  // Connection Test State
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // Import State
  const [importing, setImporting] = useState(false);
  const [importStatusText, setImportStatusText] = useState(''); 
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);

  // --- Connection Test Logic ---
  const testConnection = async () => {
    setStatus('loading');
    setMessage('');
    
    try {
      // 1. Check basic connection by counting rows in a known table
      const { count, error } = await supabase
        .from('church_programs')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;
      
      // 2. Check for Songs table specifically since it is new
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
      // Provide helpful context based on common errors
      if (err.message?.includes('fetch')) {
        setMessage("Network Error: Could not reach Supabase. Check internet connection or URL.");
      } else if (err.code === 'PGRST301') {
        setMessage("Permission Error: RLS policies might be blocking access, but DB is reached.");
      } else if (err.code === '42P01') {
         // This code means relation does not exist
         const missingTable = err.message.includes('songs') ? 'songs' : 'church_programs';
         setMessage(`Table Error: '${missingTable}' table not found. Run the SQL script in README.`);
      } else {
        setMessage(`Error: ${err.message || 'Unknown connection error'}`);
      }
    }
  };

  // --- Song Import Logic ---
  const handleSongImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset previous results
    setImportResult(null);
    setImportStatusText('Initializing import...');

    if (!confirm(`Are you sure you want to import "${file.name}"? This will add or update songs.`)) {
        e.target.value = '';
        return;
    }

    setImporting(true);
    setImportProgress({ current: 0, total: 0 });
    setImportStatusText('Reading file...');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        setImportStatusText('Parsing JSON...');
        
        let json;
        try {
            json = JSON.parse(text);
        } catch (e) {
            setImportStatusText('Error: Invalid JSON file');
            alert("Invalid JSON file.");
            setImporting(false);
            return;
        }

        if (!Array.isArray(json)) {
            setImportStatusText('Error: JSON is not an array');
            alert("JSON must be an array of song objects.");
            setImporting(false);
            return;
        }

        const total = json.length;
        setImportProgress({ current: 0, total });
        setImportStatusText(`Found ${total} songs. Starting upload...`);

        // Batch insert to prevent timeouts
        const BATCH_SIZE = 50;
        let successCount = 0;
        let errorCount = 0;
        const totalBatches = Math.ceil(total / BATCH_SIZE);

        for (let i = 0; i < total; i += BATCH_SIZE) {
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            setImportStatusText(`Uploading batch ${batchNum} of ${totalBatches}...`);

            const batch = json.slice(i, i + BATCH_SIZE).map((s: any) => ({
                id: s.id, // Ensure ID is mapped if present
                collection: s.collection,
                code: s.code,
                number: s.number,
                title: s.title,
                raw_title: s.raw_title || null,
                lyrics: s.lyrics,
                author: s.author || null,
                copyright: s.copyright || null,
                tags: s.tags || null,
                reference_number: s.reference_number || null
            }));

            const { error } = await supabase.from('songs').upsert(batch);
            
            if (error) {
                console.error('Batch import error:', error);
                errorCount += batch.length;
                setImportStatusText(`Batch ${batchNum} failed. Retrying next...`);
            } else {
                successCount += batch.length;
            }
            
            setImportProgress(prev => ({ ...prev, current: Math.min(i + BATCH_SIZE, total) }));
        }

        setImportResult({ success: successCount, failed: errorCount });
        setImportStatusText('Import complete!');

      } catch (err: any) {
        setImportStatusText('Critical Error: ' + err.message);
        alert('Error parsing or uploading: ' + err.message);
      } finally {
        setImporting(false);
        e.target.value = ''; // Reset input
      }
    };
    
    reader.onerror = () => {
        setImportStatusText('Failed to read file.');
        setImporting(false);
        e.target.value = '';
    };
    
    reader.readAsText(file);
  };

  const clearSongs = async () => {
      if(!confirm("DANGER: This will delete ALL songs from the database. Are you sure?")) return;
      
      setImporting(true);
      setImportStatusText('Clearing database...');
      
      const { error } = await supabase.from('songs').delete().neq('id', 0); // Delete all where ID is not 0 (all)
      
      if (error) {
          alert("Error clearing table: " + error.message);
          setImportStatusText('Error clearing table');
      } else {
          setImportStatusText('Database cleared.');
          setImportResult(null); // Clear previous results
      }
      
      setImporting(false);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-4 bg-white rounded-lg shadow-sm">
            <SettingsIcon className="w-8 h-8 text-gray-700" />
        </div>
        <div>
            <h1 className="text-4xl font-bold text-gray-800">System Settings</h1>
            <p className="text-lg text-gray-500">Manage application configuration and connections</p>
        </div>
      </div>

      {/* 1. Database Connection Panel */}
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
            
            <div className="text-base text-gray-500 mt-4 flex items-start gap-3 bg-blue-50 p-4 rounded text-blue-800">
                <div className="mt-1">ℹ️</div>
                <p>
                    This test attempts to connect to the <code>church_programs</code> and <code>songs</code> tables. 
                    If it fails, ensure you have run the setup SQL scripts in your Supabase dashboard and that your internet connection is active.
                </p>
            </div>
        </div>
      </div>

      {/* 2. Data Management Panel */}
      <div className="bg-white rounded-lg shadow-md p-8 border border-gray-100">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-3 border-b pb-4">
          <FileJson className="w-6 h-6 text-orange-600" />
          Data Management
        </h2>

        <div className="space-y-6">
            <div className="bg-orange-50 border border-orange-100 rounded-lg p-6">
                <h3 className="text-lg font-bold text-orange-900 mb-2">Import Songs Database</h3>
                <p className="text-orange-800 mb-4 text-base">
                    Upload the <code className="bg-white px-1 py-0.5 rounded border border-orange-200">methodist_songs_flat.json</code> file here to populate the Hymnal section. 
                </p>

                {/* Import Result Feedback */}
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
                    {!importing ? (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <label className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 shadow-sm font-medium transition-colors">
                                <Upload className="w-5 h-5 text-gray-600"/>
                                <span>Select JSON File...</span>
                                <input type="file" accept=".json" onChange={handleSongImport} className="hidden" />
                            </label>
                            
                            <button onClick={clearSongs} className="flex items-center gap-2 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100">
                                <Trash2 className="w-5 h-5"/> Clear All Songs
                            </button>
                        </div>
                    ) : (
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
            
            <div className="flex items-start gap-3 text-gray-500 text-sm">
                <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                <p>
                    <strong>Note:</strong> This process uploads data in batches of 50. Do not close the window until the success message appears.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

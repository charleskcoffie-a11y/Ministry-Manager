
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { APP_CONSTANTS } from '../constants';
import { 
  Settings as SettingsIcon, CheckCircle2, XCircle, Loader2, Database, 
  ShieldAlert, Upload, FileJson, Trash2, AlertTriangle, Play, FileText, 
  Lock, KeyRound, Save, Sparkles, Book, Copy, Check
} from 'lucide-react';
import Modal from './Modal';
import { useModal } from '../hooks/useModal';
import { getAiFeatureStatus } from '../services/geminiService';
import { isDocxDocument, isPdfDocument, parseDocxFile, parsePdfFile } from '../utils/documentParsers';

type ConstitutionStatus = {
  exists: boolean;
  filename: string;
  updatedAt: string | null;
};

const Settings: React.FC = () => {
  const { modalState, showAlert, showConfirm, closeModal } = useModal();
  
  // Connection Test State
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  // Import State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importStatusText, setImportStatusText] = useState(''); 
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const [constitutionStatusLoading, setConstitutionStatusLoading] = useState(false);
  const [mainConstitutionStatus, setMainConstitutionStatus] = useState<ConstitutionStatus>({
    exists: false,
    filename: '',
    updatedAt: null,
  });
  const [draftConstitutionStatus, setDraftConstitutionStatus] = useState<ConstitutionStatus>({
    exists: false,
    filename: '',
    updatedAt: null,
  });

  // Security / PIN State
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMessage, setPinMessage] = useState({ text: '', type: '' });
  const [oldCounselingCode, setOldCounselingCode] = useState('');
  const [newCounselingCode, setNewCounselingCode] = useState('');
  const [confirmCounselingCode, setConfirmCounselingCode] = useState('');
  const [counselingCodeMessage, setCounselingCodeMessage] = useState({ text: '', type: '' });
  const [oldSettingsLockPin, setOldSettingsLockPin] = useState('');
  const [newSettingsLockPin, setNewSettingsLockPin] = useState('');
  const [confirmSettingsLockPin, setConfirmSettingsLockPin] = useState('');
  const [settingsLockPinMessage, setSettingsLockPinMessage] = useState({ text: '', type: '' });
  const [currentCounselingCode, setCurrentCounselingCode] = useState(
    () => localStorage.getItem(APP_CONSTANTS.COUNSELING_MASTER_CODE_STORAGE_KEY) || APP_CONSTANTS.COUNSELING_MASTER_CODE
  );

  // Verse Settings
  const [verseSource, setVerseSource] = useState('plan');
  const [sqlCopied, setSqlCopied] = useState(false);

  // Settings Access Lock
  const [settingsUnlocked, setSettingsUnlocked] = useState(false);
  const [settingsAccessPin, setSettingsAccessPin] = useState('');
  const [settingsAccessError, setSettingsAccessError] = useState('');

  const DIARY_SQL = `CREATE TABLE IF NOT EXISTS public.diary_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date      DATE NOT NULL,
  title           TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'Personal Reflection',
  spiritual_tone  TEXT NOT NULL DEFAULT 'Peaceful',
  body            TEXT NOT NULL,
  scripture_ref   TEXT,
  prayer_response TEXT,
  is_private      BOOLEAN NOT NULL DEFAULT FALSE,
  remind_on       DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diary_remind_on
  ON public.diary_entries (remind_on);

CREATE INDEX IF NOT EXISTS idx_diary_entry_date
  ON public.diary_entries (entry_date DESC);

ALTER TABLE public.diary_entries ENABLE ROW LEVEL SECURITY;

-- If NOT using Supabase Auth, use this open policy:
CREATE POLICY "Allow all"
  ON public.diary_entries
  FOR ALL USING (true);

-- If using Supabase Auth, replace policy above with:
-- CREATE POLICY "Allow authenticated"
--   ON public.diary_entries
--   FOR ALL USING (auth.role() = 'authenticated');`;

  const handleCopySQL = () => {
    navigator.clipboard.writeText(DIARY_SQL).then(() => {
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 2500);
    });
  };

  const normalizeCounselingCode = (value: unknown): string | null => {
    if (typeof value === 'string' && /^\d{4,6}$/.test(value)) return value;

    if (value && typeof value === 'object') {
      const maybeCode = (value as { code?: unknown }).code;
      if (typeof maybeCode === 'string' && /^\d{4,6}$/.test(maybeCode)) {
        return maybeCode;
      }
    }

    return null;
  };

  const getCurrentLoginPin = () => localStorage.getItem('ministryAppPIN') || APP_CONSTANTS.DEFAULT_PIN;
  const getCurrentSettingsLockPin = () => localStorage.getItem(APP_CONSTANTS.SETTINGS_LOCK_PIN_STORAGE_KEY) || getCurrentLoginPin();

  const handleUnlockSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const currentSettingsLockPin = getCurrentSettingsLockPin();

    if (settingsAccessPin.trim() === currentSettingsLockPin) {
      setSettingsUnlocked(true);
      setSettingsAccessError('');
      setSettingsAccessPin('');
      return;
    }

    setSettingsAccessError('Incorrect settings lock password');
    setSettingsAccessPin('');
  };

  const lockSettingsPage = () => {
    setSettingsUnlocked(false);
    setSettingsAccessPin('');
    setSettingsAccessError('');
  };

  useEffect(() => {
      setVerseSource(localStorage.getItem('dailyVerseSource') || (getAiFeatureStatus().available ? 'ai' : 'plan'));
  }, []);

  useEffect(() => {
      if (!settingsUnlocked) return;
      checkConnection();
      loadCounselingCode();
      void loadConstitutionStatuses();
  }, [settingsUnlocked]);

    const aiStatus = getAiFeatureStatus();

  const checkConnection = async () => {
    try {
      const { error } = await supabase
        .from('church_programs')
        .select('id')
        .limit(1);
      
      setConnectionStatus(error ? 'disconnected' : 'connected');
    } catch {
      setConnectionStatus('disconnected');
    }
  };

  const loadCounselingCode = async () => {
    try {
      const { data, error } = await supabase
        .from('uploaded_documents')
        .select('content')
        .eq('id', APP_CONSTANTS.COUNSELING_MASTER_CODE_DOC_ID)
        .single();

      if (error && (error as any).code !== 'PGRST116') {
        console.error('Failed to load counseling code from database:', error);
        return;
      }

      const syncedCode = normalizeCounselingCode(data?.content);
      if (!syncedCode) return;

      localStorage.setItem(APP_CONSTANTS.COUNSELING_MASTER_CODE_STORAGE_KEY, syncedCode);
      setCurrentCounselingCode(syncedCode);
    } catch (error) {
      console.error('Unexpected error loading counseling code:', error);
    }
  };

  const loadConstitutionStatuses = async () => {
    setConstitutionStatusLoading(true);
    try {
      const { data, error } = await supabase
        .from('uploaded_documents')
        .select('id,filename,updated_at,content')
        .in('id', ['standing_orders', 'standing_orders_draft']);

      if (error) {
        console.error('Failed to load constitution statuses:', error);
        return;
      }

      const findStatus = (id: 'standing_orders' | 'standing_orders_draft'): ConstitutionStatus => {
        const row = data?.find((item: any) => item.id === id);
        const hasContent = Array.isArray(row?.content) && row.content.length > 0;
        return {
          exists: Boolean(row) && hasContent,
          filename: row?.filename || '',
          updatedAt: row?.updated_at || null,
        };
      };

      setMainConstitutionStatus(findStatus('standing_orders'));
      setDraftConstitutionStatus(findStatus('standing_orders_draft'));
    } catch (err) {
      console.error('Unexpected error loading constitution statuses:', err);
    } finally {
      setConstitutionStatusLoading(false);
    }
  };

  const uploadConstitutionDocument = async (
    file: File,
    targetId: 'standing_orders' | 'standing_orders_draft'
  ) => {
    let content: any[] = [];
    if (isPdfDocument(file)) {
      content = await parsePdfFile(file);
    } else if (isDocxDocument(file)) {
      content = await parseDocxFile(file);
    } else {
      throw new Error('Please upload a PDF or DOCX file.');
    }

    if (!Array.isArray(content) || content.length === 0) {
      throw new Error(
        'No extractable text was found in this file. Try a text-based PDF/DOCX (not scanned image-only PDF).'
      );
    }

    const { error } = await (supabase as any)
      .from('uploaded_documents')
      .upsert(
        {
          id: targetId,
          filename: file.name,
          content,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    if (error) throw error;
    await loadConstitutionStatuses();
  };

  const handleVerseSourceChange = (val: string) => {
      if (val === 'ai' && !getAiFeatureStatus().available) {
        return;
      }

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
              showAlert("Please select a valid .json file", "error", "Invalid File");
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
        showAlert("No file selected.", "warning", "No File");
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
        showAlert('Import failed: ' + err.message, 'error', 'Import Error');
    } finally {
        setImporting(false);
    }
  };

  const clearSongs = async () => {
      await showConfirm(
        "This will delete ALL songs from the database. This action cannot be undone.",
        async () => {
      setImporting(true);
      setImportStatusText('Clearing database...');
      const { error } = await supabase.from('songs').delete().neq('id', 0);
      if (error) {
          showAlert("Error clearing table: " + error.message, 'error', 'Database Error');
          setImportStatusText('Error clearing table');
      } else {
          showAlert('Database cleared successfully.', 'success');
          setImportStatusText('Database cleared.');
          setImportResult(null); 
      }
      setImporting(false);
        },
        "⚠️ Danger: Clear All Songs"
      );
  };

  // --- PIN Change Logic ---
  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    setPinMessage({ text: '', type: '' });

    const storedPin = getCurrentLoginPin();

    if (oldPin !== storedPin) {
      setPinMessage({ text: 'Incorrect current login password', type: 'error' });
      return;
    }

    if (newPin.length < 4 || newPin.length > 6) {
      setPinMessage({ text: 'New login password must be 4-6 digits', type: 'error' });
      return;
    }

    if (newPin !== confirmPin) {
      setPinMessage({ text: 'New login passwords do not match', type: 'error' });
      return;
    }

    localStorage.setItem('ministryAppPIN', newPin);
    setPinMessage({ text: 'Login password updated successfully!', type: 'success' });
    setOldPin('');
    setNewPin('');
    setConfirmPin('');
  };

  const handleChangeCounselingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCounselingCodeMessage({ text: '', type: '' });

    const storedCounselingCode = currentCounselingCode;

    if (oldCounselingCode !== storedCounselingCode) {
      setCounselingCodeMessage({ text: 'Incorrect current counseling code', type: 'error' });
      return;
    }

    if (!/^\d{4,6}$/.test(newCounselingCode)) {
      setCounselingCodeMessage({ text: 'New code must be 4-6 digits', type: 'error' });
      return;
    }

    if (newCounselingCode !== confirmCounselingCode) {
      setCounselingCodeMessage({ text: 'New codes do not match', type: 'error' });
      return;
    }

    localStorage.setItem(APP_CONSTANTS.COUNSELING_MASTER_CODE_STORAGE_KEY, newCounselingCode);
    setCurrentCounselingCode(newCounselingCode);

    const { error } = await supabase
      .from('uploaded_documents')
      .upsert(
        {
          id: APP_CONSTANTS.COUNSELING_MASTER_CODE_DOC_ID,
          filename: 'counseling_master_code.json',
          content: { code: newCounselingCode },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    if (error) {
      console.error('Failed to sync counseling code to database:', error);
      setCounselingCodeMessage({ text: 'Code updated locally. Database sync failed.', type: 'error' });
    } else {
      setCounselingCodeMessage({ text: 'Counseling code updated and synced!', type: 'success' });
    }

    setOldCounselingCode('');
    setNewCounselingCode('');
    setConfirmCounselingCode('');
  };

  const handleChangeSettingsLockPin = (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsLockPinMessage({ text: '', type: '' });

    const storedSettingsLockPin = getCurrentSettingsLockPin();

    if (oldSettingsLockPin !== storedSettingsLockPin) {
      setSettingsLockPinMessage({ text: 'Incorrect current settings lock password', type: 'error' });
      return;
    }

    if (newSettingsLockPin.length < 4 || newSettingsLockPin.length > 6) {
      setSettingsLockPinMessage({ text: 'New settings lock password must be 4-6 digits', type: 'error' });
      return;
    }

    if (newSettingsLockPin !== confirmSettingsLockPin) {
      setSettingsLockPinMessage({ text: 'New settings lock passwords do not match', type: 'error' });
      return;
    }

    localStorage.setItem(APP_CONSTANTS.SETTINGS_LOCK_PIN_STORAGE_KEY, newSettingsLockPin);
    setSettingsLockPinMessage({ text: 'Settings lock password updated successfully!', type: 'success' });
    setOldSettingsLockPin('');
    setNewSettingsLockPin('');
    setConfirmSettingsLockPin('');
  };

  const handleResetSettingsLockPinToLogin = () => {
    localStorage.removeItem(APP_CONSTANTS.SETTINGS_LOCK_PIN_STORAGE_KEY);
    setSettingsLockPinMessage({ text: 'Settings lock password reset to login password.', type: 'success' });
    setOldSettingsLockPin('');
    setNewSettingsLockPin('');
    setConfirmSettingsLockPin('');
  };

  if (!settingsUnlocked) {
    return (
      <div className="max-w-xl mx-auto py-10 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
          <div className="bg-slate-900 text-white px-8 py-6">
            <div className="flex items-center gap-3">
              <Lock className="w-6 h-6 text-amber-300" />
              <div>
                <h2 className="text-2xl font-bold">Settings Protected</h2>
                <p className="text-slate-300 text-sm">Enter your login password to access system settings.</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            <form onSubmit={handleUnlockSettings} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Settings Lock Password</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="Enter settings lock password"
                    className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-400 outline-none"
                    value={settingsAccessPin}
                    onChange={(e) => setSettingsAccessPin(e.target.value)}
                    maxLength={6}
                    autoFocus
                  />
                </div>
              </div>

              {settingsAccessError && (
                <div className="text-sm font-medium text-red-700 bg-red-50 border border-red-100 px-4 py-2 rounded-lg">
                  {settingsAccessError}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-slate-800 text-white rounded-lg hover:bg-black font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" /> Unlock Settings
              </button>
            </form>

            <p className="text-xs text-slate-500 mt-4 text-center">
              If not customized, this defaults to your app login password.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-white rounded-lg shadow-sm">
              <SettingsIcon className="w-8 h-8 text-gray-700" />
          </div>
          <div>
              <h1 className="text-4xl font-bold text-gray-800">System Settings</h1>
              <p className="text-lg text-gray-500">Manage application configuration and security</p>
          </div>
        </div>

        <button
          onClick={lockSettingsPage}
          className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium shadow-sm transition-colors flex items-center gap-2"
        >
          <Lock className="w-4 h-4" /> Lock Settings
        </button>
      </div>

      {/* Connection Status Banner */}
      <div className={`rounded-lg p-4 flex items-center gap-3 ${
        connectionStatus === 'checking' ? 'bg-gray-50 border border-gray-200' :
        connectionStatus === 'connected' ? 'bg-green-50 border border-green-200' :
        'bg-red-50 border border-red-200'
      }`}>
        {connectionStatus === 'checking' && (
          <>
            <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
            <span className="text-sm font-medium text-gray-700">Checking Supabase connection...</span>
          </>
        )}
        {connectionStatus === 'connected' && (
          <>
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-800">Connected to Supabase</span>
          </>
        )}
        {connectionStatus === 'disconnected' && (
          <>
            <XCircle className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium text-red-800">Not connected to Supabase - Check connection below</span>
          </>
        )}
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
                  disabled={!aiStatus.available}
                    className={`flex-1 p-4 rounded-xl border-2 transition-all text-left flex items-start gap-3 ${
                        verseSource === 'ai' 
                        ? 'border-purple-600 bg-purple-50 text-purple-900' 
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                  } ${!aiStatus.available ? 'cursor-not-allowed opacity-60 hover:border-slate-200' : ''}`}
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

              {!aiStatus.available && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{aiStatus.message}</span>
                </div>
              )}
        </div>
      </div>

      {/* 2. Security Settings */}
      <div className="bg-white rounded-lg shadow-md p-8 border border-gray-100">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-3 border-b pb-4">
          <Lock className="w-6 h-6 text-slate-800" />
          Security
        </h2>
        
           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
           <div className="bg-slate-50 p-6 rounded-lg border border-slate-100">
              <h3 className="font-bold text-slate-700 mb-2">Login Password (App Lock)</h3>
              <p className="text-sm text-slate-500 mb-4">
                Change the login password used to unlock the app at startup.
                Default login password is <strong>{APP_CONSTANTS.DEFAULT_PIN}</strong>.
              </p>
              
              <form onSubmit={handleChangePin} className="space-y-4">
                 <div>
                    <input 
                      type="password" 
                      placeholder="Current login password" 
                      className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-slate-400 outline-none"
                      value={oldPin}
                      onChange={e => setOldPin(e.target.value)}
                      maxLength={6}
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <input 
                      type="password" 
                      placeholder="New password" 
                      className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-slate-400 outline-none"
                      value={newPin}
                      onChange={e => setNewPin(e.target.value)}
                      maxLength={6}
                    />
                    <input 
                      type="password" 
                      placeholder="Confirm password" 
                      className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-slate-400 outline-none"
                      value={confirmPin}
                      onChange={e => setConfirmPin(e.target.value)}
                      maxLength={6}
                    />
                 </div>
                 
                 <button type="submit" className="w-full py-2.5 bg-slate-800 text-white rounded-lg hover:bg-black font-medium transition-colors flex items-center justify-center gap-2">
                    <Save className="w-4 h-4" /> Update Login Password
                 </button>

                 {pinMessage.text && (
                   <div className={`text-sm text-center font-medium py-2 rounded ${pinMessage.type === 'success' ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
                     {pinMessage.text}
                   </div>
                 )}
              </form>
           </div>

              <div className="bg-slate-50 p-6 rounded-lg border border-slate-100">
                <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                 <Lock className="w-4 h-4" /> Settings Lock Password
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                 Set a separate password for unlocking this Settings page.
                </p>

                <form onSubmit={handleChangeSettingsLockPin} className="space-y-4">
                  <div>
                    <input
                     type="password"
                     placeholder="Current settings password"
                     className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-slate-400 outline-none"
                     value={oldSettingsLockPin}
                     onChange={e => setOldSettingsLockPin(e.target.value)}
                     maxLength={6}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                     type="password"
                     placeholder="New password"
                     className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-slate-400 outline-none"
                     value={newSettingsLockPin}
                     onChange={e => setNewSettingsLockPin(e.target.value)}
                     maxLength={6}
                    />
                    <input
                     type="password"
                     placeholder="Confirm"
                     className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-slate-400 outline-none"
                     value={confirmSettingsLockPin}
                     onChange={e => setConfirmSettingsLockPin(e.target.value)}
                     maxLength={6}
                    />
                  </div>

                  <button type="submit" className="w-full py-2.5 bg-slate-800 text-white rounded-lg hover:bg-black font-medium transition-colors flex items-center justify-center gap-2">
                    <Save className="w-4 h-4" /> Update Settings Password
                  </button>

                  <button
                    type="button"
                    onClick={handleResetSettingsLockPinToLogin}
                    className="w-full py-2.5 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 font-medium transition-colors"
                  >
                    Use Login Password Instead
                  </button>

                  {settingsLockPinMessage.text && (
                   <div className={`text-sm text-center font-medium py-2 rounded ${settingsLockPinMessage.type === 'success' ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
                    {settingsLockPinMessage.text}
                   </div>
                  )}
                </form>
              </div>

           <div className="bg-slate-50 p-6 rounded-lg border border-slate-100">
              <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                <KeyRound className="w-4 h-4" /> Counseling Master Code
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Change the code used to unlock the Counseling page.
                Default code is <strong>{APP_CONSTANTS.COUNSELING_MASTER_CODE}</strong>.
              </p>

              <form onSubmit={handleChangeCounselingCode} className="space-y-4">
                 <div>
                    <input
                      type="password"
                      placeholder="Current code"
                      className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-slate-400 outline-none"
                      value={oldCounselingCode}
                      onChange={e => setOldCounselingCode(e.target.value)}
                      maxLength={6}
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <input
                      type="password"
                      placeholder="New code"
                      className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-slate-400 outline-none"
                      value={newCounselingCode}
                      onChange={e => setNewCounselingCode(e.target.value)}
                      maxLength={6}
                    />
                    <input
                      type="password"
                      placeholder="Confirm"
                      className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-slate-400 outline-none"
                      value={confirmCounselingCode}
                      onChange={e => setConfirmCounselingCode(e.target.value)}
                      maxLength={6}
                    />
                 </div>

                 <button type="submit" className="w-full py-2.5 bg-slate-800 text-white rounded-lg hover:bg-black font-medium transition-colors flex items-center justify-center gap-2">
                    <Save className="w-4 h-4" /> Update Code
                 </button>

                 {counselingCodeMessage.text && (
                   <div className={`text-sm text-center font-medium py-2 rounded ${counselingCodeMessage.type === 'success' ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
                     {counselingCodeMessage.text}
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
                        {/* Constitution Uploads */}
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-6">
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <h3 className="text-lg font-bold text-amber-900">Constitution Documents</h3>
                              {constitutionStatusLoading ? (
                                <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-500">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking status
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Settings-managed uploads
                                </span>
                              )}
                            </div>
                            <p className="text-amber-800 mb-4 text-sm">
                              Upload and manage both Main and Draft constitutions here. Draft is shared with everyone and appears in Standing Orders when saved.
                            </p>

                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="rounded-lg border border-amber-200 bg-white p-4">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-bold text-stone-800">Main Constitution</p>
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${mainConstitutionStatus.exists ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-stone-200 bg-stone-50 text-stone-500'}`}>
                                    {mainConstitutionStatus.exists ? 'Saved' : 'Not saved'}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-stone-500">
                                  {mainConstitutionStatus.exists
                                  ? `${mainConstitutionStatus.filename} • ${new Date(mainConstitutionStatus.updatedAt || '').toLocaleString()}`
                                  : 'No uploaded main constitution yet.'}
                                </p>
                                <label className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 shadow-sm text-sm font-medium transition-colors">
                                  <Upload className="w-4 h-4 text-gray-600"/>
                                  <span>{mainConstitutionStatus.exists ? 'Replace Main' : 'Upload Main'}</span>
                                  <input type="file" accept=".pdf,.docx" className="hidden" onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    try {
                                      await uploadConstitutionDocument(file, 'standing_orders');
                                      showAlert('Main constitution uploaded and saved.', 'success');
                                    } catch (err: any) {
                                      console.error(err);
                                      showAlert(err?.message || 'Error uploading document.', 'error', 'Upload Error');
                                    } finally {
                                      e.target.value = '';
                                    }
                                  }} />
                                </label>
                              </div>

                              <div className="rounded-lg border border-amber-200 bg-white p-4">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-bold text-stone-800">Draft Constitution</p>
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${draftConstitutionStatus.exists ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-stone-200 bg-stone-50 text-stone-500'}`}>
                                    {draftConstitutionStatus.exists ? 'Saved in database' : 'Not saved'}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-stone-500">
                                  {draftConstitutionStatus.exists
                                  ? `${draftConstitutionStatus.filename} • ${new Date(draftConstitutionStatus.updatedAt || '').toLocaleString()}`
                                  : 'No uploaded draft constitution yet.'}
                                </p>
                                <label className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 shadow-sm text-sm font-medium transition-colors">
                                  <Upload className="w-4 h-4 text-gray-600"/>
                                  <span>{draftConstitutionStatus.exists ? 'Replace Draft' : 'Upload Draft'}</span>
                                  <input type="file" accept=".pdf,.docx" className="hidden" onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    try {
                                      await uploadConstitutionDocument(file, 'standing_orders_draft');
                                      showAlert('Draft constitution uploaded and saved.', 'success');
                                    } catch (err: any) {
                                      console.error(err);
                                      showAlert(err?.message || 'Error uploading draft.', 'error', 'Upload Error');
                                    } finally {
                                      e.target.value = '';
                                    }
                                  }} />
                                </label>
                              </div>
                            </div>

                            <button 
                              onClick={() => { (window as any).location.hash = '#/standing-orders'; }}
                              className="mt-4 px-4 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium transition-colors"
                            >
                              Open Standing Orders
                            </button>
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

      {/* 5. Database Setup SQL */}
      <div className="bg-white rounded-lg shadow-md p-8 border border-gray-100">
        <h2 className="text-2xl font-semibold text-gray-800 mb-2 flex items-center gap-3 border-b pb-4">
          <Database className="w-6 h-6 text-teal-600" />
          Database Setup SQL
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          File: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono text-teal-700">sql/diary_entries.sql</code>
          &nbsp;— Run this in <strong>Supabase → SQL Editor → New query</strong> to create the Minister's Diary table.
        </p>
        <div className="relative">
          <pre className="bg-slate-900 text-green-300 text-xs font-mono rounded-xl p-5 overflow-x-auto whitespace-pre leading-relaxed border border-slate-700">
{DIARY_SQL}
          </pre>
          <button
            onClick={handleCopySQL}
            className={`absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              sqlCopied
                ? 'bg-green-500 text-white'
                : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
            }`}
          >
            {sqlCopied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
          </button>
        </div>
      </div>

      <Modal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        onConfirm={modalState.onConfirm}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
      />
    </div>
  );
};

export default Settings;

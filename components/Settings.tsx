import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Settings as SettingsIcon, CheckCircle2, XCircle, Loader2, Database, ShieldAlert } from 'lucide-react';

const Settings: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const testConnection = async () => {
    setStatus('loading');
    setMessage('');
    
    try {
      // 1. Check basic connection by counting rows in a known table
      const { count, error } = await supabase
        .from('church_programs')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;

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
         setMessage("Table Error: 'church_programs' table not found. Run the SQL script.");
      } else {
        setMessage(`Error: ${err.message || 'Unknown connection error'}`);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div className="flex items-center gap-4 mb-10">
        <div className="p-4 bg-white rounded-lg shadow-sm">
            <SettingsIcon className="w-8 h-8 text-gray-700" />
        </div>
        <div>
            <h1 className="text-4xl font-bold text-gray-800">System Settings</h1>
            <p className="text-lg text-gray-500">Manage application configuration and connections</p>
        </div>
      </div>

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
                    This test attempts to connect to the <code>church_programs</code> table. 
                    If it fails, ensure you have run the setup SQL scripts in your Supabase dashboard and that your internet connection is active.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
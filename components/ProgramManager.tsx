
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Program } from '../types';
import Papa from 'papaparse';
import { 
  Plus, Trash2, Edit2, Download, Upload, Calendar, Search, 
  Save, X, Loader2, MapPin, User, Filter, XCircle, 
  LayoutDashboard, Music, Users, BookOpen, Heart, 
  Briefcase, Coffee, Mic2, ChevronDown, CalendarDays
} from 'lucide-react';

const ProgramManager: React.FC = () => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  
  // Filter States
  const [filterActivity, setFilterActivity] = useState('');
  const [filterVenue, setFilterVenue] = useState('');
  const [filterLead, setFilterLead] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [currentProgram, setCurrentProgram] = useState<Partial<Program>>({});

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('church_programs')
      .select('*')
      .order('date', { ascending: true });

    if (!error && data) setPrograms(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!currentProgram.date || !currentProgram.activity_description) return;

    if (currentProgram.id) {
      // Update
      const { error } = await supabase
        .from('church_programs')
        .update(currentProgram)
        .eq('id', currentProgram.id);
      if (!error) fetchPrograms();
    } else {
      // Insert
      const { error } = await supabase
        .from('church_programs')
        .insert([currentProgram]);
      if (!error) fetchPrograms();
    }
    setIsEditing(false);
    setCurrentProgram({});
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure?')) return;
    const { error } = await supabase.from('church_programs').delete().eq('id', id);
    if (!error) fetchPrograms();
  };

  const handleExport = () => {
    const csv = Papa.unparse({
      fields: ["DATE", "ACTIVITIES-DESCRIPTION", "VENUE", "LEAD"],
      data: programs.map(p => ([
        p.date,
        p.activity_description,
        p.venue,
        p.lead
      ]))
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'church_programs.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Improved date parser
  const parseFlexibleDate = (dateStr: string): string | null => {
    if (!dateStr) return null;
    let s = dateStr.toString().trim();
    s = s.replace(/['"]+/g, '');

    if (s.toUpperCase() === 'TBD' || s.toUpperCase() === 'DATE' || s === '') return null;

    if (s.toLowerCase().includes(' to ')) {
       const parts = s.split(/ to /i);
       const firstPart = parts[0].trim();
       const yearMatch = s.match(/\d{4}/);
       const year = yearMatch ? yearMatch[0] : new Date().getFullYear();
       if (!firstPart.includes(year.toString())) {
           s = `${firstPart}, ${year}`;
       } else {
           s = firstPart;
       }
    }

    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    return null;
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);

    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const data = results.data as string[][];
          if (data.length === 0) {
             alert("File appears to be empty.");
             setImporting(false);
             return;
          }

          let headerRowIndex = -1;
          for (let i = 0; i < Math.min(data.length, 25); i++) {
              const rowStr = data[i].map(c => c ? c.toString().replace(/^\ufeff/, '').trim().toUpperCase() : '').join(' ');
              if (rowStr.includes('DATE') && (rowStr.includes('ACTIVITIES') || rowStr.includes('DESCRIPTION'))) {
                  headerRowIndex = i;
                  break;
              }
          }

          if (headerRowIndex === -1) {
              alert("Could not find a valid header row.");
              setImporting(false);
              return;
          }

          const headers = data[headerRowIndex].map(h => h ? h.toString().replace(/^\ufeff/, '').trim().toUpperCase() : '');
          const dateIdx = headers.findIndex(h => h.includes('DATE'));
          const descIdx = headers.findIndex(h => h.includes('ACTIVITIES') || h.includes('DESCRIPTION'));
          const venueIdx = headers.findIndex(h => h.includes('VENUE'));
          const leadIdx = headers.findIndex(h => h.includes('LEAD'));

          if (dateIdx === -1 || descIdx === -1) {
              alert(`Could not identify required columns.`);
              setImporting(false);
              return;
          }

          const toInsert: any[] = [];
          
          for (let i = headerRowIndex + 1; i < data.length; i++) {
              const row = data[i];
              if (!row || row.length <= dateIdx) continue;

              const rawDate = row[dateIdx];
              const rawDesc = row[descIdx];

              if (!rawDate || !rawDesc) continue;
              if (rawDate.toString().toUpperCase().trim() === 'TBD') continue;

              const parsedDate = parseFlexibleDate(rawDate);
              
              if (parsedDate) {
                  const desc = rawDesc ? rawDesc.toString().trim() : '';
                  const venue = (venueIdx > -1 && row[venueIdx]) ? row[venueIdx].toString().trim() : '';
                  const lead = (leadIdx > -1 && row[leadIdx]) ? row[leadIdx].toString().trim() : '';
                  
                  if (desc) {
                    toInsert.push({
                        date: parsedDate,
                        activity_description: desc,
                        venue: venue,
                        lead: lead
                    });
                  }
              }
          }

          if (toInsert.length > 0) {
            const BATCH_SIZE = 50;
            let successCount = 0;
            for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
                const batch = toInsert.slice(i, i + BATCH_SIZE);
                const { error } = await supabase.from('church_programs').insert(batch);
                if (error) break;
                successCount += batch.length;
            }
            alert(`Successfully imported ${successCount} programs.`);
            await fetchPrograms();
          } else {
              alert(`No valid data found to import.`);
          }
        } catch (e: any) {
            console.error("Import Exception:", e);
            alert("Unexpected error during import.");
        } finally {
            setImporting(false);
            e.target.value = '';
        }
      },
      error: (err) => {
          alert("CSV Parsing Error: " + err.message);
          setImporting(false);
      }
    });
  };

  // Helper for Activity Icons
  const getActivityIcon = (text: string) => {
      const lower = text.toLowerCase();
      if (lower.match(/worship|choir|hymn|praise|song/)) return <Music className="w-4 h-4 text-pink-500" />;
      if (lower.match(/meeting|committee|board|council/)) return <Briefcase className="w-4 h-4 text-slate-500" />;
      if (lower.match(/prayer|vigil|fasting/)) return <Heart className="w-4 h-4 text-red-500" />;
      if (lower.match(/bible|study|class|training|seminar/)) return <BookOpen className="w-4 h-4 text-indigo-500" />;
      if (lower.match(/youth|fellowship|teen|children/)) return <Users className="w-4 h-4 text-orange-500" />;
      if (lower.match(/food|lunch|dinner|breakfast/)) return <Coffee className="w-4 h-4 text-amber-600" />;
      if (lower.match(/preach|sermon/)) return <Mic2 className="w-4 h-4 text-purple-600" />;
      return <CalendarDays className="w-4 h-4 text-blue-500" />;
  };

  const uniqueVenues = useMemo(() => {
    return Array.from(new Set(programs.map(p => p.venue).filter(Boolean))).sort();
  }, [programs]);

  const uniqueLeads = useMemo(() => {
    return Array.from(new Set(programs.map(p => p.lead).filter(Boolean))).sort();
  }, [programs]);

  const filteredPrograms = programs.filter(p => {
    const matchActivity = p.activity_description.toLowerCase().includes(filterActivity.toLowerCase());
    const matchVenue = filterVenue ? p.venue === filterVenue : true;
    const matchLead = filterLead ? p.lead === filterLead : true;
    
    // Date Filtering
    const matchStart = filterStartDate ? p.date >= filterStartDate : true;
    const matchEnd = filterEndDate ? p.date <= filterEndDate : true;

    return matchActivity && matchVenue && matchLead && matchStart && matchEnd;
  });

  const clearFilters = () => {
    setFilterActivity('');
    setFilterVenue('');
    setFilterLead('');
    setFilterStartDate('');
    setFilterEndDate('');
  };

  const hasFilters = filterActivity || filterVenue || filterLead || filterStartDate || filterEndDate;

  return (
    <div className="max-w-[1600px] mx-auto pb-20 animate-fade-in space-y-8">
      
      {/* 1. Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-gradient-to-r from-blue-50 via-white to-blue-50 p-8 rounded-3xl border border-blue-100 shadow-sm">
        <div>
            <div className="flex items-center gap-2 mb-2">
                <div className="bg-blue-100 text-blue-700 p-2 rounded-lg">
                    <Calendar className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold text-blue-800 uppercase tracking-widest">Ministry Dashboard</span>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-2">Program Schedule</h1>
            <p className="text-slate-500 text-lg">Church Programs · Events · Ministry Activities</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
           <label className={`flex items-center justify-center gap-2 px-5 py-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full hover:bg-emerald-100 cursor-pointer shadow-sm transition-all font-semibold ${importing ? 'opacity-50' : ''}`}>
             {importing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4" />}
             {importing ? 'Importing' : 'Import CSV'}
             <input type="file" accept=".csv" className="hidden" onChange={handleImport} disabled={importing} />
           </label>
           
           <button onClick={handleExport} className="flex items-center justify-center gap-2 px-5 py-3 bg-white text-slate-600 border border-slate-200 rounded-full hover:bg-slate-50 shadow-sm font-semibold transition-all hover:border-slate-300">
             <Download className="w-4 h-4" /> Export
           </button>
           
           <button onClick={() => { setCurrentProgram({}); setIsEditing(true); }} className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 shadow-md hover:shadow-lg font-semibold transition-all transform hover:-translate-y-0.5">
             <Plus className="w-5 h-5" /> Add Event
           </button>
        </div>
      </div>

      {/* 2. Filters Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Filter className="w-4 h-4" /> Filter Programs
            </h2>
            {hasFilters && (
                <button onClick={clearFilters} className="text-xs font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1 bg-rose-50 px-3 py-1 rounded-full">
                    <XCircle className="w-3 h-3" /> Clear Filters
                </button>
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Search - Full Width on Mobile, 4 Cols on Desktop */}
            <div className="md:col-span-4 relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input 
                    type="text"
                    placeholder="Search activity..." 
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50 focus:bg-white transition-all outline-none text-slate-700"
                    value={filterActivity}
                    onChange={(e) => setFilterActivity(e.target.value)}
                />
            </div>
            
            {/* Date Range */}
            <div className="md:col-span-2 relative group">
                <input 
                    type="date"
                    className="w-full px-3 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50 focus:bg-white text-sm text-slate-700 outline-none"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                />
                {!filterStartDate && <span className="absolute right-3 top-3.5 pointer-events-none text-slate-400 text-xs">From</span>}
            </div>
             <div className="md:col-span-2 relative group">
                <input 
                    type="date"
                    className="w-full px-3 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50 focus:bg-white text-sm text-slate-700 outline-none"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                />
                 {!filterEndDate && <span className="absolute right-3 top-3.5 pointer-events-none text-slate-400 text-xs">To</span>}
            </div>

            {/* Dropdowns */}
            <div className="md:col-span-2 relative">
                <select 
                    className="w-full pl-3 pr-8 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none bg-slate-50 focus:bg-white text-sm outline-none text-slate-700"
                    value={filterVenue}
                    onChange={(e) => setFilterVenue(e.target.value)}
                >
                    <option value="">Venue: All</option>
                    {uniqueVenues.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>

            <div className="md:col-span-2 relative">
                <select 
                    className="w-full pl-3 pr-8 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none bg-slate-50 focus:bg-white text-sm outline-none text-slate-700"
                    value={filterLead}
                    onChange={(e) => setFilterLead(e.target.value)}
                >
                    <option value="">Lead: All</option>
                    {uniqueLeads.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
        </div>
      </div>

      {/* 3. Schedule Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
           <div className="p-12 text-center">
              <Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-500 mb-4"/>
              <p className="text-slate-500">Loading schedule...</p>
           </div>
        ) : filteredPrograms.length === 0 ? (
           <div className="p-16 text-center">
              <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                 <CalendarDays className="w-10 h-10 text-slate-300"/>
              </div>
              <h3 className="text-lg font-bold text-slate-700">No programs found</h3>
              <p className="text-slate-400">Try adjusting your filters or search terms.</p>
           </div>
        ) : (
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/80">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Activity</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Venue</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Lead</th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {filteredPrograms.map((p, index) => (
                            <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-50 text-blue-600 p-2 rounded-lg group-hover:bg-blue-100 transition-colors">
                                            <Calendar className="w-4 h-4" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-700">
                                                {new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </span>
                                            <span className="text-xs text-slate-400 font-medium">
                                                {new Date(p.date).toLocaleDateString(undefined, { weekday: 'short' })}
                                            </span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 opacity-60">
                                            {getActivityIcon(p.activity_description)}
                                        </div>
                                        <span className="text-sm font-medium text-slate-800 leading-snug">
                                            {p.activity_description}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {p.venue ? (
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                            {p.venue}
                                        </div>
                                    ) : (
                                        <span className="text-xs text-slate-400 italic">--</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {p.lead ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                            {p.lead}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-slate-400 italic">--</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => { setCurrentProgram(p); setIsEditing(true); }} 
                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                                            title="Edit"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(p.id)} 
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
      </div>

      {/* Editor Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh] border border-slate-100">
                <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                    <h3 className="text-2xl font-bold text-slate-800">{currentProgram.id ? 'Edit Event' : 'New Ministry Event'}</h3>
                    <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="space-y-5">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Date <span className="text-rose-500">*</span></label>
                        <input type="date" className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-700" 
                            value={currentProgram.date || ''} 
                            onChange={e => setCurrentProgram({...currentProgram, date: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Activity Description <span className="text-rose-500">*</span></label>
                        <textarea rows={3} className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none text-slate-700" 
                            placeholder="e.g. Sunday Service & Communion"
                            value={currentProgram.activity_description || ''} 
                            onChange={e => setCurrentProgram({...currentProgram, activity_description: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Venue</label>
                            <input type="text" className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-700" 
                                placeholder="Main Hall"
                                value={currentProgram.venue || ''} 
                                onChange={e => setCurrentProgram({...currentProgram, venue: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Lead</label>
                            <input type="text" className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-700" 
                                placeholder="Rev. Minister"
                                value={currentProgram.lead || ''} 
                                onChange={e => setCurrentProgram({...currentProgram, lead: e.target.value})} />
                        </div>
                    </div>
                </div>
                
                <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button onClick={() => setIsEditing(false)} className="px-6 py-3 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="px-8 py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-bold flex items-center shadow-md hover:shadow-lg transition-all transform active:scale-95">
                        <Save className="w-4 h-4 mr-2" /> Save Event
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ProgramManager;

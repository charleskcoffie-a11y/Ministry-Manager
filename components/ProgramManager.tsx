import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Program } from '../types';
import Papa from 'papaparse';
import { Plus, Trash2, Edit2, Download, Upload, Calendar, Search, Save, X, Loader2, MapPin, User, Filter, XCircle } from 'lucide-react';

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
    // p.date is YYYY-MM-DD string from DB
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
    <div className="space-y-6 h-full flex flex-col">
      {/* Header Section */}
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800">Program Schedule</h1>
        
        {/* Actions Grid */}
        <div className="grid grid-cols-2 md:flex md:flex-wrap gap-3">
           <label className={`col-span-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 cursor-pointer shadow-sm transition-all text-sm font-medium ${importing ? 'opacity-50' : ''}`}>
             {importing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4" />}
             {importing ? 'Importing' : 'Import CSV'}
             <input type="file" accept=".csv" className="hidden" onChange={handleImport} disabled={importing} />
           </label>
           
           <button onClick={handleExport} className="col-span-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 shadow-sm text-sm font-medium">
             <Download className="w-4 h-4" /> Export
           </button>
           
           <button onClick={() => { setCurrentProgram({}); setIsEditing(true); }} className="col-span-2 md:col-span-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-xl hover:bg-blue-700 shadow-sm text-sm font-medium">
             <Plus className="w-4 h-4" /> Add Event
           </button>
        </div>
      </div>

      {/* Stacked Filters */}
      <div className="space-y-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex justify-between items-center mb-1">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Filter className="w-4 h-4" /> Filters
            </h2>
            {hasFilters && (
                <button onClick={clearFilters} className="text-xs font-medium text-red-500 hover:text-red-700 flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> Clear All
                </button>
            )}
        </div>

        {/* Search Row */}
        <div className="relative w-full">
          <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
          <input 
            type="text"
            placeholder="Search activity..." 
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent bg-gray-50/50 shadow-sm"
            value={filterActivity}
            onChange={(e) => setFilterActivity(e.target.value)}
          />
        </div>
        
        {/* Date Range Row */}
        <div className="grid grid-cols-2 gap-3">
             <div className="relative">
                <span className="absolute left-3 top-[-8px] bg-white px-1 text-xs font-medium text-gray-500 z-10">From Date</span>
                <input 
                    type="date"
                    className="w-full px-3 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent bg-gray-50/50 shadow-sm text-sm text-gray-700"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                />
             </div>
             <div className="relative">
                <span className="absolute left-3 top-[-8px] bg-white px-1 text-xs font-medium text-gray-500 z-10">To Date</span>
                <input 
                    type="date"
                    className="w-full px-3 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent bg-gray-50/50 shadow-sm text-sm text-gray-700"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                />
             </div>
        </div>

        {/* Dropdowns Row */}
        <div className="grid grid-cols-2 gap-3">
            <div className="relative flex-1">
            <select 
                className="w-full pl-3 pr-8 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent appearance-none bg-gray-50/50 shadow-sm text-sm"
                value={filterVenue}
                onChange={(e) => setFilterVenue(e.target.value)}
            >
                <option value="">Venue: All</option>
                {uniqueVenues.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <Filter className="absolute right-3 top-3.5 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative flex-1">
            <select 
                className="w-full pl-3 pr-8 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent appearance-none bg-gray-50/50 shadow-sm text-sm"
                value={filterLead}
                onChange={(e) => setFilterLead(e.target.value)}
            >
                <option value="">Lead: All</option>
                {uniqueLeads.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <Filter className="absolute right-3 top-3.5 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
        </div>
      </div>

      {/* Editor Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-lg overflow-y-auto max-h-[90vh]">
            <h3 className="text-2xl font-bold mb-6 text-gray-800">{currentProgram.id ? 'Edit Program' : 'New Program'}</h3>
            <div className="space-y-4">
                <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Date</label>
                <input type="date" className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-primary" 
                    value={currentProgram.date || ''} 
                    onChange={e => setCurrentProgram({...currentProgram, date: e.target.value})} />
                </div>
                <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Activity Description</label>
                <textarea rows={3} className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-primary" 
                    value={currentProgram.activity_description || ''} 
                    onChange={e => setCurrentProgram({...currentProgram, activity_description: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Venue</label>
                    <input type="text" className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-primary" 
                        value={currentProgram.venue || ''} 
                        onChange={e => setCurrentProgram({...currentProgram, venue: e.target.value})} />
                    </div>
                    <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Lead</label>
                    <input type="text" className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-primary" 
                        value={currentProgram.lead || ''} 
                        onChange={e => setCurrentProgram({...currentProgram, lead: e.target.value})} />
                    </div>
                </div>
            </div>
            <div className="mt-8 flex justify-end gap-3">
                <button onClick={() => setIsEditing(false)} className="px-6 py-3 text-gray-600 hover:bg-gray-100 rounded-xl font-medium">
                Cancel
                </button>
                <button onClick={handleSave} className="px-6 py-3 bg-primary text-white hover:bg-blue-700 rounded-xl font-medium flex items-center">
                <Save className="w-4 h-4 mr-2" /> Save
                </button>
            </div>
            </div>
        </div>
      )}

      {/* Mobile Card List View */}
      <div className="md:hidden space-y-4">
          {filteredPrograms.length === 0 && !loading && (
             <div className="text-center py-10 text-gray-500 bg-white rounded-xl border border-gray-100">
                 No programs found.
             </div>
          )}
          {filteredPrograms.map((p, index) => (
            <div key={p.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-blue-50'} p-5 rounded-2xl shadow-sm border border-gray-100 active:scale-[0.99] transition-transform`}>
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center text-primary font-bold bg-blue-50/50 px-3 py-1 rounded-lg">
                    <Calendar className="w-4 h-4 mr-2" />
                    {new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' })}
                </div>
                {p.lead && <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full font-medium truncate max-w-[100px]">{p.lead}</span>}
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2 leading-tight">{p.activity_description}</h3>
            {p.venue && (
                <div className="flex items-center text-gray-500 text-sm mb-4">
                    <MapPin className="w-4 h-4 mr-1.5 flex-shrink-0" /> {p.venue}
                </div>
            )}
            <div className="flex justify-end gap-3 border-t border-gray-100 pt-3 mt-2">
                <button onClick={() => { setCurrentProgram(p); setIsEditing(true); }} className="flex-1 py-2 text-blue-600 bg-blue-50/50 rounded-lg font-medium text-sm flex items-center justify-center">
                    <Edit2 className="w-4 h-4 mr-1" /> Edit
                </button>
                <button onClick={() => handleDelete(p.id)} className="flex-1 py-2 text-red-600 bg-red-50/50 rounded-lg font-medium text-sm flex items-center justify-center">
                    <Trash2 className="w-4 h-4 mr-1" /> Delete
                </button>
            </div>
            </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 min-h-[500px]">
        <div className="overflow-auto h-full">
          <table className="min-w-full divide-y divide-gray-200 relative">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-500 uppercase tracking-wider">Activity</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-500 uppercase tracking-wider">Venue</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-500 uppercase tracking-wider">Lead</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPrograms.map((p, index) => (
                <tr key={p.id} className={`hover:bg-blue-100 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                      {new Date(p.date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-900">{p.activity_description}</td>
                  <td className="px-6 py-4 text-gray-600">{p.venue}</td>
                  <td className="px-6 py-4 text-gray-600">
                    {p.lead && <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                      {p.lead}
                    </span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => { setCurrentProgram(p); setIsEditing(true); }} className="text-primary hover:text-blue-900 mr-3 p-1.5 hover:bg-blue-100 rounded">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:text-red-900 p-1.5 hover:bg-red-100 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredPrograms.length === 0 && !loading && (
                 <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No programs found matching filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProgramManager;
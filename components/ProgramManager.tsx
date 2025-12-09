import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Program } from '../types';
import Papa from 'papaparse';
import { Plus, Trash2, Edit2, Download, Upload, Calendar, Search, Save, X, Loader2, MapPin, User, Filter } from 'lucide-react';

const ProgramManager: React.FC = () => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  
  // Filter States
  const [filterActivity, setFilterActivity] = useState('');
  const [filterVenue, setFilterVenue] = useState('');
  const [filterLead, setFilterLead] = useState('');

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
    
    // Clean up invisible chars or quotes if PapaParse missed them
    s = s.replace(/['"]+/g, '');

    // Skip TBD or invalid placeholders
    if (s.toUpperCase() === 'TBD' || s.toUpperCase() === 'DATE' || s === '') return null;

    // Handle ranges like "Monday January 5 to Friday January 9, 2026"
    // Strategy: Extract the first date part and append the year if missing
    if (s.toLowerCase().includes(' to ')) {
       const parts = s.split(/ to /i);
       const firstPart = parts[0].trim(); // "Monday January 5"
       
       // Try to find year in the full string
       const yearMatch = s.match(/\d{4}/);
       const year = yearMatch ? yearMatch[0] : new Date().getFullYear();
       
       // If the first part doesn't have the year, add it
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
    
    console.warn("Failed to parse date:", dateStr);
    return null;
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);

    Papa.parse(file, {
      header: false, // Parse as arrays to allow flexible header detection
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const data = results.data as string[][];
          console.log("CSV Raw Rows:", data.length);

          if (data.length === 0) {
             alert("File appears to be empty.");
             setImporting(false);
             return;
          }

          let headerRowIndex = -1;
          
          // 1. Detect Header Row
          // We clean strings to remove BOM (\ufeff) and trim whitespace
          for (let i = 0; i < Math.min(data.length, 25); i++) {
              const rowStr = data[i].map(c => c ? c.toString().replace(/^\ufeff/, '').trim().toUpperCase() : '').join(' ');
              
              // Look for DATE and (ACTIVITIES or DESCRIPTION)
              if (rowStr.includes('DATE') && (rowStr.includes('ACTIVITIES') || rowStr.includes('DESCRIPTION'))) {
                  headerRowIndex = i;
                  console.log("Found header at row:", i);
                  break;
              }
          }

          if (headerRowIndex === -1) {
              alert("Could not find a valid header row. The CSV must have columns named 'DATE' and 'ACTIVITIES-DESCRIPTION' (or similar).");
              setImporting(false);
              return;
          }

          // 2. Map Columns
          const headers = data[headerRowIndex].map(h => h ? h.toString().replace(/^\ufeff/, '').trim().toUpperCase() : '');
          
          // Find indices
          const dateIdx = headers.findIndex(h => h.includes('DATE'));
          const descIdx = headers.findIndex(h => h.includes('ACTIVITIES') || h.includes('DESCRIPTION'));
          const venueIdx = headers.findIndex(h => h.includes('VENUE'));
          const leadIdx = headers.findIndex(h => h.includes('LEAD'));

          console.log("Column Indices:", { dateIdx, descIdx, venueIdx, leadIdx });

          if (dateIdx === -1 || descIdx === -1) {
              alert(`Could not identify required columns. Found headers: ${headers.join(', ')}`);
              setImporting(false);
              return;
          }

          const toInsert: any[] = [];
          let skippedTBD = 0;
          let skippedInvalid = 0;

          // 3. Process Rows
          for (let i = headerRowIndex + 1; i < data.length; i++) {
              const row = data[i];
              // Ensure row has enough columns
              if (!row || row.length <= dateIdx) continue;

              const rawDate = row[dateIdx];
              const rawDesc = row[descIdx];

              if (!rawDate || !rawDesc) continue;

              // Check for TBD
              if (rawDate.toString().toUpperCase().trim() === 'TBD') {
                  skippedTBD++;
                  continue;
              }

              const parsedDate = parseFlexibleDate(rawDate);
              
              if (parsedDate) {
                  // Sanitize inputs
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
              } else {
                  // Only count as invalid if it's not empty/header-like
                  if (rawDate.length > 2) skippedInvalid++;
              }
          }

          console.log(`Prepared ${toInsert.length} rows for insertion.`);

          if (toInsert.length > 0) {
            // Perform Batch Inserts to avoid payload too large errors
            const BATCH_SIZE = 50;
            let successCount = 0;
            let firstError = null;

            for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
                const batch = toInsert.slice(i, i + BATCH_SIZE);
                const { error } = await supabase.from('church_programs').insert(batch);
                
                if (error) {
                    firstError = error;
                    console.error("Batch insert failed:", error);
                    break; // Stop importing on error
                }
                successCount += batch.length;
            }

            if (firstError) {
                // Safely extract error message
                const msg = (firstError as any).message || JSON.stringify(firstError);
                alert(`Import partially failed. Inserted ${successCount} rows before error: ${msg}`);
            } else {
                alert(`Successfully imported ${successCount} programs.\n(Skipped: ${skippedTBD} TBD, ${skippedInvalid} invalid dates)`);
                await fetchPrograms(); // Force refresh
            }
          } else {
              alert(`No valid data found to import.\nChecked ${data.length - headerRowIndex - 1} rows.\nSkipped: ${skippedTBD} TBD, ${skippedInvalid} invalid dates.\nCheck the browser console for details.`);
          }
        } catch (e: any) {
            console.error("Import Exception:", e);
            alert("Unexpected error during import: " + (e.message || e));
        } finally {
            setImporting(false);
            e.target.value = ''; // Reset input
        }
      },
      error: (err) => {
          console.error("PapaParse Error:", err);
          alert("CSV Parsing Error: " + err.message);
          setImporting(false);
      }
    });
  };

  // Extract unique filtering options from current data
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
    return matchActivity && matchVenue && matchLead;
  });

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-4xl font-bold text-gray-800">Program Schedule</h1>
        <div className="flex flex-wrap gap-2">
           <label className={`flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer text-lg shadow-sm transition-all ${importing ? 'opacity-50 cursor-wait' : ''}`}>
             {importing ? <Loader2 className="w-5 h-5 animate-spin"/> : <Upload className="w-5 h-5" />}
             {importing ? 'Importing...' : 'Import CSV'}
             <input type="file" accept=".csv" className="hidden" onChange={handleImport} disabled={importing} />
           </label>
           <button onClick={handleExport} className="flex items-center gap-2 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-lg shadow-sm">
             <Download className="w-5 h-5" /> Export
           </button>
           <button onClick={() => { setCurrentProgram({}); setIsEditing(true); }} className="flex items-center gap-2 px-4 py-3 bg-primary text-white rounded-lg hover:bg-blue-700 text-lg shadow-sm">
             <Plus className="w-5 h-5" /> Add Event
           </button>
        </div>
      </div>

      {/* Advanced Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Activity Search */}
        <div className="relative">
          <Search className="absolute left-4 top-4 h-6 w-6 text-gray-400" />
          <input 
            type="text"
            placeholder="Search activity..." 
            className="w-full pl-12 pr-4 py-3 text-lg border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white shadow-sm"
            value={filterActivity}
            onChange={(e) => setFilterActivity(e.target.value)}
          />
        </div>
        
        {/* Venue Filter */}
        <div className="relative">
           <MapPin className="absolute left-4 top-4 h-6 w-6 text-gray-400" />
           <select 
              className="w-full pl-12 pr-10 py-3 text-lg border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent appearance-none bg-white shadow-sm"
              value={filterVenue}
              onChange={(e) => setFilterVenue(e.target.value)}
           >
              <option value="">All Venues</option>
              {uniqueVenues.map(v => <option key={v} value={v}>{v}</option>)}
           </select>
           {/* Custom arrow if needed, but browser default is usually fine. Could add absolute pointer events none icon right. */}
           <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
             <Filter className="h-5 w-5 text-gray-400" />
           </div>
        </div>

        {/* Lead Filter */}
        <div className="relative">
           <User className="absolute left-4 top-4 h-6 w-6 text-gray-400" />
           <select 
              className="w-full pl-12 pr-10 py-3 text-lg border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent appearance-none bg-white shadow-sm"
              value={filterLead}
              onChange={(e) => setFilterLead(e.target.value)}
           >
              <option value="">All Leads</option>
              {uniqueLeads.map(l => <option key={l} value={l}>{l}</option>)}
           </select>
           <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
             <Filter className="h-5 w-5 text-gray-400" />
           </div>
        </div>
      </div>

      {/* Editor Modal/Inline Form */}
      {isEditing && (
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 animate-fade-in">
          <h3 className="text-2xl font-semibold mb-6">{currentProgram.id ? 'Edit Program' : 'New Program'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-lg font-medium text-gray-700 mb-1">Date</label>
              <input type="date" className="mt-1 w-full border rounded p-3 text-lg" 
                value={currentProgram.date || ''} 
                onChange={e => setCurrentProgram({...currentProgram, date: e.target.value})} />
            </div>
            <div>
              <label className="block text-lg font-medium text-gray-700 mb-1">Lead</label>
              <input type="text" className="mt-1 w-full border rounded p-3 text-lg" 
                value={currentProgram.lead || ''} 
                onChange={e => setCurrentProgram({...currentProgram, lead: e.target.value})} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-lg font-medium text-gray-700 mb-1">Activity Description</label>
              <input type="text" className="mt-1 w-full border rounded p-3 text-lg" 
                value={currentProgram.activity_description || ''} 
                onChange={e => setCurrentProgram({...currentProgram, activity_description: e.target.value})} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-lg font-medium text-gray-700 mb-1">Venue</label>
              <input type="text" className="mt-1 w-full border rounded p-3 text-lg" 
                value={currentProgram.venue || ''} 
                onChange={e => setCurrentProgram({...currentProgram, venue: e.target.value})} />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={() => setIsEditing(false)} className="px-6 py-3 text-lg text-gray-600 hover:bg-gray-100 rounded flex items-center">
              <X className="w-5 h-5 mr-2" /> Cancel
            </button>
            <button onClick={handleSave} className="px-6 py-3 bg-primary text-white hover:bg-blue-700 rounded flex items-center text-lg">
              <Save className="w-5 h-5 mr-2" /> Save
            </button>
          </div>
        </div>
      )}

      {/* Table - Scrollable with sticky header */}
      <div className="bg-white rounded-lg shadow flex flex-col flex-1 overflow-hidden min-h-[500px]">
        <div className="overflow-auto flex-1">
          <table className="min-w-full divide-y divide-gray-200 relative">
            <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-4 text-left text-lg font-bold text-gray-600 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-left text-lg font-bold text-gray-600 uppercase tracking-wider">Activity</th>
                <th className="px-6 py-4 text-left text-lg font-bold text-gray-600 uppercase tracking-wider">Venue</th>
                <th className="px-6 py-4 text-left text-lg font-bold text-gray-600 uppercase tracking-wider">Lead</th>
                <th className="px-6 py-4 text-right text-lg font-bold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPrograms.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-5 whitespace-nowrap text-xl text-gray-900">
                    <div className="flex items-center">
                      <Calendar className="w-5 h-5 text-gray-400 mr-3" />
                      {new Date(p.date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-xl text-gray-900 leading-relaxed">{p.activity_description}</td>
                  <td className="px-6 py-5 text-xl text-gray-600">{p.venue}</td>
                  <td className="px-6 py-5 text-xl text-gray-600">
                    <span className="px-3 py-1 inline-flex text-base leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {p.lead}
                    </span>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap text-right text-lg font-medium">
                    <button onClick={() => { setCurrentProgram(p); setIsEditing(true); }} className="text-primary hover:text-blue-900 mr-4 p-2 rounded hover:bg-blue-50">
                      <Edit2 className="w-6 h-6" />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:text-red-900 p-2 rounded hover:bg-red-50">
                      <Trash2 className="w-6 h-6" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredPrograms.length === 0 && !loading && (
                 <tr><td colSpan={5} className="px-6 py-8 text-center text-xl text-gray-500">No programs found matching filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProgramManager;
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Program, ProgramCSV } from '../types';
import Papa from 'papaparse';
import { Plus, Trash2, Edit2, Download, Upload, Calendar, Search, Save, X } from 'lucide-react';

const ProgramManager: React.FC = () => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
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
    const csv = Papa.unparse(programs.map(p => ({
      Date: p.date,
      "Activities-Description": p.activity_description,
      Venue: p.venue,
      Lead: p.lead
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'church_programs.csv');
    document.body.appendChild(link);
    link.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as ProgramCSV[];
        const toInsert = rows.map(row => ({
          date: row.Date,
          activity_description: row["Activities-Description"],
          venue: row.Venue,
          lead: row.Lead
        }));

        if (toInsert.length > 0) {
          const { error } = await supabase.from('church_programs').insert(toInsert);
          if (error) alert('Error importing CSV: ' + error.message);
          else fetchPrograms();
        }
      }
    });
  };

  const filteredPrograms = programs.filter(p => 
    p.activity_description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.venue.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.lead.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Program Schedule</h1>
        <div className="flex gap-2">
           <label className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer text-sm">
             <Upload className="w-4 h-4" /> Import CSV
             <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
           </label>
           <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm">
             <Download className="w-4 h-4" /> Export
           </button>
           <button onClick={() => { setCurrentProgram({}); setIsEditing(true); }} className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded hover:bg-blue-700 text-sm">
             <Plus className="w-4 h-4" /> Add Event
           </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        <input 
          type="text"
          placeholder="Search programs..." 
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Editor Modal/Inline Form */}
      {isEditing && (
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 animate-fade-in">
          <h3 className="text-lg font-semibold mb-4">{currentProgram.id ? 'Edit Program' : 'New Program'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Date</label>
              <input type="date" className="mt-1 w-full border rounded p-2" 
                value={currentProgram.date || ''} 
                onChange={e => setCurrentProgram({...currentProgram, date: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Lead</label>
              <input type="text" className="mt-1 w-full border rounded p-2" 
                value={currentProgram.lead || ''} 
                onChange={e => setCurrentProgram({...currentProgram, lead: e.target.value})} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Activity Description</label>
              <input type="text" className="mt-1 w-full border rounded p-2" 
                value={currentProgram.activity_description || ''} 
                onChange={e => setCurrentProgram({...currentProgram, activity_description: e.target.value})} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Venue</label>
              <input type="text" className="mt-1 w-full border rounded p-2" 
                value={currentProgram.venue || ''} 
                onChange={e => setCurrentProgram({...currentProgram, venue: e.target.value})} />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded flex items-center">
              <X className="w-4 h-4 mr-1" /> Cancel
            </button>
            <button onClick={handleSave} className="px-4 py-2 bg-primary text-white hover:bg-blue-700 rounded flex items-center">
              <Save className="w-4 h-4 mr-1" /> Save
            </button>
          </div>
        </div>
      )}

      {/* Table - Mobile Friendly via Stacked layout logic or Overflow */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Venue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPrograms.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                      {new Date(p.date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{p.activity_description}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{p.venue}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {p.lead}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => { setCurrentProgram(p); setIsEditing(true); }} className="text-primary hover:text-blue-900 mr-3">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:text-red-900">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredPrograms.length === 0 && !loading && (
                 <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">No programs found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProgramManager;
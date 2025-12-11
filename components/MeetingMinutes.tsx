
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { MeetingMinutesData, MeetingAgendaItem, MeetingActionItem } from '../types';
import { assistMeetingMinutes } from '../services/geminiService';
import { 
  Save, FileDown, Plus, Trash2, ChevronDown, ChevronUp, 
  Wand2, Loader2, Calendar, Clock, User, Users,
  ClipboardList, CheckSquare, MessageSquare, ArrowRight,
  CheckCircle2, AlertCircle, X, History, RefreshCw, FileText
} from 'lucide-react';

const MeetingMinutes: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeSectionAi, setActiveSectionAi] = useState<string | null>(null);
  
  // History / Load State
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  
  // Notification State
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Helper to generate fresh empty state
  const getEmptyData = (): MeetingMinutesData => ({
    meetingTitle: '',
    meetingDatetime: new Date().toISOString().slice(0, 16),
    facilitator: '',
    attendees: '',
    meetingType: { value: 'Circuit', other: '' },
    opening: { purpose: '', notes: '' },
    agendaItems: [{ number: 1, topic: '', discussionNotes: '' }],
    decisions: '',
    actionItems: [],
    prayerPoints: '',
    closingSummary: { keyTakeaways: '', followUpNeeded: '' },
    nextMeeting: { dateTime: '', agenda: '' },
    // Explicitly undefined id for new records
    id: undefined
  });

  // Form State
  const [data, setData] = useState<MeetingMinutesData>(getEmptyData());

  // Collapsible State
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'details': true,
    'opening': true,
    'agenda': true,
    'decisions': true,
    'actions': true,
    'prayer': true,
    'closing': true,
    'next': true
  });

  useEffect(() => {
    if (showHistory) {
        fetchHistory();
    }
  }, [showHistory]);

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // --- Handlers ---

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    // Auto-hide after 4 seconds
    setTimeout(() => {
        setNotification(null);
    }, 4000);
  };

  const fetchHistory = async () => {
      setLoading(true);
      const { data: list, error } = await supabase
          .from('meeting_minutes')
          .select('id, meeting_title, meeting_datetime, meeting_type')
          .order('meeting_datetime', { ascending: false });
      
      if (list) setHistoryList(list);
      setLoading(false);
  };

  const handleLoad = async (id: string) => {
      setLoading(true);
      const { data: record, error } = await supabase
          .from('meeting_minutes')
          .select('*')
          .eq('id', id)
          .single();
      
      if (record && record.minutes_json) {
          // Merge retrieved JSON with the record ID so updates work correctly
          setData({ ...record.minutes_json, id: record.id });
          setShowHistory(false);
          showNotification("Meeting loaded. You can now edit and save changes.", 'success');
      } else {
          showNotification("Failed to load meeting details.", 'error');
      }
      setLoading(false);
  };

  const handleNew = () => {
      if (confirm("Start a new meeting? Unsaved changes will be lost.")) {
          setData(getEmptyData());
          // Reset sections visibility to default
          setOpenSections({
            'details': true,
            'opening': true,
            'agenda': true,
            'decisions': true,
            'actions': true,
            'prayer': true,
            'closing': true,
            'next': true
          });
          showNotification("Started new meeting draft.", 'success');
      }
  };

  const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm("Are you sure you want to delete this record permanently?")) return;
      
      const { error } = await supabase.from('meeting_minutes').delete().eq('id', id);
      if (!error) {
          setHistoryList(prev => prev.filter(item => item.id !== id));
          if (data.id === id) handleNew(); // Reset if we deleted the currently open doc
      }
  };

  const handleAiAssist = async (section: string, currentText: string, fieldSetter: (val: string) => void) => {
    if (!data.meetingTitle) {
      showNotification("Please enter a meeting title first.", 'error');
      return;
    }
    setActiveSectionAi(section);
    const suggestion = await assistMeetingMinutes(
      data.meetingTitle,
      data.meetingType.value === 'Other' ? data.meetingType.other : data.meetingType.value,
      section,
      currentText
    );
    if (suggestion) {
      fieldSetter(currentText + (currentText ? '\n' : '') + suggestion);
    }
    setActiveSectionAi(null);
  };

  const generateDocHtml = () => {
    return `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${data.meetingTitle}</title>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 12pt; }
          h1 { text-align: center; font-size: 16pt; font-weight: bold; margin-bottom: 20px; text-transform: uppercase; }
          h2 { font-size: 14pt; font-weight: bold; margin-top: 15px; background-color: #f0f0f0; padding: 5px; }
          h3 { font-size: 13pt; font-weight: bold; margin-top: 10px; }
          p { margin-bottom: 10px; }
          ul { margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
          th { background-color: #f9f9f9; font-weight: bold; }
          .meta { margin-bottom: 20px; }
          .meta p { margin: 5px 0; }
        </style>
      </head>
      <body>
        <h1>Meeting Minutes – ${data.meetingTitle}</h1>
        
        <div class="meta">
          <p><strong>Type:</strong> ${data.meetingType.value === 'Other' ? data.meetingType.other : data.meetingType.value}</p>
          <p><strong>Date & Time:</strong> ${new Date(data.meetingDatetime).toLocaleString()}</p>
          <p><strong>Facilitator:</strong> ${data.facilitator}</p>
          <p><strong>Attendees:</strong> ${data.attendees.replace(/\n/g, ', ')}</p>
        </div>

        <h2>1. Opening / Purpose</h2>
        <p><strong>Purpose:</strong> ${data.opening.purpose}</p>
        <p><strong>Notes:</strong><br/>${data.opening.notes.replace(/\n/g, '<br/>')}</p>

        <h2>2. Agenda Items & Discussions</h2>
        ${data.agendaItems.map(item => `
          <h3>${item.number}. ${item.topic}</h3>
          <p>${item.discussionNotes.replace(/\n/g, '<br/>')}</p>
        `).join('')}

        <h2>3. Decisions Made</h2>
        <p>${data.decisions.replace(/\n/g, '<br/>')}</p>

        <h2>4. Action Items</h2>
        <table>
          <thead>
            <tr>
              <th>Task</th>
              <th>Responsible</th>
              <th>Due Date</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${data.actionItems.map(action => `
              <tr>
                <td>${action.task}</td>
                <td>${action.personResponsible}</td>
                <td>${action.dueDate}</td>
                <td>${action.notes}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h2>5. Prayer Points / Spiritual Insights</h2>
        <p>${data.prayerPoints.replace(/\n/g, '<br/>')}</p>

        <h2>6. Closing Summary</h2>
        <p><strong>Key Takeaways:</strong><br/>${data.closingSummary.keyTakeaways.replace(/\n/g, '<br/>')}</p>
        <p><strong>Follow-up Needed:</strong><br/>${data.closingSummary.followUpNeeded.replace(/\n/g, '<br/>')}</p>

        <h2>7. Next Meeting</h2>
        <p><strong>Date:</strong> ${data.nextMeeting.dateTime ? new Date(data.nextMeeting.dateTime).toLocaleString() : 'TBD'}</p>
        <p><strong>Agenda:</strong><br/>${data.nextMeeting.agenda.replace(/\n/g, '<br/>')}</p>
      </body>
      </html>
    `;
  };

  const handleExportWord = () => {
    // Generate HTML content for Word
    const htmlContent = generateDocHtml();
    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Create descriptive filename: Title_Date.doc
    const safeTitle = data.meetingTitle.trim().replace(/[^a-z0-9]/gi, '_') || 'Meeting_Minutes';
    const datePart = data.meetingDatetime.split('T')[0];
    const filename = `${safeTitle}_${datePart}.doc`;

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSave = async () => {
    if (!data.meetingTitle) {
      showNotification("Please enter a meeting title.", 'error');
      return;
    }
    setSaving(true);

    try {
      // 1. Prepare Payload
      const payload: any = {
        meeting_title: data.meetingTitle,
        meeting_datetime: data.meetingDatetime,
        meeting_type: data.meetingType.value,
        meeting_type_other: data.meetingType.other,
        facilitator: data.facilitator,
        attendees: data.attendees,
        minutes_json: data
      };

      if (data.id) {
        payload.id = data.id;
      }

      // 2. Save to Database
      const { data: insertedData, error: dbError } = await supabase
        .from('meeting_minutes')
        .upsert(payload)
        .select()
        .single();

      if (dbError) throw dbError;

      // 3. Update Local State with ID
      if (insertedData) {
        setData(prev => ({ ...prev, id: insertedData.id }));
      }

      // 4. Save Backup Files to Storage (JSON + Word Doc)
      try {
        const safeTitle = data.meetingTitle.trim().replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const datePart = data.meetingDatetime.split('T')[0];
        const baseFilename = `${safeTitle}_${datePart}`;

        // A. Upload JSON Data
        const jsonBlob = new Blob([JSON.stringify({ ...data, id: insertedData?.id }, null, 2)], { type: 'application/json' });
        await supabase.storage
          .from('meeting-minutes-json')
          .upload(`${baseFilename}.json`, jsonBlob, { upsert: true });

        // B. Upload Word Document (So it appears in Supabase Storage)
        const htmlContent = generateDocHtml();
        const docBlob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
        await supabase.storage
          .from('meeting-minutes-json')
          .upload(`${baseFilename}.doc`, docBlob, { upsert: true });

      } catch (storageErr) {
        console.warn("Backup storage failed (non-critical):", storageErr);
      }

      showNotification("Minutes saved successfully!", 'success');

    } catch (err: any) {
      console.error("Save Error:", err);
      showNotification("Failed to save: " + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // --- Render Helpers ---
  
  const AiButton = ({ section, textSetter, currentVal }: { section: string, textSetter: (v:string)=>void, currentVal: string }) => (
    <button 
      onClick={() => handleAiAssist(section, currentVal, textSetter)}
      disabled={!!activeSectionAi}
      className={`ml-2 p-1 rounded-full hover:bg-purple-100 transition-colors ${activeSectionAi === section ? 'text-purple-600 animate-pulse' : 'text-purple-400'}`}
      title="AI Assist"
    >
      {activeSectionAi === section ? <Loader2 className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4"/>}
    </button>
  );

  return (
    <div className="max-w-4xl mx-auto pb-24 animate-fade-in relative">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-800 flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-blue-600" />
            Meeting Minutes
          </h1>
          <p className="text-slate-500 mt-1">Record, organize, and export official ministry minutes.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
           <button onClick={() => setShowHistory(true)} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 font-medium transition-colors border border-slate-200">
              <History className="w-4 h-4" /> History
           </button>
           <button onClick={handleNew} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 font-medium transition-colors border border-slate-200">
              <RefreshCw className="w-4 h-4" /> New
           </button>
           <button onClick={handleExportWord} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium transition-colors border border-slate-200">
              <FileDown className="w-4 h-4" /> Export
           </button>
           <button onClick={handleSave} disabled={saving} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-md transition-colors disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />} Save
           </button>
        </div>
      </div>

      <div className="space-y-4">

        {/* 0. Meeting Type */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Meeting Type</label>
           <div className="flex gap-4 flex-wrap">
              <select 
                className="flex-1 p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
                value={data.meetingType.value}
                onChange={e => setData({...data, meetingType: { ...data.meetingType, value: e.target.value }})}
              >
                <option value="Circuit">Circuit Meeting</option>
                <option value="Society">Society Meeting</option>
                <option value="Diocesan">Diocesan Meeting</option>
                <option value="Other">Other</option>
              </select>
              {data.meetingType.value === 'Other' && (
                <input 
                  type="text" 
                  className="flex-1 p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                  placeholder="Specify type..."
                  value={data.meetingType.other}
                  onChange={e => setData({...data, meetingType: { ...data.meetingType, other: e.target.value }})}
                />
              )}
           </div>
        </div>

        {/* 1. Basic Info */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
           <button onClick={() => toggleSection('details')} className="w-full flex justify-between items-center p-4 bg-slate-50 font-bold text-slate-700 hover:bg-slate-100">
              <span>Meeting Details</span>
              {openSections['details'] ? <ChevronUp className="w-5 h-5"/> : <ChevronDown className="w-5 h-5"/>}
           </button>
           {openSections['details'] && (
             <div className="p-6 space-y-4">
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Meeting Title</label>
                   <input className="w-full p-3 bg-slate-50 border-none rounded-xl text-lg font-bold text-slate-800 focus:ring-2 focus:ring-blue-500" 
                      placeholder="e.g. Quarterly Executive Committee"
                      value={data.meetingTitle} onChange={e => setData({...data, meetingTitle: e.target.value})} 
                   />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                   <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date & Time</label>
                      <input type="datetime-local" className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500" 
                         value={data.meetingDatetime} onChange={e => setData({...data, meetingDatetime: e.target.value})} 
                      />
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Facilitator / Lead</label>
                      <input type="text" className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500" 
                         placeholder="Name of Chair"
                         value={data.facilitator} onChange={e => setData({...data, facilitator: e.target.value})} 
                      />
                   </div>
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Attendees</label>
                   <textarea rows={3} className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500" 
                      placeholder="List names..."
                      value={data.attendees} onChange={e => setData({...data, attendees: e.target.value})} 
                   />
                </div>
             </div>
           )}
        </div>

        {/* 2. Opening */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
           <button onClick={() => toggleSection('opening')} className="w-full flex justify-between items-center p-4 bg-slate-50 font-bold text-slate-700 hover:bg-slate-100">
              <span>1. Opening / Purpose</span>
              {openSections['opening'] ? <ChevronUp className="w-5 h-5"/> : <ChevronDown className="w-5 h-5"/>}
           </button>
           {openSections['opening'] && (
             <div className="p-6 space-y-4">
                <div>
                   <label className="flex items-center text-xs font-bold text-slate-500 uppercase mb-1">
                      Purpose
                      <AiButton section="Opening Purpose" currentVal={data.opening.purpose} textSetter={v => setData({...data, opening: {...data.opening, purpose: v}})} />
                   </label>
                   <textarea rows={2} className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500" 
                      value={data.opening.purpose} onChange={e => setData({...data, opening: {...data.opening, purpose: e.target.value}})} 
                   />
                </div>
                <div>
                   <label className="flex items-center text-xs font-bold text-slate-500 uppercase mb-1">
                      Key Notes / Opening Remarks
                      <AiButton section="Opening Remarks" currentVal={data.opening.notes} textSetter={v => setData({...data, opening: {...data.opening, notes: v}})} />
                   </label>
                   <textarea rows={3} className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500" 
                      placeholder="- Opening prayer by..."
                      value={data.opening.notes} onChange={e => setData({...data, opening: {...data.opening, notes: e.target.value}})} 
                   />
                </div>
             </div>
           )}
        </div>

        {/* 3. Agenda Items */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
           <button onClick={() => toggleSection('agenda')} className="w-full flex justify-between items-center p-4 bg-slate-50 font-bold text-slate-700 hover:bg-slate-100">
              <span>2. Agenda Items & Discussions</span>
              {openSections['agenda'] ? <ChevronUp className="w-5 h-5"/> : <ChevronDown className="w-5 h-5"/>}
           </button>
           {openSections['agenda'] && (
             <div className="p-6 space-y-6">
                {data.agendaItems.map((item, idx) => (
                   <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-100 relative">
                      <div className="flex justify-between items-center mb-2">
                         <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">Item {idx + 1}</span>
                         <button onClick={() => {
                            const newItems = [...data.agendaItems];
                            newItems.splice(idx, 1);
                            setData({...data, agendaItems: newItems});
                         }} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                      </div>
                      <input 
                        className="w-full p-2 mb-3 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-bold text-slate-700" 
                        placeholder="Agenda Topic"
                        value={item.topic}
                        onChange={e => {
                           const newItems = [...data.agendaItems];
                           newItems[idx].topic = e.target.value;
                           setData({...data, agendaItems: newItems});
                        }}
                      />
                      <div className="relative">
                         <textarea 
                            rows={3}
                            className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                            placeholder="Discussion notes..."
                            value={item.discussionNotes}
                            onChange={e => {
                               const newItems = [...data.agendaItems];
                               newItems[idx].discussionNotes = e.target.value;
                               setData({...data, agendaItems: newItems});
                            }}
                         />
                         <div className="absolute right-2 bottom-2">
                            <AiButton section={`Agenda Item: ${item.topic}`} currentVal={item.discussionNotes} textSetter={v => {
                               const newItems = [...data.agendaItems];
                               newItems[idx].discussionNotes = v;
                               setData({...data, agendaItems: newItems});
                            }} />
                         </div>
                      </div>
                   </div>
                ))}
                <button onClick={() => setData({...data, agendaItems: [...data.agendaItems, { number: data.agendaItems.length + 1, topic: '', discussionNotes: '' }]})} 
                   className="w-full py-3 border-2 border-dashed border-slate-200 text-slate-500 rounded-xl hover:border-blue-300 hover:text-blue-600 font-bold flex justify-center items-center gap-2">
                   <Plus className="w-5 h-5"/> Add Agenda Item
                </button>
             </div>
           )}
        </div>

        {/* 4. Decisions */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
           <button onClick={() => toggleSection('decisions')} className="w-full flex justify-between items-center p-4 bg-slate-50 font-bold text-slate-700 hover:bg-slate-100">
              <span>3. Decisions Made</span>
              {openSections['decisions'] ? <ChevronUp className="w-5 h-5"/> : <ChevronDown className="w-5 h-5"/>}
           </button>
           {openSections['decisions'] && (
             <div className="p-6">
                <div className="relative">
                   <textarea rows={4} className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500" 
                      placeholder="- Decision 1..."
                      value={data.decisions} onChange={e => setData({...data, decisions: e.target.value})} 
                   />
                   <div className="absolute right-2 bottom-2">
                      <AiButton section="Decisions Made" currentVal={data.decisions} textSetter={v => setData({...data, decisions: v})} />
                   </div>
                </div>
             </div>
           )}
        </div>

        {/* 5. Action Items */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
           <button onClick={() => toggleSection('actions')} className="w-full flex justify-between items-center p-4 bg-slate-50 font-bold text-slate-700 hover:bg-slate-100">
              <span>4. Action Items</span>
              {openSections['actions'] ? <ChevronUp className="w-5 h-5"/> : <ChevronDown className="w-5 h-5"/>}
           </button>
           {openSections['actions'] && (
             <div className="p-6 space-y-4">
                {data.actionItems.map((action, idx) => (
                   <div key={idx} className="bg-yellow-50/50 p-4 rounded-xl border border-yellow-100 relative grid grid-cols-1 md:grid-cols-2 gap-3">
                      <button onClick={() => {
                            const newItems = [...data.actionItems];
                            newItems.splice(idx, 1);
                            setData({...data, actionItems: newItems});
                         }} className="absolute right-2 top-2 text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                      
                      <div className="md:col-span-2">
                         <label className="text-xs font-bold text-yellow-700 uppercase">Task</label>
                         <input className="w-full p-2 bg-white border border-yellow-200 rounded-lg text-sm" value={action.task} onChange={e => {
                            const newItems = [...data.actionItems];
                            newItems[idx].task = e.target.value;
                            setData({...data, actionItems: newItems});
                         }} />
                      </div>
                      <div>
                         <label className="text-xs font-bold text-yellow-700 uppercase">Responsible</label>
                         <input className="w-full p-2 bg-white border border-yellow-200 rounded-lg text-sm" value={action.personResponsible} onChange={e => {
                            const newItems = [...data.actionItems];
                            newItems[idx].personResponsible = e.target.value;
                            setData({...data, actionItems: newItems});
                         }} />
                      </div>
                      <div>
                         <label className="text-xs font-bold text-yellow-700 uppercase">Due Date</label>
                         <input type="date" className="w-full p-2 bg-white border border-yellow-200 rounded-lg text-sm" value={action.dueDate} onChange={e => {
                            const newItems = [...data.actionItems];
                            newItems[idx].dueDate = e.target.value;
                            setData({...data, actionItems: newItems});
                         }} />
                      </div>
                      <div className="md:col-span-2 relative">
                         <label className="text-xs font-bold text-yellow-700 uppercase">Notes</label>
                         <textarea rows={2} className="w-full p-2 bg-white border border-yellow-200 rounded-lg text-sm" value={action.notes} onChange={e => {
                            const newItems = [...data.actionItems];
                            newItems[idx].notes = e.target.value;
                            setData({...data, actionItems: newItems});
                         }} />
                         <div className="absolute right-2 bottom-2">
                            <AiButton section={`Action Item: ${action.task}`} currentVal={action.notes} textSetter={v => {
                               const newItems = [...data.actionItems];
                               newItems[idx].notes = v;
                               setData({...data, actionItems: newItems});
                            }} />
                         </div>
                      </div>
                   </div>
                ))}
                <button onClick={() => setData({...data, actionItems: [...data.actionItems, { task: '', personResponsible: '', dueDate: '', notes: '' }]})} 
                   className="w-full py-3 border-2 border-dashed border-yellow-200 text-yellow-600 rounded-xl hover:bg-yellow-50 font-bold flex justify-center items-center gap-2">
                   <Plus className="w-5 h-5"/> Add Action Item
                </button>
             </div>
           )}
        </div>

        {/* 6. Prayer Points */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
           <button onClick={() => toggleSection('prayer')} className="w-full flex justify-between items-center p-4 bg-slate-50 font-bold text-slate-700 hover:bg-slate-100">
              <span>5. Prayer Points / Spiritual Insights</span>
              {openSections['prayer'] ? <ChevronUp className="w-5 h-5"/> : <ChevronDown className="w-5 h-5"/>}
           </button>
           {openSections['prayer'] && (
             <div className="p-6">
                <div className="relative">
                   <textarea rows={4} className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500" 
                      placeholder="Spiritual insights discussed..."
                      value={data.prayerPoints} onChange={e => setData({...data, prayerPoints: e.target.value})} 
                   />
                   <div className="absolute right-2 bottom-2">
                      <AiButton section="Prayer Points" currentVal={data.prayerPoints} textSetter={v => setData({...data, prayerPoints: v})} />
                   </div>
                </div>
             </div>
           )}
        </div>

        {/* 7. Closing Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
           <button onClick={() => toggleSection('closing')} className="w-full flex justify-between items-center p-4 bg-slate-50 font-bold text-slate-700 hover:bg-slate-100">
              <span>6. Closing Summary</span>
              {openSections['closing'] ? <ChevronUp className="w-5 h-5"/> : <ChevronDown className="w-5 h-5"/>}
           </button>
           {openSections['closing'] && (
             <div className="p-6 space-y-4">
                <div>
                   <label className="flex items-center text-xs font-bold text-slate-500 uppercase mb-1">
                      Key Takeaways
                      <AiButton section="Key Takeaways" currentVal={data.closingSummary.keyTakeaways} textSetter={v => setData({...data, closingSummary: {...data.closingSummary, keyTakeaways: v}})} />
                   </label>
                   <textarea rows={3} className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500" 
                      value={data.closingSummary.keyTakeaways} onChange={e => setData({...data, closingSummary: {...data.closingSummary, keyTakeaways: e.target.value}})} 
                   />
                </div>
                <div>
                   <label className="flex items-center text-xs font-bold text-slate-500 uppercase mb-1">
                      Follow-up Needed
                      <AiButton section="Follow-up Needed" currentVal={data.closingSummary.followUpNeeded} textSetter={v => setData({...data, closingSummary: {...data.closingSummary, followUpNeeded: v}})} />
                   </label>
                   <textarea rows={3} className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500" 
                      value={data.closingSummary.followUpNeeded} onChange={e => setData({...data, closingSummary: {...data.closingSummary, followUpNeeded: e.target.value}})} 
                   />
                </div>
             </div>
           )}
        </div>

        {/* 8. Next Meeting */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
           <button onClick={() => toggleSection('next')} className="w-full flex justify-between items-center p-4 bg-slate-50 font-bold text-slate-700 hover:bg-slate-100">
              <span>7. Next Meeting</span>
              {openSections['next'] ? <ChevronUp className="w-5 h-5"/> : <ChevronDown className="w-5 h-5"/>}
           </button>
           {openSections['next'] && (
             <div className="p-6 space-y-4">
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date & Time</label>
                   <input type="datetime-local" className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500" 
                      value={data.nextMeeting.dateTime} onChange={e => setData({...data, nextMeeting: {...data.nextMeeting, dateTime: e.target.value}})} 
                   />
                </div>
                <div>
                   <label className="flex items-center text-xs font-bold text-slate-500 uppercase mb-1">
                      Next Agenda (if known)
                      <AiButton section="Next Meeting Agenda" currentVal={data.nextMeeting.agenda} textSetter={v => setData({...data, nextMeeting: {...data.nextMeeting, agenda: v}})} />
                   </label>
                   <textarea rows={3} className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500" 
                      value={data.nextMeeting.agenda} onChange={e => setData({...data, nextMeeting: {...data.nextMeeting, agenda: e.target.value}})} 
                   />
                </div>
             </div>
           )}
        </div>

      </div>

      {/* History Modal */}
      {showHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
                  <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                      <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                          <History className="w-5 h-5"/> Saved Meetings
                      </h3>
                      <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5"/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                      {loading ? (
                          <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-blue-500"/></div>
                      ) : historyList.length === 0 ? (
                          <div className="text-center py-12 text-slate-400">No saved meetings found.</div>
                      ) : (
                          historyList.map(item => (
                              <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition-all flex justify-between items-center group">
                                  <div onClick={() => handleLoad(item.id)} className="cursor-pointer flex-1">
                                      <h4 className="font-bold text-slate-800">{item.meeting_title}</h4>
                                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> {new Date(item.meeting_datetime).toLocaleDateString()}</span>
                                          <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{item.meeting_type}</span>
                                      </div>
                                  </div>
                                  <button onClick={(e) => handleDeleteHistory(item.id, e)} className="p-2 text-slate-300 hover:text-red-500 rounded-full hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Trash2 className="w-4 h-4" />
                                  </button>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* Notification Toast */}
      <div className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${notification ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
          {notification && (
            <div className={`px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 font-medium text-sm border ${
              notification.type === 'success' 
                ? 'bg-slate-800 text-white border-slate-700' 
                : 'bg-red-50 text-red-700 border-red-200'
            }`}>
                {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <AlertCircle className="w-4 h-4 text-red-500" />}
                {notification.message}
                <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-70"><X className="w-4 h-4" /></button>
            </div>
          )}
      </div>

    </div>
  );
};

export default MeetingMinutes;

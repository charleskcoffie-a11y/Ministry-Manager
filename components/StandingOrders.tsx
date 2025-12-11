
// ... (imports remain the same)
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { StandingOrder } from '../types';
import { 
  Search, BookOpen, ChevronRight, Bot, Upload, FileText, X, ArrowLeft, 
  AlignJustify, Scale, Bookmark, Gavel, ScrollText, CheckCircle2, BookmarkCheck,
  Library
} from 'lucide-react';
import { explainStandingOrder } from '../services/geminiService';
import { useLocation, useNavigate } from 'react-router-dom';

// ... (globals and interfaces remain the same)
declare global {
  interface Window {
    pdfjsLib: any;
    mammoth: any;
  }
}

interface DocContent {
  id: string;
  text: string;
  page?: number;
}

const StandingOrders: React.FC = () => {
  // ... (state setup remains the same)
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const initialQuery = searchParams.get('q') || '';

  const [orders, setOrders] = useState<StandingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const [docMode, setDocMode] = useState(false);
  const [docContent, setDocContent] = useState<DocContent[]>([]);
  const [docFileName, setDocFileName] = useState<string>('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showFullDoc, setShowFullDoc] = useState(false);

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedOrder, setSelectedOrder] = useState<StandingOrder | null>(null);
  const [selectedDocItem, setSelectedDocItem] = useState<DocContent | null>(null);
  
  const [aiExplanation, setAiExplanation] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);

  const fullDocViewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (searchQuery) {
        params.set('q', searchQuery);
    } else {
        params.delete('q');
    }
    const newSearch = params.toString();
    const currentSearch = new URLSearchParams(location.search).toString();
    
    // Only navigate if the search string actually changed to prevent loops
    if (newSearch !== currentSearch) {
        navigate({ search: newSearch }, { replace: true });
    }
  }, [searchQuery, navigate, location.search]);

  useEffect(() => {
    const fetchSavedDocument = async () => {
      try {
        setParsing(true);
        const { data, error } = await supabase
          .from('uploaded_documents')
          .select('*')
          .eq('id', 'standing_orders')
          .single();

        if (error && error.code !== 'PGRST116') {
           console.error("Error fetching saved document:", error);
        }

        if (data && data.content) {
          console.log("Restored document:", data.filename);
          setDocFileName(data.filename);
          setDocContent(data.content);
          setDocMode(true);
        }
      } catch (err) {
        console.error("Unexpected error loading document:", err);
      } finally {
        setParsing(false);
        setLoading(false);
      }
    };

    fetchSavedDocument();
  }, []);

  const extractSoNumber = (input: string) => {
    const match = input.match(/^s[\.\s]*o[\.\s]*(\d+)/i);
    return match ? match[1] : null;
  };

  const fetchOrders = useCallback(async () => {
    if (docMode) return;

    setLoading(true);
    let query = supabase.from('standing_orders').select('*');

    const codeNumber = extractSoNumber(searchQuery);

    if (codeNumber) {
      query = query.ilike('code', `%${codeNumber}%`); 
    } else if (searchQuery.trim().length > 0) {
      query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
    }

    if (showFavoritesOnly) {
      query = query.eq('is_favorite', true);
    }

    const { data, error } = await query.order('code', { ascending: true });
    
    if (!error && data) setOrders(data);
    setLoading(false);
  }, [searchQuery, docMode, showFavoritesOnly]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchOrders();
    }, 500); 
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, fetchOrders, showFavoritesOnly]);

  const toggleFavorite = async (e: React.MouseEvent, order: StandingOrder) => {
    e.stopPropagation();
    
    const newStatus = !order.is_favorite;
    
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, is_favorite: newStatus } : o));
    if (selectedOrder?.id === order.id) {
      setSelectedOrder({ ...selectedOrder, is_favorite: newStatus });
    }

    try {
      await supabase.from('standing_orders').update({ is_favorite: newStatus }).eq('id', order.id);
    } catch (err) {
      console.error("Error updating favorite", err);
      fetchOrders(); 
    }
  };

  const handleAskAI = async (text: string, code: string = 'Reference') => {
    setAiLoading(true);
    const result = await explainStandingOrder(code, text);
    setAiExplanation(result);
    setAiLoading(false);
  }

  const saveDocumentToSupabase = async (fileName: string, content: DocContent[]) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('uploaded_documents')
        .upsert({ 
          id: 'standing_orders',
          filename: fileName, 
          content: content,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error("Supabase Save Error:", error);
        alert("File parsed locally, but failed to save to cloud database. " + error.message);
      }
    } catch (err) {
      console.error("Save Exception:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setDocFileName(file.name);
    setDocMode(true);
    setDocContent([]);
    setSelectedDocItem(null);
    setSelectedOrder(null);
    setShowFullDoc(false);

    try {
      let extractedContent: DocContent[] = [];

      if (file.type === 'application/pdf') {
        extractedContent = await parsePDF(file);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        extractedContent = await parseDocx(file);
      } else {
        alert('Please upload a PDF or DOCX file.');
        setParsing(false);
        return;
      }

      setDocContent(extractedContent);
      await saveDocumentToSupabase(file.name, extractedContent);

    } catch (err) {
      console.error(err);
      alert('Error parsing file.');
    } finally {
      setParsing(false);
    }
  };

  const parsePDF = async (file: File): Promise<DocContent[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    const extractedLines: DocContent[] = [];
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      
      if (pageText.trim()) {
        extractedLines.push({
          id: `p-${i}`,
          text: pageText,
          page: i
        });
      }
    }
    return extractedLines;
  };

  const parseDocx = async (file: File): Promise<DocContent[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer: arrayBuffer });
    
    const lines = result.value.split('\n').filter((line: string) => line.trim().length > 0);
    const extracted = lines.map((line: string, idx: number) => ({
      id: `d-${idx}`,
      text: line.trim()
    }));
    return extracted;
  };

  const clearDocument = () => {
    setDocMode(false);
    setDocContent([]);
    setDocFileName('');
    setSearchQuery('');
    setShowFullDoc(false);
    setTimeout(fetchOrders, 0); 
  };

  const filteredDocContent = docContent.filter(item => {
    if (!searchQuery) return true;
    const codeNumber = extractSoNumber(searchQuery);
    if (codeNumber) {
      const regex = new RegExp(`s[\\.\\s]*o[\\.\\s]*${codeNumber}`, 'i');
      return regex.test(item.text);
    }
    return item.text.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (showFullDoc && docMode) {
    return (
      <div className="h-[calc(100vh-100px)] flex flex-col bg-stone-50 rounded-lg shadow-lg border border-stone-200 animate-fade-in relative">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-white sticky top-0 z-20 rounded-t-lg shadow-sm">
           <div className="flex items-center gap-4">
             <button 
               onClick={() => setShowFullDoc(false)}
               className="flex items-center gap-2 px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg transition-colors font-serif"
             >
               <ArrowLeft className="w-5 h-5" /> Back to Search
             </button>
             <div>
               <h2 className="font-bold text-stone-800 text-lg flex items-center gap-2 font-serif">
                 <ScrollText className="w-5 h-5 text-amber-600"/>
                 {docFileName}
               </h2>
               <p className="text-sm text-stone-500">Full Text Mode</p>
             </div>
           </div>
           
           {selectedDocItem && (
              <div className="hidden sm:block text-sm font-medium text-stone-600 bg-stone-100 px-4 py-2 rounded-full border border-stone-200">
                Jumped to result: {extractSoNumber(searchQuery) ? `SO ${extractSoNumber(searchQuery)}` : 'Selection'}
              </div>
           )}
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-stone-100/50" ref={fullDocViewRef}>
           <div className="max-w-4xl mx-auto bg-white p-12 shadow-md min-h-full rounded-sm border border-stone-200 relative">
             <div className="absolute top-0 left-0 w-full h-2 bg-slate-900"></div>
             {docContent.length === 0 && <p className="text-stone-400 text-xl font-serif text-center italic mt-10">No content loaded.</p>}
             {docContent.map((item, index) => (
                <div 
                  key={item.id} 
                  id={item.id}
                  className={`mb-6 transition-all duration-500 ${selectedDocItem?.id === item.id ? 'p-6 -mx-6 rounded bg-amber-50/50 border-l-4 border-amber-500' : ''}`}
                >
                   {item.page && index > 0 && docContent[index-1].page !== item.page && (
                     <div className="flex items-center gap-4 my-8 opacity-50">
                       <div className="h-px bg-stone-300 flex-1"></div>
                       <span className="text-xs font-serif font-bold text-stone-500 uppercase tracking-widest">Page {item.page}</span>
                       <div className="h-px bg-stone-300 flex-1"></div>
                     </div>
                   )}
                   <p className="text-stone-800 leading-loose text-lg font-serif whitespace-pre-wrap">{item.text}</p>
                </div>
             ))}
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col bg-stone-50/50">
       <div className="mb-6 bg-slate-900 rounded-2xl shadow-lg p-8 relative overflow-hidden border-b-4 border-amber-600">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] opacity-10"></div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
             <div className="flex gap-5 items-start">
                <div className="bg-white/10 p-3 rounded-xl border border-white/10 backdrop-blur-sm">
                   <Gavel className="w-8 h-8 text-amber-500" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-serif font-bold text-white tracking-wide mb-1">
                      Standing Orders & Constitution
                  </h1>
                  <p className="text-slate-400 font-light text-lg">
                      Governance • Rules • Legal Framework
                  </p>
                </div>
             </div>
             
             <div className="flex items-center gap-3">
               {!docMode ? (
                 <label className="flex items-center gap-2 px-5 py-3 bg-white/10 border border-white/20 text-white rounded-lg hover:bg-white/20 cursor-pointer transition-all">
                   <Upload className="w-5 h-5 text-amber-400" />
                   <span className="font-medium text-sm">Upload Document</span>
                   <input type="file" accept=".pdf,.docx" className="hidden" onChange={handleFileUpload} />
                 </label>
               ) : (
                  <button 
                    onClick={clearDocument}
                    className="flex items-center gap-2 px-5 py-3 bg-red-500/20 border border-red-500/30 text-red-200 rounded-lg hover:bg-red-500/30 transition-all text-sm font-medium"
                  >
                    <X className="w-5 h-5" /> Close Reader
                  </button>
               )}
             </div>
          </div>
       </div>

      <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
        
        {/* Left Panel: List */}
        <div className={`w-full md:w-1/3 lg:w-1/4 bg-white rounded-xl shadow-sm border border-stone-200 flex flex-col overflow-hidden ${selectedOrder || selectedDocItem ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-stone-100 bg-stone-50/50 space-y-3">
               <div className="relative">
                  <Search className="absolute left-3 top-3 h-5 w-5 text-stone-400" />
                  <input 
                    type="text"
                    placeholder="Search section, rule, or code..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-lg shadow-sm focus:ring-2 focus:ring-slate-800 focus:border-slate-800 outline-none text-stone-700 font-medium placeholder-stone-400"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
               </div>
               
               {!docMode && (
                   <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-500 uppercase tracking-widest">
                          {showFavoritesOnly ? 'Saved Items' : 'All Sections'}
                      </span>
                      <button 
                         onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                         className={`text-xs font-bold px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors border ${
                             showFavoritesOnly 
                             ? 'bg-amber-50 text-amber-700 border-amber-200' 
                             : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'
                         }`}
                      >
                          <Bookmark className={`w-3 h-3 ${showFavoritesOnly ? 'fill-amber-600' : ''}`} />
                          Favorites
                      </button>
                   </div>
               )}
               {docMode && (
                 <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-md border border-emerald-100">
                    <CheckCircle2 className="w-3 h-3" />
                    Viewing: <span className="font-bold truncate max-w-[150px]">{docFileName}</span>
                 </div>
               )}
            </div>

            <div className="flex-1 overflow-y-auto bg-white">
                {!docMode && (
                    <>
                        {loading ? (
                            <div className="p-8 text-center text-stone-400 text-sm font-serif italic">Loading statutes...</div>
                        ) : orders.length === 0 ? (
                            <div className="p-10 text-center flex flex-col items-center opacity-60">
                                <Scale className="w-10 h-10 text-stone-300 mb-3" />
                                <p className="text-stone-500 font-medium">No sections found.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-stone-100">
                                {orders.map(order => (
                                    <div 
                                        key={order.id} 
                                        onClick={() => { setSelectedOrder(order); setAiExplanation(''); }}
                                        className={`group px-5 py-4 cursor-pointer hover:bg-stone-50 transition-all border-l-4 ${
                                            selectedOrder?.id === order.id 
                                            ? 'bg-amber-50/40 border-amber-500' 
                                            : 'border-transparent hover:border-stone-200'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`text-xs font-bold uppercase tracking-wider ${
                                                selectedOrder?.id === order.id ? 'text-amber-700' : 'text-slate-500'
                                            }`}>
                                                {order.code}
                                            </span>
                                            <button 
                                                onClick={(e) => toggleFavorite(e, order)}
                                                className={`p-1 rounded-full transition-colors ${order.is_favorite ? 'text-amber-500' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'}`}
                                            >
                                                <Bookmark className={`w-4 h-4 ${order.is_favorite ? 'fill-amber-500' : ''}`} />
                                            </button>
                                        </div>
                                        <h3 className={`font-serif font-bold text-base leading-tight mb-1 ${
                                            selectedOrder?.id === order.id ? 'text-slate-900' : 'text-stone-700'
                                        }`}>
                                            {order.title}
                                        </h3>
                                        <p className="text-xs text-stone-400 line-clamp-2 font-serif leading-relaxed">
                                            {order.content}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {docMode && (
                    <div className="divide-y divide-stone-100">
                        {filteredDocContent.length === 0 ? (
                            <div className="p-10 text-center text-stone-400 text-sm">No matches in document.</div>
                        ) : (
                            filteredDocContent.map(item => (
                                <div 
                                    key={item.id} 
                                    onClick={() => { setSelectedDocItem(item); setAiExplanation(''); }}
                                    className={`px-5 py-4 cursor-pointer hover:bg-stone-50 transition-all border-l-4 ${
                                        selectedDocItem?.id === item.id 
                                        ? 'bg-amber-50/40 border-amber-500' 
                                        : 'border-transparent'
                                    }`}
                                >
                                    {item.page && (
                                        <span className="text-[10px] font-bold text-stone-400 uppercase mb-1 block">
                                            Page {item.page}
                                        </span>
                                    )}
                                    <p className="text-sm text-stone-700 font-serif line-clamp-3 leading-relaxed">
                                        {item.text}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>

        {/* Right Panel: Viewer */}
        <div className={`flex-[2] bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden relative flex flex-col ${(selectedOrder || selectedDocItem) ? 'flex' : 'hidden md:flex'}`}>
            
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
                 <Scale className="w-96 h-96 text-slate-900" />
             </div>

             <div className="md:hidden bg-stone-50 p-4 border-b border-stone-200 sticky top-0 z-10">
                 <button 
                    onClick={() => { setSelectedOrder(null); setSelectedDocItem(null); }}
                    className="flex items-center gap-2 text-stone-600 font-medium"
                 >
                     <ArrowLeft className="w-5 h-5"/> Back to List
                 </button>
             </div>

             <div className="flex-1 overflow-y-auto p-8 md:p-12 relative z-0">
               {selectedOrder && !docMode && (
                 <div className="max-w-3xl mx-auto">
                    <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
                         <div>
                             <span className="block text-sm font-bold text-amber-600 uppercase tracking-widest mb-2">Standing Order</span>
                             <h2 className="text-5xl font-serif font-bold text-slate-900">{selectedOrder.code}</h2>
                         </div>
                         <div className="flex flex-col gap-2 items-end">
                             {/* Top Action Button */}
                             <button 
                                onClick={(e) => toggleFavorite(e, selectedOrder)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold transition-all ${
                                    selectedOrder.is_favorite 
                                    ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                    : 'bg-white text-stone-400 border-stone-200 hover:border-stone-300'
                                }`}
                             >
                                 <Bookmark className={`w-4 h-4 ${selectedOrder.is_favorite ? 'fill-amber-600' : ''}`} />
                                 {selectedOrder.is_favorite ? 'Saved' : 'Save Section'}
                             </button>
                             <button 
                                onClick={() => handleAskAI(selectedOrder.content, selectedOrder.code)}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 text-sm font-bold transition"
                             >
                               <Bot className="w-4 h-4" /> Explain
                             </button>
                         </div>
                    </div>

                    <h3 className="text-2xl font-serif font-bold text-slate-800 mb-6">{selectedOrder.title}</h3>
                    
                    <div className="prose prose-lg max-w-none prose-p:font-serif prose-p:text-stone-800 prose-p:leading-loose">
                        <p>{selectedOrder.content}</p>
                    </div>

                    {selectedOrder.tags && (
                        <div className="mt-12 pt-6 border-t border-stone-200 flex gap-2">
                            {selectedOrder.tags.map(tag => (
                                <span key={tag} className="px-3 py-1 bg-stone-100 text-stone-500 rounded text-xs font-bold uppercase">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Bottom Prominent Action Button */}
                    <div className="mt-8 pt-8 border-t border-stone-200 flex justify-center">
                        <button 
                            onClick={(e) => toggleFavorite(e, selectedOrder)}
                            className={`flex items-center gap-3 px-8 py-3 rounded-full font-bold text-lg transition-all shadow-sm transform hover:-translate-y-0.5 ${
                                selectedOrder.is_favorite 
                                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200' 
                                : 'bg-slate-800 text-white hover:bg-slate-700'
                            }`}
                        >
                            <Bookmark className={`w-5 h-5 ${selectedOrder.is_favorite ? 'fill-amber-800' : ''}`} />
                            {selectedOrder.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}
                        </button>
                    </div>
                 </div>
               )}

               {selectedDocItem && docMode && (
                  <div className="max-w-3xl mx-auto">
                     <div className="flex justify-between items-center mb-8 pb-4 border-b border-stone-200">
                        <div className="flex items-center gap-3 text-stone-500">
                             <FileText className="w-6 h-6"/>
                             <span className="font-serif italic">Excerpt from uploaded document</span>
                        </div>
                        <div className="flex gap-2">
                             <button 
                                onClick={() => setShowFullDoc(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 text-sm font-bold transition shadow-sm"
                             >
                               <AlignJustify className="w-4 h-4" /> Read Full Context
                             </button>
                             <button 
                                onClick={() => handleAskAI(selectedDocItem.text, "Document Excerpt")}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 text-sm font-bold transition"
                             >
                               <Bot className="w-4 h-4" /> Explain
                             </button>
                        </div>
                     </div>
                     
                     <div className="bg-amber-50/30 p-8 rounded border-l-4 border-amber-300">
                        <p className="font-serif text-xl leading-loose text-slate-800 whitespace-pre-wrap">
                            {selectedDocItem.text}
                        </p>
                     </div>
                     
                     <div className="mt-6 text-center">
                         <p className="text-stone-400 italic font-serif text-sm">
                            Click "Read Full Context" to view the surrounding pages.
                         </p>
                     </div>
                  </div>
               )}

               {!selectedOrder && !selectedDocItem && (
                 <div className="h-full flex flex-col items-center justify-center text-stone-300">
                    <Library className="w-32 h-32 mb-6 opacity-20" />
                    <h3 className="text-2xl font-serif font-bold text-stone-400 mb-2">Select a Section</h3>
                    <p className="font-serif italic">Choose an item from the table of contents to begin reading.</p>
                 </div>
               )}

               {(selectedOrder || selectedDocItem) && (
                 <div className="mt-12 max-w-3xl mx-auto">
                   {aiLoading && (
                       <div className="p-6 bg-slate-50 rounded border border-slate-100 flex items-center gap-3 animate-pulse">
                         <Bot className="w-5 h-5 text-slate-400"/>
                         <span className="text-slate-500 font-medium">Analyzing legal text...</span>
                       </div>
                   )}
                   {aiExplanation && !aiLoading && (
                     <div className="p-8 bg-slate-50 rounded-lg border border-slate-200 shadow-inner">
                       <h4 className="font-bold flex items-center gap-2 mb-4 text-slate-700 uppercase tracking-widest text-xs">
                           <Bot className="w-4 h-4 text-amber-600"/> 
                           AI Simplification
                       </h4>
                       <p className="text-slate-700 leading-relaxed font-medium">
                           {aiExplanation}
                       </p>
                     </div>
                   )}
                 </div>
               )}
             </div>
        </div>
      </div>
    </div>
  );
};

export default StandingOrders;

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { StandingOrder } from '../types';
import { Search, BookOpen, ChevronRight, Bot, Upload, FileText, X, ArrowLeft, AlignJustify, Save, Cloud } from 'lucide-react';
import { explainStandingOrder } from '../services/geminiService';
import { useSearchParams } from 'react-router-dom';

// Declare globals for the script libraries
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
  // URL Params
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  // Database State
  const [orders, setOrders] = useState<StandingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Document Reader State
  const [docMode, setDocMode] = useState(false);
  const [docContent, setDocContent] = useState<DocContent[]>([]);
  const [docFileName, setDocFileName] = useState<string>('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showFullDoc, setShowFullDoc] = useState(false);

  // Shared State
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedOrder, setSelectedOrder] = useState<StandingOrder | null>(null);
  const [selectedDocItem, setSelectedDocItem] = useState<DocContent | null>(null);
  
  // AI State
  const [aiExplanation, setAiExplanation] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);

  // Refs for scrolling
  const fullDocViewRef = useRef<HTMLDivElement>(null);

  // Update URL when search changes (optional, but good for bookmarking)
  useEffect(() => {
    if (searchQuery) {
        setSearchParams({ q: searchQuery });
    } else {
        setSearchParams({});
    }
  }, [searchQuery, setSearchParams]);

  // 1. Load Persisted Document on Startup
  useEffect(() => {
    const fetchSavedDocument = async () => {
      try {
        setParsing(true);
        const { data, error } = await supabase
          .from('uploaded_documents')
          .select('*')
          .eq('id', 'standing_orders')
          .single();

        if (error && error.code !== 'PGRST116') { // Ignore 'row not found' errors
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
        setLoading(false); // Stop main loading spinner if we were waiting
      }
    };

    fetchSavedDocument();
  }, []);

  // Extract number from inputs like "SO 54", "S.O 54", "s.o. 54"
  const extractSoNumber = (input: string) => {
    const match = input.match(/^s[\.\s]*o[\.\s]*(\d+)/i);
    return match ? match[1] : null;
  };

  const fetchOrders = useCallback(async () => {
    // If in document mode, we don't fetch from DB
    if (docMode) return;

    setLoading(true);
    let query = supabase.from('standing_orders').select('*');

    const codeNumber = extractSoNumber(searchQuery);

    if (codeNumber) {
      // If user typed "SO 54" or "S.O 54", search for the number part in the code
      query = query.ilike('code', `%${codeNumber}%`); 
    } else if (searchQuery.trim().length > 0) {
      query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
    }

    const { data, error } = await query.order('code', { ascending: true });
    
    if (!error && data) setOrders(data);
    setLoading(false);
  }, [searchQuery, docMode]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchOrders();
    }, 500); 
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, fetchOrders]);

  // Scroll to selected item when Full Doc View is opened
  useEffect(() => {
    if (showFullDoc && selectedDocItem) {
      setTimeout(() => {
        const element = document.getElementById(selectedDocItem.id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('bg-yellow-100', 'transition-colors', 'duration-1000');
        }
      }, 100);
    }
  }, [showFullDoc, selectedDocItem]);

  const handleAskAI = async (text: string, code: string = 'Reference') => {
    setAiLoading(true);
    const result = await explainStandingOrder(code, text);
    setAiExplanation(result);
    setAiLoading(false);
  }

  // 2. Persist Document to Supabase
  const saveDocumentToSupabase = async (fileName: string, content: DocContent[]) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('uploaded_documents')
        .upsert({ 
          id: 'standing_orders', // Singleton ID to always replace the previous one
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

  // Document Handling
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
      // Automatically save to Supabase
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
    // Note: This only clears it from the current view session. 
    // It remains in the DB unless overwritten.
    setDocMode(false);
    setDocContent([]);
    setDocFileName('');
    setSearchQuery('');
    setShowFullDoc(false);
    setTimeout(fetchOrders, 0); 
  };

  // Filter Document Content
  const filteredDocContent = docContent.filter(item => {
    if (!searchQuery) return true; // Show all if no query
    const codeNumber = extractSoNumber(searchQuery);
    if (codeNumber) {
      const regex = new RegExp(`s[\\.\\s]*o[\\.\\s]*${codeNumber}`, 'i');
      return regex.test(item.text);
    }
    return item.text.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // --- RENDER FULL DOCUMENT VIEW ---
  if (showFullDoc && docMode) {
    return (
      <div className="h-[calc(100vh-100px)] flex flex-col bg-white rounded-lg shadow-lg border animate-fade-in relative">
        <div className="px-6 py-4 border-b flex items-center justify-between bg-white sticky top-0 z-20 rounded-t-lg shadow-sm">
           <div className="flex items-center gap-4">
             <button 
               onClick={() => setShowFullDoc(false)}
               className="flex items-center gap-2 px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-lg"
             >
               <ArrowLeft className="w-6 h-6" /> Back to Search
             </button>
             <div>
               <h2 className="font-bold text-gray-800 text-xl flex items-center gap-2">
                 <FileText className="w-6 h-6 text-primary"/>
                 {docFileName}
               </h2>
               <p className="text-base text-gray-500">Full Text Mode</p>
             </div>
           </div>
           
           {selectedDocItem && (
              <div className="hidden sm:block text-base text-gray-500 bg-gray-50 px-4 py-2 rounded-full">
                Jumped to result: {extractSoNumber(searchQuery) ? `SO ${extractSoNumber(searchQuery)}` : 'Selection'}
              </div>
           )}
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-gray-50" ref={fullDocViewRef}>
           <div className="max-w-4xl mx-auto bg-white p-10 shadow-sm min-h-full rounded-lg">
             {docContent.length === 0 && <p className="text-gray-400 text-xl">No content loaded.</p>}
             {docContent.map((item, index) => (
                <div 
                  key={item.id} 
                  id={item.id}
                  className={`mb-6 transition-all duration-500 ${selectedDocItem?.id === item.id ? 'p-6 -mx-6 rounded-lg bg-yellow-50 border-l-8 border-yellow-400 shadow-sm' : ''}`}
                >
                   {item.page && index > 0 && docContent[index-1].page !== item.page && (
                     <div className="flex items-center gap-4 my-8">
                       <div className="h-px bg-gray-200 flex-1"></div>
                       <span className="text-sm font-mono text-gray-400">Page {item.page}</span>
                       <div className="h-px bg-gray-200 flex-1"></div>
                     </div>
                   )}
                   <p className="text-gray-800 leading-relaxed text-2xl whitespace-pre-wrap">{item.text}</p>
                </div>
             ))}
           </div>
        </div>
      </div>
    );
  }

  // --- RENDER STANDARD SPLIT VIEW ---
  return (
    <div className="h-[calc(100vh-100px)] flex flex-col">
       <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">Standing Orders & Constitution</h1>
          <div className="flex gap-2 items-center mb-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-4 h-6 w-6 text-gray-400" />
              <input 
                type="text"
                placeholder={docMode ? `Search in ${docFileName} (e.g. S.O 54)...` : "Search by code (e.g., SO 117) or keyword..."}
                className="w-full pl-12 pr-4 py-4 border rounded-lg shadow-sm focus:ring-2 focus:ring-primary focus:border-transparent text-xl"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {!docMode ? (
              <label className="flex items-center gap-2 px-5 py-4 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 cursor-pointer shadow-sm transition-colors whitespace-nowrap text-lg">
                <Upload className="w-6 h-6" />
                <span className="hidden sm:inline">Read File</span>
                <input type="file" accept=".pdf,.docx" className="hidden" onChange={handleFileUpload} />
              </label>
            ) : (
               <button 
                 onClick={clearDocument}
                 className="flex items-center gap-2 px-5 py-4 bg-red-50 border border-red-200 text-red-700 rounded-lg hover:bg-red-100 shadow-sm transition-colors whitespace-nowrap text-lg"
               >
                 <X className="w-6 h-6" /> Close File
               </button>
            )}
          </div>
          <p className="text-base text-gray-500 flex items-center gap-2">
            {docMode ? (
               <>
                 Reading: <strong>{docFileName}</strong>
                 {saving ? <span className="text-primary flex items-center text-sm ml-2"><Cloud className="w-3 h-3 animate-bounce mr-1"/> Saving...</span> : <span className="text-green-600 flex items-center text-sm ml-2"><Cloud className="w-3 h-3 mr-1"/> Saved</span>}
               </>
            ) : 'Try searching "SO117", "S.O 54", or "Discipline"'}
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
        {/* Results List */}
        <div className={`flex-1 bg-white rounded-lg shadow border overflow-y-auto ${selectedOrder || selectedDocItem ? 'hidden md:block' : 'block'}`}>
          
          {/* DATABASE MODE */}
          {!docMode && (
            <>
              {loading ? (
                <div className="p-4 text-center text-gray-500 text-lg">Searching database...</div>
              ) : orders.length === 0 ? (
                <div className="p-8 text-center text-gray-400 flex flex-col items-center">
                  <BookOpen className="w-16 h-16 mb-4 opacity-50"/>
                  <p className="text-xl">No results found for "{searchQuery}"</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {orders.map(order => (
                    <li 
                      key={order.id} 
                      onClick={() => { setSelectedOrder(order); setAiExplanation(''); }}
                      className={`p-6 cursor-pointer hover:bg-blue-50 transition-colors ${selectedOrder?.id === order.id ? 'bg-blue-50 border-l-8 border-primary' : ''}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="inline-block px-3 py-1 text-sm font-bold bg-gray-200 text-gray-700 rounded mb-2">
                            {order.code}
                          </span>
                          <h3 className="font-bold text-xl text-gray-900 mb-1">{order.title}</h3>
                          <p className="text-lg text-gray-500 line-clamp-2">{order.content}</p>
                        </div>
                        <ChevronRight className="w-6 h-6 text-gray-400 mt-2" />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {/* DOCUMENT MODE */}
          {docMode && (
            <>
              {parsing ? (
                <div className="p-8 text-center text-gray-500 flex flex-col items-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
                  <p className="text-xl">Processing document...</p>
                </div>
              ) : filteredDocContent.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <FileText className="w-16 h-16 mb-4 opacity-50 mx-auto"/>
                  <p className="text-xl">No matching text found in file.</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filteredDocContent.map(item => (
                    <li 
                      key={item.id} 
                      onClick={() => { setSelectedDocItem(item); setAiExplanation(''); }}
                      className={`p-6 cursor-pointer hover:bg-blue-50 transition-colors ${selectedDocItem?.id === item.id ? 'bg-blue-50 border-l-8 border-primary' : ''}`}
                    >
                       <div className="flex justify-between items-start">
                        <div>
                           {item.page && (
                             <span className="inline-block px-3 py-1 text-sm font-bold bg-gray-200 text-gray-700 rounded mb-2">
                               Page {item.page}
                             </span>
                           )}
                           <p className="text-lg text-gray-700 line-clamp-3 leading-relaxed">{item.text}</p>
                        </div>
                        <ChevronRight className="w-6 h-6 text-gray-400 flex-shrink-0 mt-1" />
                       </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

        </div>

        {/* Detail View */}
        <div className={`flex-[2] bg-white rounded-lg shadow border p-8 overflow-y-auto relative animate-fade-in ${(selectedOrder || selectedDocItem) ? 'block' : 'hidden md:block'}`}>
             
             {/* Back button for mobile */}
             {(selectedOrder || selectedDocItem) && (
               <button 
                onClick={() => { setSelectedOrder(null); setSelectedDocItem(null); }}
                className="md:hidden absolute top-4 left-4 text-gray-500 hover:text-gray-900 text-lg"
               >
                 &larr; Back
               </button>
             )}

             {/* Content Area */}
             <div className="md:mt-0 mt-10">
               {/* DB Selection */}
               {selectedOrder && !docMode && (
                 <>
                   <div className="flex justify-between items-center mb-6 border-b pb-6">
                     <div>
                        <h2 className="text-4xl font-bold text-gray-900 mb-2">{selectedOrder.code}</h2>
                        <h3 className="text-2xl text-gray-700">{selectedOrder.title}</h3>
                     </div>
                     <button 
                        onClick={() => handleAskAI(selectedOrder.content, selectedOrder.code)}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 text-base font-medium transition"
                     >
                       <Bot className="w-5 h-5" /> Explain
                     </button>
                   </div>
                   <div className="prose max-w-none text-gray-800 leading-relaxed whitespace-pre-wrap text-2xl">
                     {selectedOrder.content}
                   </div>
                 </>
               )}

               {/* Document Selection */}
               {selectedDocItem && docMode && (
                  <>
                    <div className="flex justify-between items-center mb-6 border-b pb-6 flex-wrap gap-4">
                       <div>
                         <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                           <FileText className="w-6 h-6 text-gray-500"/>
                           Document Excerpt
                         </h2>
                         {selectedDocItem.page && <span className="text-lg text-gray-500">Page {selectedDocItem.page}</span>}
                       </div>
                       
                       <div className="flex gap-3">
                         <button 
                            onClick={() => setShowFullDoc(true)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 text-base font-medium transition shadow-sm"
                         >
                           <AlignJustify className="w-5 h-5" /> Read Full Text
                         </button>
                         <button 
                            onClick={() => handleAskAI(selectedDocItem.text, "Document Excerpt")}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 text-base font-medium transition"
                         >
                           <Bot className="w-5 h-5" /> Explain
                         </button>
                       </div>
                    </div>
                    
                    <div className="p-6 bg-gray-50 border rounded-lg mb-6">
                      <div className="prose max-w-none text-gray-800 leading-relaxed whitespace-pre-wrap text-2xl">
                        {selectedDocItem.text}
                      </div>
                    </div>
                    <p className="text-base text-gray-500 italic text-center">
                       This is an excerpt matching your search. Click "Read Full Text" to see the surrounding context.
                    </p>
                  </>
               )}

               {/* Empty State */}
               {!selectedOrder && !selectedDocItem && (
                 <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <BookOpen className="w-24 h-24 mb-6 opacity-20" />
                    <p className="text-2xl">Select an item from the list to view details</p>
                 </div>
               )}

               {/* AI Explanation Area (Shared) */}
               {(selectedOrder || selectedDocItem) && (
                 <div className="mt-10">
                   {aiLoading && (
                       <div className="mb-6 p-6 bg-purple-50 rounded-lg border border-purple-100 text-purple-900 text-lg animate-pulse">
                         Thinking...
                       </div>
                   )}
                   {aiExplanation && !aiLoading && (
                     <div className="mb-6 p-6 bg-purple-50 rounded-lg border border-purple-100 text-purple-900 text-lg animate-fade-in">
                       <h4 className="font-bold flex items-center gap-2 mb-3 text-xl"><Bot className="w-6 h-6"/> AI Explanation</h4>
                       {aiExplanation}
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
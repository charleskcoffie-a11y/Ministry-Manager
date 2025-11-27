import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { StandingOrder } from '../types';
import { Search, BookOpen, ChevronRight, Bot } from 'lucide-react';
import { explainStandingOrder } from '../services/geminiService';

const StandingOrders: React.FC = () => {
  const [orders, setOrders] = useState<StandingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<StandingOrder | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);

  // Normalize search input to handle "SO 117", "SO.117", "so117"
  const normalizeCode = (input: string) => {
    // Regex matches starts with "so", optional dots/spaces, then digits
    const match = input.match(/^so[\.\s]*(\d+)/i);
    if (match) {
      return `SO${match[1]}`; // Return standardized format "SO117"
    }
    return null;
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('standing_orders').select('*');

    const normalizedCode = normalizeCode(searchQuery);

    if (normalizedCode) {
      // Precise code match logic
      // Note: The DB 'code' should be standardized (e.g. SO117). 
      // If DB has mixed formats, we might need an ILIKE.
      // Assuming DB code is standardized like "SO117" or "SO.117"
      // We search via ILIKE to catch variations if stored differently
      query = query.ilike('code', `%${normalizedCode.replace('SO', '')}%`); 
    } else if (searchQuery.trim().length > 0) {
      // Text search in title or content
      query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
    }

    const { data, error } = await query.order('code', { ascending: true });
    
    if (!error && data) setOrders(data);
    setLoading(false);
  }, [searchQuery]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchOrders();
    }, 500); // Debounce search
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, fetchOrders]);

  const handleAskAI = async () => {
    if(!selectedOrder) return;
    setAiLoading(true);
    const result = await explainStandingOrder(selectedOrder.code, selectedOrder.content);
    setAiExplanation(result);
    setAiLoading(false);
  }

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col">
       <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Standing Orders & Constitution</h1>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <input 
            type="text"
            placeholder="Search by code (e.g., SO 117) or keyword..." 
            className="w-full pl-10 pr-4 py-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-primary focus:border-transparent text-lg"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">Try searching "SO117", "Discipline", or "Inauguration"</p>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
        {/* Results List */}
        <div className={`flex-1 bg-white rounded-lg shadow border overflow-y-auto ${selectedOrder ? 'hidden md:block' : 'block'}`}>
          {loading ? (
             <div className="p-4 text-center text-gray-500">Searching...</div>
          ) : orders.length === 0 ? (
             <div className="p-8 text-center text-gray-400 flex flex-col items-center">
               <BookOpen className="w-12 h-12 mb-2 opacity-50"/>
               <p>No results found for "{searchQuery}"</p>
             </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {orders.map(order => (
                <li 
                  key={order.id} 
                  onClick={() => { setSelectedOrder(order); setAiExplanation(''); }}
                  className={`p-4 cursor-pointer hover:bg-blue-50 transition-colors ${selectedOrder?.id === order.id ? 'bg-blue-50 border-l-4 border-primary' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="inline-block px-2 py-1 text-xs font-bold bg-gray-200 text-gray-700 rounded mb-1">
                        {order.code}
                      </span>
                      <h3 className="font-semibold text-gray-900">{order.title}</h3>
                      <p className="text-sm text-gray-500 line-clamp-2 mt-1">{order.content}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 mt-2" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Detail View */}
        {selectedOrder && (
          <div className="flex-[2] bg-white rounded-lg shadow border p-6 overflow-y-auto relative animate-fade-in">
             <button 
               onClick={() => setSelectedOrder(null)}
               className="md:hidden absolute top-4 left-4 text-gray-500 hover:text-gray-900"
             >
               &larr; Back
             </button>
             <div className="md:mt-0 mt-8">
               <div className="flex justify-between items-center mb-4 border-b pb-4">
                 <div>
                    <h2 className="text-3xl font-bold text-gray-900">{selectedOrder.code}</h2>
                    <h3 className="text-xl text-gray-700">{selectedOrder.title}</h3>
                 </div>
                 <button 
                    onClick={handleAskAI}
                    className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 text-sm font-medium transition"
                 >
                   <Bot className="w-4 h-4" /> Explain
                 </button>
               </div>
               
               {aiExplanation && (
                 <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-100 text-purple-900 text-sm">
                   <h4 className="font-bold flex items-center gap-2 mb-2"><Bot className="w-4 h-4"/> AI Explanation</h4>
                   {aiExplanation}
                 </div>
               )}

               {aiLoading && (
                   <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-100 text-purple-900 text-sm animate-pulse">
                     Thinking...
                   </div>
               )}

               <div className="prose max-w-none text-gray-800 leading-relaxed whitespace-pre-wrap">
                 {selectedOrder.content}
               </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StandingOrders;
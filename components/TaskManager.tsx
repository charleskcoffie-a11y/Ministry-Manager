
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Task, TaskCategory, TaskPriority, TaskStatus } from '../types';
import { 
  CheckCircle2, Circle, Plus, Trash2, Calendar, 
  FileText, User, HeartHandshake, Mic2, BookOpen, 
  MessageCircle, Edit2, Clock, X, Layout, Filter,
  ClipboardList, Check
} from 'lucide-react';

const CATEGORIES: TaskCategory[] = ['Preaching', 'Visitation', 'Counseling', 'Administration', 'Prayer', 'Bible Study', 'Other'];
const PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High', 'Critical'];
const STATUSES: TaskStatus[] = ['Pending', 'In Progress', 'Completed'];

const TaskManager: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Partial<Task>>({
    title: '',
    category: 'Other',
    priority: 'Medium',
    status: 'Pending',
    task_date: new Date().toISOString().split('T')[0],
    description: ''
  });

  // Filter State
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('active');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('task_date', { ascending: true });
    
    if (!error && data) {
        // Handle migration gracefully if old data exists without new fields
        const processed = data.map(t => ({
            ...t,
            title: t.title || t.message || 'Untitled Task',
            category: t.category || 'Other',
            priority: t.priority || 'Medium',
            status: t.status || (t.is_completed ? 'Completed' : 'Pending'),
            // Keep legacy sync
            message: t.title || t.message
        }));
        setTasks(processed);
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask.title) return;

    // We map back to legacy fields (message/is_completed) to maintain compatibility if DB triggers use them
    const taskData = {
        title: editingTask.title,
        message: editingTask.title, // Legacy sync
        category: editingTask.category,
        priority: editingTask.priority,
        status: editingTask.status,
        task_date: editingTask.task_date,
        description: editingTask.description,
        is_completed: editingTask.status === 'Completed', // Legacy sync
        completed_at: editingTask.status === 'Completed' ? new Date().toISOString() : null
    };

    if (editingTask.id) {
        const { error } = await supabase.from('tasks').update(taskData).eq('id', editingTask.id);
        if (!error) fetchTasks();
    } else {
        const { error } = await supabase.from('tasks').insert([taskData]);
        if (!error) fetchTasks();
    }
    closeModal();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this task?")) return;
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (!error) fetchTasks();
  };

  const handleStatusChange = async (task: Task, newStatus: TaskStatus) => {
      const { error } = await supabase.from('tasks').update({
          status: newStatus,
          is_completed: newStatus === 'Completed',
          completed_at: newStatus === 'Completed' ? new Date().toISOString() : null
      }).eq('id', task.id);
      
      if (!error) {
          // Optimistic update
          setTasks(tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
          fetchTasks(); // Refresh to ensure sync
      }
  };

  const openNewTaskModal = (category: TaskCategory = 'Other') => {
      setEditingTask({
        title: '',
        category: category,
        priority: 'Medium',
        status: 'Pending',
        task_date: new Date().toISOString().split('T')[0],
        description: ''
      });
      setIsModalOpen(true);
  };

  const openEditModal = (task: Task) => {
      setEditingTask(task);
      setIsModalOpen(true);
  };

  const closeModal = () => {
      setIsModalOpen(false);
      setEditingTask({});
  };

  // --- Grouping & Sorting ---
  const groupedTasks = useMemo(() => {
      // 1. Filter
      const filtered = tasks.filter(t => {
          if (filterStatus === 'all') return true;
          if (filterStatus === 'completed') return t.status === 'Completed';
          return t.status !== 'Completed';
      });

      // 2. Group by Category
      const groups: Record<string, Task[]> = {};
      CATEGORIES.forEach(c => groups[c] = []); // Initialize all keys
      
      filtered.forEach(t => {
          if (groups[t.category]) {
              groups[t.category].push(t);
          } else {
              // Fallback for unknown categories or legacy data
              if(!groups['Other']) groups['Other'] = [];
              groups['Other'].push(t);
          }
      });

      // 3. Sort inside groups (Already sorted by date from DB, but secondary sort by Priority useful)
      Object.keys(groups).forEach(key => {
          groups[key].sort((a, b) => {
              // Primary: Date
              const dateA = new Date(a.task_date).getTime();
              const dateB = new Date(b.task_date).getTime();
              if (dateA !== dateB) return dateA - dateB;
              
              // Secondary: Priority Weight
              const pWeight = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
              return pWeight[a.priority] - pWeight[b.priority];
          });
      });

      return groups;
  }, [tasks, filterStatus]);

  // --- Helpers for UI ---
  const getCategoryTheme = (c: TaskCategory) => {
      switch(c) {
          case 'Preaching': return {
              bg: 'bg-indigo-50', header: 'text-indigo-800', iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600', border: 'border-indigo-100'
          };
          case 'Visitation': return {
              bg: 'bg-emerald-50', header: 'text-emerald-800', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', border: 'border-emerald-100'
          };
          case 'Counseling': return {
              bg: 'bg-rose-50', header: 'text-rose-800', iconBg: 'bg-rose-100', iconColor: 'text-rose-600', border: 'border-rose-100'
          };
          case 'Administration': return {
              bg: 'bg-slate-50', header: 'text-slate-700', iconBg: 'bg-slate-200', iconColor: 'text-slate-600', border: 'border-slate-200'
          };
          case 'Prayer': return {
              bg: 'bg-violet-50', header: 'text-violet-800', iconBg: 'bg-violet-100', iconColor: 'text-violet-600', border: 'border-violet-100'
          };
          case 'Bible Study': return {
              bg: 'bg-amber-50', header: 'text-amber-800', iconBg: 'bg-amber-100', iconColor: 'text-amber-600', border: 'border-amber-100'
          };
          default: return {
              bg: 'bg-gray-50', header: 'text-gray-700', iconBg: 'bg-gray-200', iconColor: 'text-gray-500', border: 'border-gray-200'
          };
      }
  };

  const getCategoryIcon = (c: TaskCategory) => {
      switch(c) {
          case 'Preaching': return <Mic2 className="w-5 h-5"/>;
          case 'Visitation': return <User className="w-5 h-5"/>;
          case 'Counseling': return <HeartHandshake className="w-5 h-5"/>;
          case 'Administration': return <ClipboardList className="w-5 h-5"/>;
          case 'Prayer': return <MessageCircle className="w-5 h-5"/>;
          case 'Bible Study': return <BookOpen className="w-5 h-5"/>;
          default: return <Circle className="w-5 h-5"/>;
      }
  };

  const getPriorityBorderColor = (p: TaskPriority) => {
      switch(p) {
          case 'Critical': return 'border-l-red-500';
          case 'High': return 'border-l-orange-500';
          case 'Medium': return 'border-l-blue-400';
          case 'Low': return 'border-l-gray-300';
          default: return 'border-l-gray-200';
      }
  };

  const getPriorityBadgeColor = (p: TaskPriority) => {
      switch(p) {
          case 'Critical': return 'text-red-600 bg-red-50 border border-red-100';
          case 'High': return 'text-orange-600 bg-orange-50 border border-orange-100';
          case 'Medium': return 'text-blue-600 bg-blue-50 border border-blue-100';
          case 'Low': return 'text-gray-500 bg-gray-100 border border-gray-200';
      }
  };

  return (
    <div className="max-w-[1600px] mx-auto pb-12 animate-fade-in">
      
      {/* 1. Hero / Header Section */}
      <div className="relative bg-gradient-to-r from-blue-900 to-slate-800 rounded-3xl p-8 md:p-10 mb-10 shadow-lg text-white overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
              <Layout className="w-64 h-64 text-white" />
          </div>
          
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div>
                  <div className="flex items-center gap-3 mb-2 text-blue-200 font-semibold tracking-wide uppercase text-sm">
                      <CheckCircle2 className="w-5 h-5" />
                      Ministry Management
                  </div>
                  <h1 className="text-4xl md:text-5xl font-bold mb-2 tracking-tight">Pastoral Tracker</h1>
                  <p className="text-blue-100 text-lg md:text-xl font-light max-w-xl opacity-90">
                      Manage preaching, visitation, and ministry duties with care and excellence.
                  </p>
              </div>

              <button 
                onClick={() => openNewTaskModal()}
                className="bg-white text-blue-900 px-6 py-3 rounded-full hover:bg-blue-50 flex items-center gap-2 font-bold shadow-lg transition-transform active:scale-95 text-lg"
             >
                 <Plus className="w-5 h-5" /> New Task
             </button>
          </div>
      </div>

      {/* 2. Controls & Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
         <div className="flex items-center gap-2 bg-white p-1.5 rounded-full shadow-sm border border-gray-100">
             {['active', 'completed', 'all'].map((s) => (
                 <button
                    key={s}
                    onClick={() => setFilterStatus(s as any)}
                    className={`px-6 py-2 rounded-full text-sm font-bold capitalize transition-all duration-300 ${
                        filterStatus === s 
                        ? 'bg-slate-800 text-white shadow-md transform scale-105' 
                        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                    }`}
                 >
                     {s}
                 </button>
             ))}
         </div>
         
         <div className="text-gray-400 text-sm font-medium flex items-center gap-2">
             <Filter className="w-4 h-4" />
             Showing {tasks.filter(t => filterStatus === 'all' ? true : filterStatus === 'completed' ? t.status === 'Completed' : t.status !== 'Completed').length} tasks
         </div>
      </div>

      {/* 3. Ministry Categories Grid */}
      {loading ? (
          <div className="flex justify-center py-32 text-gray-400">
              <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <p>Loading pastoral records...</p>
              </div>
          </div>
      ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
              {CATEGORIES.map(category => {
                  const items = groupedTasks[category];
                  const theme = getCategoryTheme(category);

                  return (
                      <div key={category} className={`rounded-xl p-3 border transition-colors flex flex-col gap-3 min-h-[160px] ${theme.bg} ${theme.border}`}>
                          {/* Category Header */}
                          <div className="flex justify-between items-center px-1 pt-1">
                             <div className="flex items-center gap-3">
                                 <div className={`p-2 rounded-xl ${theme.iconBg} ${theme.iconColor}`}>
                                     {getCategoryIcon(category)}
                                 </div>
                                 <div>
                                     <h3 className={`font-bold text-base leading-none ${theme.header}`}>{category}</h3>
                                     <span className="text-[11px] font-semibold opacity-60 text-gray-600">{items.length} Tasks</span>
                                 </div>
                             </div>
                             <button 
                                onClick={() => openNewTaskModal(category)} 
                                className={`w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/50 transition-colors ${theme.iconColor}`}
                             >
                                 <Plus className="w-5 h-5" />
                             </button>
                          </div>

                          {/* Task List */}
                          <div className="space-y-2.5 flex-1">
                              {items.length === 0 && (
                                  <div className="h-28 flex flex-col items-center justify-center text-center p-3 border-2 border-dashed border-gray-300/50 rounded-xl">
                                      <div className="opacity-30 mb-2">{getCategoryIcon(category)}</div>
                                      <p className="text-gray-400 text-xs font-medium">No tasks yet.</p>
                                      <button onClick={() => openNewTaskModal(category)} className="text-[11px] font-bold text-gray-400 hover:text-gray-600 mt-1">Tap + to add</button>
                                  </div>
                              )}
                              
                              {items.map(task => (
                                                                    <div 
                                    key={task.id} 
                                                                        className={`bg-white p-3 rounded-lg shadow-sm hover:shadow-md transition-all group relative border-l-4 ${getPriorityBorderColor(task.priority)} overflow-hidden`}
                                  >
                                      {/* Top Row: Date & Priority */}
                                      <div className="flex justify-between items-start mb-1.5">
                                          <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${getPriorityBadgeColor(task.priority)}`}>
                                              {task.priority}
                                          </div>
                                          {task.task_date && (
                                              <span className={`text-[11px] font-bold flex items-center gap-1.5 ${new Date(task.task_date) < new Date() && task.status !== 'Completed' ? 'text-rose-500' : 'text-gray-400'}`}>
                                                  <Calendar className="w-3 h-3" />
                                                  {new Date(task.task_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                              </span>
                                          )}
                                      </div>

                                      {/* Content */}
                                      <h3 className={`font-bold text-gray-800 text-sm mb-0.5 leading-snug ${task.status === 'Completed' ? 'line-through opacity-50' : ''}`}>
                                          {task.title}
                                      </h3>
                                      
                                      {task.description && (
                                          <p className={`text-[11px] text-gray-500 line-clamp-1 mb-2 ${task.status === 'Completed' ? 'opacity-50' : ''}`}>
                                              {task.description}
                                          </p>
                                      )}

                                      {/* Actions Footer */}
                                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                                          <button 
                                            onClick={() => handleStatusChange(task, task.status === 'Completed' ? 'Pending' : 'Completed')}
                                            className={`flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-md transition-colors ${
                                                task.status === 'Completed' 
                                                ? 'bg-green-50 text-green-700' 
                                                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                            }`}
                                          >
                                              {task.status === 'Completed' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                                              {task.status === 'Completed' ? 'Done' : 'Mark Done'}
                                          </button>

                                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <button onClick={() => openEditModal(task)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                                  <Edit2 className="w-3.5 h-3.5" />
                                              </button>
                                              <button onClick={() => handleDelete(task.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                  <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                          </div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  );
              })}
          </div>
      )}

      {/* --- ADD / EDIT MODAL --- */}
      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-gray-100 transform transition-all scale-100">
                  <form onSubmit={handleSave}>
                      <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                          <div>
                              <h3 className="font-bold text-xl text-gray-900">{editingTask.id ? 'Edit Task' : 'New Pastoral Task'}</h3>
                              <p className="text-xs text-gray-500 mt-1">Fill in the details below</p>
                          </div>
                          <button type="button" onClick={closeModal} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors">
                              <X className="w-5 h-5" />
                          </button>
                      </div>
                      
                      <div className="p-8 space-y-6">
                          {/* Title */}
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-2">Task Title</label>
                              <input 
                                required
                                type="text" 
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium text-gray-800 placeholder-gray-400"
                                placeholder="e.g. Prepare Sermon for Sunday"
                                value={editingTask.title}
                                onChange={e => setEditingTask({...editingTask, title: e.target.value})}
                              />
                          </div>

                          <div className="grid grid-cols-2 gap-6">
                              {/* Category */}
                              <div>
                                  <label className="block text-sm font-bold text-gray-700 mb-2">Category</label>
                                  <div className="relative">
                                      <select 
                                        className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium appearance-none"
                                        value={editingTask.category}
                                        onChange={e => setEditingTask({...editingTask, category: e.target.value as TaskCategory})}
                                      >
                                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                      </select>
                                      <div className="absolute right-4 top-3.5 pointer-events-none text-gray-400">
                                          <Filter className="w-4 h-4" />
                                      </div>
                                  </div>
                              </div>
                              
                              {/* Due Date */}
                              <div>
                                  <label className="block text-sm font-bold text-gray-700 mb-2">Due Date</label>
                                  <input 
                                    type="date" 
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-600"
                                    value={editingTask.task_date}
                                    onChange={e => setEditingTask({...editingTask, task_date: e.target.value})}
                                  />
                              </div>
                          </div>

                          <div className="grid grid-cols-2 gap-6">
                              {/* Priority */}
                              <div>
                                  <label className="block text-sm font-bold text-gray-700 mb-2">Priority</label>
                                  <select 
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                                    value={editingTask.priority}
                                    onChange={e => setEditingTask({...editingTask, priority: e.target.value as TaskPriority})}
                                  >
                                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                                  </select>
                              </div>

                              {/* Status */}
                              <div>
                                  <label className="block text-sm font-bold text-gray-700 mb-2">Status</label>
                                  <select 
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                                    value={editingTask.status}
                                    onChange={e => setEditingTask({...editingTask, status: e.target.value as TaskStatus})}
                                  >
                                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                              </div>
                          </div>

                          {/* Description */}
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-2">Description <span className="text-gray-400 font-normal">(Optional)</span></label>
                              <textarea 
                                rows={3}
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none resize-none text-gray-700 leading-relaxed"
                                placeholder="Add specific details, bible verses, or address..."
                                value={editingTask.description || ''}
                                onChange={e => setEditingTask({...editingTask, description: e.target.value})}
                              />
                          </div>
                          
                          {/* Reminder Toggle (Visual Only) */}
                          <div className="flex items-center gap-3 bg-blue-50 p-4 rounded-xl border border-blue-100">
                             <div className="p-2 bg-white rounded-full text-blue-500 shadow-sm">
                                <Clock className="w-4 h-4" />
                             </div>
                             <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium text-blue-900">
                                 <input type="checkbox" className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300" />
                                 Enable notifications for this task
                             </label>
                          </div>
                      </div>

                      <div className="px-8 py-5 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                          <button type="button" onClick={closeModal} className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-colors">
                              Cancel
                          </button>
                          <button type="submit" className="px-8 py-3 bg-slate-900 text-white font-bold hover:bg-black rounded-xl transition-transform active:scale-95 shadow-md flex items-center gap-2">
                              {editingTask.id ? 'Save Changes' : 'Create Task'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default TaskManager;

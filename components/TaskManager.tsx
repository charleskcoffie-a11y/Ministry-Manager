
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Task, TaskCategory, TaskPriority, TaskStatus } from '../types';
import { 
  CheckCircle2, Circle, Plus, Trash2, Calendar, 
  FileText, User, HeartHandshake, Mic2, BookOpen, 
  MessageCircle, Edit2, Clock, X, AlertTriangle, LayoutGrid, List
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
  const getPriorityColor = (p: TaskPriority) => {
      switch(p) {
          case 'Critical': return 'bg-red-100 text-red-800 border-red-200';
          case 'High': return 'bg-orange-100 text-orange-800 border-orange-200';
          case 'Medium': return 'bg-blue-50 text-blue-700 border-blue-100';
          case 'Low': return 'bg-gray-100 text-gray-600 border-gray-200';
          default: return 'bg-gray-50 text-gray-600';
      }
  };

  const getCategoryIcon = (c: TaskCategory) => {
      switch(c) {
          case 'Preaching': return <Mic2 className="w-5 h-5 text-indigo-500"/>;
          case 'Visitation': return <User className="w-5 h-5 text-green-500"/>;
          case 'Counseling': return <HeartHandshake className="w-5 h-5 text-pink-500"/>;
          case 'Administration': return <FileText className="w-5 h-5 text-gray-500"/>;
          case 'Prayer': return <MessageCircle className="w-5 h-5 text-purple-500"/>;
          case 'Bible Study': return <BookOpen className="w-5 h-5 text-blue-500"/>;
          default: return <Circle className="w-5 h-5 text-slate-400"/>;
      }
  };

  return (
    <div className="max-w-7xl mx-auto pb-12 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 flex items-center gap-3">
                <CheckCircle2 className="w-10 h-10 text-primary" />
                Pastoral Tracker
            </h1>
            <p className="text-gray-500 mt-1">Manage preaching, visitation, and ministry duties.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
             {/* View Filter */}
             <div className="bg-white rounded-lg p-1 border border-gray-200 flex">
                 {['active', 'completed', 'all'].map((s) => (
                     <button
                        key={s}
                        onClick={() => setFilterStatus(s as any)}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-all ${filterStatus === s ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                     >
                         {s}
                     </button>
                 ))}
             </div>

             <button 
                onClick={() => openNewTaskModal()}
                className="bg-primary text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 flex items-center gap-2 font-medium shadow-sm transition-transform active:scale-95"
             >
                 <Plus className="w-5 h-5" /> New Task
             </button>
          </div>
      </div>

      {loading ? (
          <div className="flex justify-center py-20 text-gray-400">Loading tasks...</div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
              {CATEGORIES.map(category => {
                  const items = groupedTasks[category];
                  // If hiding empty categories is desired, uncomment next line
                  // if (items.length === 0 && filterStatus === 'active') return null;

                  return (
                      <div key={category} className="bg-gray-50 rounded-2xl p-4 border border-gray-200 flex flex-col gap-3 min-h-[150px]">
                          {/* Category Header */}
                          <div className="flex justify-between items-center px-1">
                             <div className="flex items-center gap-2 font-bold text-gray-700">
                                 {getCategoryIcon(category)}
                                 {category}
                                 <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">{items.length}</span>
                             </div>
                             <button onClick={() => openNewTaskModal(category)} className="text-gray-400 hover:text-primary transition-colors p-1 hover:bg-gray-200 rounded">
                                 <Plus className="w-4 h-4" />
                             </button>
                          </div>

                          {/* Task List */}
                          <div className="space-y-3 flex-1">
                              {items.length === 0 && (
                                  <div className="h-full flex flex-col items-center justify-center text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl bg-white/50">
                                      No tasks
                                  </div>
                              )}
                              {items.map(task => (
                                  <div key={task.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group relative">
                                      {/* Status & Priority Badge */}
                                      <div className="flex justify-between items-start mb-2">
                                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getPriorityColor(task.priority)}`}>
                                              {task.priority}
                                          </span>
                                          {task.task_date && (
                                              <span className={`text-xs font-medium flex items-center gap-1 ${new Date(task.task_date) < new Date() && task.status !== 'Completed' ? 'text-red-600' : 'text-gray-400'}`}>
                                                  <Calendar className="w-3 h-3" />
                                                  {new Date(task.task_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                              </span>
                                          )}
                                      </div>

                                      {/* Title */}
                                      <h3 className={`font-bold text-gray-800 mb-1 leading-snug ${task.status === 'Completed' ? 'line-through opacity-60' : ''}`}>
                                          {task.title}
                                      </h3>

                                      {/* Actions Bar (Bottom) */}
                                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                                          {/* Status Toggle */}
                                          <div className="relative">
                                            <select 
                                                value={task.status}
                                                onChange={(e) => handleStatusChange(task, e.target.value as TaskStatus)}
                                                className={`text-xs font-medium bg-transparent border-none focus:ring-0 cursor-pointer pr-4 appearance-none ${
                                                    task.status === 'Completed' ? 'text-green-600' : 
                                                    task.status === 'In Progress' ? 'text-blue-600' : 'text-gray-500'
                                                }`}
                                            >
                                                <option value="Pending">Pending</option>
                                                <option value="In Progress">In Progress</option>
                                                <option value="Completed">Completed</option>
                                            </select>
                                          </div>

                                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <button onClick={() => openEditModal(task)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                                                  <Edit2 className="w-3.5 h-3.5" />
                                              </button>
                                              <button onClick={() => handleDelete(task.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
              <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
                  <form onSubmit={handleSave}>
                      <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                          <h3 className="font-bold text-lg text-gray-800">{editingTask.id ? 'Edit Task' : 'New Pastoral Task'}</h3>
                          <button type="button" onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                              <X className="w-5 h-5" />
                          </button>
                      </div>
                      
                      <div className="p-6 space-y-4">
                          {/* Title */}
                          <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">Task Title</label>
                              <input 
                                required
                                type="text" 
                                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                                placeholder="e.g. Prepare Sermon for Sunday"
                                value={editingTask.title}
                                onChange={e => setEditingTask({...editingTask, title: e.target.value})}
                              />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                              {/* Category */}
                              <div>
                                  <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
                                  <select 
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-primary outline-none bg-white"
                                    value={editingTask.category}
                                    onChange={e => setEditingTask({...editingTask, category: e.target.value as TaskCategory})}
                                  >
                                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                  </select>
                              </div>
                              
                              {/* Due Date */}
                              <div>
                                  <label className="block text-sm font-semibold text-gray-700 mb-1">Due Date</label>
                                  <input 
                                    type="date" 
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-primary outline-none"
                                    value={editingTask.task_date}
                                    onChange={e => setEditingTask({...editingTask, task_date: e.target.value})}
                                  />
                              </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                              {/* Priority */}
                              <div>
                                  <label className="block text-sm font-semibold text-gray-700 mb-1">Priority</label>
                                  <select 
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-primary outline-none bg-white"
                                    value={editingTask.priority}
                                    onChange={e => setEditingTask({...editingTask, priority: e.target.value as TaskPriority})}
                                  >
                                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                                  </select>
                              </div>

                              {/* Status */}
                              <div>
                                  <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                                  <select 
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-primary outline-none bg-white"
                                    value={editingTask.status}
                                    onChange={e => setEditingTask({...editingTask, status: e.target.value as TaskStatus})}
                                  >
                                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                              </div>
                          </div>

                          {/* Description */}
                          <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">Description (Optional)</label>
                              <textarea 
                                rows={3}
                                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary outline-none resize-none"
                                placeholder="Add specific details, bible verses, or address..."
                                value={editingTask.description || ''}
                                onChange={e => setEditingTask({...editingTask, description: e.target.value})}
                              />
                          </div>
                          
                          {/* Reminder Toggle (Visual Only) */}
                          <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-200">
                             <Clock className="w-4 h-4 text-primary" />
                             <label className="flex items-center gap-2 cursor-pointer select-none">
                                 <input type="checkbox" className="rounded text-primary focus:ring-primary" />
                                 Enable notifications for this task
                             </label>
                          </div>
                      </div>

                      <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
                          <button type="button" onClick={closeModal} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-xl transition-colors">
                              Cancel
                          </button>
                          <button type="submit" className="px-5 py-2.5 bg-primary text-white font-medium hover:bg-blue-700 rounded-xl transition-colors shadow-sm">
                              Save Task
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

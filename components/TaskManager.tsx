import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Task } from '../types';
import { CheckCircle2, Circle, Plus, Trash, Filter } from 'lucide-react';

const TaskManager: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');
  const [taskDate, setTaskDate] = useState(new Date().toISOString().split('T')[0]);
  const [filter, setFilter] = useState<'all' | 'open' | 'completed'>('open');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('task_date', { ascending: true })
      .order('is_completed', { ascending: true }); // Open tasks first
    
    if (!error && data) setTasks(data);
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;

    const { error } = await supabase.from('tasks').insert([{
      message: newTask,
      task_date: taskDate,
      is_completed: false
    }]);

    if (!error) {
      setNewTask('');
      fetchTasks();
    }
  };

  const toggleTask = async (task: Task) => {
    const newStatus = !task.is_completed;
    const { error } = await supabase
      .from('tasks')
      .update({ 
        is_completed: newStatus,
        completed_at: newStatus ? new Date().toISOString() : null 
      })
      .eq('id', task.id);

    if (!error) fetchTasks();
  };

  const deleteTask = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (!error) fetchTasks();
  };

  const filteredTasks = tasks.filter(t => {
    if (filter === 'open') return !t.is_completed;
    if (filter === 'completed') return t.is_completed;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Ministry Tasks</h1>

      {/* Add Task Input */}
      <form onSubmit={addTask} className="bg-white p-4 rounded-lg shadow-md mb-6 flex flex-col sm:flex-row gap-3">
        <input 
          type="date"
          required
          value={taskDate}
          onChange={(e) => setTaskDate(e.target.value)}
          className="border rounded px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary sm:w-40"
        />
        <input 
          type="text"
          required
          placeholder="What needs to be done?"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          className="flex-1 border rounded px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button type="submit" className="bg-primary text-white px-6 py-2 rounded hover:bg-blue-700 flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Add
        </button>
      </form>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
        <Filter className="w-4 h-4 text-gray-500" />
        {['all', 'open', 'completed'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-3 py-1 rounded-full text-sm capitalize ${filter === f ? 'bg-secondary text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
         {filteredTasks.length === 0 ? (
           <div className="p-8 text-center text-gray-500">No tasks found.</div>
         ) : (
           <ul className="divide-y divide-gray-100">
             {filteredTasks.map(task => (
               <li key={task.id} className={`p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors ${task.is_completed ? 'bg-gray-50' : ''}`}>
                 <button 
                   onClick={() => toggleTask(task)}
                   className={`flex-shrink-0 ${task.is_completed ? 'text-green-500' : 'text-gray-300 hover:text-primary'}`}
                 >
                   {task.is_completed ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                 </button>
                 <div className="flex-1 min-w-0">
                   <p className={`text-base font-medium truncate ${task.is_completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                     {task.message}
                   </p>
                   <p className="text-xs text-gray-500">
                     Due: {new Date(task.task_date).toLocaleDateString()}
                     {task.completed_at && <span> • Completed</span>}
                   </p>
                 </div>
                 <button onClick={() => deleteTask(task.id)} className="text-gray-400 hover:text-red-500">
                   <Trash className="w-4 h-4" />
                 </button>
               </li>
             ))}
           </ul>
         )}
      </div>
    </div>
  );
};

export default TaskManager;
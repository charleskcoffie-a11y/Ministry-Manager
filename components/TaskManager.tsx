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
    <div className="max-w-5xl mx-auto">
      <h1 className="text-4xl font-bold text-gray-800 mb-8">Ministry Tasks</h1>

      {/* Add Task Input */}
      <form onSubmit={addTask} className="bg-white p-6 rounded-lg shadow-md mb-8 flex flex-col sm:flex-row gap-4">
        <input 
          type="date"
          required
          value={taskDate}
          onChange={(e) => setTaskDate(e.target.value)}
          className="border rounded px-4 py-3 text-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary sm:w-48"
        />
        <input 
          type="text"
          required
          placeholder="What needs to be done?"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          className="flex-1 border rounded px-4 py-3 text-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button type="submit" className="bg-primary text-white px-8 py-3 rounded hover:bg-blue-700 flex items-center justify-center gap-2 text-lg font-medium">
          <Plus className="w-6 h-6" /> Add
        </button>
      </form>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 overflow-x-auto pb-2">
        <Filter className="w-5 h-5 text-gray-500" />
        {['all', 'open', 'completed'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-4 py-2 rounded-full text-base font-medium capitalize ${filter === f ? 'bg-secondary text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
         {filteredTasks.length === 0 ? (
           <div className="p-10 text-center text-xl text-gray-500">No tasks found.</div>
         ) : (
           <ul className="divide-y divide-gray-100">
             {filteredTasks.map(task => (
               <li key={task.id} className={`p-6 flex items-center gap-5 hover:bg-gray-50 transition-colors ${task.is_completed ? 'bg-gray-50' : ''}`}>
                 <button 
                   onClick={() => toggleTask(task)}
                   className={`flex-shrink-0 ${task.is_completed ? 'text-green-500' : 'text-gray-300 hover:text-primary'}`}
                 >
                   {task.is_completed ? <CheckCircle2 className="w-8 h-8" /> : <Circle className="w-8 h-8" />}
                 </button>
                 <div className="flex-1 min-w-0">
                   <p className={`text-2xl font-medium truncate ${task.is_completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                     {task.message}
                   </p>
                   <p className="text-base text-gray-500 mt-1">
                     Due: {new Date(task.task_date).toLocaleDateString()}
                     {task.completed_at && <span> • Completed</span>}
                   </p>
                 </div>
                 <button onClick={() => deleteTask(task.id)} className="text-gray-400 hover:text-red-500 p-2">
                   <Trash className="w-6 h-6" />
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
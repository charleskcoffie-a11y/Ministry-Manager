import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Layout from './components/Layout';
import Auth from './components/Auth';
import ProgramManager from './components/ProgramManager';
import StandingOrders from './components/StandingOrders';
import TaskManager from './components/TaskManager';
import IdeasJournal from './components/IdeasJournal';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center bg-gray-50 text-primary">Loading...</div>;
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={!session ? <Auth /> : <Navigate to="/" />} />
        
        <Route path="/" element={session ? <Layout><ProgramManager /></Layout> : <Navigate to="/login" />} />
        <Route path="/standing-orders" element={session ? <Layout><StandingOrders /></Layout> : <Navigate to="/login" />} />
        <Route path="/tasks" element={session ? <Layout><TaskManager /></Layout> : <Navigate to="/login" />} />
        <Route path="/ideas" element={session ? <Layout><IdeasJournal /></Layout> : <Navigate to="/login" />} />
        
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
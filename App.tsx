
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './components/Home';
import ProgramManager from './components/ProgramManager';
import StandingOrders from './components/StandingOrders';
import TaskManager from './components/TaskManager';
import ReminderSystem from './components/ReminderSystem';
import CounselingManager from './components/CounselingManager';
import IdeasJournal from './components/IdeasJournal';
import Settings from './components/Settings';
import Devotion from './components/Devotion';
import ChristianCalendar from './components/ChristianCalendar';
import SermonBuilder from './components/SermonBuilder';
import Hymnal from './components/Hymnal';

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route 
          path="/" 
          element={<Layout><Home /></Layout>} 
        />
        
        <Route 
          path="/programs" 
          element={<Layout><ProgramManager /></Layout>} 
        />

        <Route 
          path="/sermons" 
          element={<Layout><SermonBuilder /></Layout>} 
        />

        <Route 
          path="/devotion" 
          element={<Layout><Devotion /></Layout>} 
        />

        <Route 
          path="/hymnal" 
          element={<Layout><Hymnal /></Layout>} 
        />

        <Route 
          path="/christian-calendar" 
          element={<Layout><ChristianCalendar /></Layout>} 
        />

        <Route 
          path="/standing-orders" 
          element={<Layout><StandingOrders /></Layout>} 
        />
        
        <Route 
          path="/tasks" 
          element={<Layout><TaskManager /></Layout>} 
        />

        <Route 
          path="/reminders" 
          element={<Layout><ReminderSystem /></Layout>} 
        />
        
        <Route 
          path="/counseling" 
          element={<Layout><CounselingManager /></Layout>} 
        />
        
        <Route 
          path="/ideas" 
          element={<Layout><IdeasJournal /></Layout>} 
        />
        
        <Route 
          path="/settings" 
          element={<Layout><Settings /></Layout>} 
        />
        
        {/* Redirect unknown paths to home */}
        <Route 
          path="*" 
          element={<Navigate to="/" replace />} 
        />
      </Routes>
    </HashRouter>
  );
};

export default App;

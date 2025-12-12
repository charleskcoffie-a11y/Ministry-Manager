
import React, { useState, Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Layout from './components/Layout';
import PINLock from './components/PINLock';

// Lazy load route components for code splitting
const Home = lazy(() => import('./components/Home'));
const ProgramManager = lazy(() => import('./components/ProgramManager'));
const StandingOrders = lazy(() => import('./components/StandingOrders'));
const TaskManager = lazy(() => import('./components/TaskManager'));
const ReminderSystem = lazy(() => import('./components/ReminderSystem'));
const CounselingManager = lazy(() => import('./components/CounselingManager'));
const IdeasJournal = lazy(() => import('./components/IdeasJournal'));
const Settings = lazy(() => import('./components/Settings'));
const Devotion = lazy(() => import('./components/Devotion'));
const ChristianCalendar = lazy(() => import('./components/ChristianCalendar'));
const SermonBuilder = lazy(() => import('./components/SermonBuilder'));
const Hymnal = lazy(() => import('./components/Hymnal'));
const SermonNotes = lazy(() => import('./components/SermonNotes'));
const MeetingMinutes = lazy(() => import('./components/MeetingMinutes'));

// Loading component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      <p className="text-sm text-gray-600 font-medium">Loading...</p>
    </div>
  </div>
);

const App: React.FC = () => {
  // Check session storage to see if already unlocked in this browser session
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem('ministryAppUnlocked') === 'true';
  });

  const handleUnlock = () => {
    sessionStorage.setItem('ministryAppUnlocked', 'true');
    setIsUnlocked(true);
  };

  if (!isUnlocked) {
    return <PINLock onUnlock={handleUnlock} />;
  }

  return (
    <HashRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<Layout><Home /></Layout>} />
          
          <Route path="/programs" element={<Layout><ProgramManager /></Layout>} />

          <Route path="/sermons" element={<Layout><SermonBuilder /></Layout>} />

          <Route path="/sermon-notes" element={<Layout><SermonNotes /></Layout>} />

          <Route path="/devotion" element={<Layout><Devotion /></Layout>} />

          <Route path="/hymnal" element={<Layout><Hymnal /></Layout>} />

          <Route path="/christian-calendar" element={<Layout><ChristianCalendar /></Layout>} />

          <Route path="/standing-orders" element={<Layout><StandingOrders /></Layout>} />
          
          <Route path="/tasks" element={<Layout><TaskManager /></Layout>} />

          <Route path="/meetings" element={<Layout><MeetingMinutes /></Layout>} />

          <Route path="/reminders" element={<Layout><ReminderSystem /></Layout>} />
          
          <Route path="/counseling" element={<Layout><CounselingManager /></Layout>} />
          
          <Route path="/ideas" element={<Layout><IdeasJournal /></Layout>} />
          
          <Route path="/settings" element={<Layout><Settings /></Layout>} />
          
          {/* Redirect unknown paths to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
};

export default App;

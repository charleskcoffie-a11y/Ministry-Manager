
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Book, CheckSquare, Lightbulb, Menu, X, Settings, 
  Home, Calendar, Music, Bell, Scroll, Flame, HeartHandshake, 
  Church, ChevronRight, PenTool
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const location = useLocation();

  const isActiveLink = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  // Navigation Structure
  const navGroups = [
    {
      title: 'Overview',
      items: [
        { to: '/', label: 'Home', icon: Home, showOnBottom: true },
      ]
    },
    {
      title: 'Pastoral Ministry',
      items: [
        { to: '/sermons', label: 'Sermon Builder', icon: Scroll, showOnBottom: true },
        { to: '/sermon-notes', label: 'Sermon Notes', icon: PenTool, showOnBottom: true },
        { to: '/devotion', label: 'Devotion', icon: Flame, showOnBottom: true },
        { to: '/hymnal', label: 'Canticles & Hymns', icon: Music, showOnBottom: true },
        { to: '/christian-calendar', label: 'Calendar', icon: Calendar, showOnBottom: false },
        { to: '/counseling', label: 'Counseling', icon: HeartHandshake, showOnBottom: false },
        { to: '/ideas', label: 'Ideas Journal', icon: Lightbulb, showOnBottom: false },
      ]
    },
    {
      title: 'Administration',
      items: [
        { to: '/programs', label: 'Programs', icon: LayoutDashboard, showOnBottom: true },
        { to: '/tasks', label: 'Tasks', icon: CheckSquare, showOnBottom: false },
        { to: '/reminders', label: 'Reminders', icon: Bell, showOnBottom: false },
        { to: '/standing-orders', label: 'Constitution', icon: Book, showOnBottom: false },
        { to: '/settings', label: 'Settings', icon: Settings, showOnBottom: false },
      ]
    }
  ];

  // Flattened items for mobile bottom bar logic
  const bottomTabs = navGroups.flatMap(g => g.items).filter(i => i.showOnBottom).slice(0, 5); // Limit to 5 for space

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar (Desktop & Mobile Drawer) */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-gradient-to-b from-slate-900 via-[#1e1b4b] to-slate-900 text-white transform transition-transform duration-300 ease-out 
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static shadow-2xl lg:shadow-none border-r border-white/5 flex flex-col`}
      >
        {/* Brand Header */}
        <div className="h-24 flex items-center px-8 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg shadow-indigo-500/30 text-white">
                <Church className="w-6 h-6" />
             </div>
             <div>
                <h1 className="text-xl font-bold tracking-tight text-white leading-none">
                  MINISTRY <span className="text-indigo-400">MGR</span>
                </h1>
                <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase mt-1">
                  Pastoral Suite
                </p>
             </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto p-2 text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* Scrollable Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-8 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {navGroups.map((group, idx) => (
            <div key={idx}>
              {group.title && (
                <h3 className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  {group.title}
                  <div className="h-px bg-slate-800 flex-1"></div>
                </h3>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = isActiveLink(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setSidebarOpen(false)}
                      className={`group relative flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 
                        ${active 
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-900/50 translate-x-1' 
                          : 'text-slate-400 hover:text-slate-100 hover:bg-white/5 hover:translate-x-1'
                        }`}
                    >
                      <item.icon className={`w-5 h-5 mr-3 transition-colors ${active ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'}`} />
                      <span className="flex-1">{item.label}</span>
                      {active && <ChevronRight className="w-4 h-4 opacity-50" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User / Footer Area */}
        <div className="p-4 border-t border-white/5 bg-black/20">
            <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold text-white ring-2 ring-indigo-400/30">
                    RC
                </div>
                <div className="overflow-hidden">
                    <p className="text-sm font-medium text-white truncate">Rev. Coffie</p>
                    <p className="text-xs text-slate-500 truncate">North America Diocese</p>
                </div>
            </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen relative bg-gray-50/50">
        
        {/* Mobile Header */}
        <header className="lg:hidden h-16 bg-white/90 backdrop-blur-md border-b border-gray-100 flex items-center px-4 justify-between z-40 sticky top-0 shadow-sm">
          <div className="flex items-center gap-2">
              <Church className="w-6 h-6 text-indigo-600" />
              <span className="font-bold text-lg text-gray-800">
                Ministry Mgr
              </span>
          </div>
          <button onClick={() => setSidebarOpen(true)} className="p-2 -mr-2 text-gray-600 hover:bg-gray-100 rounded-full active:scale-95 transition-all">
             <Menu className="w-6 h-6" />
          </button>
        </header>

        {/* Main Body */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-10 pb-28 lg:pb-10 scroll-smooth">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 pb-[env(safe-area-inset-bottom)] flex justify-around items-center h-[72px] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
            {bottomTabs.map(item => {
               const active = isActiveLink(item.to);
               return (
                <Link 
                    key={item.to} 
                    to={item.to} 
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 active:scale-90 transition-transform relative ${active ? 'text-indigo-600' : 'text-gray-400'}`}
                >
                    {active && <div className="absolute top-0 w-12 h-1 bg-indigo-600 rounded-b-full"></div>}
                    <item.icon className={`w-6 h-6 ${active ? 'fill-indigo-50' : ''}`} />
                    <span className="text-[10px] font-medium leading-none">{item.label.split(' ')[0]}</span>
                </Link>
               );
            })}
            
            <button 
                onClick={() => setSidebarOpen(true)}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 active:scale-90 transition-transform ${sidebarOpen ? 'text-indigo-600' : 'text-gray-400'}`}
            >
                <Menu className="w-6 h-6" />
                <span className="text-[10px] font-medium leading-none">Menu</span>
            </button>
        </div>
      </div>
    </div>
  );
};

export default Layout;

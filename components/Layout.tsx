
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Book, CheckSquare, Lightbulb, Menu, X, Settings, Home, Heart, Calendar, PenTool, Music, Bell, ShieldCheck } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const location = useLocation();

  // Navigation Items Config
  const navItems = [
    { to: '/', label: 'Home', icon: Home, showOnBottom: true },
    { to: '/programs', label: 'Programs', icon: LayoutDashboard, showOnBottom: true },
    { to: '/sermons', label: 'Sermon Builder', icon: PenTool, showOnBottom: true },
    { to: '/devotion', label: 'Devotion', icon: Heart, showOnBottom: true },
    { to: '/hymnal', label: 'Canticles & Hymns', icon: Music, showOnBottom: true },
    { to: '/christian-calendar', label: 'Calendar', icon: Calendar, showOnBottom: false },
    { to: '/tasks', label: 'Tasks', icon: CheckSquare, showOnBottom: false },
    { to: '/reminders', label: 'Reminders', icon: Bell, showOnBottom: false },
    { to: '/counseling', label: 'Counseling', icon: ShieldCheck, showOnBottom: false },
    { to: '/standing-orders', label: 'Constitution', icon: Book, showOnBottom: false },
    { to: '/ideas', label: 'Ideas', icon: Lightbulb, showOnBottom: false },
    { to: '/settings', label: 'Settings', icon: Settings, showOnBottom: false },
  ];

  const isActiveLink = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const bottomTabs = navItems.filter(i => i.showOnBottom);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Sidebar Overlay (Drawer) */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-50"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar (Desktop: Static, Mobile: Drawer) */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static shadow-2xl lg:shadow-none`}>
        <div className="h-16 flex items-center justify-between px-6 bg-slate-800 font-bold text-2xl tracking-wider">
          <span>MINISTRY<span className="text-primary ml-1">MGR</span></span>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <nav className="mt-6 px-4 space-y-3 pb-24 lg:pb-0 overflow-y-auto max-h-[calc(100vh-4rem)]">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center px-5 py-4 text-lg font-medium rounded-xl transition-colors ${isActiveLink(item.to) ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
            >
              <item.icon className="w-6 h-6 mr-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-screen relative">
        {/* Mobile Header (Title & Context) */}
        <header className="lg:hidden h-16 bg-white shadow-sm flex items-center px-4 justify-between z-10 flex-shrink-0">
          <span className="font-bold text-xl text-gray-800 truncate">
             {navItems.find(i => isActiveLink(i.to))?.label || 'Ministry Manager'}
          </span>
          {/* We hide the hamburger here because we have the 'Menu' tab in bottom bar, 
              but keeping it as a secondary option is fine. Let's keep it clean. */}
          <div className="w-6"></div> 
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
          {children}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 pb-[env(safe-area-inset-bottom)] flex justify-between items-center h-16 px-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            {bottomTabs.map(item => (
                <Link 
                    key={item.to} 
                    to={item.to} 
                    className={`flex flex-col items-center justify-center flex-1 h-full space-y-1 active:scale-95 transition-transform ${isActiveLink(item.to) ? 'text-primary' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <item.icon className={`w-6 h-6 ${isActiveLink(item.to) ? 'fill-blue-50' : ''}`} />
                    <span className="text-[10px] font-medium leading-none">{item.label}</span>
                </Link>
            ))}
            
            {/* Menu Tab to open Sidebar */}
            <button 
                onClick={() => setSidebarOpen(true)}
                className={`flex flex-col items-center justify-center flex-1 h-full space-y-1 active:scale-95 transition-transform ${sidebarOpen ? 'text-primary' : 'text-gray-400 hover:text-gray-600'}`}
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

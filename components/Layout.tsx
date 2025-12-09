import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Book, CheckSquare, Lightbulb, Menu, X, Settings, Home, Heart } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const location = useLocation();

  const navItems = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/programs', label: 'Programs', icon: LayoutDashboard },
    { to: '/devotion', label: 'Devotion', icon: Heart },
    { to: '/standing-orders', label: 'Standing Orders', icon: Book },
    { to: '/tasks', label: 'Tasks', icon: CheckSquare },
    { to: '/ideas', label: 'Ideas Journal', icon: Lightbulb },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const isActiveLink = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-72 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="h-20 flex items-center px-6 bg-slate-800 font-bold text-2xl tracking-wider">
          MINISTRY<span className="text-primary ml-1">MGR</span>
        </div>
        
        <nav className="mt-6 px-4 space-y-3">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center px-5 py-4 text-lg font-medium rounded-xl transition-colors ${isActiveLink(item.to) ? 'bg-primary text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
            >
              <item.icon className="w-6 h-6 mr-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-screen">
        {/* Mobile Header */}
        <header className="lg:hidden h-16 bg-white shadow-sm flex items-center px-4 justify-between z-10 flex-shrink-0">
          <span className="font-bold text-xl text-gray-800">Ministry Manager</span>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 text-gray-600 rounded hover:bg-gray-100">
             {sidebarOpen ? <X className="w-6 h-6"/> : <Menu className="w-6 h-6"/>}
          </button>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Mic, User, Settings, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Mic, label: 'Interviews', path: '/interview' },
  { icon: User, label: 'Profile', path: '/profile' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export const SharedLayout: React.FC = () => {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-[#0a192f] text-gray-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900/50 backdrop-blur-2xl border-r border-white/10 flex flex-col z-20">
        <div className="p-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-neon-cyan rounded-xl flex items-center justify-center shadow-neon-glow">
            <span className="text-slate-950 font-black text-2xl italic">P</span>
          </div>
          <span className="text-2xl font-black tracking-tight tracking-[-0.05em] text-glow">PrepX</span>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 group relative",
                  isActive 
                    ? "bg-neon-cyan/10 text-neon-cyan" 
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute left-0 w-1 h-6 bg-neon-cyan rounded-r-full shadow-neon-glow"
                  />
                )}
                <Icon className={cn("w-5 h-5", isActive && "shadow-neon-glow")} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-6 mt-auto border-t border-white/5">
          <button className="flex items-center gap-4 px-4 py-3 text-gray-400 hover:text-red-400 transition-colors w-full group">
            <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative overflow-y-auto">
        {/* Top Header */}
        <header className="sticky top-0 z-20 h-20 px-8 flex items-center justify-between border-b border-white/5 bg-[#0a192f]/50 backdrop-blur-md">
          <h1 className="text-xl font-bold tracking-tight text-white/90">
            {navItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
          </h1>
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-full hover:bg-white/5 text-gray-400 relative">
              <div className="absolute top-2 right-2 w-2 h-2 bg-neon-cyan rounded-full border-2 border-slate-900" />
              <User className="w-6 h-6" />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-8">
          <Outlet />
        </div>
      </main>
      
      {/* Background Glows */}
      <div className="fixed top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[600px] h-[600px] bg-neon-cyan/5 blur-[120px] rounded-full -z-10 pointer-events-none" />
      <div className="fixed bottom-0 left-64 -translate-y-[-50%] translate-x-[-50%] w-[400px] h-[400px] bg-blue-500/5 blur-[100px] rounded-full -z-10 pointer-events-none" />
    </div>
  );
};

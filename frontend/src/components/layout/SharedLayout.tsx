import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Mic, User, LogOut, Trophy, RotateCcw, Lock, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';
import { useAuthStore } from '../../store/useAuthStore';
import { type InterviewFlowStage, useInterviewStore } from '../../store/useInterviewStore';

const navItems = [
  {
    icon: LayoutDashboard,
    label: 'Upload',
    path: '/upload',
    isEnabled: () => true,
  },
  {
    icon: User,
    label: 'Profile',
    path: '/profile',
    isEnabled: (hasUploadData: boolean) => hasUploadData,
  },
  {
    icon: Mic,
    label: 'Interview',
    path: '/interview',
    isEnabled: (hasUploadData: boolean, hasReport: boolean) => hasUploadData && !hasReport,
  },
  {
    icon: Trophy,
    label: 'Results',
    path: '/report',
    isEnabled: (_hasUploadData: boolean, hasReport: boolean) => hasReport,
  },
];

export const SharedLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const reset = useInterviewStore((state) => state.reset);
  const sessionId = useInterviewStore((state) => state.sessionId);
  const report = useInterviewStore((state) => state.report);
  const profile = useInterviewStore((state) => state.profile);
  const flowStage = useInterviewStore((state) => state.flowStage);
  const hasUploadData = Boolean(sessionId && profile);
  const hasReport = Boolean(report);
  const stageOrder: Record<InterviewFlowStage, number> = {
    upload: 0,
    profile: 1,
    interview: 2,
    report: 3,
  };
  const resolvedNavItems = navItems.map((item) => ({
    ...item,
    enabled:
      item.path === '/interview'
        ? hasUploadData && stageOrder[flowStage] >= stageOrder.interview && !hasReport
        : item.path === '/report'
          ? hasReport && stageOrder[flowStage] >= stageOrder.report
          : item.isEnabled(hasUploadData, hasReport),
  }));

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const handleNewSession = () => {
    reset();
    navigate('/upload');
  };

  return (
    <div className="flex h-screen bg-[#0a192f] text-gray-100 overflow-hidden font-sans relative">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-30 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:relative w-64 h-full bg-slate-900/50 backdrop-blur-2xl border-r border-white/10 flex flex-col z-40 transition-transform duration-300 transform",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="p-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-neon-cyan rounded-xl flex items-center justify-center shadow-neon-glow">
              <span className="text-slate-950 font-black text-2xl italic">P</span>
            </div>
            <span className="text-2xl font-black tracking-tight text-glow">PrepX</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 text-gray-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2">
          {resolvedNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            if (!item.enabled) {
              return (
                <div
                  key={item.path}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl text-gray-600 border border-transparent cursor-not-allowed"
                >
                  <div className="flex items-center justify-center w-5 h-5">
                    <Lock className="w-4 h-4" />
                  </div>
                  <span className="font-medium">{item.label}</span>
                </div>
              );
            }

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
                onClick={() => setIsSidebarOpen(false)}
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

        <div className="p-6 mt-auto border-t border-white/5 space-y-2">
          <button 
            onClick={handleNewSession}
            className="flex items-center gap-4 px-4 py-3 text-gray-400 hover:text-neon-cyan transition-colors w-full group"
          >
            <RotateCcw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
            <span className="font-medium">New Session</span>
          </button>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-4 px-4 py-3 text-gray-400 hover:text-red-400 transition-colors w-full group"
          >
            <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative overflow-y-auto">
        {/* Top Header */}
        <header className="sticky top-0 z-20 h-20 px-4 md:px-8 flex items-center justify-between border-b border-white/5 bg-[#0a192f]/50 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold tracking-tight text-white/90">
              {resolvedNavItems.find(item => item.path === location.pathname)?.label || 'Upload'}
            </h1>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-4 md:p-8">
          <Outlet />
        </div>
      </main>
      
      {/* Background Glows */}
      <div className="fixed top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[600px] h-[600px] bg-neon-cyan/5 blur-[120px] rounded-full -z-10 pointer-events-none" />
      <div className="fixed bottom-0 left-64 -translate-y-[-50%] translate-x-[-50%] w-[400px] h-[400px] bg-blue-500/5 blur-[100px] rounded-full -z-10 pointer-events-none" />
    </div>
  );
};

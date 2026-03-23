import React from 'react';
import { 
  LayoutGrid, 
  Search, 
  DownloadCloud, 
  Settings, 
  Library,
  ChevronRight,
  Monitor,
  Shield,
  MessageSquare,
  Home,
  User,
  LogOut
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../context/AuthContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SidebarItem = ({ icon: Icon, label, to, active }: any) => (
  <Link
    to={to}
    className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
      active 
        ? "bg-primary text-background font-bold shadow-lg shadow-primary/20 scale-[1.02]" 
        : "text-gray-400 hover:bg-accent hover:text-white hover:translate-x-1"
    )}
  >
    <Icon size={20} />
    <span className="text-sm">{label}</span>
  </Link>
);

const Sidebar = () => {
  const location = useLocation();
  const { isAdmin, user, logout } = useAuth();

  return (
    <div className="w-64 bg-secondary flex flex-col border-r border-accent p-4 gap-2">
      <div className="flex items-center gap-2 mb-8 px-2">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
          <DownloadCloud size={24} className="text-background" />
        </div>
        <div>
          <h1 className="text-lg font-black tracking-tighter uppercase leading-none">Crunchy<span className="text-primary">DL</span></h1>
          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{user?.role} Mode</div>
        </div>
      </div>

      <nav className="flex flex-col gap-1.5 font-medium">
        <SidebarItem 
          icon={Home} 
          label="Dashboard" 
          to="/dashboard" 
          active={location.pathname === '/dashboard' || location.pathname === '/'} 
        />
        <SidebarItem 
          icon={LayoutGrid} 
          label="Seasonal Catalog" 
          to="/catalog" 
          active={location.pathname === '/catalog'} 
        />
        <SidebarItem 
          icon={Monitor} 
          label="Full Catalog" 
          to="/all-series" 
          active={location.pathname === '/all-series'} 
        />
        <SidebarItem 
          icon={Search} 
          label="Search" 
          to="/search" 
          active={location.pathname === '/search'} 
        />
        <SidebarItem 
          icon={DownloadCloud} 
          label="Downloads" 
          to="/downloads" 
          active={location.pathname === '/downloads'} 
        />
        <SidebarItem 
          icon={Library} 
          label="Library" 
          to="/library" 
          active={location.pathname === '/library'} 
        />
        <SidebarItem 
          icon={MessageSquare} 
          label="Suggestions" 
          to="/suggestions" 
          active={location.pathname === '/suggestions'} 
        />
        {isAdmin && (
          <SidebarItem 
            icon={Shield} 
            label="Admin" 
            to="/admin" 
            active={location.pathname === '/admin'} 
          />
        )}
      </nav>

      <div className="mt-auto space-y-1.5 pt-4 border-t border-accent/50">
        <Link 
          to="/profile"
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group mb-2",
            location.pathname === '/profile' ? "bg-primary/20 text-primary border border-primary/20" : "text-gray-400 hover:bg-accent/50 hover:text-white"
          )}
        >
          {user?.avatar_url ? (
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 group-hover:border-primary/50 transition-all">
              <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center text-gray-500 group-hover:text-primary border border-white/5 transition-all">
              <User size={16} />
            </div>
          )}
          <div className="flex flex-col items-start truncate overflow-hidden">
            <span className="text-sm font-bold truncate w-full">{user?.full_name || user?.username}</span>
            <span className="text-[10px] font-black uppercase tracking-tighter opacity-50">Manage Identity</span>
          </div>
          <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>

        {isAdmin && (
          <SidebarItem 
            icon={Settings} 
            label="Settings" 
            to="/settings" 
            active={location.pathname === '/settings'} 
          />
        )}
        
        <button 
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-gray-500 hover:bg-red-500/10 hover:text-red-500 transition-all duration-200 group text-left"
        >
          <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-[11px] font-black uppercase tracking-widest">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;

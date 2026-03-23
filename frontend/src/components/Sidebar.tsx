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
  LogOut,
  Languages
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

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
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { isAdmin, user, logout } = useAuth();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="w-64 bg-secondary flex flex-col border-r border-accent p-4 gap-2">
      <div className="flex items-center gap-2 mb-8 px-2">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
          <DownloadCloud size={24} className="text-background" />
        </div>
        <div>
          <h1 className="text-lg font-black tracking-tighter uppercase leading-none">Crunchy<span className="text-primary">DL</span></h1>
          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{t('sidebar.mode', { role: t('sidebar.role_' + (user?.role || 'user').toLowerCase()) })}</div>
        </div>
      </div>

      <nav className="flex flex-col gap-1.5 font-medium">
        <SidebarItem 
          icon={Home} 
          label={t('sidebar.dashboard')} 
          to="/dashboard" 
          active={location.pathname === '/dashboard' || location.pathname === '/'} 
        />
        <SidebarItem 
          icon={LayoutGrid} 
          label={t('sidebar.seasonal_catalog')} 
          to="/catalog" 
          active={location.pathname === '/catalog'} 
        />
        <SidebarItem 
          icon={Monitor} 
          label={t('sidebar.full_catalog')} 
          to="/all-series" 
          active={location.pathname === '/all-series'} 
        />
        <SidebarItem 
          icon={Search} 
          label={t('sidebar.search')} 
          to="/search" 
          active={location.pathname === '/search'} 
        />
        <SidebarItem 
          icon={DownloadCloud} 
          label={t('sidebar.downloads')} 
          to="/downloads" 
          active={location.pathname === '/downloads'} 
        />
        <SidebarItem 
          icon={Library} 
          label={t('sidebar.library')} 
          to="/library" 
          active={location.pathname === '/library'} 
        />
        <SidebarItem 
          icon={MessageSquare} 
          label={t('sidebar.suggestions')} 
          to="/suggestions" 
          active={location.pathname === '/suggestions'} 
        />
        {isAdmin && (
          <SidebarItem 
            icon={Shield} 
            label={t('sidebar.admin')} 
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
            <span className="text-[10px] font-black uppercase tracking-tighter opacity-50">{t('sidebar.manage_identity')}</span>
          </div>
          <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>

        {/* Language Switcher */}
        <div className="flex items-center gap-2 px-4 py-2 bg-black/20 rounded-xl mb-2 group border border-transparent hover:border-accent transition-all">
          <Languages size={16} className="text-gray-500 group-hover:text-primary transition-colors" />
          <select 
            value={i18n.language.split('-')[0]} 
            onChange={(e) => changeLanguage(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-[11px] font-black uppercase tracking-widest text-gray-400 hover:text-white cursor-pointer transition-colors h-8"
          >
            <option value="en" className="bg-secondary text-white">{t('sidebar.english')}</option>
            <option value="es" className="bg-secondary text-white">{t('sidebar.spanish')}</option>
          </select>
        </div>

        {isAdmin && (
          <SidebarItem 
            icon={Settings} 
            label={t('sidebar.settings')} 
            to="/settings" 
            active={location.pathname === '/settings'} 
          />
        )}
        
        <button 
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-gray-500 hover:bg-red-500/10 hover:text-red-500 transition-all duration-200 group text-left"
        >
          <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-[11px] font-black uppercase tracking-widest">{t('sidebar.logout')}</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;

import React, { useState, useEffect, useMemo } from 'react';
import { Play, Pause, Trash2, CheckCircle, Clock, RotateCw, AlertCircle, HardDrive, Download as DownloadIcon, ChevronRight } from 'lucide-react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

/** Utility for Tailwind classes */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Downloads = () => {
  const { t } = useTranslation();
  const [downloads, setDownloads] = useState<any[]>([]);
  const [avgTime, setAvgTime] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>(() => {
    return (localStorage.getItem('downloads_view_mode') as 'grid' | 'compact') || 'grid';
  });
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('downloads_collapsed_groups');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const { isAdmin } = useAuth();
  
  useEffect(() => {
    const socket = io(); // Use relative socket connection
    fetchDownloads();
    fetchQueueStatus();
    
    socket.on('downloadProgress', ({ id, progress }) => {
      setDownloads(prev => prev.map(dl => dl.id === id ? { ...dl, progress } : dl));
    });

    socket.on('downloadStatus', ({ id, status }) => {
      setDownloads(prev => prev.map(dl => dl.id === id ? { ...dl, status } : dl));
    });

    socket.on('queueStatus', ({ paused }) => {
      setIsPaused(paused);
    });

    return () => {
      socket.off('downloadProgress');
      socket.off('downloadStatus');
      socket.off('queueStatus');
      socket.disconnect();
    };
  }, []);

  const fetchQueueStatus = async () => {
    try {
      const resp = await axios.get('/api/downloads/queue-status');
      setIsPaused(resp.data.paused);
    } catch (err) {
      console.error('Queue status error:', err);
    }
  };

  const fetchDownloads = async () => {
    try {
      const resp = await axios.get('/api/downloads');
      setDownloads(resp.data.items);
      setAvgTime(resp.data.avgEncodingTime);
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  const toggleQueue = async () => {
    try {
      if (isPaused) {
        await axios.post('/api/downloads/resume');
        setIsPaused(false);
      } else {
        await axios.post('/api/downloads/pause');
        setIsPaused(true);
      }
    } catch (err) {
      console.error('Toggle queue error:', err);
    }
  };

  const toggleViewMode = () => {
    const next = viewMode === 'grid' ? 'compact' : 'grid';
    setViewMode(next);
    localStorage.setItem('downloads_view_mode', next);
  };

  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('downloads_collapsed_groups', JSON.stringify(next));
      return next;
    });
  };

  const formatSeconds = (s: number) => {
    if (!s) return '0s';
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return m > 0 ? `${m}m ${rs}s` : `${rs}s`;
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`/api/downloads/${id}`);
      setDownloads(prev => prev.filter(dl => dl.id !== id));
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleRetry = async (id: number) => {
    try {
      setDownloads(prev => prev.map(dl => dl.id === id ? { ...dl, status: 'pending', progress: 0 } : dl));
      await axios.post(`/api/downloads/${id}/retry`);
    } catch (err) {
      console.error('Retry error:', err);
    }
  };

  const handleClearFinished = async () => {
    try {
      await axios.post('/api/downloads/clear-finished');
      setDownloads(prev => prev.filter(dl => dl.status !== 'completed' && dl.status !== 'error'));
    } catch (err) {
      console.error('Clear error:', err);
    }
  };

  // Group downloads by series and season
  const groupedDownloads = useMemo(() => {
    const groups: any = {};
    
    downloads.forEach((dl: any) => {
      const parts = dl.name.split(' - ');
      // Try to get clean series title. If 3 parts, usually [Series] - [Season] - [Episode]
      const seriesTitle = parts.length > 2 ? parts[0] : (parts.length > 1 ? parts.slice(0, -1).join(' - ') : dl.name);
      const groupId = dl.show_id || seriesTitle;
      
      // Try to determine season text
      let seasonText = '';
      if (dl.season_number) {
        seasonText = `${t('catalog.seasonal') || 'Season'} ${dl.season_number}`;
      } else if (parts.length > 2 && parts[1].toLowerCase().includes('season')) {
        seasonText = parts[1];
      }

      const key = `${groupId}_${seasonText}`;

      if (!groups[key]) {
        groups[key] = {
          seriesTitle,
          seasonText,
          items: [],
          thumbnail: dl.thumbnail || '/notFound.png',
          showId: dl.show_id
        };
      }
      groups[key].items.push(dl);
    });

    return Object.values(groups);
  }, [downloads, t]);

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20">
      {/* Header Section */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row items-center justify-between gap-6"
      >
        <div className="space-y-2 text-center md:text-left">
          <h1 className="text-5xl font-black text-white uppercase italic tracking-tighter leading-none">
            {t('downloads.title')} <span className={cn(isPaused ? "text-red-500" : "text-orange-500")}>{isPaused ? 'Paused' : 'Queue'}</span>
          </h1>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
            <p className="text-gray-400 font-medium">{t('downloads.subtitle')}</p>
            {avgTime > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full text-[10px] font-black text-orange-500 uppercase tracking-widest">
                <RotateCw size={12} className="animate-spin" style={{ animationDuration: '3s' }} />
                {t('downloads.avg_encoding')}: {formatSeconds(avgTime)}
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-gray-400 uppercase tracking-widest">
              <DownloadIcon size={12} />
              {downloads.length} {t('downloads.total_tasks') || 'Tasks'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center md:justify-end gap-3">
          <button
            onClick={toggleViewMode}
            className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-gray-400 hover:text-white transition-all font-bold tracking-tight text-sm"
          >
            {viewMode === 'grid' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            )}
            {viewMode === 'grid' ? 'Grid' : 'Compact'}
          </button>

          {isAdmin && (
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleQueue}
              className={cn(
                "px-8 py-4 font-black uppercase tracking-widest rounded-3xl transition-all flex items-center gap-2 shadow-2xl border-b-4",
                isPaused 
                  ? "bg-green-500 hover:bg-green-400 text-white border-green-700 shadow-green-500/20" 
                  : "bg-orange-500 hover:bg-orange-400 text-white border-orange-700 shadow-orange-500/20"
              )}
            >
              {isPaused ? <Play size={20} fill="currentColor" /> : <Pause size={20} fill="currentColor" />}
              {isPaused ? t('downloads.resume') : t('downloads.pause')}
            </motion.button>
          )}

          {isAdmin && downloads.some(d => d.status === 'completed' || d.status === 'error') && (
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleClearFinished}
              className="p-4 bg-white/5 hover:bg-red-500/20 border border-white/10 rounded-3xl text-gray-500 hover:text-red-500 transition-all hover:scale-105"
              title={t('downloads.clear_finished')}
            >
              <Trash2 size={24} strokeWidth={3} />
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* Downloads List */}
      <div className="space-y-12">
        <AnimatePresence mode="popLayout">
          {groupedDownloads.map((group: any, index: number) => {
            const groupKey = group.seriesTitle + group.seasonText;
            const isCollapsed = collapsedGroups[groupKey];

            return (
              <motion.div 
                key={groupKey}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="space-y-6"
              >
                {/* Series Header Block */}
                <div 
                  className="relative group/header flex items-center gap-6 cursor-pointer"
                  onClick={() => toggleGroupCollapse(groupKey)}
                >
                  <div className="relative w-24 h-36 shrink-0 rounded-2xl overflow-hidden shadow-2xl border border-white/10 group-hover/header:border-orange-500/50 transition-colors duration-500">
                    <img src={group.thumbnail} alt={group.seriesTitle} className="w-full h-full object-cover group-hover/header:scale-110 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  </div>
                  
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter hover:text-orange-500 transition-colors">
                        {group.seriesTitle}
                      </h3>
                      <div className={cn("text-gray-500 transition-transform duration-300", isCollapsed ? "rotate-[-90deg]" : "rotate-0")}>
                        <ChevronRight size={32} />
                      </div>
                    </div>
                    {group.seasonText && (
                      <div className="text-sm font-bold text-orange-500/80 uppercase tracking-widest mt-1 flex items-center gap-2">
                         <ChevronRight size={14} /> {group.seasonText}
                      </div>
                    )}
                    <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-lg text-[10px] font-black text-green-500 uppercase tracking-widest">
                      <CheckCircle size={12} />
                      {group.items.filter((e: any) => e.status === 'completed').length} / {group.items.length} {t('downloads.completed')}
                    </div>
                    {group.items.some((i: any) => i.status === 'downloading' || i.status === 'encoding') && (
                      <div className="flex items-center gap-2 px-3 py-1 bg-orange-500/10 border border-orange-500/20 rounded-lg text-[10px] font-black text-orange-500 uppercase tracking-widest animate-pulse">
                        <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,1)]" />
                        {t('downloads.active_working') || 'Active Processing'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

                {/* Episodes Grid */}
                {!isCollapsed && (
                  <div className={cn(
                    "grid gap-4",
                    viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-2"
                  )}>
                    <AnimatePresence>
                      {group.items.sort((a: any, b: any) => {
                        const getEp = (name: string) => {
                          const m = name.match(/E(\d+)/i) || name.match(/Ep\s*(\d+)/i) || name.match(/Episode\s*(\d+)/i) || name.match(/(?:^|[\s\-\_\#])(\d+)(?:[\s\-\_\.\(]|$)/);
                          return m ? parseInt(m[2] || m[1]) : 0;
                        };
                        const epA = getEp(a.name);
                        const epB = getEp(b.name);
                        return epA !== epB ? epA - epB : a.id - b.id;
                      }).map((dl: any) => (
                        <EpisodeCard 
                          key={dl.id} 
                          dl={dl} 
                          isAdmin={isAdmin} 
                          viewMode={viewMode}
                          onDelete={handleDelete} 
                          onRetry={handleRetry} 
                          t={t}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {downloads.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-40 bg-white/[0.02] border border-dashed border-white/5 rounded-[3rem] text-gray-500 gap-6"
          >
            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center">
              <Clock size={48} className="text-gray-700" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-xl font-bold text-gray-400">{t('downloads.empty')}</p>
              <p className="text-sm uppercase tracking-widest font-black text-gray-600">Start exploring to fill your queue</p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

const EpisodeCard = ({ dl, isAdmin, onDelete, onRetry, t, viewMode }: any) => {
  const isCompact = viewMode === 'compact';
  const statusColor = useMemo(() => {
    switch (dl.status) {
      case 'completed': return 'bg-green-500';
      case 'encoding': return 'bg-orange-500';
      case 'decrypting': return 'bg-blue-500';
      case 'error': return 'bg-red-500';
      case 'downloading': return 'bg-primary';
      default: return 'bg-gray-500';
    }
  }, [dl.status]);

  const episodeNumber = useMemo(() => {
    const m = dl.name.match(/E(\d+)/i) || dl.name.match(/Ep\s*(\d+)/i) || dl.name.match(/Episode\s*(\d+)/i) || dl.name.match(/(?:^|[\s\-\_\#])(\d+)(?:[\s\-\_\.\(]|$)/);
    return m ? (m[2] || m[1]) : '#';
  }, [dl.name]);

  const triggerIcon = useMemo(() => {
    if (dl.triggered_by === 'system:subscription') return <Bell size={10} className="text-orange-500" />;
    if (dl.triggered_by === 'AUTO_CATCH_UP') return <RotateCw size={10} className="text-blue-500" />;
    return <DownloadIcon size={10} className="text-gray-500" />;
  }, [dl.triggered_by]);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, x: 20 }}
      whileHover={{ y: -4 }}
      className={cn(
        "relative group bg-secondary/30 backdrop-blur-xl rounded-[2rem] border border-white/5 hover:border-orange-500/30 transition-all duration-300 shadow-xl overflow-hidden",
        isCompact ? "p-3 rounded-2xl" : "p-5"
      )}
    >
      {/* Background Glow */}
      <div className={cn("absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[100px] opacity-10 transition-colors duration-500", statusColor)} />

      <div className="relative z-10 space-y-4">
        {/* Top Info */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "rounded-2xl flex items-center justify-center font-black transition-all shadow-lg", 
              statusColor, 
              "text-white",
              isCompact ? "w-8 h-8 text-sm rounded-xl" : "w-12 h-12 text-lg"
            )}>
              {episodeNumber}
            </div>
            <div>
              <div className={cn("font-black text-gray-500 uppercase tracking-[0.2em] mb-0.5", isCompact ? "text-[8px]" : "text-[10px]")}>
                {t('downloads.status_' + dl.status)}
              </div>
              <div className="flex items-center gap-2">
                {!isCompact && <span className="text-xs font-bold text-gray-400">EPISODE</span>}
                {dl.progress > 0 && dl.status !== 'completed' && (
                  <span className={cn("font-black text-white px-1.5 py-0.5 bg-white/10 rounded flex items-center gap-1", isCompact ? "text-[8px]" : "text-[10px]")}>
                    {Number(dl.progress).toFixed(1)}% 
                    <div className="w-1 h-1 rounded-full bg-orange-500 animate-ping" />
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-1.5">
            {(dl.status === 'completed' || dl.status === 'error') && (
              <button 
                onClick={() => onRetry(dl.id)}
                title={dl.status === 'completed' ? 'Re-download' : 'Retry'}
                className={cn("bg-white/5 hover:bg-orange-500 text-gray-400 hover:text-white rounded-xl transition-all hover:scale-110", isCompact ? "p-1.5" : "p-2.5")}
              >
                <RotateCw size={isCompact ? 12 : 16} strokeWidth={3} />
              </button>
            )}
            {isAdmin && (
              <button 
                onClick={() => onDelete(dl.id)}
                className={cn("bg-white/5 hover:bg-red-500 text-gray-400 hover:text-white rounded-xl transition-all hover:scale-110", isCompact ? "p-1.5" : "p-2.5")}
              >
                <Trash2 size={isCompact ? 12 : 16} strokeWidth={3} />
              </button>
            )}
          </div>
        </div>

        {/* Progress System */}
        <div className={cn("space-y-2", isCompact && "space-y-1")}>
          <div className={cn("w-full bg-white/5 rounded-full overflow-hidden p-0.5", isCompact ? "h-1" : "h-2")}>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${dl.progress}%` }}
              className={cn(
                "h-full rounded-full relative overflow-hidden transition-colors duration-500 shadow-[0_0_15px_rgba(255,255,255,0.1)]",
                statusColor
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-20 h-full -skew-x-45 animate-scan" style={{ animationDuration: '2s' }} />
            </motion.div>
          </div>
          
          {!isCompact && (
            <div className="flex items-center justify-between text-[10px] font-black text-gray-500 uppercase tracking-widest">
              <div className="flex items-center gap-2">
                {triggerIcon}
                <span>{
                  dl.triggered_by === 'AUTO_CATCH_UP' ? t('downloads.auto') : 
                  dl.triggered_by === 'system:subscription' ? t('downloads.trigger_subscription') : 
                  t('downloads.manual')
                }</span>
              </div>
              {dl.status === 'completed' && <CheckCircle size={12} className="text-green-500" />}
            </div>
          )}
        </div>

        {/* Secondary Info */}
        {dl.path && !isCompact && (
          <div className="pt-2 border-t border-white/5 flex items-center gap-2 text-[8px] font-mono text-gray-600 truncate group-hover:text-gray-400 transition-colors">
            <HardDrive size={10} />
            <span className="truncate">{dl.path}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Internal Components missing in standard UI
const Bell = ({ size, className }: any) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>;
const X = ({ size, className, strokeWidth = "2" }: any) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 6L6 18M6 6l12 12"></path></svg>;

export default Downloads;

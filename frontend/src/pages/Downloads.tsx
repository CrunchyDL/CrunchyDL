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
  const { isAdmin } = useAuth();
  
  useEffect(() => {
    const socket = io(); // Use relative socket connection
    fetchDownloads();
    
    socket.on('downloadProgress', ({ id, progress }) => {
      setDownloads(prev => prev.map(dl => dl.id === id ? { ...dl, progress } : dl));
    });

    socket.on('downloadStatus', ({ id, status }) => {
      setDownloads(prev => prev.map(dl => dl.id === id ? { ...dl, status } : dl));
    });

    return () => {
      socket.off('downloadProgress');
      socket.off('downloadStatus');
      socket.disconnect();
    };
  }, []);

  const fetchDownloads = async () => {
    try {
      const resp = await axios.get('/api/downloads');
      setDownloads(resp.data.items);
      setAvgTime(resp.data.avgEncodingTime);
    } catch (err) {
      console.error('Fetch error:', err);
    }
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

  // Group downloads by series
  const groupedDownloads = useMemo(() => {
    return downloads.reduce((acc: any, dl: any) => {
      const parts = dl.name.split(' - ');
      const seriesName = parts.length > 1 ? parts.slice(0, -1).join(' - ') : dl.name;
      
      if (!acc[seriesName]) {
        acc[seriesName] = {
          items: [],
          thumbnail: dl.thumbnail || '/notFound.png',
          showId: dl.show_id
        };
      }
      acc[seriesName].items.push(dl);
      return acc;
    }, {});
  }, [downloads]);

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
            {t('downloads.title')} <span className="text-orange-500">Queue</span>
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

        {isAdmin && downloads.some(d => d.status === 'completed' || d.status === 'error') && (
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleClearFinished}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-black uppercase tracking-widest rounded-2xl transition-all flex items-center gap-2 shadow-xl shadow-red-900/20"
          >
            <Trash2 size={18} strokeWidth={3} /> {t('downloads.clear_finished')}
          </motion.button>
        )}
      </motion.div>

      {/* Downloads List */}
      <div className="space-y-12">
        <AnimatePresence mode="popLayout">
          {Object.entries(groupedDownloads).map(([seriesName, group]: [string, any], index) => (
            <motion.div 
              key={seriesName}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="space-y-6"
            >
              {/* Series Header Block */}
              <div className="relative group/header flex items-center gap-6">
                <div className="relative w-24 h-36 shrink-0 rounded-2xl overflow-hidden shadow-2xl border border-white/10 group-hover/header:border-orange-500/50 transition-colors duration-500">
                  <img src={group.thumbnail} alt={seriesName} className="w-full h-full object-cover group-hover/header:scale-110 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter hover:text-orange-500 transition-colors cursor-default">
                    {seriesName}
                  </h3>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                      onDelete={handleDelete} 
                      onRetry={handleRetry} 
                      t={t}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
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

const EpisodeCard = ({ dl, isAdmin, onDelete, onRetry, t }: any) => {
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
      className="relative group bg-secondary/30 backdrop-blur-xl p-5 rounded-[2rem] border border-white/5 hover:border-orange-500/30 transition-all duration-300 shadow-xl overflow-hidden"
    >
      {/* Background Glow */}
      <div className={cn("absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[100px] opacity-10 transition-colors duration-500", statusColor)} />

      <div className="relative z-10 space-y-4">
        {/* Top Info */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg transition-all shadow-lg", statusColor, "text-white")}>
              {episodeNumber}
            </div>
            <div>
              <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-0.5">
                {t('downloads.status_' + dl.status)}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400">EPISODE</span>
                {dl.progress > 0 && dl.status !== 'completed' && (
                  <span className="text-[10px] font-black text-white px-1.5 py-0.5 bg-white/10 rounded flex items-center gap-1">
                    {dl.progress}% 
                    <div className="w-1 h-1 rounded-full bg-orange-500 animate-ping" />
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {dl.status !== 'completed' && (
              <button 
                onClick={() => onRetry(dl.id)}
                className="p-2.5 bg-white/5 hover:bg-orange-500 text-gray-400 hover:text-white rounded-xl transition-all hover:scale-110"
              >
                <RotateCw size={16} strokeWidth={3} />
              </button>
            )}
            {isAdmin && (
              <button 
                onClick={() => onDelete(dl.id)}
                className="p-2.5 bg-white/5 hover:bg-red-500 text-gray-400 hover:text-white rounded-xl transition-all hover:scale-110"
              >
                <Trash2 size={16} strokeWidth={3} />
              </button>
            )}
          </div>
        </div>

        {/* Progress System */}
        <div className="space-y-2">
          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden p-0.5">
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
        </div>

        {/* Secondary Info */}
        {dl.path && (
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

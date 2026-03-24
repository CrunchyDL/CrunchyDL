import React, { useState, useEffect } from 'react';
import { Play, Pause, Trash2, CheckCircle, Clock, RotateCw, AlertCircle } from 'lucide-react';
import { io } from 'socket.io-client';
import axios from 'axios';

import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

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
    const resp = await axios.get('/api/downloads');
    setDownloads(resp.data.items);
    setAvgTime(resp.data.avgEncodingTime);
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
      // Set local state to pending immediately for feedback
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('downloads.title')}</h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-gray-400">{t('downloads.subtitle')}</p>
            {avgTime > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-bold text-primary uppercase tracking-wider">
                <RotateCw size={10} className="animate-spin-slow" />
                {t('downloads.avg_encoding')}: {formatSeconds(avgTime)}
              </div>
            )}
          </div>
        </div>
        {isAdmin && (
          <button 
            onClick={handleClearFinished}
            className="px-4 py-2 bg-accent hover:bg-red-500/20 hover:text-red-500 border border-transparent rounded-lg transition-all flex items-center gap-2"
          >
            <Trash2 size={18} /> {t('downloads.clear_finished')}
          </button>
        )}
      </div>

      <div className="space-y-4">
        {Object.entries(downloads.reduce((acc: any, dl: any) => {
          // Normalize name: Get everything before the last " - " pattern
          const parts = dl.name.split(' - ');
          const seriesName = parts.length > 1 ? parts.slice(0, -1).join(' - ') : dl.name;
          
          if (!acc[seriesName]) acc[seriesName] = [];
          acc[seriesName].push(dl);
          return acc;
        }, {})).map(([seriesName, episodes]: [string, any]) => (
          <div key={seriesName} className="space-y-2">
            <div className="flex items-center gap-3 px-2 py-1">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <CheckCircle size={16} />
              </div>
              <div>
                <h3 className="font-black text-lg text-white leading-none">{seriesName}</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                  {episodes.length} {t('downloads.episodes_in_queue')} • {episodes.filter((e: any) => e.status === 'completed').length} {t('downloads.completed')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pl-10 border-l border-white/5 ml-4">
              {episodes.sort((a: any, b: any) => {
                const getEp = (name: string) => {
                  const m = name.match(/E(\d+)/i) || name.match(/Ep\s*(\d+)/i) || name.match(/Episode\s*(\d+)/i);
                  return m ? parseInt(m[1]) : 0;
                };
                const epA = getEp(a.name);
                const epB = getEp(b.name);
                return epA !== epB ? epA - epB : a.id - b.id;
              }).map((dl: any) => (
                <div key={dl.id} className="bg-secondary/40 p-3 rounded-xl border border-accent/50 flex flex-col gap-2 hover:border-primary/30 transition-colors group relative overflow-hidden">
                  {/* Status indicator on the left edge */}
                  <div className={cn(
                    "absolute left-0 top-0 bottom-0 w-1",
                    dl.status === 'completed' ? "bg-green-500" : 
                    dl.status === 'encoding' ? "bg-orange-500" :
                    dl.status === 'error' ? "bg-red-500" :
                    "bg-primary"
                  )}></div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="text-xs font-bold text-white truncate max-w-[150px]">
                        {t('catalog.episode_label', { number: (() => {
                          const m = dl.name.match(/E(\d+)/i) || dl.name.match(/Ep\s*(\d+)/i) || dl.name.match(/Episode\s*(\d+)/i);
                          return m ? m[1] : dl.id;
                        })() }).toUpperCase()} 
                      </div>
                      <div className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter bg-white/5 px-1 rounded">
                        {t('downloads.status_' + dl.status)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-10 group-hover:opacity-100 transition-opacity">
                      {dl.status !== 'completed' && (
                        <RotateCw 
                          size={14} 
                          className="text-primary cursor-pointer hover:rotate-180 transition-transform duration-500"
                          onClick={() => handleRetry(dl.id)}
                        />
                      )}
                      {isAdmin && (
                        <Trash2 
                          size={14} 
                          className="text-gray-500 cursor-pointer hover:text-red-500"
                          onClick={() => handleDelete(dl.id)}
                        />
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="h-1 w-full bg-accent rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full transition-all duration-500 ease-out",
                          dl.status === 'encoding' || dl.status === 'decrypting' ? "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]" : "bg-primary shadow-[0_0_8px_rgba(224,35,47,0.4)]"
                        )}
                        style={{ width: `${dl.progress}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[9px] text-gray-500 font-bold uppercase">
                      <span>{dl.progress}%</span>
                      <span>{dl.triggered_by === 'AUTO_CATCH_UP' ? t('downloads.auto') : t('downloads.manual')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {downloads.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-4">
            <Clock size={48} className="text-accent" />
            <p className="font-medium">{t('downloads.empty')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper inside the file to avoid import issues for now
function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ');
}

export default Downloads;

import React, { useState, useEffect } from 'react';
import { Filter, Grid, List as ListIcon, FolderOpen, RefreshCw, X, Download, Trash2, CheckCircle, Cloud, Play, ChevronRight, SearchIcon, Folder, Bell, BellOff, Zap } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

const API_BASE = '/api';

const Library = () => {
  const { t } = useTranslation();
  const { isAdmin, user } = useAuth();
  const isContributor = user?.role === 'contributor' || user?.role === 'collaborator';
  const [series, setSeries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'mismatched'>('all');
  const [selectedSeries, setSelectedSeries] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'anilist' | 'tmdb' | 'tvdb' | 'crunchy' | 'local'>('all');
  
  // Repair Modal States
  const [isRepairModalOpen, setIsRepairModalOpen] = useState(false);
  const [repairSearchQuery, setRepairSearchQuery] = useState('');
  const [repairResults, setRepairResults] = useState<{ crunchyroll: any[], anilist: any[], tmdb: any[], tvdb: any[] } | null>(null);
  const [isSearchingRepair, setIsSearchingRepair] = useState(false);
  const [isRebinding, setIsRebinding] = useState(false);

  // Poster Selection States
  const [isPosterModalOpen, setIsPosterModalOpen] = useState(false);
  const [isSearchingPosters, setIsSearchingPosters] = useState(false);
  const [posterOptions, setPosterOptions] = useState<any[]>([]);
  const [posterTimestamp, setPosterTimestamp] = useState(Date.now());
  
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [isSubscribing, setIsSubscribing] = useState(false);

  const [sortBy, setSortBy] = useState<'added-desc' | 'added-asc' | 'title-asc' | 'title-desc'>('added-desc');

  useEffect(() => {
    fetchLibrary();
    fetchSubscriptions();
  }, [activeTab]);

  const fetchSubscriptions = async () => {
    try {
      const resp = await axios.get(`${API_BASE}/subscriptions`);
      setSubscriptions(resp.data);
    } catch (e) {
      console.error('Error fetching subscriptions:', e);
    }
  };

  const fetchLibrary = async () => {
    setLoading(true);
    try {
      const resp = await axios.get(`${API_BASE}/library/series`, {
          params: activeTab === 'mismatched' ? { filter: 'mismatched' } : {}
      });
      setSeries(resp.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await axios.post(`${API_BASE}/library/scan`);
      fetchLibrary();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  const openDetails = async (id: string) => {
    setDetailsLoading(true);
    try {
      const resp = await axios.get(`${API_BASE}/library/series/${id}`);
      setSelectedSeries(resp.data);
    } catch (e) {
      console.error(e);
    } finally {
      setDetailsLoading(false);
    }
  };

  const deleteEpisode = async (episodeId: string) => {
    if (!confirm(t('library.delete_episode_confirm'))) return;
    try {
      await axios.delete(`${API_BASE}/library/episodes/${episodeId}`);
      if (selectedSeries) openDetails(selectedSeries.id); // Refresh details
    } catch (e) {
      console.error(e);
      alert(t('common.error_deleting_episode'));
    }
  };

  const downloadMissing = async (season: any) => {
    const missingEps = season.episodes.filter((ep: any) => !ep.is_downloaded);
    if (missingEps.length === 0) return alert(t('library.all_downloaded'));
    
    try {
        await axios.post(`${API_BASE}/downloads`, {
            name: `${selectedSeries.title} - ${season.title}`,
            service: 'crunchy',
            show_id: selectedSeries.id,
            episodes: missingEps.map((ep: any) => ep.episode_number).join(',')
        });
        alert(t('library.download_triggered'));
    } catch (e) {
        console.error(e);
        alert(t('library.error_triggering_download'));
    }
  };

  const handleRepairSearch = async () => {
    if (!repairSearchQuery) return;
    setIsSearchingRepair(true);
    try {
        const resp = await axios.get(`${API_BASE}/library/search-matches`, { params: { q: repairSearchQuery } });
        setRepairResults(resp.data);
    } catch (e) {
        console.error(e);
    } finally {
        setIsSearchingRepair(false);
    }
  };

  const handleRebind = async (match: any, source: string) => {
    if (!selectedSeries) return;
    setIsRebinding(true);
    try {
        await axios.post(`${API_BASE}/library/series/${selectedSeries.id}/rebind`, { 
            match: { ...match, source } 
        });
        
        // Success: Close modal and clear temporary states
        setIsRepairModalOpen(false);
        setRepairResults(null);
        setRepairSearchQuery('');
        
        // Close the details modal too to force a fresh click/view of the new ID
        setSelectedSeries(null);
        
        // Refresh library to show new ID/Title/Poster in the grid
        await fetchLibrary();
        
        // If the user wants to keep seeing details, we could re-open it with new ID
        // but often it's cleaner to return to the grid especially if many things changed.
        // For now, let's just refresh.
    } catch (e) {
        console.error(e);
        alert(t('library.error_rebinding'));
    } finally {
        setIsRebinding(false);
    }
  };

  const handleApproveSeries = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
        await axios.post(`${API_BASE}/library/series/${id}/approve`);
        fetchLibrary();
    } catch (e) {
        console.error(e);
        alert(t('library.error_approving'));
    }
  };

  const handleToggleDownloaded = async (episodeId: string) => {
    try {
      await axios.post(`${API_BASE}/library/episodes/${episodeId}/toggle-downloaded`);
      if (selectedSeries) {
        const resp = await axios.get(`${API_BASE}/library/series/${selectedSeries.id}`);
        setSelectedSeries(resp.data);
      }
    } catch (e) {
      console.error('Error toggling download status:', e);
    }
  };

  const searchPosters = async () => {
    if (!selectedSeries) return;
    setIsSearchingPosters(true);
    setPosterOptions([]);
    try {
        const query = selectedSeries.title;
        const configResp = await axios.get(`${API_BASE}/config/muxing`);
        const config = configResp.data;

        // Search across all providers for images
        const [anilist, tmdb, tvdb] = await Promise.all([
          axios.post(`${API_BASE}/search`, { service: 'anilist', query }),
          config.tmdbApiKey ? axios.post(`${API_BASE}/search`, { service: 'tmdb', query }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          config.tvdbApiKey ? axios.post(`${API_BASE}/search`, { service: 'tvdb', query }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] })
        ]);

        const grouped: any = {
            tmdb: (tmdb.data || []).map((r: any) => ({ url: r.image, source: 'TMDB', title: r.title })),
            tvdb: (tvdb.data || []).map((r: any) => ({ url: r.image, source: 'TVDB', title: r.title })),
            anilist: anilist.data.map((r: any) => ({ url: r.image, source: 'AniList', title: r.title })),
            crunchyroll: selectedSeries.crunchyroll_id ? [{ url: `https://www.crunchyroll.com/imgs/series/${selectedSeries.crunchyroll_id}/poster`, source: 'Crunchyroll', title: selectedSeries.title }] : []
        };
        
        setPosterOptions(grouped as any);
    } catch (e) {
        console.error(e);
    } finally {
        setIsSearchingPosters(false);
    }
  };

  const updatePoster = async (imageUrl: string) => {
    if (!selectedSeries) return;
    try {
        const resp = await axios.post(`${API_BASE}/library/series/${selectedSeries.id}/update-image`, { image: imageUrl });
        // The backend returns the locally saved filename, but we want the UI to refresh immediately.
        // We Use the provided image name from backend to force a refresh on the poster endpoint
        setSelectedSeries({ ...selectedSeries, image: resp.data.image || imageUrl });
        setPosterTimestamp(Date.now());
        setIsPosterModalOpen(false);
        fetchLibrary();
    } catch (e) {
        console.error(e);
        alert(t('library.error_update_poster'));
    }
  };

  const handleToggleSubscription = async () => {
    if (!selectedSeries) return;
    const existing = subscriptions.find(s => s.series_id === selectedSeries.id && s.active);
    
    setIsSubscribing(true);
    try {
        if (existing) {
            await axios.delete(`${API_BASE}/subscriptions/${existing.id}`);
        } else {
            // Find next episode number
            let lastEp = 0;
            if (selectedSeries.seasons) {
                selectedSeries.seasons.forEach((s: any) => {
                    s.episodes.forEach((e: any) => {
                        if (e.episode_number > lastEp) lastEp = e.episode_number;
                    });
                });
            }

            await axios.post(`${API_BASE}/subscriptions`, {
                seriesId: selectedSeries.id,
                title: selectedSeries.title,
                nextEpisode: lastEp + 1,
                // defaults for now
                releaseDay: new Date().getDay(), 
                releaseTime: "12:00" 
            });
        }
        await fetchSubscriptions();
    } catch (e) {
        console.error(e);
        alert(t('library.error_handling_subscription'));
    } finally {
        setIsSubscribing(false);
    }
  };

  return (
    <div className="space-y-6 text-white">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('library.title')}</h1>
          <p className="text-gray-400">{t('library.subtitle')}</p>
        </div>
        
        {isAdmin && (
          <div className="flex items-center gap-2">
             {activeTab === 'mismatched' && series.length > 0 && (
               <button 
                  onClick={async () => {
                      setIsSyncing(true);
                      try {
                          await axios.post(`${API_BASE}/library/rescan-mismatched`);
                          fetchLibrary();
                      } catch (e) { console.error(e); }
                      finally { setIsSyncing(false); }
                  }}
                  disabled={isSyncing}
                  className="flex items-center gap-2 bg-primary text-secondary rounded-lg px-4 py-2 hover:opacity-90 transition-opacity text-sm font-bold disabled:opacity-50"
               >
                  <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
                  {t('library.refresh_all_mismatched')}
               </button>
             )}
             <button 
              onClick={handleSync}
              disabled={isSyncing}
              className={`flex items-center gap-2 bg-secondary border border-accent rounded-lg px-4 py-2 hover:bg-accent transition-colors text-sm ${isSyncing ? 'opacity-50' : ''}`}
            >
              <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? t('library.scanning') : t('library.scan_libraries')}
            </button>
          </div>
        )}
      </div>
      <div className="flex border-b border-accent">
          <button 
            onClick={() => setActiveTab('all')}
            className={`px-6 py-3 text-sm font-bold transition-colors relative ${activeTab === 'all' ? 'text-primary' : 'text-gray-500 hover:text-gray-300'}`}
          >
              {t('library.full_library')}
              {activeTab === 'all' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
          <button 
            onClick={() => setActiveTab('mismatched')}
            className={`px-6 py-3 text-sm font-bold transition-colors relative flex items-center gap-2 ${activeTab === 'mismatched' ? 'text-primary' : 'text-gray-500 hover:text-gray-300'}`}
          >
              {t('library.needs_review')}
              <div className="bg-accent text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                  {activeTab === 'mismatched' ? series.length : '?'}
              </div>
              {activeTab === 'mismatched' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
          
          <div className="flex-1" />
          
          <div className="flex items-center gap-2 px-4 py-2 bg-secondary border-b border-l border-accent group transition-colors">
            <Cloud size={14} className="text-gray-500" />
            <select 
              value={sourceFilter} 
              onChange={(e: any) => setSourceFilter(e.target.value)}
              className="bg-transparent border-none outline-none text-xs text-gray-400 hover:text-white cursor-pointer transition-colors"
            >
              <option value="all" className="bg-secondary text-white">{t('library.all_sources')}</option>
              <option value="anilist" className="bg-secondary text-white">{t('library.anilist')}</option>
              <option value="tmdb" className="bg-secondary text-white">{t('library.tmdb')}</option>
              <option value="tvdb" className="bg-secondary text-white">{t('library.tvdb')}</option>
              <option value="crunchy" className="bg-secondary text-white">{t('library.crunchyroll')}</option>
              <option value="local" className="bg-secondary text-white">{t('library.local')}</option>
            </select>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 bg-secondary border-b border-l border-accent group transition-colors">
            <Filter size={14} className="text-gray-500" />
            <select 
              value={sortBy} 
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-transparent border-none outline-none text-xs text-gray-400 hover:text-white cursor-pointer transition-colors"
            >
              <option value="added-desc" className="bg-secondary text-white">{t('library.newest_first')}</option>
              <option value="added-asc" className="bg-secondary text-white">{t('library.oldest_first')}</option>
              <option value="title-asc" className="bg-secondary text-white">{t('library.name_az')}</option>
              <option value="title-desc" className="bg-secondary text-white">{t('library.name_za')}</option>
            </select>
          </div>

          <div className="flex items-center px-4 py-2 bg-secondary border-b border-l border-accent group focus-within:bg-black/20 transition-colors">
            <SearchIcon size={16} className="text-gray-500 group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder={t('library.filter_placeholder')} 
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              className="bg-transparent border-none outline-none px-3 text-sm text-white w-48 md:w-64"
            />
            {librarySearch && (
              <button onClick={() => setLibrarySearch('')} className="text-gray-500 hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>
      </div>

      {loading ? (
        <div className="py-20 text-center animate-pulse text-gray-500">{t('library.loading_library')}</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {series
            .filter(item => {
                const matchesSearch = item.title.toLowerCase().includes(librarySearch.toLowerCase());
                const matchesSource = sourceFilter === 'all' || 
                    (sourceFilter === 'anilist' && item.id.startsWith('al-')) ||
                    (sourceFilter === 'tmdb' && item.id.startsWith('tmdb-')) ||
                    (sourceFilter === 'tvdb' && item.id.startsWith('tvdb-')) ||
                    (sourceFilter === 'local' && item.id.startsWith('local-')) ||
                    (sourceFilter === 'crunchy' && (!item.id.includes('-') || item.metadata_provider === 'crunchy'));
                return matchesSearch && matchesSource;
            })
            .sort((a, b) => {
                if (sortBy === 'title-asc') return a.title.localeCompare(b.title);
                if (sortBy === 'title-desc') return b.title.localeCompare(a.title);
                if (sortBy === 'added-asc') return new Date(a.added_at).getTime() - new Date(b.added_at).getTime();
                if (sortBy === 'added-desc') return new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
                return 0;
            })
            .map((item: any) => (
            <div key={item.id} className="group cursor-pointer" onClick={() => openDetails(item.id)}>
              <div className="aspect-[2/3] bg-secondary rounded-xl border border-accent overflow-hidden relative mb-2">
                {item.image ? (
                   <img src={`${API_BASE}/library/series/${item.id}/poster?t=${posterTimestamp}`} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                   <div className="w-full h-full bg-gradient-to-br from-accent/50 to-secondary flex items-center justify-center p-4">
                     <span className="text-gray-600 font-bold text-4xl text-center">{item.title[0]}</span>
                  </div>
                )}
                {item.is_airing === 1 && (
                  <div className="absolute top-2 left-2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-lg z-10 animate-pulse">
                    <Zap size={10} fill="currentColor" />
                    {t('library.airing')}
                  </div>
                )}
                {item.id.startsWith('local-') && (
                  <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-[10px] font-bold px-2 py-1 rounded-md border border-white/10 z-10">
                    {t('library.local')}
                  </div>
                )}
                {item.id.startsWith('al-') && (
                  <div className="absolute top-2 left-2 bg-blue-600/80 backdrop-blur-md text-[10px] font-bold px-2 py-1 rounded-md border border-white/10 z-10">
                    {t('library.anilist')}
                  </div>
                )}
                {item.id.startsWith('tmdb-') && (
                  <div className="absolute top-2 left-2 bg-green-600/80 backdrop-blur-md text-[10px] font-bold px-2 py-1 rounded-md border border-white/10 z-10">
                    {t('library.tmdb')}
                  </div>
                )}
                {item.id.startsWith('tvdb-') && (
                  <div className="absolute top-2 left-2 bg-emerald-600/80 backdrop-blur-md text-[10px] font-bold px-2 py-1 rounded-md border border-white/10 z-10">
                    {t('library.tvdb')}
                  </div>
                )}
                {item.crunchyroll_id && (item.id.startsWith('al-') || item.id.startsWith('tmdb-') || item.id.startsWith('tvdb-')) && (
                  <div className="absolute top-2 left-14 bg-orange-600/80 backdrop-blur-md text-[8px] font-bold px-1.5 py-0.5 rounded-md border border-white/10 z-10 flex items-center gap-0.5 shadow-lg">
                    {t('library.cr_link')}
                  </div>
                )}
                {!item.id.startsWith('local-') && !item.id.startsWith('al-') && !item.id.startsWith('tmdb-') && !item.id.startsWith('tvdb-') && (
                  <div className="absolute top-2 left-2 bg-orange-600/80 backdrop-blur-md text-[10px] font-bold px-2 py-1 rounded-md border border-white/10 z-10 flex items-center gap-1">
                    <Cloud size={10} />
                    {t('library.crunchyroll')}
                  </div>
                )}
                {isAdmin && item.needs_review === 1 && (
                  <div className="absolute top-2 right-2 flex flex-col items-end gap-2 z-20">
                    <div className="bg-red-600/90 backdrop-blur-md text-[10px] font-bold px-2 py-1 rounded-md border border-white/10 flex items-center gap-1 shadow-lg">
                      <Filter size={10} />
                      {t('library.revision')}
                    </div>
                    <button 
                      onClick={(e) => handleApproveSeries(item.id, e)}
                      className="bg-green-600 hover:bg-green-500 text-white p-2 rounded-full shadow-xl border border-white/20 transition-all hover:scale-110 active:scale-95"
                      title={t('library.confirm_metadata_tooltip')}
                    >
                      <CheckCircle size={18} />
                    </button>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <Play className="text-primary fill-primary" size={40} />
                </div>
              </div>
              <div className="font-bold text-sm truncate">{item.title}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-tighter">{item.folder_name}</div>
            </div>
          ))}

          {series.length === 0 && (
            <div className="col-span-full py-20 text-center space-y-4">
              <div className="w-16 h-16 bg-secondary border border-accent rounded-full flex items-center justify-center mx-auto">
                <FolderOpen size={30} className="text-gray-600" />
              </div>
              <div className="text-gray-500">{t('library.no_content')}</div>
              {isAdmin && (
                <button 
                  onClick={handleSync}
                  className="text-primary hover:underline text-sm font-bold"
                >
                  {t('library.scan_now')}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Series Details Modal */}
      {selectedSeries && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-secondary border border-accent w-full max-w-7xl h-[95vh] rounded-2xl overflow-hidden flex flex-col relative shadow-2xl">
            <button 
              onClick={() => setSelectedSeries(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black rounded-full transition-colors text-white"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col md:flex-row h-full overflow-hidden">
              <div className="w-full md:w-1/3 aspect-[2/3] md:aspect-auto relative group">
                {selectedSeries.image ? (
                  <img 
                    src={`${API_BASE}/library/series/${selectedSeries.id}/poster?t=${posterTimestamp}`}
                    alt={selectedSeries.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-accent/50 to-secondary flex items-center justify-center p-10">
                    <span className="text-gray-600 font-bold text-8xl text-center">{selectedSeries.title[0]}</span>
                  </div>
                )}
                {isAdmin && (
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-6">
                    <button 
                      onClick={() => {
                          setIsPosterModalOpen(true);
                          searchPosters();
                      }}
                      className="bg-primary text-secondary font-bold px-4 py-2 rounded-xl flex items-center gap-2 hover:scale-105 transition-transform"
                    >
                      <Grid size={18} />
                      {t('library.change_poster')}
                    </button>
                  </div>
                )}
              </div>
              
              <div className="flex-1 p-6 md:p-10 overflow-y-auto space-y-6">
                <div>
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-3">
                        <h2 className="text-3xl font-bold text-white leading-tight break-words">{selectedSeries.title}</h2>
                        {selectedSeries.is_airing === 1 && (
                          <span className="bg-primary/20 text-primary border border-primary/30 text-[10px] font-black px-2 py-0.5 rounded flex items-center gap-1 animate-pulse shrink-0">
                            <Zap size={10} fill="currentColor" />
                            {t('library.airing')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-gray-500 text-xs mt-1 font-mono">
                        <Folder size={12} className="shrink-0" />
                        <span className="truncate">{selectedSeries.full_path || t('library.no_local_folder')}</span>
                      </div>
                    </div>
                    {(isAdmin || isContributor) && (
                      <div className="flex gap-2 shrink-0">
                        {selectedSeries.is_airing === 1 && (selectedSeries.crunchyroll_id || !selectedSeries.id.startsWith('local-')) && (
                          <button 
                            onClick={handleToggleSubscription}
                            disabled={isSubscribing}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-sm font-bold ${
                              subscriptions.find(s => s.series_id === selectedSeries.id && s.active)
                              ? 'bg-primary/10 border-primary text-primary hover:bg-primary/20'
                              : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            {isSubscribing ? (
                              <RefreshCw size={14} className="animate-spin" />
                            ) : (
                              subscriptions.find(s => s.series_id === selectedSeries.id && s.active) ? <BellOff size={14} /> : <Bell size={14} />
                            )}
                            {subscriptions.find(s => s.series_id === selectedSeries.id && s.active) ? t('catalog.subscribed') : t('catalog.subscribe_weekly')}
                          </button>
                        )}

                        <button 
                          onClick={() => {
                            setIsRepairModalOpen(true);
                            setRepairSearchQuery(selectedSeries.title);
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors text-sm text-gray-400 hover:text-white"
                          title={t('library.identify_repair')}
                        >
                          <RefreshCw size={14} />
                          {t('library.identify')}
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">{selectedSeries.description}</p>
                </div>

                <div className="space-y-8">
                  {selectedSeries.seasons && selectedSeries.seasons.map((season: any) => (
                    <div key={season.id} className="space-y-4">
                      <div className="flex items-center justify-between border-b border-accent pb-2">
                        <h3 className="text-xl font-bold text-primary">{t('catalog.season_number', { number: season.season_number || '?' })}: {season.title}</h3>
                        {(isAdmin || isContributor) && (selectedSeries.crunchyroll_id || !selectedSeries.id.startsWith('local-')) && (
                          <div className="flex gap-2">
                             <button 
                               onClick={() => downloadMissing(season)}
                               className="flex items-center gap-1.5 text-xs bg-accent/50 hover:bg-accent px-3 py-1.5 rounded-full transition-colors"
                             >
                               <Download size={14} /> {t('library.download_missing')}
                             </button>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {season.episodes && season.episodes.map((ep: any) => (
                          <div key={ep.id} className="flex items-center justify-between bg-black/20 p-3 rounded-xl group border border-transparent hover:border-accent transition-all">
                            <div className="flex items-center gap-3 truncate text-white">
                              <span className="text-primary font-mono font-bold text-xs">{(ep.episode_number || 0).toString().padStart(2, '0')}</span>
                              <span className="text-sm font-medium truncate">{ep.title}</span>
                            </div>
                            <div className="flex items-center gap-2 pl-2">
                              {ep.is_downloaded ? (
                                <>
                                  <CheckCircle 
                                    size={16} 
                                    className="text-green-500 cursor-pointer hover:scale-110 active:scale-90 transition-transform" 
                                    onClick={(e) => { e.stopPropagation(); handleToggleDownloaded(ep.id); }}
                                  />
                                  {isAdmin && (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); deleteEpisode(ep.id); }}
                                      className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </>
                              ) : (
                                <Cloud 
                                  size={16} 
                                  className="text-gray-600 cursor-pointer hover:text-primary hover:scale-110 active:scale-90 transition-all" 
                                  onClick={(e) => { e.stopPropagation(); handleToggleDownloaded(ep.id); }}
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Repair Modal */}
      {isRepairModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-secondary border border-accent w-full max-w-5xl h-[85vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-accent flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <SearchIcon size={20} className="text-primary" />
                {t('library.repair_metadata')}
              </h2>
              <button onClick={() => setIsRepairModalOpen(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 flex gap-4">
              <input 
                type="text" 
                value={repairSearchQuery}
                onChange={(e) => setRepairSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRepairSearch()}
                placeholder={t('library.search_name_placeholder')}
                className="flex-1 bg-black/40 border border-accent rounded-xl px-4 py-2 text-white outline-none focus:border-primary transition-colors"
                autoFocus
              />
               <button 
                onClick={handleRepairSearch}
                disabled={isSearchingRepair}
                className="bg-primary text-secondary font-bold px-6 py-2 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSearchingRepair ? t('common.loading') : t('common.search')}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {repairResults ? (
                <>
                  {/* Crunchyroll Results */}
                  {repairResults.crunchyroll.length > 0 && (
                    <div className="space-y-4">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-widest px-2">{t('library.crunchy_matches')}</div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
                        {repairResults.crunchyroll.map((res: any) => (
                           <div key={res.id} className="group relative rounded-xl overflow-hidden aspect-[2/3] border border-accent cursor-pointer" onClick={() => handleRebind(res, 'crunchy')}>
                             <img src={res.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                             <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent flex flex-col justify-end p-3">
                               <div className="text-sm font-bold text-white truncate">{res.title}</div>
                               <div className="text-[10px] text-orange-400 font-black tracking-widest uppercase">{t('library.select_source', { source: 'Crunchyroll' })}</div>
                             </div>
                             <div className="absolute top-2 right-2 bg-orange-600 text-[8px] font-bold px-1.5 py-0.5 rounded shadow-lg border border-white/10">CR</div>
                           </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TMDB Results */}
                  {repairResults.tmdb && repairResults.tmdb.length > 0 && (
                    <div className="space-y-4">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-widest px-2">{t('library.tmdb_matches')}</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {repairResults.tmdb.map((res: any) => (
                           <div key={res.id} className="group relative rounded-xl overflow-hidden aspect-[2/3] border border-accent cursor-pointer" onClick={() => handleRebind({ ...res, source: 'tmdb' }, 'tmdb')}>
                             <img src={res.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                             <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent flex flex-col justify-end p-3">
                               <div className="text-sm font-bold text-white truncate">{res.title}</div>
                               <div className="text-[10px] text-green-400 font-bold">{t('common.confirm')}</div>
                             </div>
                           </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TVDB Results */}
                  {repairResults.tvdb && repairResults.tvdb.length > 0 && (
                    <div className="space-y-4">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-widest px-2 border-l-2 border-emerald-500 ml-2">{t('library.tvdb_matches')}</div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
                        {repairResults.tvdb.map((res: any) => (
                           <div key={res.id} className="group relative rounded-xl overflow-hidden aspect-[2/3] border border-accent cursor-pointer" onClick={() => handleRebind({ ...res, source: 'tvdb' }, 'tvdb')}>
                             <img src={res.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                             <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent flex flex-col justify-end p-3">
                               <div className="text-sm font-bold text-white truncate">{res.title}</div>
                               <div className="text-[10px] text-emerald-400 font-bold tracking-widest uppercase">{t('library.select_source', { source: 'TVDB' })}</div>
                             </div>
                             <div className="absolute top-2 right-2 bg-emerald-600 text-[8px] font-bold px-1.5 py-0.5 rounded shadow-lg border border-white/10">TV</div>
                           </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AniList Results */}
                  {repairResults.anilist && repairResults.anilist.length > 0 && (
                    <div className="space-y-4">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-widest px-2 border-l-2 border-blue-500 ml-2">{t('library.anilist_matches')}</div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
                        {repairResults.anilist.map((res: any) => (
                           <div key={res.id} className="group relative rounded-xl overflow-hidden aspect-[2/3] border border-accent cursor-pointer" onClick={() => handleRebind(res, 'anilist')}>
                             <img src={res.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                             <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-3">
                               <div className="text-sm font-bold text-white truncate">{res.title}</div>
                               <div className="text-[10px] text-blue-400 font-bold tracking-widest uppercase">{t('library.select_source', { source: 'AniList' })}</div>
                             </div>
                             <div className="absolute top-2 right-2 bg-blue-600 text-[8px] font-bold px-1.5 py-0.5 rounded">AL</div>
                           </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {repairResults.crunchyroll.length === 0 && repairResults.anilist.length === 0 && (!repairResults.tmdb || repairResults.tmdb.length === 0) && (!repairResults.tvdb || repairResults.tvdb.length === 0) && (
                      <div className="text-center py-10 text-gray-500">{t('library.no_matches_found')}</div>
                  )}
                </>
              ) : (
                <div className="text-center py-20 text-gray-500">
                  <SearchIcon size={40} className="mx-auto mb-4 opacity-20" />
                  {t('library.search_prompt')}
                </div>
              )}
            </div>
            
            {isRebinding && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                    <div className="text-center space-y-4">
                        <RefreshCw className="animate-spin text-primary mx-auto" size={40} />
                        <div className="font-bold">{t('library.rebinding_status')}</div>
                    </div>
                </div>
            )}
          </div>
        </div>
      )}

      {/* Poster Selection Modal */}
      {isPosterModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[70] flex items-center justify-center p-4">
          <div className="bg-secondary border border-accent w-full max-w-4xl h-[85vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-accent flex items-center justify-between bg-black/20">
              <div>
                <h2 className="text-xl font-bold text-white">{t('library.choose_new_poster')}</h2>
                <p className="text-xs text-gray-500">{t('library.selecting_multiple', { title: selectedSeries?.title })}</p>
              </div>
              <button onClick={() => setIsPosterModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-10">
              {isSearchingPosters ? (
                <div className="h-full flex flex-col items-center justify-center space-y-4">
                  <RefreshCw className="animate-spin text-primary" size={40} />
                  <p className="text-gray-400 font-medium">{t('library.fetching_covers')}</p>
                </div>
              ) : (
                <>
                  {/* TMDB Section */}
                  {(posterOptions as any).tmdb?.length > 0 && (
                    <div className="space-y-4">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-widest px-2 border-l-2 border-green-500 ml-2">TMDB Priority (High Res)</div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                        {(posterOptions as any).tmdb.map((opt: any, idx: number) => (
                          <div key={idx} onClick={() => updatePoster(opt.url)} className="group cursor-pointer space-y-2">
                             <div className="aspect-[2/3] rounded-2xl overflow-hidden border-2 border-transparent group-hover:border-green-500 transition-all relative shadow-lg">
                               <img src={opt.url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                               <div className="absolute inset-0 bg-green-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" />
                             </div>
                             <div className="text-[10px] text-gray-400 truncate text-center uppercase tracking-tighter">{opt.title}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TVDB Section */}
                  {(posterOptions as any).tvdb?.length > 0 && (
                    <div className="space-y-4">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-widest px-2 border-l-2 border-emerald-500 ml-2">TVDB Matches</div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                        {(posterOptions as any).tvdb.map((opt: any, idx: number) => (
                          <div key={idx} onClick={() => updatePoster(opt.url)} className="group cursor-pointer space-y-2">
                             <div className="aspect-[2/3] rounded-2xl overflow-hidden border-2 border-transparent group-hover:border-emerald-500 transition-all relative shadow-lg">
                               <img src={opt.url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                               <div className="absolute inset-0 bg-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" />
                             </div>
                             <div className="text-[10px] text-gray-400 truncate text-center uppercase tracking-tighter">{opt.title}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AniList Section */}
                  {(posterOptions as any).anilist?.length > 0 && (
                    <div className="space-y-4">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-widest px-2 border-l-2 border-blue-500 ml-2">AniList Covers</div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                        {(posterOptions as any).anilist.map((opt: any, idx: number) => (
                          <div key={idx} onClick={() => updatePoster(opt.url)} className="group cursor-pointer space-y-2">
                             <div className="aspect-[2/3] rounded-xl overflow-hidden border-2 border-transparent group-hover:border-blue-500 transition-all relative">
                               <img src={opt.url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                             </div>
                             <div className="text-[9px] text-gray-500 truncate text-center uppercase">{opt.title}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Crunchyroll Section */}
                  {(posterOptions as any).crunchyroll?.length > 0 && (
                    <div className="space-y-4">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-widest px-2 border-l-2 border-orange-500 ml-2">Crunchyroll Native</div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                        {(posterOptions as any).crunchyroll.map((opt: any, idx: number) => (
                          <div key={idx} onClick={() => updatePoster(opt.url)} className="group cursor-pointer space-y-2">
                             <div className="aspect-[2/3] rounded-xl overflow-hidden border-2 border-transparent group-hover:border-orange-500 transition-all relative">
                               <img src={opt.url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                             </div>
                             <div className="text-[9px] text-gray-500 truncate text-center uppercase">Current Link</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {Object.values(posterOptions).every(arr => (arr as any[]).length === 0) && (
                    <div className="col-span-full py-20 text-center text-gray-500">
                      No additional posters found.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Library;

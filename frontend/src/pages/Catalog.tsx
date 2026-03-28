import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutGrid, 
  List, 
  Clock, 
  Calendar, 
  Filter, 
  Search, 
  Download, 
  RefreshCw, 
  Trash2, 
  Plus, 
  Check, 
  AlertCircle, 
  Bell, 
  BellOff,
  MessageSquare,
  Database,
  Play
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

interface Anime {
  id: string;
  title: string;
  image: string;
  description?: string;
  release_day?: number;
  release_time?: string;
  is_simulcast?: boolean;
  seasons?: any[];
  lib_path?: string;
  folder_name?: string;
  in_library?: boolean;
}

interface Subscription {
  id: number;
  series_id: string;
  active: boolean;
}

const Catalog: React.FC = () => {
  const { t } = useTranslation();
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [season, setSeason] = useState(() => {
    const month = new Date().getMonth();
    if (month < 3) return 'winter';
    if (month < 6) return 'spring';
    if (month < 9) return 'summer';
    return 'fall';
  });
  const [filter, setFilter] = useState('');
  const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [storageData, setStorageData] = useState<any[]>([]);
  const [selectedVolume, setSelectedVolume] = useState('');
  const [mode, setMode] = useState<'seasonal' | 'browse' | 'search'>('seasonal');
  const [searchQuery, setSearchQuery] = useState('');
  const [episodesStatus, setEpisodesStatus] = useState<any>({});
  const [forceDownload, setForceDownload] = useState(false);
  
  const { user, isAdmin, isContributor, token, isLoading } = useAuth();
  
  const fetchStorage = async () => {
    try {
      const response = await fetch('/api/system/storage', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStorageData(data);
        if (data.length > 0) setSelectedVolume(data[0].path);
      }
    } catch (err) {
      console.error('Error fetching storage:', err);
    }
  };

  useEffect(() => {
    if (!isLoading && token) {
      if (mode === 'seasonal') fetchCatalog();
      else if (mode === 'browse') fetchBrowse();
      // search is triggered manually
      fetchSubscriptions();
      if (isContributor) fetchStorage();
    }
  }, [year, season, mode, token, isLoading]);

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/seasonal?year=${year}&season=${season}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAnimeList(data);
      }
    } catch (error) {
      console.error('Error fetching catalog:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBrowse = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/catalog/browse?n=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAnimeList(data);
      }
    } catch (error) {
      console.error('Error fetching browse:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGlobalSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setMode('search');
    setLoading(true);
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ service: 'crunchy', query: searchQuery })
      });
      if (response.ok) {
        const data = await response.json();
        setAnimeList(data);
      }
    } catch (error) {
      console.error('Error in global search:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscriptions = async () => {
    try {
      const response = await fetch('/api/subscriptions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSubscriptions(data);
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    }
  };

  const fetchEpisodesStatus = async (seriesId: string, title?: string) => {
    try {
      const url = `/api/series/${seriesId}/episodes-status${title ? `?title=${encodeURIComponent(title)}` : ''}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setEpisodesStatus(data);
      }
    } catch (e) {
      console.error('Error fetching episodes status:', e);
    }
  };

  const toggleEpisodeStatus = async (episodeId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/episodes/${episodeId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isDownloaded: !currentStatus })
      });
      if (response.ok && selectedAnime) {
        fetchEpisodesStatus(selectedAnime.id);
      }
    } catch (e) {
      console.error('Error toggling episode status:', e);
    }
  };

  const deleteEpisode = async (episodeId: string) => {
    if (!window.confirm(t('catalog.delete_episode_confirm'))) return;
    try {
      const response = await fetch(`/api/episodes/${episodeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok && selectedAnime) {
        fetchEpisodesStatus(selectedAnime.id);
      }
    } catch (e) {
      console.error('Error deleting episode:', e);
    }
  };

  useEffect(() => {
    const loadDetails = async () => {
      if (!selectedAnime || !token || selectedAnime.seasons) return;
      
      try {
        const res = await fetch(`/api/series/${selectedAnime.id}/details`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const details = await res.json();
          const seasonsWithEps = await Promise.all(details.seasons.map(async (s: any) => {
             const epRes = await fetch(`/api/seasons/${s.id}/episodes`, {
               headers: { 'Authorization': `Bearer ${token}` }
             });
             return epRes.ok ? { ...s, episodes: await epRes.json() } : s;
          }));
          setSelectedAnime(prev => {
             if (!prev || prev.id !== selectedAnime.id) return prev;
             if (details.lib_path) {
                const matching = storageData.find((s: any) => details.lib_path.startsWith(s.path));
                if (matching) setSelectedVolume(matching.path);
             }
             return { ...prev, seasons: seasonsWithEps, lib_path: details.lib_path };
          });
        }
      } catch (err) {
        console.error('Error loading anime detail:', err);
      }
    };

    if (selectedAnime && token) {
      loadDetails();
      fetchEpisodesStatus(selectedAnime.id, selectedAnime.title);
    }
  }, [selectedAnime?.id, token]);

  const handleToggleSubscription = async (animeOverride?: Anime) => {
    const anime = animeOverride || selectedAnime;
    if (!anime || !token) return;

    setIsSubscribing(true);
    try {
      const existing = subscriptions.find(s => s.series_id === anime.id);
      
      if (existing && existing.active) {
        const response = await fetch(`/api/subscriptions/${existing.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          setSubscriptions(prev => prev.map(s => s.id === existing.id ? { ...s, active: false } : s));
        }
      } else {
        // Find existing path in library to decide next episode
        let nextEp = 1;
        // If we are calling from card (animeOverride exists), we default to 1 for catch-up
        // or we could fetch existing path if we really wanted, but for now 1 is safer for catch-up.
        
        const response = await fetch('/api/subscriptions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            seriesId: anime.id,
            title: anime.title,
            nextEpisode: nextEp,
            releaseDay: anime.release_day,
            releaseTime: anime.release_time,
            rootPath: selectedVolume
          })
        });
        if (response.ok) {
          fetchSubscriptions();
        }
      }
    } catch (error) {
      console.error('Error toggling subscription:', error);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleSuggest = async (animeOverride?: Anime) => {
    const anime = animeOverride || selectedAnime;
    if (!anime || !token) return;
    setIsSuggesting(true);
    try {
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          series_id: anime.id,
          title: anime.title,
          image: anime.image
        })
      });
      if (response.ok) {
        alert(t('catalog.suggestion_success'));
        if (!animeOverride) setSelectedAnime(null);
      } else {
        const err = await response.json();
        alert(t('catalog.suggestion_error', { error: err.error }));
      }
    } catch (error) {
      console.error('Error suggesting anime:', error);
      alert(t('catalog.suggestion_conn_error'));
    } finally {
      setIsSuggesting(false);
    }
  };

  const startDownload = async (anime: Anime, episodes: string, seasonId?: string, seasonNumber?: number) => {
    try {
      const response = await fetch('/api/downloads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: anime.title,
          service: 'crunchy',
          show_id: anime.id,
          season_id: seasonId,
          season_number: seasonNumber,
          episodes,
          rootPath: selectedVolume,
          image: anime.image,
          force: forceDownload
        })
      });
      if (response.ok) {
        alert(t('common.download_added_to_queue'));
      }
    } catch (error) {
      console.error('Error starting download:', error);
    }
  };

  const downloadAllMissingSeries = async (anime: Anime) => {
    if (!anime.seasons || anime.seasons.length === 0) {
      startDownload(anime, 'all');
      return;
    }

    const missingEpisodes: number[] = [];
    anime.seasons.forEach((s: any) => {
      if (s.episodes) {
        s.episodes.forEach((ep: any) => {
          const status = episodesStatus[ep.id] || episodesStatus[`number-${ep.episode_number}`];
          if (!status || !status.is_downloaded) {
            missingEpisodes.push(ep.episode_number);
          }
        });
      }
    });

    if (missingEpisodes.length === 0) {
      alert(t('catalog.all_in_library'));
      return;
    }

    startDownload(anime, missingEpisodes.sort((a, b) => a - b).join(','));
  };

  const downloadSeason = async (anime: Anime, season: any, missingOnly: boolean = false) => {
    if (!season.episodes || season.episodes.length === 0) return;

    let episodesToDownload: number[] = [];
    if (missingOnly) {
      episodesToDownload = season.episodes
        .filter((ep: any) => {
          const status = episodesStatus[ep.id] || episodesStatus[`number-${ep.episode_number}`];
          return !status || !status.is_downloaded;
        })
        .map((ep: any) => ep.episode_number);
    } else {
      episodesToDownload = season.episodes.map((ep: any) => ep.episode_number);
    }

    if (episodesToDownload.length === 0) {
      alert(t('catalog.all_in_library'));
      return;
    }

    // Call startDownload with specific episodes and season info
    startDownload(anime, episodesToDownload.sort((a, b) => a - b).join(','), season.id, season.season_number);
  };

  const filteredAnime = useMemo(() => {
    return animeList.filter(a => a.title.toLowerCase().includes(filter.toLowerCase()));
  }, [animeList, filter]);

  const years = [];
  for (let i = new Date().getFullYear(); i >= 2000; i--) {
    years.push(i);
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-8 bg-secondary/50 p-8 rounded-[2.5rem] border border-accent backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32" />
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <h1 className="text-5xl font-black tracking-tighter text-white uppercase italic leading-none">
              {mode === 'seasonal' ? t('catalog.seasonal') : mode === 'browse' ? t('catalog.browse') : t('common.search')} <span className="text-primary">{t('catalog.catalog_title')}</span>
            </h1>
            <p className="text-gray-400 font-medium tracking-tight text-lg max-w-xl">
              {mode === 'seasonal' ? t('catalog.seasonal_subtitle', { season: t(`common.${season}`), year }) : 
               mode === 'browse' ? t('catalog.browse_subtitle') :
               t('catalog.search_subtitle')}
            </p>
          </div>

          <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5">
            <button 
              onClick={() => { setMode('seasonal'); setFilter(''); }}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${mode === 'seasonal' ? 'bg-primary text-background shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-white'}`}
            >
              {t('catalog.seasonal')}
            </button>
            <button 
              onClick={() => { setMode('browse'); setFilter(''); }}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${mode === 'browse' ? 'bg-primary text-background shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-white'}`}
            >
              {t('catalog.discovery')}
            </button>
            <button 
              onClick={() => setMode('search')}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${mode === 'search' ? 'bg-primary text-background shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-white'}`}
            >
              {t('common.search')}
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center relative z-10">
          <form className="md:col-span-6 lg:col-span-7 relative group" onSubmit={handleGlobalSearch}>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={20} />
            <input 
              type="text"
              placeholder={mode === 'search' ? t('catalog.search_placeholder') : t('catalog.filter_placeholder')}
              className="w-full pl-12 pr-4 py-4 bg-accent/50 border border-white/5 rounded-2xl focus:bg-accent focus:border-primary/50 transition-all text-sm font-medium text-white placeholder:text-gray-600 outline-none"
              value={mode === 'search' ? searchQuery : filter}
              onChange={(e) => mode === 'search' ? setSearchQuery(e.target.value) : setFilter(e.target.value)}
            />
          </form>
          
          <div className="md:col-span-6 lg:col-span-5 flex items-center gap-3">
            {mode === 'search' ? (
              <button 
                onClick={handleGlobalSearch}
                className="flex-1 px-8 py-4 bg-primary text-background font-black uppercase tracking-widest rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-primary/20"
              >
                {t('catalog.perform_search')}
              </button>
            ) : mode === 'seasonal' ? (
              <>
                <select 
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  className="flex-1 bg-accent/50 border border-white/5 px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest text-white cursor-pointer hover:bg-accent transition-all outline-none appearance-none"
                >
                  <option value="winter">{t('common.winter')}</option>
                  <option value="spring">{t('common.spring')}</option>
                  <option value="summer">{t('common.summer')}</option>
                  <option value="fall">{t('common.fall')}</option>
                </select>

                <select 
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="flex-1 bg-accent/50 border border-white/5 px-6 py-4 rounded-2xl text-sm font-black text-white cursor-pointer hover:bg-accent transition-all outline-none appearance-none"
                >
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </>
            ) : (
               <button 
                onClick={fetchBrowse}
                className="flex-1 px-8 py-4 bg-accent/50 border border-white/5 text-gray-400 font-black uppercase tracking-widest rounded-2xl hover:text-white transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                {t('catalog.refresh_discovery')}
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <div className="text-xs font-black uppercase tracking-[0.3em] text-primary animate-pulse">{t('catalog.loading')}</div>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredAnime.length === 0 ? (
            <div className="text-center py-32 bg-secondary/30 rounded-3xl border border-dashed border-accent">
               <Filter className="mx-auto text-gray-600 mb-4" size={48} />
               <h3 className="text-xl font-bold text-gray-400">{t('catalog.no_matching')}</h3>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {filteredAnime.map((anime) => (
                  <div 
                    key={anime.id} 
                    className="group relative bg-secondary rounded-2xl overflow-hidden border border-accent hover:border-primary/50 transition-all duration-300 cursor-pointer shadow-xl hover:-translate-y-1"
                    onClick={() => setSelectedAnime(anime)}
                  >
                    <div className="aspect-[2/3] relative overflow-hidden">
                      <img 
                        src={anime.image} 
                        alt={anime.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                        <button 
                          className="w-full py-2 bg-primary text-background font-black text-xs uppercase rounded-xl transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-lg"
                        >
                          {t('catalog.view_details')}
                        </button>
                      </div>

                      {anime.in_library && (
                        <div className="absolute top-2 left-2 bg-green-500 text-white p-1.5 rounded-full shadow-lg z-10 border border-white/20 animate-in zoom-in duration-300">
                          <Check className="w-3 h-3" strokeWidth={4} />
                        </div>
                      )}
                      
                      {/* Subscription Status on card */}
                      <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <div
                          className={`p-2 rounded-lg backdrop-blur-md border shadow-2xl transition-all ${
                            subscriptions.find(s => s.series_id === anime.id && s.active)
                            ? 'bg-orange-500 text-white border-orange-400'
                            : 'bg-black/60 text-white border-white/20 hover:bg-primary hover:text-background hover:border-transparent'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            const isSubscribed = subscriptions.find(s => s.series_id === anime.id && s.active);
                            if (isSubscribed) {
                              // Fast unsubscribe is safe
                              handleToggleSubscription(anime);
                            } else {
                              // For new subscriptions, open details to select Disk
                              setSelectedAnime(anime);
                            }
                          }}
                           title={t('catalog.subscribe_weekly')}
                        >
                          {subscriptions.find(s => s.series_id === anime.id && s.active) ? <BellOff className="w-6 h-6" /> : <Bell className="w-6 h-6" />}
                        </div>

                         <div
                          className="p-2 rounded-lg backdrop-blur-md border border-white/20 bg-black/60 text-white hover:bg-orange-500 hover:border-transparent transition-all shadow-2xl"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSuggest(anime);
                          }}
                          title={t('catalog.suggest_community')}
                        >
                          <MessageSquare className="w-6 h-6" />
                        </div>
                      </div>
                    </div>
                    <div className="p-3">
                      <h3 className="text-sm font-semibold text-white line-clamp-2 leading-tight group-hover:text-orange-500 transition-colors">
                        {anime.title}
                      </h3>
                      {anime.in_library && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                          <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">{t('catalog.in_library_short')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Details Modal */}
      {selectedAnime && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-gray-900 w-full max-w-7xl h-[95vh] rounded-2xl border border-white/10 overflow-hidden shadow-2xl flex flex-col">
            <div className="relative min-h-[400px] w-full shrink-0">
              <img src={selectedAnime.image} className="w-full h-full object-cover blur-xl opacity-30 absolute inset-0" alt="" />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />
              <div className="absolute inset-0 p-8 flex gap-8">
                <img src={selectedAnime.image} className="h-full rounded-xl shadow-2xl border border-white/10 hidden sm:block" alt={selectedAnime.title} />
                <div className="flex flex-col justify-end flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-orange-500 font-bold text-xs uppercase bg-orange-500/10 px-2 py-0.5 rounded tracking-widest">{t(`common.${season}`)} {year}</span>
                    {selectedAnime.is_simulcast && <span className="text-blue-400 font-bold text-xs uppercase bg-blue-400/10 px-2 py-0.5 rounded tracking-widest">{t('catalog.simulcast')}</span>}
                  </div>
                  <h2 className="text-3xl md:text-5xl font-black text-white mb-4 leading-tight break-words uppercase italic">{selectedAnime.title}</h2>
                    {/* Actions Row 1: Subscriptions and Suggestions */}
                    <div className="flex flex-wrap gap-3 mb-6">
                      {isContributor && (
                        <button
                          onClick={() => handleToggleSubscription()}
                          disabled={isSubscribing}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-xs font-black uppercase tracking-widest shadow-lg ${
                            subscriptions.find(s => s.series_id === selectedAnime.id && s.active)
                            ? 'bg-orange-500 border-orange-400 text-white hover:bg-orange-600'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {isSubscribing ? (
                            <RefreshCw size={14} className="animate-spin" />
                          ) : (
                            subscriptions.find(s => s.series_id === selectedAnime.id && s.active) ? <BellOff size={14} /> : <Bell size={14} />
                          )}
                          {subscriptions.find(s => s.series_id === selectedAnime.id && s.active) ? t('catalog.subscribed') : t('catalog.subscribe_weekly')}
                        </button>
                      )}

                      <button
                        onClick={() => handleSuggest()}
                        disabled={isSuggesting}
                        className="flex items-center gap-2 px-6 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-xl active:scale-95 disabled:opacity-50"
                      >
                        {isSuggesting ? <RefreshCw size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                        {t('catalog.suggest_community')}
                      </button>
                    </div>

                    {/* Actions Row 2: Download Configuration and Execution (Collaborators Only) */}
                    {isContributor && (
                      <div className="bg-black/40 border border-white/5 p-6 rounded-[2rem] space-y-6 shadow-inner">
                        <div className="flex flex-col md:flex-row items-end gap-6">
                          {storageData.length > 0 && (
                            <div className="flex flex-col gap-2 min-w-[240px]">
                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-1.5 ml-1">
                                <Database size={12} className="text-primary" /> {t('catalog.download_destination')}
                              </label>
                              {!(selectedAnime && selectedAnime.lib_path) ? (
                                <select
                                  value={selectedVolume}
                                  onChange={(e) => setSelectedVolume(e.target.value)}
                                  className="w-full bg-secondary/80 border border-white/10 text-white text-sm font-bold rounded-2xl px-4 py-3 outline-none focus:border-primary/50 transition-all cursor-pointer appearance-none shadow-xl"
                                >
                                  {storageData.map(drive => (
                                    <option key={drive.path} value={drive.path} className="bg-secondary">
                                      {drive.name || drive.path.split(/[\\/]/).pop() || drive.path} — {drive.free} {t('catalog.available')}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <div className="bg-primary/5 p-3 rounded-2xl border border-primary/20 flex items-center justify-between">
                                  <div className="text-sm font-bold text-white truncate max-w-[200px]">
                                    {selectedAnime.folder_name ? t('catalog.folder_label', { name: selectedAnime.folder_name }) : (selectedVolume.split(/[\\/]/).pop() || t('catalog.library'))}
                                  </div>
                                  <div className="text-[9px] font-black text-primary uppercase tracking-widest px-2 py-1 bg-primary/20 rounded-lg">
                                    {t('catalog.locked')}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex flex-1 flex-wrap gap-2">
                            <button
                              onClick={() => startDownload(selectedAnime, 'all')}
                              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 border border-white/10 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl group/btn"
                            >
                                <Download className="w-4 h-4 group-hover/btn:translate-y-0.5 transition-transform" />
                                {t('catalog.download_full_to_drive', { drive: storageData.find(d => d.path === selectedVolume)?.name || selectedVolume.split(/[\\/]/).pop() || t('catalog.drive') })}
                            </button>
                            
                            <button
                              onClick={() => downloadAllMissingSeries(selectedAnime)}
                              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-green-900/20"
                            >
                                <Play className="w-4 h-4" />
                                {t('catalog.download_missing_to_drive', { drive: storageData.find(d => d.path === selectedVolume)?.name || selectedVolume.split(/[\\/]/).pop() || t('catalog.drive') })}
                            </button>
                          </div>
                          
                          <div 
                            className="flex items-center gap-3 px-5 py-3 bg-white/5 border border-white/10 rounded-2xl cursor-pointer hover:bg-white/10 transition-all select-none group/force"
                            onClick={() => setForceDownload(!forceDownload)}
                          >
                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${forceDownload ? 'bg-orange-500 border-orange-400' : 'border-white/20 group-hover/force:border-white/40'}`}>
                              {forceDownload && <Check size={14} strokeWidth={4} className="text-white" />}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase tracking-widest text-white leading-none mb-1">Force Re-download</span>
                              <span className="text-[8px] font-medium text-gray-500 uppercase tracking-tight">Bypasses internal download archive</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                </div>
                <button 
                  onClick={() => setSelectedAnime(null)}
                  className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-8 h-8" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar">
               <div className="space-y-6">
                  <div>
                    <h3 className="text-orange-500 font-black text-xs uppercase tracking-widest mb-2">{t('catalog.overview')}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      {selectedAnime.description || t('catalog.no_description')}
                    </p>
                  </div>

                  {/* Seasons and Episodes Section */}
                  {selectedAnime.seasons && selectedAnime.seasons.length > 0 && (
                    <div className="space-y-8 mt-10">
                      <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <h3 className="text-xl font-bold text-white flex items-center gap-3">
                          <List className="text-orange-500 w-5 h-5" />
                          {t('catalog.seasons_episodes')}
                        </h3>
                        <span className="text-xs font-black text-gray-500 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full">
                          {selectedAnime.seasons.length} {selectedAnime.seasons.length === 1 ? t('catalog.season_one') : t('catalog.season_other')}
                        </span>
                      </div>

                      <div className="space-y-10">
                         {selectedAnime.seasons.map((s: any) => (
                          <div key={s.id} className="group/season">
                            <div className="flex items-center gap-6 mb-6">
                              <div className="h-px flex-1 bg-gradient-to-r from-orange-500/50 via-orange-500/20 to-transparent"></div>
                              <div className="flex flex-col items-center gap-2">
                                <h4 className="text-base font-black text-white uppercase tracking-[0.4em] flex items-center gap-3">
                                  {s.title || t('catalog.season_number', { number: s.season_number })}
                                </h4>
                                {isContributor && (
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => downloadSeason(selectedAnime, s, false)}
                                      className="flex items-center gap-1.5 px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all active:scale-95"
                                      title={t('catalog.download_season')}
                                    >
                                      <Download size={10} /> {t('catalog.download_season')}
                                    </button>
                                    <button 
                                      onClick={() => downloadSeason(selectedAnime, s, true)}
                                      className="flex items-center gap-1.5 px-3 py-1 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 rounded-full text-[10px] font-black uppercase tracking-widest text-orange-500 transition-all active:scale-95"
                                      title={t('catalog.download_missing_season')}
                                    >
                                      <Play size={10} /> {t('catalog.download_missing_season')}
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div className="h-px flex-1 bg-gradient-to-l from-orange-500/50 via-orange-500/20 to-transparent"></div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {s.episodes?.map((ep: any) => {
                                const epStatus = episodesStatus[ep.id] || episodesStatus[`number-${ep.episode_number}`] || { is_downloaded: false };
                                return (
                                  <div 
                                    key={ep.id} 
                                    className={`group/ep flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
                                      epStatus.is_downloaded 
                                      ? 'bg-orange-500/5 border-orange-500/20' 
                                      : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10'
                                    }`}
                                  >
                                    <div className="flex items-center gap-4 min-w-0">
                                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs transition-colors ${
                                        epStatus.is_downloaded ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-white/5 text-gray-400'
                                      }`}>
                                        {ep.episode_number}
                                      </div>
                                      <div className="truncate">
                                          <div className="text-xs font-bold text-white truncate max-w-[200px]">{ep.title || t('catalog.episode_label', { number: ep.episode_number })}</div>
                                          {epStatus.is_downloaded && (
                                            <div className="text-[10px] text-orange-500 font-black uppercase tracking-widest mt-0.5 flex items-center gap-1">
                                              <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></div>
                                              {t('catalog.in_library')}
                                            </div>
                                          )}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1 opacity-0 group-hover/ep:opacity-100 transition-opacity">
                                      {(!epStatus.is_downloaded || forceDownload) && (
                                        <button 
                                          onClick={() => startDownload(selectedAnime, ep.episode_number.toString(), s.id, s.season_number)}
                                          className="p-2.5 rounded-xl bg-primary hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 transition-all hover:scale-105"
                                          title={t('catalog.download_episode')}
                                        >
                                          <Download size={14} />
                                        </button>
                                      )}
                                      
                                      {epStatus.is_downloaded && (
                                        <button 
                                          onClick={() => deleteEpisode(ep.id)}
                                          className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all hover:scale-105"
                                          title={t('catalog.delete_from_library')}
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      )}
                                      
                                      <button 
                                        onClick={() => toggleEpisodeStatus(ep.id, epStatus.is_downloaded)}
                                        className={`p-2.5 rounded-xl transition-all hover:scale-105 ${
                                          epStatus.is_downloaded 
                                          ? 'bg-green-500/10 text-green-500' 
                                          : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                        }`}
                                        title={epStatus.is_downloaded ? t('catalog.mark_as_undownloaded') : t('catalog.mark_as_downloaded')}
                                      >
                                        <Check size={14} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const X = ({ className, onClick }: any) => (
  <svg onClick={onClick} className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);

export default Catalog;

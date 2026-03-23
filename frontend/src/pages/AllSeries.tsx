import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutGrid, 
  Search, 
  Download, 
  RefreshCw, 
  Plus, 
  Check, 
  Bell, 
  BellOff,
  MessageSquare,
  ChevronDown,
  Database
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Anime {
  id: string;
  title: string;
  image: string;
  description?: string;
  is_simulcast?: boolean;
}

interface Subscription {
  id: number;
  series_id: string;
  active: boolean;
}

const AllSeries: React.FC = () => {
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sort, setSort] = useState('popularity');
  const [start, setStart] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [storageData, setStorageData] = useState<any[]>([]);
  const [selectedVolume, setSelectedVolume] = useState('');

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
      fetchCatalog(true);
      fetchSubscriptions();
      if (isContributor) fetchStorage();
    }
  }, [sort, token, isLoading]);

  const fetchCatalog = async (reset = false) => {
    if (reset) {
        setLoading(true);
        setStart(0);
    } else {
        setLoadingMore(true);
    }
    
    const currentStart = reset ? 0 : start;
    
    try {
      const response = await fetch(`/api/catalog/browse?sort=${sort}&start=${currentStart}&n=48`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (reset) {
            setAnimeList(data);
        } else {
            setAnimeList(prev => [...prev, ...data]);
        }
        setHasMore(data.length === 48);
        setStart(currentStart + data.length);
      }
    } catch (error) {
      console.error('Error fetching catalog:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
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
        const response = await fetch('/api/subscriptions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            seriesId: anime.id,
            title: anime.title,
            nextEpisode: 1
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

  const handleSuggest = async () => {
    if (!selectedAnime || !token) return;
    setIsSuggesting(true);
    try {
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          series_id: selectedAnime.id,
          title: selectedAnime.title,
          image: selectedAnime.image
        })
      });
      if (response.ok) {
        alert('Suggestion sent successfully!');
        setSelectedAnime(null);
      } else {
        const err = await response.json();
        alert('Error: ' + err.error);
      }
    } catch (error) {
      console.error('Error suggesting anime:', error);
      alert('Connection error');
    } finally {
      setIsSuggesting(false);
    }
  };

  const startDownload = async (anime: Anime, episodes: string) => {
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
          episodes,
          rootPath: selectedVolume
        })
      });
      if (response.ok) {
        alert('Download added to queue');
      }
    } catch (error) {
      console.error('Error starting download:', error);
    }
  };

  const filteredAnime = useMemo(() => {
    return animeList.filter(a => a.title.toLowerCase().includes(filter.toLowerCase()));
  }, [animeList, filter]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-secondary/50 p-6 rounded-3xl border border-accent backdrop-blur-sm">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic">Complete <span className="text-primary">Catalog</span></h1>
          <p className="text-gray-400 font-medium tracking-tight">Explore the entire Crunchyroll library.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={18} />
            <input 
              type="text"
              placeholder="Search in loaded..."
              className="pl-10 pr-4 py-2 bg-accent border-transparent rounded-xl focus:bg-accent/80 focus:border-primary/50 transition-all text-sm w-full md:w-64 text-white outline-none"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          
          <select 
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="bg-accent px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider cursor-pointer hover:bg-accent/80 transition-colors border-transparent text-white outline-none"
          >
            <option value="popularity">Popularity</option>
            <option value="newly_added">Newly Added</option>
            <option value="alphabetical">Alphabetical</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <div className="text-xs font-black uppercase tracking-[0.3em] text-primary animate-pulse">Fetching Library...</div>
        </div>
      ) : (
        <div className="space-y-10">
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
                      <button className="w-full py-2 bg-primary text-background font-black text-xs uppercase rounded-xl transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-lg">
                        Details
                      </button>
                    </div>
                    
                    <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <div
                        className={`p-2 rounded-lg backdrop-blur-md border shadow-2xl transition-all ${
                          subscriptions.find(s => s.series_id === anime.id && s.active)
                          ? 'bg-orange-500 text-white border-orange-400'
                          : 'bg-black/60 text-white border-white/20 hover:bg-primary hover:text-background hover:border-transparent'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSubscription(anime);
                        }}
                      >
                        {subscriptions.find(s => s.series_id === anime.id && s.active) ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-semibold text-white line-clamp-2 leading-tight group-hover:text-orange-500 transition-colors">
                      {anime.title}
                    </h3>
                  </div>
                </div>
              ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-4">
               <button 
                onClick={() => fetchCatalog()}
                disabled={loadingMore}
                className="group flex items-center gap-3 px-10 py-4 bg-secondary border border-accent hover:border-primary/50 rounded-2xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
               >
                 {loadingMore ? (
                   <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                 ) : (
                   <>
                     <span className="text-sm font-black uppercase tracking-widest text-white">Load More Content</span>
                     <ChevronDown className="w-5 h-5 text-primary group-hover:translate-y-1 transition-transform" />
                   </>
                 )}
               </button>
            </div>
          )}
        </div>
      )}

      {/* Details Modal */}
      {selectedAnime && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-gray-900 w-full max-w-4xl max-h-[90vh] rounded-2xl border border-white/10 overflow-hidden shadow-2xl flex flex-col">
            <div className="relative h-64 sm:h-80 w-full shrink-0">
              <img src={selectedAnime.image} className="w-full h-full object-cover blur-xl opacity-30 absolute inset-0" alt="" />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />
              <div className="absolute inset-0 p-8 flex gap-8">
                <img src={selectedAnime.image} className="h-full rounded-xl shadow-2xl border border-white/10 hidden sm:block" alt={selectedAnime.title} />
                <div className="flex flex-col justify-end flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-orange-500 font-bold text-xs uppercase bg-orange-500/10 px-2 py-0.5 rounded tracking-widest">Library</span>
                    {selectedAnime.is_simulcast && <span className="text-blue-400 font-bold text-xs uppercase bg-blue-400/10 px-2 py-0.5 rounded tracking-widest">Simulcast</span>}
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-4 leading-tight">{selectedAnime.title}</h2>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {isContributor && (
                        <button
                          onClick={() => handleToggleSubscription()}
                          disabled={isSubscribing}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-xs font-bold ${
                            subscriptions.find(s => s.series_id === selectedAnime.id && s.active)
                            ? 'bg-orange-500/20 border-orange-500 text-orange-500 hover:bg-orange-500/30'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {isSubscribing ? (
                            <RefreshCw size={14} className="animate-spin" />
                          ) : (
                            subscriptions.find(s => s.series_id === selectedAnime.id && s.active) ? <BellOff size={14} /> : <Bell size={14} />
                          )}
                          {subscriptions.find(s => s.series_id === selectedAnime.id && s.active) ? 'Subscribed' : 'Subscribe Weekly'}
                        </button>
                      )}

                      {isContributor && storageData.length > 0 && (
                        <div className="flex flex-col gap-1 min-w-[180px]">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                            <Database size={10} /> Target Volume
                          </label>
                          <select
                            value={selectedVolume}
                            onChange={(e) => setSelectedVolume(e.target.value)}
                            className="bg-black/40 border border-white/10 text-white text-xs font-bold rounded-xl px-3 py-2 outline-none focus:border-primary/50 transition-all cursor-pointer appearance-none"
                          >
                            {storageData.map(drive => (
                              <option key={drive.path} value={drive.path} className="bg-secondary">
                                {drive.path.split(/[\\/]/).pop() || drive.path} ({drive.free} free)
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {isContributor ? (
                        <button
                          onClick={() => startDownload(selectedAnime, 'all')}
                          className="flex items-center gap-2 px-3 py-1.5 h-[38.5px] bg-gray-800 hover:bg-gray-700 border border-white/5 text-white text-xs font-bold rounded-lg transition-colors shadow-lg self-end"
                        >
                          <Download className="w-4 h-4" />
                          DOWNLOAD ALL
                        </button>
                      ) : (
                        <button
                          onClick={handleSuggest}
                          disabled={isSuggesting}
                          className="flex items-center gap-2 px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-black rounded-lg transition-all shadow-lg shadow-orange-500/20 active:scale-95 disabled:opacity-50"
                        >
                          {isSuggesting ? <RefreshCw size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                          SUGGEST CONTENT
                        </button>
                      )}
                    </div>
                </div>
                <button 
                  onClick={() => setSelectedAnime(null)}
                  className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors"
                >
                  <XIcon />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar">
               <div className="space-y-6">
                  <div>
                    <h3 className="text-orange-500 font-black text-xs uppercase tracking-widest mb-2">Description</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      {selectedAnime.description || 'No description available.'}
                    </p>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);

export default AllSeries;

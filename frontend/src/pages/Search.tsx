import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, Download, Info, Loader2, Check, Play, Plus, Trash2, Database } from 'lucide-react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

interface Anime {
  id: string;
  title: string;
  image: string;
  description: string;
  is_simulcast?: boolean;
}

interface SeasonDetails {
  id: string;
  title: string;
  season_number: number;
  episode_count: number;
}

const Search = () => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);
  const [details, setDetails] = useState<{ seasons: SeasonDetails[] } | null>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [episodeStatus, setEpisodeStatus] = useState<Record<string, { is_downloaded: boolean, path?: string }>>({});
  const [storageData, setStorageData] = useState<any[]>([]);
  const [selectedVolume, setSelectedVolume] = useState<string>('');
  const [existingPath, setExistingPath] = useState<string | null>(null);
  const [archiveStatus, setArchiveStatus] = useState<Record<string, boolean>>({});
  const [service, setService] = useState('crunchy');

  useEffect(() => {
    fetchVolumes();
  }, []);

  const fetchVolumes = async () => {
    try {
      const response = await axios.get('/api/system/storage');
      setStorageData(response.data);
      if (response.data.length > 0) {
        setSelectedVolume(response.data[0].path);
      }
    } catch (err) {
      console.error('Error fetching storage:', err);
    }
  };

  const handleSearch = async (e: any) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const resp = await axios.post('/api/search', {
        service,
        query
      });
      setResults(resp.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const showDetails = async (anime: Anime) => {
    setSelectedAnime(anime);
    setLoadingDetails(true);
    setDetails(null);
    setEpisodes([]);
    setEpisodeStatus({});
    setExistingPath(null);
    try {
      const [detailsRes, statusRes, locationRes] = await Promise.all([
        axios.get(`/api/catalog/series/${anime.id}`),
        axios.get(`/api/library/series/${anime.id}/status`).catch(() => ({ data: {} })),
        axios.get(`/api/library/series/${anime.id}/location`).catch(() => ({ data: { full_path: null } }))
      ]);
      setDetails(detailsRes.data);
      setEpisodeStatus(statusRes.data);
      setExistingPath(locationRes.data.full_path);
    } catch (error) {
      console.error('Error fetching details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const fetchEpisodes = async (seasonId: string) => {
    setLoadingDetails(true);
    try {
      const response = await axios.get(`/api/catalog/season/${seasonId}/episodes`);
      setEpisodes(response.data);
      
      // Fetch archive status
      const statuses: Record<string, boolean> = { ...archiveStatus };
      await Promise.all(response.data.map(async (ep: any) => {
        try {
          const res = await axios.get(`/api/archive/status`, {
            params: { service: 'crunchy', type: 's', id: seasonId, episode: ep.episode_number }
          });
          statuses[ep.id] = res.data.downloaded;
        } catch (e) {
          console.error('Error fetching archive status:', e);
        }
      }));
      setArchiveStatus(statuses);
    } catch (error) {
      console.error('Error fetching episodes:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const toggleArchive = async (ep: any) => {
    try {
      const isArchived = archiveStatus[ep.id];
      await axios.post('/api/archive/toggle', {
        service: 'crunchy',
        type: 's',
        id: ep.season_id,
        episode: ep.episode_number
      });
      setArchiveStatus(prev => ({
        ...prev,
        [ep.id]: !isArchived
      }));
    } catch (err) {
      console.error('Error toggling archive:', err);
    }
  };

  const startDownload = async (anime: Anime, episodesValue: string = 'all', seasonId?: string, seasonNumber?: number) => {
    try {
      await axios.post('/api/downloads', {
        name: anime.title,
        service: 'crunchy',
        show_id: anime.id,
        season_id: seasonId,
        season_number: seasonNumber,
        episodes: episodesValue,
        rootPath: selectedVolume
      });
      alert(t('common.download_added_to_queue'));
    } catch (error) {
      console.error('Error starting download:', error);
    }
  };

  const downloadAllMissingSeries = async (anime: Anime) => {
    if (!details) return;
    alert(t('search.download_missing_warning'));

    for (const season of details.seasons) {
      try {
        const response = await axios.get(`/api/catalog/season/${season.id}/episodes`);
        const seasonEps = response.data;
        const missing = seasonEps.filter((ep: any) => !episodeStatus[ep.id]?.is_downloaded && !archiveStatus[ep.id]);
        if (missing.length > 0) {
          const epList = missing.map((ep: any) => ep.episode_number).join(',');
          await startDownload(anime, epList, season.id, season.season_number);
        }
      } catch (err) {
        console.error(`Error processing season ${season.title}:`, err);
      }
    }
    alert(t('search.download_queue_updated'));
  };

  const rescanSeries = async (anime: Anime) => {
    setLoadingDetails(true);
    try {
      await axios.post(`/api/library/series/${anime.id}/refresh`);
      const statusRes = await axios.get(`/api/library/series/${anime.id}/status`);
      setEpisodeStatus(statusRes.data);
      alert(t('search.library_rescanned'));
    } catch (err) {
      console.error('Error rescanning:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const deleteEpisode = async (anime: Anime, ep: any) => {
    if (!window.confirm(t('search.delete_confirm', { episode: ep.episode_number }))) return;
    try {
      await axios.post('/api/library/episode/delete', { episodeId: ep.id });
      // Update local status
      setEpisodeStatus(prev => ({
        ...prev,
        [ep.id]: { ...prev[ep.id], is_downloaded: false }
      }));
    } catch (err) {
      console.error('Error deleting episode:', err);
      alert(t('common.error_deleting_episode'));
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-black text-white">{t('search.title')}</h1>
        <p className="text-gray-400">{t('search.subtitle')}</p>
      </div>

      <div className="bg-gray-900/50 p-6 rounded-2xl border border-white/5 backdrop-blur-sm shadow-xl">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
          <div className="flex_1 relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-orange-500 transition-colors">
              <SearchIcon size={20} />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={service === 'anidb' ? t('search.placeholder_id') : t('search.placeholder_title')}
              className="w-full bg-gray-800 border-gray-700 border text-white rounded-xl py-4 pl-12 pr-4 outline-none focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 transition-all text-lg shadow-inner"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-orange-500 transition-all font-bold"
            >
              <option value="crunchy">Crunchyroll</option>
              <option value="hidive">HIDIVE</option>
              <option value="anilist">{t('search.anilist_mal')}</option>
              <option value="tmdb">{t('search.tmdb_meta')}</option>
              <option value="tvdb">{t('search.tvdb_meta')}</option>
              <option value="anidb">{t('search.anidb_meta')}</option>
            </select>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-8 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all shadow-lg flex items-center gap-2 whitespace-nowrap"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <SearchIcon size={20} />}
              {loading ? t('common.searching') : t('common.search')}
            </button>
          </div>
        </form>
      </div>

      {(results.length > 0 && (service === 'crunchy' || service === 'anilist' || service === 'tmdb' || service === 'tvdb' || service === 'anidb')) ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {results.map((anime: Anime) => (
            <div
              key={anime.id}
              className="group relative bg-gray-900 rounded-xl overflow-hidden border border-white/5 hover:border-orange-500/50 transition-all duration-300 hover:scale-105 cursor-pointer shadow-lg"
              onClick={() => showDetails(anime)}
            >
              <div className="aspect-[2/3] relative">
                <img
                  src={anime.image || '/notFound.png'}
                  alt={anime.title}
                  className="w-full h-full object-cover group-hover:opacity-40 transition-opacity"
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-orange-600 p-3 rounded-full shadow-xl">
                    <Info className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
              <div className="p-3">
                <h3 className="text-sm font-semibold text-white line-clamp-2 leading-tight group-hover:text-orange-500 transition-colors">
                  {anime.title}
                </h3>
                {service === 'anilist' && (
                  <div className="mt-1 text-[10px] text-blue-400 font-mono uppercase tracking-tighter">{t('search.anilist_mal_short')}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-1 gap-3">
          {results.map((item: any, i) => (
            <div key={i} className="flex items-center gap-4 bg-gray-900/50 p-4 rounded-xl border border-white/5 hover:border-orange-500/30 transition-colors group">
              <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center text-orange-500 font-bold border border-white/5">
                {service[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="font-bold text-white truncate">{item.title}</div>
                <div className="text-xs text-gray-500 font-mono">{item.id}</div>
              </div>
              <button
                onClick={() => startDownload({ id: item.id, title: item.title, image: '', description: '' })}
                className="p-2 bg-gray-800 text-gray-400 rounded-lg hover:bg-orange-600 hover:text-white transition-all"
              >
                <Download size={20} />
              </button>
            </div>
          ))}
        </div>
      ) : !loading && query && (
        <div className="text-center py-20 text-gray-500">
          {t('common.no_results_found')}
        </div>
      )}

      {/* Details Modal (Copied from Catalog.tsx) */}
      {selectedAnime && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-gray-900 w-full max-w-4xl max-h-[90vh] rounded-2xl border border-white/10 overflow-hidden shadow-2xl flex flex-col">
            <div className="relative h-64 sm:h-80 w-full">
              <img src={selectedAnime.image} className="w-full h-full object-cover blur-xl opacity-30 absolute inset-0" alt="" />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />
              <div className="absolute inset-0 p-8 flex gap-8">
                <img src={selectedAnime.image} className="h-full rounded-xl shadow-2xl border border-white/10 hidden sm:block" alt={selectedAnime.title} />
                <div className="flex flex-col justify-end flex-1">
                  <h2 className="text-3xl font-bold text-white mb-4 leading-tight">{selectedAnime.title}</h2>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {!selectedAnime.id.startsWith('al-') && (
                      <>
                        <button
                          onClick={() => startDownload(selectedAnime, 'all')}
                          className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg transition-colors shadow-lg"
                        >
                          <Download className="w-4 h-4" />
                          {t('search.download_all')}
                        </button>
                        <button
                          onClick={() => downloadAllMissingSeries(selectedAnime)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors shadow-lg"
                        >
                          <Plus className="w-4 h-4" />
                          {t('search.download_missing')}
                        </button>
                      </>
                    )}
                    {selectedAnime.id.startsWith('al-') && (
                      <div className="px-3 py-1.5 bg-blue-600/20 text-blue-400 text-[10px] font-bold rounded-lg border border-blue-500/30 uppercase tracking-widest">
                        {t('search.metadata_provider_only')}
                      </div>
                    )}
                    <button
                      onClick={() => rescanSeries(selectedAnime)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      <Play className="w-4 h-4 rotate-90" />
                      {t('search.rescan_library')}
                    </button>
                  </div>
                  <div className="flex flex-col gap-2 mb-4 bg-black/20 p-3 rounded-lg border border-white/5">
                    {existingPath ? (
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        <span className="text-xs text-gray-300">{t('search.in_library_path')} <span className="text-white font-mono">{existingPath}</span></span>
                      </div>
                    ) : storageData.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest flex items-center gap-1.5 ml-1">
                          <Database size={10} /> {t('search.download_volume')}
                        </label>
                        <select
                          value={selectedVolume}
                          onChange={(e) => setSelectedVolume(e.target.value)}
                          className="bg-black/40 border border-white/10 text-white text-xs font-bold rounded-xl px-3 py-2 outline-none focus:border-primary/50 transition-all cursor-pointer appearance-none"
                        >
                          {storageData.map(drive => (
                            <option key={drive.path} value={drive.path} className="bg-gray-900">
                              {drive.path.split(/[\\/]/).pop() || drive.path} ({drive.free} free)
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </div>
                  <p className="text-gray-300 line-clamp-2 text-sm max-w-xl">{selectedAnime.description}</p>
                </div>
                <button
                  onClick={() => setSelectedAnime(null)}
                  className="absolute top-6 right-6 p-2 bg-black/50 hover:bg-orange-600 rounded-full transition-colors"
                >
                  <Plus className="w-6 h-6 text-white rotate-45" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              {loadingDetails ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                </div>
              ) : (
                <div className="space-y-8">
                  {details && (
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2"> {t('search.seasons')}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {details.seasons.map((s) => (
                          <div
                            key={s.id}
                            className="bg-gray-800/50 p-4 rounded-xl border border-white/5 hover:border-orange-500/30 transition-all flex items-center justify-between cursor-pointer group"
                            onClick={() => fetchEpisodes(s.id)}
                          >
                            <div>
                              <p className="text-white font-medium">{s.title}</p>
                              <p className="text-xs text-gray-400">{s.episode_count} {t('search.episodes_count')}</p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startDownload(selectedAnime!, `1-${s.episode_count}`, s.id, s.season_number);
                                }}
                                className="p-2 bg-gray-700 hover:bg-orange-600 rounded-lg transition-colors group-hover:scale-110"
                              >
                                <Download className="w-4 h-4 text-white" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {episodes.length > 0 && (
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-4">Episodes</h3>
                      <div className="space-y-3">
                        {episodes.map((ep) => {
                          const epStatus = episodeStatus[ep.id] || episodeStatus[`number-${ep.episode_number}`];
                          const isDownloaded = epStatus?.is_downloaded || false;
                          return (
                            <div key={ep.id} className={`flex items-center gap-4 p-3 rounded-xl border transition-all ${isDownloaded ? 'bg-green-600/10 border-green-500/30' : (archiveStatus[ep.id] ? 'bg-blue-600/10 border-blue-500/30' : 'bg-gray-800/30 border-white/5')}`}>
                              <div className="relative">
                                <img src={ep.image} className="w-32 aspect-video object-cover rounded-lg shadow-md" alt={ep.title} />
                                {isDownloaded && (
                                  <div className="absolute top-1 right-1 bg-green-500 text-white p-1 rounded-full shadow-lg">
                                    <Check className="w-3 h-3" />
                                  </div>
                                )}
                                {!isDownloaded && archiveStatus[ep.id] && (
                                  <div className="absolute top-1 right-1 bg-blue-500 text-white p-1 rounded-full shadow-lg">
                                    <Check className="w-3 h-3" />
                                  </div>
                                )}
                              </div>
                              <div className="flex_1">
                                <div className="flex items-center gap-2">
                                  <p className="text-white font-medium text-sm">{ep.episode_number}. {ep.title}</p>
                                  {isDownloaded && <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">{t('search.on_disk')}</span>}
                                  {!isDownloaded && archiveStatus[ep.id] && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">{t('search.archived')}</span>}
                                </div>
                                <p className="text-xs text-gray-400">{Math.floor(ep.duration_ms / 60000)} min</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => toggleArchive(ep)}
                                  title={archiveStatus[ep.id] ? t('search.remove_from_archive') : t('search.mark_as_owned')}
                                  className={`p-2 rounded-lg transition-colors ${archiveStatus[ep.id] ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                {!selectedAnime.id.startsWith('al-') && (
                                  <button
                                    onClick={() => startDownload(selectedAnime!, `${ep.episode_number}`, ep.season_id, details?.seasons.find(s => s.id === ep.season_id)?.season_number)}
                                    className={`p-2 rounded-lg transition-colors ${isDownloaded ? 'bg-gray-700 text-gray-500' : 'bg-orange-600 hover:bg-orange-700 text-white'}`}
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                )}
                                {isDownloaded && (
                                  <button
                                    onClick={() => deleteEpisode(selectedAnime!, ep)}
                                    title={t('search.delete_physical')}
                                    className="p-2 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white rounded-lg transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Search;
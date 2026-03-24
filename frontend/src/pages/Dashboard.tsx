import React, { useState, useEffect } from 'react';
import { Star, Clock, CheckCircle2, AlertCircle, Layout, ArrowRight, Play, Trophy, User as UserIcon, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

const Dashboard = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const res = await fetch('/api/user/dashboard', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (res.ok) {
                    setData(await res.json());
                }
            } catch (err) {
                console.error('Dashboard fetch error:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchDashboard();
    }, []);

    if (isLoading) return (
        <div className="h-[60vh] flex flex-col items-center justify-center text-primary">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
            <p className="text-xs font-black uppercase tracking-widest animate-pulse">{t('dashboard.initializing')}</p>
        </div>
    );

    const stats = data?.stats || { total: 0, approved: 0, pending: 0 };

    return (
        <div className="max-w-6xl mx-auto pb-24 font-sans animate-in fade-in duration-1000">
            {/* Header / Welcome */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12">
                <div className="flex items-center gap-6">
                    {user?.avatar_url ? (
                        <div className="w-20 h-20 rounded-3xl overflow-hidden border-2 border-primary/20 shadow-xl">
                            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="w-20 h-20 rounded-3xl bg-secondary/60 flex items-center justify-center text-primary border-2 border-white/5 shadow-xl">
                            <UserIcon size={32} />
                        </div>
                    )}
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tight mb-2">
                            {t('dashboard.welcome')}, <span className="text-primary">{user?.full_name || user?.username}</span>!
                        </h1>
                        <p className="text-gray-500 font-medium italic">{user?.bio || t('dashboard.default_bio')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4 bg-secondary/40 backdrop-blur-md p-4 rounded-3xl border border-white/5">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-lg shadow-primary/10">
                        <Trophy size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-black text-gray-500 uppercase tracking-widest">{t('dashboard.community_score')}</p>
                        <p className="text-xl font-black text-white">{stats.approved * 10} XP</p>
                    </div>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                {/* User Stats Card */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-secondary/40 backdrop-blur-md rounded-[2.5rem] border border-white/5 p-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/10 transition-all duration-500" />
                        
                        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                            <Star size={16} className="text-primary" />
                            {t('dashboard.my_contribution')}
                        </h3>

                        <div className="space-y-8">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-sm font-bold text-white">{t('dashboard.suggested_series')}</p>
                                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">{t('dashboard.total_requests')}</p>
                                </div>
                                <span className="text-3xl font-black text-white">{stats.total}</span>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-sm font-bold text-green-400">{t('dashboard.approved_added')}</p>
                                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">{t('dashboard.in_library')}</p>
                                </div>
                                <span className="text-3xl font-black text-green-400">{stats.approved}</span>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-sm font-bold text-orange-400">{t('dashboard.processing')}</p>
                                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">{t('dashboard.pending')}</p>
                                </div>
                                <span className="text-3xl font-black text-orange-400">{stats.pending}</span>
                            </div>
                        </div>

                        <Link to="/seasonal" className="mt-10 flex items-center justify-between group/link bg-white/5 hover:bg-white/10 p-4 rounded-2xl transition-all border border-white/5">
                            <span className="text-xs font-black uppercase tracking-widest text-white">{t('dashboard.keep_suggesting')}</span>
                            <ArrowRight size={16} className="text-primary group-hover/link:translate-x-1 transition-transform" />
                        </Link>
                    </div>

                    {/* Quick Shortcuts */}
                    <div className="grid grid-cols-2 gap-4">
                        <Link to="/seasonal" className="bg-secondary/20 hover:bg-secondary/40 p-6 rounded-3xl border border-white/5 transition-all text-center group">
                            <Layout size={24} className="mx-auto mb-3 text-primary group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover:text-white">{t('dashboard.catalog')}</span>
                        </Link>
                        <Link to="/search" className="bg-secondary/20 hover:bg-secondary/40 p-6 rounded-3xl border border-white/5 transition-all text-center group">
                            <Play size={24} className="mx-auto mb-3 text-primary group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover:text-white">{t('dashboard.search')}</span>
                        </Link>
                    </div>
                </div>

                {/* Center Content: New Arrivals & Episodes */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Series Arrivals */}
                    <div className="bg-secondary/40 backdrop-blur-md rounded-[2.5rem] border border-white/5 p-8">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Clock size={16} className="text-primary" />
                                {t('dashboard.recent_arrivals')}
                            </h3>
                            <Link to="/all-series" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">{t('dashboard.view_all')}</Link>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                            {data?.newArrivals?.map((item: any) => (
                                <div key={item.id} className="group relative">
                                    <div className="aspect-[2/3] rounded-2xl overflow-hidden bg-black/40 border border-white/5 group-hover:border-primary/50 transition-all mb-3 shadow-xl">
                                        <img 
                                            src={`/api/library/series/${item.id}/poster`} 
                                            alt={item.title}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                                            <Link to={`/all-series`} className="w-full bg-primary text-secondary py-2 rounded-xl text-[10px] font-black uppercase text-center">
                                                {t('dashboard.go_to_series')}
                                            </Link>
                                        </div>
                                    </div>
                                    <h4 className="text-[11px] font-black text-white truncate px-1 group-hover:text-primary transition-colors">{item.title}</h4>
                                    <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest px-1">{item.year || '2026'}</p>
                                </div>
                            ))}
                            {(!data?.newArrivals || data.newArrivals.length === 0) && (
                                <div className="col-span-full py-12 text-center text-gray-500 opacity-50 italic">
                                    {t('dashboard.no_new_series')}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Granular Episode Arrivals */}
                    <div className="bg-secondary/40 backdrop-blur-md rounded-[2.5rem] border border-white/5 p-8">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Activity size={16} className="text-primary" />
                                {t('dashboard.latest_downloads')}
                            </h3>
                            <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{t('dashboard.realtime_feed')}</span>
                        </div>

                        <div className="space-y-4">
                            {data?.recentEpisodes?.map((ep: any) => (
                                <div key={ep.id} className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5 hover:border-white/10 transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10 shadow-lg">
                                            <img src={`/api/library/series/${ep.series_id}/poster`} alt="" className="w-full h-full object-cover" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-bold text-white group-hover:text-primary transition-colors truncate max-w-[150px] sm:max-w-xs">{ep.series_title}</h4>
                                                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-lg font-black uppercase tracking-tighter">{t('dashboard.ep') || 'EP'} {ep.episode_number}</span>
                                            </div>
                                            <p className="text-[10px] text-gray-500 font-medium truncate max-w-[200px]">{ep.title || t('dashboard.official_release')}</p>
                                        </div>
                                    </div>
                                    <div className="text-right hidden sm:block">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{new Date(ep.downloaded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        <p className="text-[8px] text-gray-600 font-bold uppercase">{new Date(ep.downloaded_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            ))}
                            {(!data?.recentEpisodes || data.recentEpisodes.length === 0) && (
                                <div className="py-12 text-center text-gray-500 opacity-50 italic">
                                    {t('dashboard.no_episodes')}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Row: History */}
            <div className="bg-secondary/40 backdrop-blur-md rounded-[2.5rem] border border-white/5 p-8">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                    <Activity size={16} className="text-primary" />
                    {t('dashboard.my_activity')}
                </h3>

                <div className="space-y-4">
                    {data?.recentSuggestions?.map((sug: any) => (
                        <div key={sug.id} className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5 hover:border-white/10 transition-all group">
                             <div className="flex items-center gap-4">
                                <div className="w-10 h-14 rounded-lg overflow-hidden border border-white/10">
                                    <img src={`/api/library/series/${sug.series_id || sug.id}/poster`} alt="" className="w-full h-full object-cover" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-white group-hover:text-primary transition-colors">{sug.title}</h4>
                                    <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">{new Date(sug.created_at).toLocaleDateString()}</p>
                                </div>
                             </div>
                             <div className="flex items-center gap-3">
                                {sug.status === 'approved' ? <span className="flex items-center gap-1"><CheckCircle2 size={10} /> {t('dashboard.approved')}</span> :
                                 sug.status === 'rejected' ? <span className="flex items-center gap-1"><AlertCircle size={10} /> {t('dashboard.rejected')}</span> :
                                 <span className="flex items-center gap-1 font-black">{t('dashboard.pending').toUpperCase()}</span>}
                             </div>
                        </div>
                    ))}
                    {(!data?.recentSuggestions || data.recentSuggestions.length === 0) && (
                        <div className="py-8 text-center text-gray-500 opacity-50 italic">
                            {t('dashboard.no_suggestions_yet')}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;

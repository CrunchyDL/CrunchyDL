import React, { useState } from 'react';
import axios from 'axios';
import { Database, User, Shield, Check, Server, Save, ArrowRight, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Setup = () => {
    const { t } = useTranslation();
    const [step, setStep] = useState(1);
    const [dbType, setDbType] = useState<'sqlite' | 'mysql'>('sqlite');
    const [config, setConfig] = useState({
        sqlitePath: './data/database.sqlite',
        mysql: {
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'crunchyroll_downloader',
            port: 3306
        },
        admin: {
            username: '',
            password: '',
            confirmPassword: ''
        },
        tmdbApiKey: '',
        tvdbApiKey: '',
        crEmail: '',
        crPassword: '',
        metadataLanguage: 'es-ES'
    });
    const [isInstalling, setIsInstalling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleInstall = async () => {
        if (config.admin.password !== config.admin.confirmPassword) {
            setError(t('setup.error_passwords'));
            setStep(2);
            return;
        }
        if (config.admin.password.length < 4) {
            setError(t('setup.error_password_length'));
            setStep(2);
            return;
        }

        setIsInstalling(true);
        setError(null);

        try {
            const payload = {
                dbType,
                sqlitePath: dbType === 'sqlite' ? config.sqlitePath : null,
                mysql: dbType === 'mysql' ? config.mysql : null,
                admin: {
                    username: config.admin.username,
                    password: config.admin.password
                },
                tmdbApiKey: config.tmdbApiKey || null,
                tvdbApiKey: config.tvdbApiKey || null,
                crEmail: config.crEmail || null,
                crPassword: config.crPassword || null,
                metadataLanguage: config.metadataLanguage
            };
            const response = await axios.post('/api/setup/install', payload);
            if (response.data.token) {
                localStorage.setItem('token', response.data.token);
            }
            window.location.reload(); // Reload to trigger AuthContext re-check
        } catch (err: any) {
            setError(err.response?.data?.error || t('setup.error_install'));
            setIsInstalling(false);
        }
    };

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-white mb-2">{t('setup.welcome')}</h2>
                            <p className="text-muted-foreground">{t('setup.welcome_desc')}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setDbType('sqlite')}
                                className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 ${dbType === 'sqlite' ? 'border-primary bg-primary/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}
                            >
                                <Database className={`w-10 h-10 ${dbType === 'sqlite' ? 'text-primary' : 'text-muted-foreground'}`} />
                                <div className="text-center">
                                    <div className="font-bold text-white">{t('setup.sqlite')}</div>
                                    <div className="text-xs text-muted-foreground mt-1">{t('setup.sqlite_desc')}</div>
                                </div>
                            </button>
                            <button
                                onClick={() => setDbType('mysql')}
                                className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 ${dbType === 'mysql' ? 'border-primary bg-primary/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}
                            >
                                <Server className={`w-10 h-10 ${dbType === 'mysql' ? 'text-primary' : 'text-muted-foreground'}`} />
                                <div className="text-center">
                                    <div className="font-bold text-white">{t('setup.mysql')}</div>
                                    <div className="text-xs text-muted-foreground mt-1">{t('setup.mysql_desc')}</div>
                                </div>
                            </button>
                        </div>
                        {dbType === 'sqlite' ? (
                            <div className="bg-white/5 p-4 rounded-xl space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('setup.db_path')}</label>
                                <input
                                    type="text"
                                    value={config.sqlitePath}
                                    onChange={(e) => setConfig({ ...config, sqlitePath: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-all"
                                />
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4 bg-white/5 p-4 rounded-xl">
                                <div className="col-span-2 space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('setup.host')}</label>
                                    <input
                                        type="text"
                                        value={config.mysql.host}
                                        onChange={(e) => setConfig({ ...config, mysql: { ...config.mysql, host: e.target.value } })}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('setup.user')}</label>
                                    <input
                                        type="text"
                                        value={config.mysql.user}
                                        onChange={(e) => setConfig({ ...config, mysql: { ...config.mysql, user: e.target.value } })}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('settings.password')}</label>
                                    <input
                                        type="password"
                                        value={config.mysql.password}
                                        onChange={(e) => setConfig({ ...config, mysql: { ...config.mysql, password: e.target.value } })}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('setup.db_name')}</label>
                                    <input
                                        type="text"
                                        value={config.mysql.database}
                                        onChange={(e) => setConfig({ ...config, mysql: { ...config.mysql, database: e.target.value } })}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('setup.port')}</label>
                                    <input
                                        type="number"
                                        value={config.mysql.port}
                                        onChange={(e) => setConfig({ ...config, mysql: { ...config.mysql, port: parseInt(e.target.value) } })}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-all"
                                    />
                                </div>
                            </div>
                        )}
                        <button
                            onClick={() => setStep(2)}
                            className="w-full bg-primary hover:bg-primary-hover text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 transition-all group"
                        >
                            {t('setup.continue')} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                );
            case 2:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-white mb-2">{t('setup.account_setup')}</h2>
                            <p className="text-muted-foreground">{t('setup.account_desc')}</p>
                        </div>
                        <div className="space-y-4">
                            <div className="bg-white/5 p-4 rounded-xl space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('settings.username_email')}</label>
                                <div className="flex items-center bg-black/40 border border-white/10 rounded-lg px-3 focus-within:border-primary transition-all">
                                    <User className="w-5 h-5 text-muted-foreground mr-3" />
                                    <input
                                        type="text"
                                        value={config.admin.username}
                                        onChange={(e) => setConfig({ ...config, admin: { ...config.admin, username: e.target.value } })}
                                        className="w-full bg-transparent p-3 text-white focus:outline-none"
                                        placeholder="admin"
                                    />
                                </div>
                            </div>
                            <div className="bg-white/5 p-4 rounded-xl space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('settings.password')}</label>
                                <div className="flex items-center bg-black/40 border border-white/10 rounded-lg px-3 focus-within:border-primary transition-all">
                                    <Shield className="w-5 h-5 text-muted-foreground mr-3" />
                                    <input
                                        type="password"
                                        value={config.admin.password}
                                        onChange={(e) => setConfig({ ...config, admin: { ...config.admin, password: e.target.value } })}
                                        className="w-full bg-transparent p-3 text-white focus:outline-none"
                                    />
                                </div>
                            </div>
                            <div className="bg-white/5 p-4 rounded-xl space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('setup.confirm_password')}</label>
                                <div className="flex items-center bg-black/40 border border-white/10 rounded-lg px-3 focus-within:border-primary transition-all">
                                    <Check className="w-5 h-5 text-muted-foreground mr-3" />
                                    <input
                                        type="password"
                                        value={config.admin.confirmPassword}
                                        onChange={(e) => setConfig({ ...config, admin: { ...config.admin, confirmPassword: e.target.value } })}
                                        className="w-full bg-transparent p-3 text-white focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                        {error && <div className="bg-red-500/20 border border-red-500/50 text-red-500 p-4 rounded-xl text-sm text-center">{error}</div>}
                        <div className="flex gap-4">
                            <button
                                onClick={() => setStep(1)}
                                className="flex-1 border border-white/10 hover:bg-white/5 text-white font-bold h-12 rounded-xl transition-all"
                            >
                                {t('common.back')}
                            </button>
                            <button
                                onClick={() => setStep(3)}
                                className="flex-[2] bg-primary hover:bg-primary-hover text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 transition-all group"
                            >
                                {t('setup.continue')} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-white mb-2">{t('sidebar.library')}</h2>
                            <p className="text-muted-foreground">{t('setup.metadata_desc')}</p>
                        </div>
                        <div className="space-y-4">
                            <div className="bg-white/5 p-4 rounded-xl space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">TMDB API Key</label>
                                <input
                                    type="text"
                                    value={config.tmdbApiKey}
                                    onChange={(e) => setConfig({ ...config, tmdbApiKey: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-all"
                                    placeholder="your-tmdb-key"
                                />
                                <p className="text-[10px] text-muted-foreground px-1">
                                    <span className="text-primary font-bold">{t('setup.sqlite')}?</span> {t('setup.tmdb_recommended')}
                                </p>
                            </div>
                            <div className="bg-white/5 p-4 rounded-xl space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">TVDB API Key</label>
                                <input
                                    type="text"
                                    value={config.tvdbApiKey}
                                    onChange={(e) => setConfig({ ...config, tvdbApiKey: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-all"
                                    placeholder="your-tvdb-key"
                                />
                                <p className="text-[10px] text-muted-foreground px-1">{t('setup.tvdb_desc')}</p>
                            </div>
                            <div className="bg-white/5 p-4 rounded-xl space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('setup.meta_lang')}</label>
                                <select
                                    value={config.metadataLanguage}
                                    onChange={(e) => setConfig({ ...config, metadataLanguage: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-all cursor-pointer"
                                >
                                    <option value="es-ES">Español (España)</option>
                                    <option value="es-MX">Español (México)</option>
                                    <option value="en-US">English (United States)</option>
                                    <option value="en-GB">English (United Kingdom)</option>
                                    <option value="fr-FR">Français (France)</option>
                                    <option value="de-DE">Deutsch (Deutschland)</option>
                                    <option value="it-IT">Italiano (Italia)</option>
                                    <option value="pt-BR">Português (Brasil)</option>
                                </select>
                                <p className="text-[10px] text-muted-foreground px-1">{t('setup.meta_lang_desc')}</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setStep(2)}
                                className="flex-1 border border-white/10 hover:bg-white/5 text-white font-bold h-12 rounded-xl transition-all"
                            >
                                {t('common.back')}
                            </button>
                            <button
                                onClick={() => setStep(4)}
                                className="flex-[2] bg-primary hover:bg-primary-hover text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 transition-all group"
                            >
                                {t('setup.continue')} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                );
            case 4:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-white mb-2">{t('settings.account_title')}</h2>
                            <p className="text-muted-foreground">{t('setup.account_desc')}</p>
                        </div>
                        <div className="space-y-4">
                            <div className="bg-white/5 p-4 rounded-xl space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('settings.username_email')}</label>
                                <input
                                    type="text"
                                    value={config.crEmail}
                                    onChange={(e) => setConfig({ ...config, crEmail: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-all"
                                    placeholder="email@example.com"
                                />
                            </div>
                            <div className="bg-white/5 p-4 rounded-xl space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('settings.password')}</label>
                                <input
                                    type="password"
                                    value={config.crPassword}
                                    onChange={(e) => setConfig({ ...config, crPassword: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-all"
                                />
                            </div>
                        </div>
                        {error && <div className="bg-red-500/20 border border-red-500/50 text-red-500 p-4 rounded-xl text-sm text-center">{error}</div>}
                        <div className="flex gap-4">
                            <button
                                onClick={() => setStep(3)}
                                className="flex-1 border border-white/10 hover:bg-white/5 text-white font-bold h-12 rounded-xl transition-all"
                            >
                                {t('common.back')}
                            </button>
                             <button
                                onClick={handleInstall}
                                disabled={isInstalling}
                                className="flex-[2] bg-primary hover:bg-primary-hover text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                            >
                                {isInstalling ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" /> {t('common.loading')}...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" /> {t('setup.finish')}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen w-screen flex items-center justify-center bg-background p-4 overflow-hidden relative">
            {/* Ambient Background Blur */}
            <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />
            <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-700" />
            
            <div className="w-full max-w-lg bg-white/5 border border-white/10 backdrop-blur-2xl rounded-[32px] overflow-hidden shadow-2xl relative">
                {/* Header Gradient */}
                <div className="h-2 w-full bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
                
                <div className="p-8 sm:p-12">
                    <div className="flex flex-col items-center gap-6 mb-8">
                        <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary-hover rounded-[24px] rotate-12 flex items-center justify-center shadow-lg transform hover:rotate-0 transition-all duration-500">
                            <Database className="w-10 h-10 text-white -rotate-12 group-hover:rotate-0 transition-all" />
                        </div>
                        <div className="text-center">
                            <h1 className="text-3xl font-black text-white uppercase tracking-tighter">{t('setup.system_setup')}</h1>
                            <div className="flex items-center justify-center gap-2 mt-2">
                                <div className={`h-1.5 w-8 rounded-full transition-all ${step === 1 ? 'bg-primary' : 'bg-white/20'}`} />
                                <div className={`h-1.5 w-8 rounded-full transition-all ${step === 2 ? 'bg-primary' : 'bg-white/20'}`} />
                                <div className={`h-1.5 w-8 rounded-full transition-all ${step === 3 ? 'bg-primary' : 'bg-white/20'}`} />
                                <div className={`h-1.5 w-8 rounded-full transition-all ${step === 4 ? 'bg-primary' : 'bg-white/20'}`} />
                            </div>
                        </div>
                    </div>

                    {renderStep()}
                    
                    <div className="mt-12 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground opacity-30">
                            Powered by CrunchyDL
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Setup;

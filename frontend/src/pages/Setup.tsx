import React, { useState } from 'react';
import axios from 'axios';
import { Database, User, Shield, Check, Server, Save, ArrowRight, Loader2 } from 'lucide-react';

const Setup = () => {
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
            setError('Passwords do not match');
            setStep(2);
            return;
        }
        if (config.admin.password.length < 4) {
            setError('Password must be at least 4 characters');
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
            setError(err.response?.data?.error || 'Installation failed');
            setIsInstalling(false);
        }
    };

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-white mb-2">Welcome!</h2>
                            <p className="text-muted-foreground">Select your preferred database engine to get started.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setDbType('sqlite')}
                                className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 ${dbType === 'sqlite' ? 'border-primary bg-primary/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}
                            >
                                <Database className={`w-10 h-10 ${dbType === 'sqlite' ? 'text-primary' : 'text-muted-foreground'}`} />
                                <div className="text-center">
                                    <div className="font-bold text-white">SQLite</div>
                                    <div className="text-xs text-muted-foreground mt-1">Simple, file-based</div>
                                </div>
                            </button>
                            <button
                                onClick={() => setDbType('mysql')}
                                className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 ${dbType === 'mysql' ? 'border-primary bg-primary/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}
                            >
                                <Server className={`w-10 h-10 ${dbType === 'mysql' ? 'text-primary' : 'text-muted-foreground'}`} />
                                <div className="text-center">
                                    <div className="font-bold text-white">MySQL</div>
                                    <div className="text-xs text-muted-foreground mt-1">Robust, scalable</div>
                                </div>
                            </button>
                        </div>
                        {dbType === 'sqlite' ? (
                            <div className="bg-white/5 p-4 rounded-xl space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Database Path</label>
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
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Host</label>
                                    <input
                                        type="text"
                                        value={config.mysql.host}
                                        onChange={(e) => setConfig({ ...config, mysql: { ...config.mysql, host: e.target.value } })}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">User</label>
                                    <input
                                        type="text"
                                        value={config.mysql.user}
                                        onChange={(e) => setConfig({ ...config, mysql: { ...config.mysql, user: e.target.value } })}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Password</label>
                                    <input
                                        type="password"
                                        value={config.mysql.password}
                                        onChange={(e) => setConfig({ ...config, mysql: { ...config.mysql, password: e.target.value } })}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Database</label>
                                    <input
                                        type="text"
                                        value={config.mysql.database}
                                        onChange={(e) => setConfig({ ...config, mysql: { ...config.mysql, database: e.target.value } })}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Port</label>
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
                            Next <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                );
            case 2:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-white mb-2">Account Setup</h2>
                            <p className="text-muted-foreground">Create the initial administrator account.</p>
                        </div>
                        <div className="space-y-4">
                            <div className="bg-white/5 p-4 rounded-xl space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Username</label>
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
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Password</label>
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
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Confirm Password</label>
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
                                Back
                            </button>
                            <button
                                onClick={() => setStep(3)}
                                className="flex-[2] bg-primary hover:bg-primary-hover text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 transition-all group"
                            >
                                Next <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-white mb-2">Metadata Providers</h2>
                            <p className="text-muted-foreground">Optional: Configure API keys for better metadata (TMDB/TVDB).</p>
                        </div>
                        <div className="space-y-4">
                            <div className="bg-white/5 p-4 rounded-xl space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">TMDB API Key (Highly Recommended)</label>
                                <input
                                    type="text"
                                    value={config.tmdbApiKey}
                                    onChange={(e) => setConfig({ ...config, tmdbApiKey: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-all"
                                    placeholder="your-tmdb-key"
                                />
                                <p className="text-[10px] text-muted-foreground px-1">
                                    <span className="text-primary font-bold">Recommended:</span> It's free and used as a base for posters and info in multiple languages.
                                </p>
                            </div>
                            <div className="bg-white/5 p-4 rounded-xl space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">TVDB API Key (Optional)</label>
                                <input
                                    type="text"
                                    value={config.tvdbApiKey}
                                    onChange={(e) => setConfig({ ...config, tvdbApiKey: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-all"
                                    placeholder="your-tvdb-key"
                                />
                                <p className="text-[10px] text-muted-foreground px-1">Completely optional. Improves episode numbering and seasons.</p>
                            </div>
                            <div className="bg-white/5 p-4 rounded-xl space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Metadata Language / Region</label>
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
                                <p className="text-[10px] text-muted-foreground px-1">This will affect titles, descriptions and posters across all providers.</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setStep(2)}
                                className="flex-1 border border-white/10 hover:bg-white/5 text-white font-bold h-12 rounded-xl transition-all"
                            >
                                Back
                            </button>
                            <button
                                onClick={() => setStep(4)}
                                className="flex-[2] bg-primary hover:bg-primary-hover text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 transition-all group"
                            >
                                Next <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                );
            case 4:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-white mb-2">Crunchyroll Account</h2>
                            <p className="text-muted-foreground">Optional: Connect your account to enable downloads.</p>
                        </div>
                        <div className="space-y-4">
                            <div className="bg-white/5 p-4 rounded-xl space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email / Username</label>
                                <input
                                    type="text"
                                    value={config.crEmail}
                                    onChange={(e) => setConfig({ ...config, crEmail: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-all"
                                    placeholder="email@example.com"
                                />
                            </div>
                            <div className="bg-white/5 p-4 rounded-xl space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Password</label>
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
                                Back
                            </button>
                            <button
                                onClick={handleInstall}
                                disabled={isInstalling}
                                className="flex-[2] bg-primary hover:bg-primary-hover text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                            >
                                {isInstalling ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" /> Installing...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" /> Finish Installation
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
                            <h1 className="text-3xl font-black text-white uppercase tracking-tighter">CrunchyDL System Setup</h1>
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

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, User, LogIn, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Login: React.FC = () => {
    const { t } = useTranslation();
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            await login(username, password);
        } catch (err: any) {
            setError(err.response?.data?.error || t('login.invalid_credentials'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] relative overflow-hidden font-sans">
            {/* Background elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />

            <div className="w-full max-w-md p-8 z-10">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 mb-6 shadow-lg shadow-primary/20">
                        <Lock className="text-secondary" size={32} />
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-tight mb-2 uppercase">Crunchy<span className="text-primary">DL</span></h1>
                    <p className="text-gray-500 font-medium">{t('login.title')}</p>
                </div>

                <div className="bg-secondary/40 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl flex items-center gap-3 text-sm animate-shake">
                                <AlertCircle size={18} />
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">{t('login.username')}</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-primary transition-colors">
                                    <User size={20} />
                                </div>
                                <input 
                                    type="text" 
                                    className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-primary/50 focus:bg-black/60 transition-all placeholder:text-gray-700"
                                    placeholder={t('login.username_placeholder')}
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">{t('login.password')}</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-primary transition-colors">
                                    <Lock size={20} />
                                </div>
                                <input 
                                    type="password" 
                                    className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-primary/50 focus:bg-black/60 transition-all placeholder:text-gray-700"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full bg-primary hover:bg-primary/90 text-secondary font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-primary/20 uppercase tracking-wider"
                        >
                            {isLoading ? (
                                <div className="w-6 h-6 border-2 border-secondary/20 border-t-secondary rounded-full animate-spin" />
                            ) : (
                                <>
                                    <LogIn size={20} />
                                    {t('login.access_system')}
                                </>
                            )}
                        </button>
                    </form>
                </div>
                
                <p className="text-center mt-8 text-sm text-gray-600">
                    {t('login.restricted_area')} • v2.0
                </p>
            </div>
        </div>
    );
};

export default Login;

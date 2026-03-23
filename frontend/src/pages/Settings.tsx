import React, { useState, useEffect, useRef } from 'react';
import { User, Shield, Info, LogOut, FileVideo, Settings as SettingsIcon, Save, Check, ChevronDown, X, ChevronUp, Library, Database, Cpu, Monitor, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

import { useTranslation } from 'react-i18next';

// Simple cn helper since lib/utils doesn't exist
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

const LANGUAGES = [
  { locale: 'ja-JP', code: 'jpn', name: 'Japanese' },
  { locale: 'en-US', code: 'eng', name: 'English' },
  { locale: 'es-419', code: 'spa', name: 'Spanish (LatAm)' },
  { locale: 'es-ES', code: 'spa-ES', name: 'Spanish (Europe)' },
  { locale: 'pt-BR', code: 'por', name: 'Portuguese (Brazil)' },
  { locale: 'pt-PT', code: 'por-PT', name: 'Portuguese (Portugal)' },
  { locale: 'fr-FR', code: 'fra', name: 'French' },
  { locale: 'de-DE', code: 'deu', name: 'German' },
  { locale: 'it-IT', code: 'ita', name: 'Italian' },
  { locale: 'ru-RU', code: 'rus', name: 'Russian' },
  { locale: 'tr-TR', code: 'tur', name: 'Turkish' },
  { locale: 'hi-IN', code: 'hin', name: 'Hindi' },
  { locale: 'ko-KR', code: 'kor', name: 'Korean' },
  { locale: 'zh-CN', code: 'zho', name: 'Chinese (Mainland)' },
  { locale: 'ar-SA', code: 'ara', name: 'Arabic' },
];

const Dropdown = ({ 
  label, 
  value, 
  options, 
  multiple = false, 
  onChange,
  useCode = false 
}: { 
  label: string, 
  value: any, 
  options: any[], 
  multiple?: boolean, 
  onChange: (val: any) => void,
  useCode?: boolean
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (optionValue: string) => {
    if (multiple) {
      if (optionValue === 'all' || optionValue === 'none') {
        onChange([optionValue]);
      } else {
        const current = Array.isArray(value) ? value : [value];
        const newValues = current.includes(optionValue)
          ? current.filter(v => v !== optionValue)
          : [...current.filter(v => v !== 'all' && v !== 'none'), optionValue];
        onChange(newValues.length === 0 ? ['none'] : newValues);
      }
    } else {
      onChange(optionValue);
      setIsOpen(false);
    }
  };

  const getDisplayValue = () => {
    if (multiple) {
      if (!Array.isArray(value) || value.length === 0) return t('settings.none');
      if (value.includes('all')) return t('settings.all_languages');
      if (value.includes('none')) return t('settings.none');
      return `${value.length} ${t('settings.selected')}`;
    }
    const option = options.find(o => (useCode ? o.code : o.locale) === value);
    return option ? option.locale : (value || t('common.loading'));
  };

  return (
    <div className="space-y-2 relative" ref={dropdownRef}>
      <label className="text-xs font-bold text-gray-400 uppercase ml-1 flex items-center justify-between">
          {label}
          {multiple && <span className="text-[10px] text-gray-600 normal-case italic">{t('settings.multi_selection')}</span>}
      </label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
            "w-full bg-black/40 border rounded-xl px-4 py-3 text-sm flex items-center justify-between cursor-pointer transition-all",
            isOpen ? "border-primary/50 bg-black/60 shadow-lg" : "border-white/10 hover:border-white/20 hover:bg-black/50"
        )}
      >
        <span className={cn(
            "font-medium",
            getDisplayValue() === 'none' ? 'text-gray-500' : 'text-white'
        )}>
          {getDisplayValue()}
        </span>
        <ChevronDown size={16} className={cn("text-gray-500 transition-transform", isOpen && "rotate-180")} />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl py-2 max-h-64 overflow-y-auto no-scrollbar animate-in fade-in zoom-in-95 duration-200">
          {multiple && (
            <>
              <div 
                onClick={() => toggleOption('all')}
                className={cn(
                    "px-4 py-2.5 text-sm cursor-pointer hover:bg-white/5 transition-colors flex items-center gap-2",
                    value.includes('all') ? 'text-primary font-bold bg-primary/5' : 'text-gray-400'
                )}
              >
                {value.includes('all') && <Check size={14} className="text-primary" />}
                {t('settings.all_languages')}
              </div>
              <div 
                onClick={() => toggleOption('none')}
                className={cn(
                    "px-4 py-2.5 text-sm cursor-pointer hover:bg-white/5 transition-colors flex items-center gap-2",
                    value.includes('none') ? 'text-primary font-bold bg-primary/5' : 'text-gray-400'
                )}
              >
                {value.includes('none') && <Check size={14} className="text-primary" />}
                {t('settings.none')}
              </div>
              <div className="h-[1px] bg-white/5 my-1" />
            </>
          )}
          {!multiple && (
             <div 
                onClick={() => toggleOption('none')}
                className={cn(
                    "px-4 py-2.5 text-sm cursor-pointer hover:bg-white/5 transition-colors flex items-center gap-2",
                    value === 'none' ? 'text-primary font-bold bg-primary/5' : 'text-gray-400'
                )}
              >
                {value === 'none' && <Check size={14} className="text-primary" />}
                {t('settings.none')}
              </div>
          )}
          {LANGUAGES.map(lang => {
            const optionValue = useCode ? lang.code : lang.locale;
            const isSelected = multiple ? value.includes(optionValue) : value === optionValue;
            return (
              <div 
                key={lang.locale}
                onClick={() => toggleOption(optionValue)}
                className={cn(
                    "px-4 py-2.5 text-sm cursor-pointer hover:bg-white/5 transition-colors flex items-center gap-2",
                    isSelected ? 'bg-primary/5 text-primary font-bold' : 'text-gray-400'
                )}
              >
                <div className="flex-1 flex flex-col">
                    <span className="flex items-center gap-2">
                        {isSelected && <Check size={14} />}
                        {lang.locale}
                    </span>
                    <span className="text-[10px] text-gray-500 uppercase ml-5">{lang.name}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const AuthSection = ({ authStatus, showLogin, setShowLogin, credentials, setCredentials, handleLogin, loggingIn }: any) => {
  const { t } = useTranslation();
  return (
  <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
    <div className="bg-secondary/40 backdrop-blur-md rounded-3xl border border-white/5 overflow-hidden">
      <div 
        className={cn(
            "p-6 flex items-center justify-between cursor-pointer transition-all",
            showLogin ? "bg-white/5 border-b border-white/5" : "hover:bg-white/5"
        )} 
        onClick={() => setShowLogin(!showLogin)}
      >
        <div className="flex items-center gap-4">
          <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg",
              authStatus?.type === 'user' ? "bg-green-500/10 text-green-500" : "bg-primary/10 text-primary"
          )}>
            <User size={24} />
          </div>
          <div>
            <div className="text-lg font-bold text-white">{t('settings.account_title')}</div>
            <div className="text-sm text-gray-400">
              {authStatus?.type === 'user' ? t('settings.logged_in_as', { username: authStatus.username }) : t('settings.anonymous_guest')}
            </div>
          </div>
        </div>
        <div className="px-4 py-2 bg-white/5 text-primary text-xs font-black uppercase tracking-wider rounded-xl border border-white/5">
            {showLogin ? t('common.cancel') : t('settings.modify_access')}
        </div>
      </div>
      
      {showLogin && (
        <div className="p-8 space-y-8 bg-black/40">
          <form onSubmit={handleLogin} className="space-y-6">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest px-1 border-l-2 border-primary ml-1">{t('settings.login_credentials')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">{t('settings.username_email')}</label>
                <input 
                  type="text" 
                  value={credentials.username}
                  onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-all"
                  placeholder="name@email.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">{t('settings.password')}</label>
                <input 
                  type="password" 
                  value={credentials.password}
                  onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <button 
              type="submit"
              disabled={loggingIn || (!credentials.username && !credentials.token)}
              className="w-full py-4 bg-primary text-secondary font-black rounded-2xl hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest shadow-lg shadow-primary/20"
            >
              {loggingIn && !credentials.token ? (
                  <div className="w-5 h-5 border-2 border-secondary/20 border-t-secondary rounded-full animate-spin" />
              ) : t('settings.auth_credentials')}
            </button>
          </form>

          <div className="relative py-2 flex items-center">
            <div className="flex-grow border-t border-white/5"></div>
            <span className="flex-shrink mx-6 text-[10px] text-gray-600 font-black uppercase tracking-[0.2em]">{t('settings.safer_method')}</span>
            <div className="flex-grow border-t border-white/5"></div>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest px-1 border-l-2 border-primary ml-1">{t('settings.login_token')}</h3>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 flex justify-between">
                <span>{t('settings.refresh_token')}</span>
                <a href="https://github.com/Crunchy-DL/Crunchy-Downloader/wiki/How-to-get-your-token" target="_blank" rel="noreferrer" className="text-primary hover:underline lowercase tracking-normal font-medium">{t('settings.how_to_find')}</a>
              </label>
              <input 
                type="text" 
                value={credentials.token}
                onChange={(e) => setCredentials({...credentials, token: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-xs text-white font-mono focus:outline-none focus:border-primary transition-all placeholder:text-gray-700"
                placeholder="Paste your etp-rt cookie string here..."
              />
            </div>
            <button 
              type="submit"
              disabled={loggingIn || !credentials.token}
              className="w-full py-4 bg-white/5 text-white border border-white/10 font-black rounded-2xl hover:bg-white/10 active:scale-[0.99] transition-all flex items-center justify-center gap-2 uppercase tracking-widest shadow-xl"
            >
              {loggingIn && credentials.token ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : t('settings.auth_token')}
            </button>
          </form>
        </div>
      )}
    </div>
  </div>
);
};

const MuxingSection = ({ config, updateConfig }: any) => {
  const { t } = useTranslation();
  return (
  <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500">
    <div className="bg-secondary/40 backdrop-blur-md rounded-3xl border border-white/5 p-8 space-y-8">
      <div className="flex items-center justify-between p-6 bg-primary/10 rounded-2xl border border-primary/20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary text-secondary flex items-center justify-center shadow-lg shadow-primary/20">
            <FileVideo size={24} />
          </div>
          <div>
            <div className="text-lg font-bold text-white">{t('settings.video_encoding')}</div>
            <div className="text-sm text-gray-400">{t('settings.encoding_desc')}</div>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            className="sr-only peer"
            checked={config.videoEncodingEnabled ?? true}
            onChange={(e) => updateConfig('videoEncodingEnabled', e.target.checked)}
          />
          <div className="w-14 h-7 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:start-[4px] after:bg-white after:border-white after:border after:rounded-full after:h-[20px] after:w-[20px] after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>

      { (config.videoEncodingEnabled ?? true) && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Dropdown 
              label={t('settings.primary_audio_track')}
              value={config.defaultAudio || 'jpn'}
              options={LANGUAGES}
              useCode={true}
              onChange={(val) => updateConfig('defaultAudio', val)}
            />
            <Dropdown 
              label={t('settings.additional_audios')}
              value={config.dubLang || ['jpn']}
              options={LANGUAGES}
              multiple={true}
              useCode={true}
              onChange={(val) => updateConfig('dubLang', val)}
            />
          </div>

          <div className="space-y-6 pt-6 border-t border-white/5">
            <div className="flex items-center gap-3">
                <Shield size={18} className="text-primary" />
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">{t('settings.priority_title')}</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <Dropdown 
                label={t('settings.primary_audio')}
                value={config.audioPriority?.[0] || 'jpn'}
                options={LANGUAGES}
                useCode={true}
                onChange={(val) => {
                  const newPrio = [...(config.audioPriority || ['jpn', 'eng', 'spa-ES'])];
                  newPrio[0] = val;
                  updateConfig('audioPriority', newPrio);
                }}
              />
              <Dropdown 
                label={t('settings.secondary_audio')}
                value={config.audioPriority?.[1] || 'eng'}
                options={LANGUAGES}
                useCode={true}
                onChange={(val) => {
                  const newPrio = [...(config.audioPriority || ['jpn', 'eng', 'spa-ES'])];
                  newPrio[1] = val;
                  updateConfig('audioPriority', newPrio);
                }}
              />
              <Dropdown 
                label={t('settings.tertiary_audio')}
                value={config.audioPriority?.[2] || 'spa-ES'}
                options={LANGUAGES}
                useCode={true}
                onChange={(val) => {
                  const newPrio = [...(config.audioPriority || ['jpn', 'eng', 'spa-ES'])];
                  newPrio[2] = val;
                  updateConfig('audioPriority', newPrio);
                }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4">
              <Dropdown 
                label={t('settings.primary_sub')}
                value={config.subtitlePriority?.[0] || 'en-US'}
                options={LANGUAGES}
                onChange={(val) => {
                  const newPrio = [...(config.subtitlePriority || ['en-US', 'es-419', 'es-ES'])];
                  newPrio[0] = val;
                  updateConfig('subtitlePriority', newPrio);
                }}
              />
              <Dropdown 
                label={t('settings.secondary_sub')}
                value={config.subtitlePriority?.[1] || 'es-419'}
                options={LANGUAGES}
                onChange={(val) => {
                  const newPrio = [...(config.subtitlePriority || ['en-US', 'es-419', 'es-ES'])];
                  newPrio[1] = val;
                  updateConfig('subtitlePriority', newPrio);
                }}
              />
              <Dropdown 
                label={t('settings.tertiary_sub')}
                value={config.subtitlePriority?.[2] || 'es-ES'}
                options={LANGUAGES}
                onChange={(val) => {
                  const newPrio = [...(config.subtitlePriority || ['en-US', 'es-419', 'es-ES'])];
                  newPrio[2] = val;
                  updateConfig('subtitlePriority', newPrio);
                }}
              />
            </div>
          </div>

          <Dropdown 
            label={t('settings.subs_to_download')}
            value={config.dlsubs || ['all']}
            options={LANGUAGES}
            multiple={true}
            onChange={(val) => updateConfig('dlsubs', val)}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-white/5">
             <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5 transition-all hover:bg-black/30">
                <div className="flex items-center gap-3">
                    <Monitor size={20} className="text-primary" />
                    <div>
                        <div className="text-sm font-bold">MP4 Container</div>
                        <div className="text-[10px] text-gray-500">MKV is recommended</div>
                    </div>
                </div>
                <input 
                    type="checkbox"
                    checked={config.mp4}
                    onChange={(e) => updateConfig('mp4', e.target.checked)}
                    className="w-5 h-5 accent-primary cursor-pointer"
                />
             </div>

             <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center justify-between ml-1">
                    <span>Threads</span>
                    <span className="text-gray-700 italic lowercase tracking-normal">0 = auto</span>
                </label>
                <input 
                    type="number"
                    value={config.threads ?? 0}
                    onChange={(e) => updateConfig('threads', parseInt(e.target.value) || 0)}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors text-white"
                    min="0"
                />
             </div>
          </div>

          <div className="space-y-8 pt-8 border-t border-white/5">
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] border-l-2 border-primary pl-3">{t('settings.encoding_profiles')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">{t('settings.res_preset')}</label>
                <select
                  value={config.encodingPreset || 'custom'}
                  onChange={(e) => updateConfig('encodingPreset', e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-primary transition-all appearance-none cursor-pointer"
                >
                  <option value="custom">Custom (x264/x265)</option>
                  <optgroup label="AV1 High Quality">
                    <option value="av1_1080p24">AV1 1080p24</option>
                    <option value="av1_720p24">AV1 720p24</option>
                    <option value="av1_480p24">AV1 480p24</option>
                    <option value="av1_360p24">AV1 360p24</option>
                    <option value="av1_240p24">AV1 240p24</option>
                  </optgroup>
                  <optgroup label="H.265 (HEVC)">
                    <option value="h265_1080p24">H.265 1080p24</option>
                    <option value="h265_720p24">H.265 720p24</option>
                    <option value="h265_480p24">H.265 480p24</option>
                    <option value="h265_360p24">H.265 360p24</option>
                    <option value="h265_240p24">H.265 240p24</option>
                  </optgroup>
                  <optgroup label="H.264 (AVC)">
                    <option value="h264_1080p24">H.264 1080p24</option>
                    <option value="h264_720p24">H.264 720p24</option>
                    <option value="h264_480p24">H.264 480p24</option>
                    <option value="h264_360p24">H.264 360p24</option>
                    <option value="h264_240p24">H.264 240p24</option>
                  </optgroup>
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">{t('settings.speed_preset')}</label>
                <select
                  value={config.x265Preset || 'none'}
                  onChange={(e) => updateConfig('x265Preset', e.target.value)}
                  disabled={config.encodingPreset?.startsWith('av1')}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-primary transition-all disabled:opacity-30 appearance-none cursor-pointer"
                >
                  <option value="none">Default</option>
                  <option value="veryfast">Very Fast</option>
                  <option value="fast">Fast</option>
                  <option value="medium">Medium</option>
                  <option value="slow">Slow</option>
                  <option value="veryslow">Very Slow</option>
                </select>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  </div>
);
};

const MetadataSection = ({ metadataProviders, moveProvider, config, updateConfig }: any) => {
  const { t } = useTranslation();
  return (
  <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500">
    <div className="bg-secondary/40 backdrop-blur-md rounded-3xl border border-white/5 p-8 space-y-8">
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-lg">
            <Database size={24} />
          </div>
          <div>
            <div className="text-lg font-bold text-white">{t('settings.provider_priority')}</div>
            <div className="text-sm text-gray-400">{t('settings.priority_desc')}</div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-3">
          {metadataProviders.map((provider: string, index: number) => (
            <div key={provider} className="flex items-center justify-between p-5 bg-black/40 rounded-2xl border border-white/5 group hover:border-primary/30 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary text-xs font-black shadow-inner">
                  {index + 1}
                </div>
                <span className="font-bold text-white capitalize tracking-wide">
                  {provider === 'crunchy' ? 'Crunchyroll' : (provider === 'tmdb' ? 'TheMovieDB' : (provider === 'anilist' ? 'Anilist' : (provider === 'tvdb' ? 'TheTVDB' : (provider === 'anidb' ? 'AniDB' : provider))))}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => moveProvider(index, 'up')}
                  disabled={index === 0}
                  className="p-2 hover:bg-white/10 rounded-xl text-gray-500 hover:text-white disabled:opacity-20 transition-all active:scale-90"
                >
                  <ChevronUp size={20} />
                </button>
                <button
                  onClick={() => moveProvider(index, 'down')}
                  disabled={index === metadataProviders.length - 1}
                  className="p-2 hover:bg-white/10 rounded-xl text-gray-500 hover:text-white disabled:opacity-20 transition-all active:scale-90"
                >
                  <ChevronDown size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-8 border-t border-white/5 space-y-8">
        <h3 className="text-sm font-black text-gray-500 uppercase tracking-[0.2em] border-l-2 border-primary pl-3">{t('settings.api_keys')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">TMDB API Key (v3)</label>
                <input 
                    type="password"
                    value={config.tmdbApiKey || ''}
                    onChange={(e) => updateConfig('tmdbApiKey', e.target.value)}
                    placeholder="Enter API Key..."
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-xs text-white focus:outline-none focus:border-primary transition-all font-mono placeholder:text-gray-800"
                />
            </div>
            <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">TVDB API Key (v4)</label>
                <input 
                    type="password"
                    value={config.tvdbApiKey || ''}
                    onChange={(e) => updateConfig('tvdbApiKey', e.target.value)}
                    placeholder="Enter API Key..."
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-xs text-white focus:outline-none focus:border-primary transition-all font-mono placeholder:text-gray-800"
                />
            </div>
        </div>
      </div>
      
      <div className="pt-8 border-t border-white/5 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-black/20 rounded-2xl border border-white/5 gap-6">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-lg">
                    <Cpu size={24} />
                </div>
                <div>
                    <div className="text-lg font-bold">{t('settings.scan_concurrency')}</div>
                    <div className="text-sm text-gray-400">{t('settings.concurrency_desc')}</div>
                </div>
            </div>
            <div className="w-full md:w-32">
                <input 
                    type="number"
                    value={config.scanConcurrency ?? 4}
                    onChange={(e) => updateConfig('scanConcurrency', parseInt(e.target.value) || 1)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-center focus:outline-none focus:border-primary transition-all"
                    min="1"
                    max="16"
                />
            </div>
        </div>

        <div className="flex items-center justify-between p-6 bg-black/20 rounded-2xl border border-white/5">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shadow-lg">
                    <Library size={24} />
                </div>
                <div>
                    <div className="text-lg font-bold">{t('settings.auto_scan')}</div>
                    <div className="text-sm text-gray-400">{t('settings.auto_scan_desc')}</div>
                </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
                <input 
                    type="checkbox"
                    checked={config.autoScanLibrary ?? false}
                    onChange={(e) => updateConfig('autoScanLibrary', e.target.checked)}
                    className="sr-only peer"
                />
                <div className="w-14 h-7 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:start-[4px] after:bg-white after:border-white after:border after:rounded-full after:h-[20px] after:w-[20px] after:transition-all peer-checked:bg-orange-500"></div>
            </label>
        </div>
      </div>
    </div>
  </div>
);
};

const SystemSection = ({ systemInfo, appVersion }: any) => {
  const { t } = useTranslation();
  return (
  <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-secondary/40 backdrop-blur-md rounded-3xl border border-white/5 p-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xl shadow-primary/10">
                <Cpu size={32} />
            </div>
            <div>
                <div className="text-3xl font-black text-white">{systemInfo?.cpus || '0'}</div>
                <div className="text-xs font-black text-gray-500 uppercase tracking-widest mt-1">{t('settings.cpu_threads')}</div>
            </div>
        </div>
        <div className="bg-secondary/40 backdrop-blur-md rounded-3xl border border-white/5 p-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center shadow-xl shadow-blue-500/10">
                <Database size={32} />
            </div>
            <div>
                <div className="text-3xl font-black text-white">{systemInfo?.totalMem || '0'} GB</div>
                <div className="text-xs font-black text-gray-500 uppercase tracking-widest mt-1">{t('settings.total_ram')}</div>
            </div>
        </div>
    </div>

    <div className="bg-secondary/40 backdrop-blur-md rounded-3xl border border-white/5 overflow-hidden">
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400">
                    <Monitor size={20} />
                </div>
                <div>
                    <div className="font-bold text-white">{t('settings.environment')}</div>
                    <div className="text-xs text-gray-500">{t('settings.os_desc')}</div>
                </div>
            </div>
            <div className="text-right">
                <div className="text-sm font-black text-white uppercase tracking-widest">{systemInfo?.platform || '...'}</div>
                <div className="text-[10px] text-gray-500 font-mono">{systemInfo?.release || ''}</div>
            </div>
        </div>
        <div className="p-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                    <Info size={20} />
                </div>
                <div>
                    <div className="font-bold text-white">{t('settings.software_version')}</div>
                    <div className="text-xs text-gray-500">{t('settings.core_desc')}</div>
                </div>
            </div>
            <div className="text-right">
                <div className="text-sm font-black text-primary uppercase tracking-widest">v1.2.0</div>
                <div className="text-[10px] text-green-500 font-bold uppercase tracking-tighter">{t('settings.up_to_date')}</div>
            </div>
        </div>
    </div>

    <div className="pt-4">
        <button className="w-full py-6 bg-red-500/10 text-red-500 font-black rounded-3xl border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center justify-center gap-3 uppercase tracking-[0.3em] text-sm shadow-2xl">
            <LogOut size={20} /> 
            {t('settings.reset_app')}
        </button>
        <p className="text-[10px] text-gray-600 text-center mt-4 italic">{t('settings.reset_warning')}</p>
    </div>
  </div>
);
};

const Settings = () => {
  const { t } = useTranslation();
  const [currentTab, setCurrentTab] = useState<'account' | 'downloads' | 'library' | 'system'>('account');
  const [config, setConfig] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [authStatus, setAuthStatus] = useState<any>(null);
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [credentials, setCredentials] = useState({ username: '', password: '', token: '' });
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
        const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
        try {
            const [cfg, auth, sys] = await Promise.all([
                fetch('/api/config/muxing', { headers }).then(r => r.json()),
                fetch('/api/auth/status', { headers }).then(r => r.json()),
                fetch('/api/system/info', { headers }).then(r => r.json())
            ]);
            setConfig(cfg);
            setAuthStatus(auth);
            setSystemInfo(sys);
        } catch (err) {
            console.error('Error fetching settings data:', err);
        }
    };
    fetchData();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    try {
      const res = await fetch('/api/catalog/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      if (res.ok) {
        const statusRes = await fetch('/api/auth/status');
        setAuthStatus(await statusRes.json());
        setShowLogin(false);
      } else {
        const error = await res.json();
        alert(t('settings.auth_error', { error: error.error }));
      }
    } catch (err) {
      alert(t('common.error'));
    } finally {
      setLoggingIn(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/config/muxing', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error('Error saving:', err);
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (key: string, value: any) => {
    setConfig({ ...config, [key]: value });
  };

  if (!config) return (
    <div className="h-[60vh] flex flex-col items-center justify-center text-gray-500 font-sans">
       <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-6" />
       <div className="text-xs font-black uppercase tracking-[0.3em] opacity-50">{t('settings.syncing')}</div>
    </div>
  );

  const metadataProviders = config.metadataProviders || ['crunchy', 'anilist', 'tmdb', 'tvdb', 'anidb'];

  const moveProvider = (index: number, direction: 'up' | 'down') => {
    const newProviders = [...metadataProviders];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newProviders.length) return;
    [newProviders[index], newProviders[newIndex]] = [newProviders[newIndex], newProviders[index]];
    updateConfig('metadataProviders', newProviders);
  };

  const tabs = [
    { id: 'account', label: 'Crunchyroll', icon: User },
    { id: 'downloads', label: t('sidebar.downloads'), icon: Download },
    { id: 'library', label: t('sidebar.library'), icon: Library },
    { id: 'system', label: 'System', icon: Cpu },
  ];

  return (
    <div className="max-w-4xl mx-auto pb-24 font-sans animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-white tracking-tight">{t('settings.title').split(' ')[0]} <span className="text-primary">{t('settings.title').split(' ')[1]}</span></h1>
          <p className="text-gray-500 font-medium">{t('settings.subtitle')}</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "flex items-center gap-2 px-8 py-4 rounded-2xl font-black transition-all shadow-lg active:scale-95",
            saved ? "bg-green-500 text-white" : "bg-primary text-secondary hover:scale-[1.03] shadow-primary/20"
          )}
        >
          {saved ? (
             <Check size={20} />
          ) : (
             <Save size={20} className={saving ? 'animate-spin' : ''} />
          )}
          {saved ? t('settings.saved') : (saving ? t('settings.syncing') : t('settings.save_changes'))}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-10 p-1.5 bg-secondary/30 backdrop-blur-sm rounded-[24px] border border-white/5">
        {tabs.map(tab => (
            <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id as any)}
                className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-[18px] text-sm font-black uppercase tracking-widest transition-all",
                    currentTab === tab.id 
                        ? "bg-white/10 text-white shadow-lg border border-white/10" 
                        : "text-gray-500 hover:text-white hover:bg-white/5 border border-transparent"
                )}
            >
                <tab.icon size={18} className={currentTab === tab.id ? 'text-primary' : 'text-gray-500'} />
                <span className="hidden sm:inline">{tab.label}</span>
            </button>
        ))}
      </div>

      <div className="min-h-[400px]">
        {currentTab === 'account' && (
            <AuthSection 
                authStatus={authStatus}
                showLogin={showLogin}
                setShowLogin={setShowLogin}
                credentials={credentials}
                setCredentials={setCredentials}
                handleLogin={handleLogin}
                loggingIn={loggingIn}
            />
        )}

        {currentTab === 'downloads' && (
            <MuxingSection 
                config={config}
                updateConfig={updateConfig}
            />
        )}

        {currentTab === 'library' && (
            <MetadataSection 
                metadataProviders={metadataProviders}
                moveProvider={moveProvider}
                config={config}
                updateConfig={updateConfig}
            />
        )}

        {currentTab === 'system' && (
            <SystemSection 
                systemInfo={systemInfo}
            />
        )}
      </div>

      {saved && (
          <div className="fixed bottom-10 right-10 bg-green-500 text-white px-6 py-4 rounded-2xl font-black shadow-2xl flex items-center gap-3 animate-in slide-in-from-right duration-300">
              <Check size={24} />
              {t('settings.saved')}
          </div>
      )}
    </div>
  );
};

export default Settings;

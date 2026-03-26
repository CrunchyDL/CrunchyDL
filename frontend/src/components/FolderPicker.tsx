import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Folder, ChevronRight, Home, ArrowLeft, Check, X, Loader2, HardDrive } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface FolderPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (path: string) => void;
    initialPath?: string;
}

const FolderPicker: React.FC<FolderPickerProps> = ({ isOpen, onClose, onSelect, initialPath }) => {
    const { t } = useTranslation();
    const [currentPath, setCurrentPath] = useState(initialPath || 'root');
    const [directories, setDirectories] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<string[]>([]);
    const [parent, setParent] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadPath(currentPath);
        }
    }, [isOpen]);

    const loadPath = async (path: string) => {
        setLoading(true);
        try {
            const response = await axios.get(`/api/system/browse?path=${encodeURIComponent(path)}`);
            if (Array.isArray(response.data)) {
                // Root drives (Windows)
                setDirectories(response.data);
                setParent(null);
                setCurrentPath('root');
            } else {
                setDirectories(response.data.directories);
                setParent(response.data.parent);
                setCurrentPath(response.data.current);
            }
        } catch (error) {
            console.error('Failed to load path:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-2xl flex flex-col max-h-[80vh] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/20 rounded-lg">
                            <Folder className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white leading-tight">{t('sidebar.library')}</h3>
                            <p className="text-xs text-muted-foreground truncate max-w-[300px]">{currentPath === 'root' ? 'Drives' : currentPath}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="p-2 border-b border-white/10 bg-black/20 flex items-center gap-2 overflow-x-auto no-scrollbar">
                    <button 
                        onClick={() => loadPath('root')}
                        className="p-2 hover:bg-white/10 rounded-lg text-muted-foreground transition-colors shrink-0"
                    >
                        <Home className="w-4 h-4" />
                    </button>
                    {parent !== null && (
                        <>
                            <ChevronRight className="w-4 h-4 text-white/20 shrink-0" />
                            <button 
                                onClick={() => loadPath(parent)}
                                className="p-2 hover:bg-white/10 rounded-lg text-muted-foreground flex items-center gap-2 text-sm transition-colors shrink-0"
                            >
                                <ArrowLeft className="w-4 h-4" /> {t('common.back')}
                            </button>
                        </>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-[300px]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            <span className="text-sm text-muted-foreground animate-pulse uppercase tracking-widest">{t('common.loading')}</span>
                        </div>
                    ) : (
                        <>
                            {directories.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-64 text-center p-8">
                                    <Folder className="w-12 h-12 text-white/5 mb-4" />
                                    <p className="text-muted-foreground text-sm">Este directorio está vacío</p>
                                </div>
                            )}
                            {directories.map((dir, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => loadPath(dir.path)}
                                    className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl group transition-all"
                                >
                                    <div className={`p-2 rounded-lg ${dir.isDrive ? 'bg-blue-500/10' : 'bg-primary/10'} group-hover:scale-110 transition-transform`}>
                                        {dir.isDrive ? (
                                            <HardDrive className="w-5 h-5 text-blue-500" />
                                        ) : (
                                            <Folder className="w-5 h-5 text-primary" />
                                        )}
                                    </div>
                                    <span className="text-white text-sm font-medium flex-1 text-left truncate">{dir.name}</span>
                                    <ChevronRight className="w-4 h-4 text-white/10 group-hover:text-primary transition-colors" />
                                </button>
                            ))}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-white/5 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 h-11 border border-white/10 hover:bg-white/5 text-white font-bold rounded-xl transition-all"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={() => onSelect(currentPath)}
                        disabled={currentPath === 'root'}
                        className="flex-[2] h-11 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20"
                    >
                        <Check className="w-4 h-4" /> {t('common.confirm')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FolderPicker;

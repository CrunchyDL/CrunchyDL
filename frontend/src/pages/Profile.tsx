import React, { useState, useEffect, useCallback } from 'react';
import { User, Mail, Shield, Camera, Save, Lock, Info, CheckCircle2, Image as ImageIcon, X } from 'lucide-react';
import Cropper from 'react-easy-crop';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

const Profile = () => {
    const { t } = useTranslation();
    const { user, updateUser } = useAuth();
    const [formData, setFormData] = useState({
        username: user?.username || '',
        full_name: user?.full_name || '',
        bio: user?.bio || '',
        avatar_url: user?.avatar_url || '',
        password: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
    
    // Crop states
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    // Stock Avatars dynamic state
    const [stockAvatars, setStockAvatars] = useState<any[]>([]);

    useEffect(() => {
        const fetchStock = async () => {
            try {
                const res = await fetch('/api/stock-avatars');
                if (res.ok) setStockAvatars(await res.json());
            } catch (err) { console.error('Error fetching stock avatars:', err); }
        };
        fetchStock();
    }, []);

    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                username: user.username,
                full_name: user.full_name || '',
                bio: user.bio || '',
                avatar_url: user.avatar_url || ''
            }));
        }
    }, [user]);

    const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        // Validation for 10MB limit
        if (file.size > 10 * 1024 * 1024) {
            setMessage({ type: 'error', text: t('profile.error_image_size') });
            return;
        }

        const reader = new FileReader();
        reader.onload = () => setImageToCrop(reader.result as string);
        reader.readAsDataURL(file);
    };

    const syncAvatarWithServer = async (newUrl: string) => {
        try {
            const res = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ ...formData, avatar_url: newUrl, password: '' })
            });

            if (res.ok) {
                updateUser({ ...user, avatar_url: newUrl });
                setFormData(prev => ({ ...prev, avatar_url: newUrl }));
                setMessage({ type: 'success', text: t('profile.success_avatar_sync') });
                
                // Clear message after 3s
                setTimeout(() => setMessage(null), 3000);
            }
        } catch (err) {
            console.error('Failed to sync avatar:', err);
            setMessage({ type: 'error', text: t('profile.error_avatar_sync') });
        }
    };

    const handleCropDone = async () => {
        if (!imageToCrop || !croppedAreaPixels) return;
        
        setIsUploading(true);
        const image = new Image();
        image.src = imageToCrop;
        await new Promise(r => image.onload = r);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const { x, y, width, height } = croppedAreaPixels as any;
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(image, x, y, width, height, 0, 0, width, height);

        canvas.toBlob(async (blob) => {
            if (!blob) return;
            const formDataUpload = new FormData();
            formDataUpload.append('avatar', blob, 'avatar.jpg');

            try {
                const res = await fetch('/api/user/avatar', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                    body: formDataUpload
                });
                if (res.ok) {
                    const { url } = await res.json();
                    await syncAvatarWithServer(url);
                    setImageToCrop(null);
                }
            } finally {
                setIsUploading(false);
            }
        }, 'image/jpeg');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setMessage(null);

        try {
            const res = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                updateUser({
                    username: formData.username,
                    full_name: formData.full_name,
                    bio: formData.bio,
                    avatar_url: formData.avatar_url
                });
                setMessage({ type: 'success', text: 'Profile updated successfully!' });
                setFormData(prev => ({ ...prev, password: '' }));
            } else {
                const err = await res.json();
                setMessage({ type: 'error', text: err.error || t('profile.error_update') });
            }
        } catch (err) {
            setMessage({ type: 'error', text: t('common.error') });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto pb-24 font-sans animate-in slide-in-from-bottom-4 duration-700">
            <div className="mb-12">
                <h1 className="text-4xl font-black text-white tracking-tight mb-2 flex items-center gap-3">
                    <User size={36} className="text-primary" />
                    {t('profile.title')}
                </h1>
                <p className="text-gray-500 font-medium italic">{t('profile.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Left: Avatar Preview */}
                <div className="lg:col-span-1 border-r border-white/5 pr-0 lg:pr-12">
                    <div className="sticky top-8 flex flex-col items-center text-center">
                        <div className="relative group mb-6">
                            <div className="w-40 h-40 rounded-[2.5rem] overflow-hidden bg-secondary border-4 border-white/5 shadow-2xl transition-all group-hover:border-primary/50">
                                {formData.avatar_url ? (
                                    <img src={formData.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-700">
                                        <User size={64} />
                                    </div>
                                )}
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-primary text-secondary p-3 rounded-2xl shadow-xl">
                                <Camera size={20} />
                            </div>
                        </div>

                        <h2 className="text-xl font-black text-white mb-1">{formData.full_name || formData.username}</h2>
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                            {user?.role}
                        </span>
                        
                        <p className="mt-6 text-sm text-gray-500 italic leading-relaxed">
                            "{formData.bio || t('profile.no_bio')}"
                        </p>
                    </div>
                </div>

                {/* Right: Form */}
                <div className="lg:col-span-2">
                    <form onSubmit={handleSubmit} className="space-y-8">
                        {message && (
                            <div className={`p-4 rounded-2xl border flex items-center gap-3 animate-in zoom-in-95 ${
                                message.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'
                            }`}>
                                {message.type === 'success' ? <CheckCircle2 size={20} /> : <Info size={20} />}
                                <span className="text-sm font-bold">{message.text}</span>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase ml-1 tracking-widest">Username</label>
                                <input 
                                    type="text" 
                                    value={formData.username}
                                    onChange={e => setFormData({...formData, username: e.target.value})}
                                    className="w-full bg-secondary/40 border border-white/5 rounded-2xl px-5 py-4 text-sm focus:border-primary outline-none transition-all text-white font-bold"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase ml-1 tracking-widest">Full Name</label>
                                <input 
                                    type="text" 
                                    value={formData.full_name}
                                    onChange={e => setFormData({...formData, full_name: e.target.value})}
                                    className="w-full bg-secondary/40 border border-white/5 rounded-2xl px-5 py-4 text-sm focus:border-primary outline-none transition-all text-white font-bold"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-gray-500 uppercase ml-1 tracking-widest flex items-center justify-between">
                                <span>{t('profile.picture')}</span>
                                {isUploading && <span className="text-primary animate-pulse italic">{t('common.loading')}</span>}
                            </label>
                            <div className="flex gap-4">
                                <input 
                                    type="text" 
                                    value={formData.avatar_url}
                                    onChange={e => setFormData({...formData, avatar_url: e.target.value})}
                                    className="flex-1 bg-secondary/40 border border-white/5 rounded-2xl px-5 py-4 text-sm focus:border-primary outline-none transition-all text-white"
                                    placeholder={t('profile.avatar_url_placeholder')}
                                />
                                <label className="bg-secondary hover:bg-accent text-white px-6 rounded-2xl flex items-center justify-center cursor-pointer border border-white/5">
                                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                                    <ImageIcon size={20} />
                                </label>
                            </div>
                            <div className="flex flex-wrap gap-3 mt-2">
                                {stockAvatars.map((avatar, i) => (
                                    <button 
                                        key={i} 
                                        type="button"
                                        onClick={() => syncAvatarWithServer(avatar.url)}
                                        className={`w-10 h-10 rounded-xl overflow-hidden border-2 transition-all ${formData.avatar_url === avatar.url ? 'border-primary' : 'border-transparent hover:border-white/20'}`}
                                    >
                                        <img src={avatar.url} alt={avatar.name} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase ml-1 tracking-widest">Biography</label>
                            <textarea 
                                value={formData.bio}
                                onChange={e => setFormData({...formData, bio: e.target.value})}
                                rows={4}
                                className="w-full bg-secondary/40 border border-white/5 rounded-2xl px-5 py-4 text-sm focus:border-primary outline-none transition-all text-white resize-none"
                            />
                        </div>

                        <div className="pt-6 border-t border-white/5 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase ml-1 tracking-widest">Security Update</label>
                                <input 
                                    type="password" 
                                    value={formData.password}
                                    onChange={e => setFormData({...formData, password: e.target.value})}
                                    className="w-full bg-secondary/40 border border-white/5 rounded-2xl px-5 py-4 text-sm focus:border-primary outline-none transition-all text-white"
                                    placeholder={t('profile.new_password_placeholder')}
                                />
                            </div>
                            <button 
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-5 bg-primary text-secondary rounded-[2rem] font-black uppercase tracking-[0.2em] hover:scale-[1.01] transition-all"
                            >
                                {isSubmitting ? t('common.loading') : t('profile.update_identity')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Crop Modal Outside Form */}
            {imageToCrop && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-xl p-4 md:p-8">
                    <div className="bg-secondary p-6 md:p-10 rounded-[3rem] border border-white/5 w-full max-w-2xl h-[85vh] flex flex-col shadow-2xl relative">
                        <button onClick={() => setImageToCrop(null)} className="absolute top-6 right-6 p-2 hover:bg-white/5 rounded-full text-gray-400"><X size={24}/></button>
                        <h2 className="text-xl font-black text-white mb-8">{t('profile.adjust_avatar')}</h2>
                        <div className="relative flex-1 bg-black/40 rounded-3xl overflow-hidden mb-8">
                            <Cropper
                                image={imageToCrop}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={onCropComplete}
                            />
                        </div>
                        <div className="flex flex-col md:flex-row items-center gap-6">
                            <input 
                                type="range"
                                min={1} max={3} step={0.1}
                                value={zoom}
                                onChange={e => setZoom(Number(e.target.value))}
                                className="w-full md:w-48 accent-primary"
                            />
                            <button 
                                type="button"
                                onClick={handleCropDone}
                                disabled={isUploading}
                                className="w-full md:w-auto md:ml-auto px-10 py-4 bg-primary text-secondary rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-primary/20"
                            >
                                {isUploading ? t('common.loading') : t('profile.apply_selection')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profile;

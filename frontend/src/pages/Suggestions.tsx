import React, { useState, useEffect } from 'react';
import { Check, X, MessageSquare, Clock, User, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Suggestion {
  id: number;
  user_id: number;
  series_id: string;
  title: string;
  image: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  suggested_by: string;
}

const Suggestions: React.FC = () => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, token } = useAuth();
  
  const isManager = user?.role === 'admin' || user?.role === 'colaborador';

  useEffect(() => {
    fetchSuggestions();
  }, [token]);

  const fetchSuggestions = async () => {
    try {
      const response = await fetch('/api/suggestions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: number, status: 'approved' | 'rejected') => {
    try {
      const response = await fetch(`/api/suggestions/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (response.ok) {
        // Update local state
        setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status } : s));
      }
    } catch (error) {
      console.error(`Error updating suggestion ${id}:`, error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
            <MessageSquare className="w-10 h-10 text-orange-500" />
            Sugerencias de la Comunidad
          </h1>
          <p className="text-gray-400 mt-2 font-medium">Gestiona las peticiones de descarga de los usuarios.</p>
        </div>
      </div>

      {suggestions.length === 0 ? (
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-12 text-center">
          <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white">No hay sugerencias todavía</h3>
          <p className="text-gray-400 mt-2">Las peticiones de los usuarios aparecerán aquí.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {suggestions.map((suggestion) => (
            <div 
              key={suggestion.id}
              className="group bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl overflow-hidden hover:border-orange-500/50 transition-all duration-300 flex flex-col shadow-xl"
            >
              {/* Poster Image */}
              <div className="relative aspect-video overflow-hidden">
                <img 
                  src={suggestion.image || 'https://images.unsplash.com/photo-1541562232579-512a21359920?q=80&w=687&auto=format&fit=crop'} 
                  alt={suggestion.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                
                {/* Status Badge */}
                <div className="absolute top-4 right-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                    suggestion.status === 'approved' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                    suggestion.status === 'rejected' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                    'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  }`}>
                    {suggestion.status}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-5 flex-grow flex flex-col">
                <h3 className="text-lg font-bold text-white mb-2 line-clamp-2 min-h-[3.5rem] group-hover:text-orange-400 transition-colors">
                  {suggestion.title}
                </h3>
                
                <div className="space-y-2 mt-auto">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <User className="w-4 h-4 text-orange-500" />
                    <span>Sugerido por: <strong className="text-gray-200">{suggestion.suggested_by}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Clock className="w-4 h-4 text-orange-500" />
                    <span>{new Date(suggestion.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Actions */}
                {suggestion.status === 'pending' && isManager && (
                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => handleAction(suggestion.id, 'approved')}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-green-500/20"
                    >
                      <Check className="w-5 h-5" />
                      Aprobar
                    </button>
                    <button
                      onClick={() => handleAction(suggestion.id, 'rejected')}
                      className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 font-bold py-2.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <X className="w-5 h-5" />
                      Rechazar
                    </button>
                  </div>
                )}
                
                {suggestion.status !== 'pending' && (
                  <div className="mt-6 text-center">
                    <p className={`text-sm font-bold ${
                      suggestion.status === 'approved' ? 'text-green-400/60' : 'text-red-400/60'
                    }`}>
                      {suggestion.status === 'approved' ? 'Esta sugerencia fue aceptada' : 'Esta sugerencia fue rechazada'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Suggestions;

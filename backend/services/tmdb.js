const axios = require('axios');

class TmdbService {
    constructor() {
        this.baseUrl = 'https://api.themoviedb.org/3';
    }

    async getApiKey(db) {
        // 1. Prioritize environment variable (most secure/direct)
        if (process.env.TMDB_API_KEY) return process.env.TMDB_API_KEY;

        // 2. Lookup in secure settings table if DB is provided
        if (db) {
            try {
                const setting = await db.get('SELECT value FROM settings WHERE `key` = "tmdb_api_key"');
                if (setting) return setting.value;
            } catch (err) {
                console.error('[TMDB] Error fetching API Key from DB:', err.message);
            }
        }
        
        return null;
    }

    async searchSeries(query, dbOrKey, language = null) {
        let apiKey = typeof dbOrKey === 'string' ? dbOrKey : await this.getApiKey(dbOrKey);
        if (!apiKey) {
            console.warn('[TMDB] No API Key available for search.');
            return [];
        }

        try {
            const response = await axios.get(`${this.baseUrl}/search/tv`, {
                params: {
                    api_key: apiKey,
                    query: query,
                    language: language || 'es-ES'
                }
            });

            return response.data.results.map(item => ({
                id: `tmdb-${item.id}`,
                title: item.name,
                description: item.overview,
                image: item.poster_path ? `https://image.tmdb.org/t/p/w780${item.poster_path}` : null,
                release_date: item.first_air_date
            }));
        } catch (error) {
            console.error('[TMDB] Search error:', error.message);
            return [];
        }
    }

    async getSeriesDetails(id, dbOrKey, language = null) {
        let apiKey = typeof dbOrKey === 'string' ? dbOrKey : await this.getApiKey(dbOrKey);
        if (!apiKey) throw new Error('TMDB API Key not configured');

        const tmdbId = id.toString().split('-').pop();
        const url = `${this.baseUrl}/tv/${tmdbId}`;
        try {
            const response = await axios.get(url, {
                params: {
                    api_key: apiKey,
                    language: language || 'es-ES'
                }
            });

            const data = response.data;
            return {
                id: `tmdb-${data.id}`,
                title: data.name,
                description: data.overview,
                image: data.poster_path ? `https://image.tmdb.org/t/p/w780${data.poster_path}` : null,
                seasons: data.seasons.map(s => ({
                    id: `tmdb-s-${data.id}-${s.season_number}`,
                    title: s.name,
                    season_number: s.season_number,
                    episode_count: s.episode_count
                }))
            };
        } catch (error) {
            console.error('[TMDB] Details error:', error.message);
            throw error;
        }
    }

    async getEpisodes(id, seasonNumber, dbOrKey, language = null) {
        let apiKey = typeof dbOrKey === 'string' ? dbOrKey : await this.getApiKey(dbOrKey);
        if (!apiKey) return [];

        const tmdbId = id.toString().split('-').pop();
        const url = `${this.baseUrl}/tv/${tmdbId}/season/${seasonNumber}`;
        try {
            const response = await axios.get(url, {
                params: {
                    api_key: apiKey,
                    language: language || 'es-ES'
                }
            });

            return response.data.episodes.map(ep => ({
                id: `tmdb-ep-${tmdbId}-${seasonNumber}-${ep.episode_number}`,
                title: ep.name,
                episode_number: ep.episode_number,
                air_date: ep.air_date
            }));
        } catch (error) {
            console.error('[TMDB] Episodes error:', error.message);
            return [];
        }
    }

    async findByTvdbId(tvdbId, dbOrKey, language = null) {
        let apiKey = typeof dbOrKey === 'string' ? dbOrKey : await this.getApiKey(dbOrKey);
        if (!apiKey || !tvdbId) return null;
        try {
            const response = await axios.get(`${this.baseUrl}/find/${tvdbId}`, {
                params: {
                    api_key: apiKey,
                    external_source: 'tvdb_id',
                    language: language || 'es-ES'
                }
            });

            const results = response.data.tv_results || [];
            if (results.length > 0) {
                const item = results[0];
                return {
                    tmdb_id: item.id,
                    image: item.poster_path ? `https://image.tmdb.org/t/p/w780${item.poster_path}` : null,
                    description: item.overview
                };
            }
            return null;
        } catch (error) {
            console.error('[TMDB] Find by TVDB ID error:', error.message);
            return null;
        }
    }

    async findByMalId(malId, apiKey) {
        // As tested, MAL ID find is not officially supported for TV results in TMDB v3
        // We keep the method signature for compatibility but it might always return 0 results
        return null;
    }
}

module.exports = new TmdbService();

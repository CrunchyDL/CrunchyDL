const axios = require('axios');

class TvdbService {
    constructor() {
        this.baseUrl = 'https://api4.thetvdb.com/v4';
        this.token = null;
    }

    async getApiKey(db) {
        if (process.env.TVDB_API_KEY) return process.env.TVDB_API_KEY;
        if (db) {
            try {
                const setting = await db.get('SELECT value FROM settings WHERE `key` = "tvdb_api_key"');
                if (setting) return setting.value;
            } catch (err) {
                console.error('[TVDB] Error fetching API Key from DB:', err.message);
            }
        }
        return null;
    }

    async login(dbOrKey) {
        let apiKey = typeof dbOrKey === 'string' ? dbOrKey : await this.getApiKey(dbOrKey);
        if (!apiKey) throw new Error('TVDB API Key is required');
        
        try {
            const response = await axios.post(`${this.baseUrl}/login`, {
                apikey: apiKey
            });
            this.token = response.data.data.token;
            return this.token;
        } catch (error) {
            console.error('[TVDB] Login error:', error.response?.data || error.message);
            throw error;
        }
    }

    async request(method, endpoint, dbOrKey, data = null, params = {}) {
        if (!this.token) {
            await this.login(dbOrKey);
        }

        const execute = async () => {
            return await axios({
                method,
                url: `${this.baseUrl}${endpoint}`,
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/json',
                    'Accept-Language': params.language || 'eng'
                },
                data,
                params
            });
        };

        try {
            return await execute();
        } catch (error) {
            if (error.response && error.response.status === 401) {
                await this.login(dbOrKey);
                return await execute();
            }
            throw error;
        }
    }

    async searchSeries(query, dbOrKey, language = null) {
        try {
            const response = await this.request('get', '/search', dbOrKey, null, {
                q: query,
                type: 'series',
                limit: 5,
                language
            });

            return response.data.data.map(item => ({
                id: `tvdb-${item.tvdb_id}`,
                title: item.name,
                description: item.overview,
                image: item.image_url || item.thumbnail,
                year: item.year
            }));
        } catch (error) {
            console.error('[TVDB] Search error:', error.message);
            return [];
        }
    }

    async getSeriesDetails(id, dbOrKey, language = null) {
        const tvdbId = id.replace('tvdb-', '');
        try {
            const response = await this.request('get', `/series/${tvdbId}/extended`, dbOrKey, null, { language });
            const data = response.data.data;
            
            return {
                id: `tvdb-${data.id}`,
                title: data.name,
                description: data.overview,
                image: data.image,
                seasons: data.seasons 
                    ? data.seasons
                        .filter(s => s.type.type === 'official')
                        .map(s => ({
                            id: `tvdb-s-${data.id}-${s.number}`,
                            title: `Season ${s.number}`,
                            season_number: s.number,
                            episode_count: s.episodes ? s.episodes.length : 0
                        }))
                    : []
            };
        } catch (error) {
            console.error('[TVDB] Details error:', error.message);
            throw error;
        }
    }

    async getEpisodes(id, seasonNumber, dbOrKey, language = null) {
        const tvdbId = id.toString().replace('tvdb-', '');
        try {
            const response = await this.request('get', `/series/${tvdbId}/episodes/official`, dbOrKey, null, { language });
            const episodes = response.data.data.episodes;
            
            return episodes
                .filter(ep => ep.seasonNumber === parseInt(seasonNumber))
                .map(ep => ({
                    id: `tvdb-ep-${tvdbId}-${seasonNumber}-${ep.number}`,
                    title: ep.name,
                    episode_number: ep.number,
                    air_date: ep.aired
                }));
        } catch (error) {
            console.error('[TVDB] Episodes error:', error.message);
            return [];
        }
    }
}

module.exports = new TvdbService();

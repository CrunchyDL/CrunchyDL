const axios = require('axios');
const xml2js = require('xml2js');
const zlib = require('zlib');

class AnidbService {
    constructor() {
        this.baseUrl = 'http://api.anidb.net:9001/httpapi';
        this.client = 'antigravity';
        this.clientver = '1';
    }

    async getSeriesDetails(aid) {
        try {
            const response = await axios.get(this.baseUrl, {
                params: {
                    client: this.client,
                    clientver: this.clientver,
                    protover: '1',
                    request: 'anime',
                    aid: aid
                },
                responseType: 'arraybuffer',
                headers: {
                    'Accept-Encoding': 'gzip'
                }
            });

            // AniDB returns gzipped XML
            const decompressed = zlib.gunzipSync(response.data);
            const parser = new xml2js.Parser({ explicitArray: false });
            const result = await parser.parseStringPromise(decompressed);

            const anime = result.anime;
            if (!anime) return null;

            return {
                id: `anidb-${anime.$.id}`,
                title: Array.isArray(anime.titles.title) 
                    ? (anime.titles.title.find(t => t.$['xml:lang'] === 'en' && t.$.type === 'main') || anime.titles.title[0])._
                    : anime.titles.title._,
                description: anime.description,
                image: `https://cdn.anidb.net/images/main/${anime.picture}`,
                seasons: [
                    {
                        id: `anidb-s-${anime.$.id}-1`,
                        title: 'Complete Series',
                        season_number: 1,
                        episode_count: anime.episodecount
                    }
                ]
            };
        } catch (error) {
            console.error('[AniDB] Details error:', error.message);
            throw error;
        }
    }

    async getEpisodes(aid) {
        // Detailed episodes are part of the 'anime' request in some protovers,
        // but let's stick to the basic info for now.
        const details = await this.getSeriesDetails(aid);
        if (!details) return [];
        
        // AniDB API needs some refinement for episode lists if not included in details.
        // For now, let's return a dummy list based on count if needed, 
        // or actually parse them from the details XML if they are there.
        return [];
    }

    // Since AniDB search is complex, we use AniList to find the AniDB ID if possible
    async searchSeries(query) {
        try {
            const anilistService = require('./anilist');
            const alResults = await anilistService.searchSeries(query);
            
            // Map AniList results that have an AniDB ID
            return alResults
                .filter(res => res.anidb_id)
                .map(res => ({
                    id: `anidb-${res.anidb_id}`,
                    title: res.title,
                    description: res.description,
                    image: res.image,
                    confidence: res.confidence
                }));
        } catch (error) {
            console.error('[AniDB] Search error:', error.message);
            return [];
        }
    }
}

module.exports = new AnidbService();

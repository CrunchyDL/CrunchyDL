const axios = require('axios');

class AnilistService {
    constructor() {
        this.url = 'https://graphql.anilist.co';
        this.queue = [];
        this.isProcessing = false;
        this.lastRequestTime = 0;
        this.minDelay = 700; // ms between requests
        this.cache = new Map();
        this.cacheTTL = 1000 * 60 * 30; // 30 minutes
    }

    async _request(data, retryCount = 0) {
        return new Promise((resolve, reject) => {
            this.queue.push({ data, retryCount, resolve, reject });
            this._processQueue();
        });
    }

    async _processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;
        this.isProcessing = true;

        while (this.queue.length > 0) {
            const now = Date.now();
            const timeSinceLast = now - this.lastRequestTime;
            if (timeSinceLast < this.minDelay) {
                await new Promise(r => setTimeout(r, this.minDelay - timeSinceLast));
            }

            const item = this.queue.shift();
            try {
                const response = await axios.post(this.url, item.data);
                this.lastRequestTime = Date.now();
                item.resolve(response);
            } catch (error) {
                this.lastRequestTime = Date.now();
                if (error.response && error.response.status === 429 && item.retryCount < 5) {
                    const retryAfter = parseInt(error.response.headers['retry-after']) || (item.retryCount + 1) * 2;
                    console.warn(`[AniList] Rate limited (429). Retrying in ${retryAfter}s...`);

                    // Put back in front of queue after delay
                    setTimeout(() => {
                        this.queue.unshift({ ...item, retryCount: item.retryCount + 1 });
                        this._processQueue();
                    }, retryAfter * 1000);

                    // Break this worker's loop to wait for the retry
                    break;
                }
                item.reject(error);
            }
        }

        this.isProcessing = false;
    }

    async searchSeries(query) {
        const cacheKey = `search-${query.toLowerCase()}`;
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < this.cacheTTL)) {
            return cached.data;
        }
        const graphqlQuery = `
            query ($search: String) {
                Page(perPage: 5) {
                    media(search: $search, type: ANIME) {
                        id
                        idMal
                        title {
                            romaji
                            english
                        }
                        description
                        coverImage {
                            large
                        }
                        nextAiringEpisode {
                            airingAt
                            episode
                        }
                        externalLinks {
                           id
                           site
                           url
                        }
                    }
                }
            }
        `;

        try {
            const response = await this._request({
                query: graphqlQuery,
                variables: { search: query }
            });

            const media = response.data.data.Page.media;
            const results = media.map(m => {
                const tvdbLink = m.externalLinks?.find(l => l.site === 'TheTVDB');
                const tvdbId = tvdbLink ? tvdbLink.url.split('/').pop() : null;

                const anidbLink = m.externalLinks?.find(l => l.site === 'AniDB');
                const anidbId = anidbLink ? anidbLink.url.split('anime/').pop() : null;

                const crLink = m.externalLinks?.find(l => l.site === 'Crunchyroll');
                let crId = null;
                if (crLink) {
                    const match = crLink.url.match(/series\/([^\/]+)/);
                    if (match) crId = match[1];
                }

                let releaseDay = null;
                let releaseTime = null;
                if (m.nextAiringEpisode) {
                    const date = new Date(m.nextAiringEpisode.airingAt * 1000);
                    releaseDay = date.getUTCDay();
                    releaseTime = `${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`;
                }

                return {
                    id: `al-${m.id}`,
                    mal_id: m.idMal,
                    tvdb_id: tvdbId,
                    anidb_id: anidbId,
                    crunchyroll_id: crId,
                    title: m.title.english || m.title.romaji,
                    description: m.description ? m.description.replace(/<[^>]*>?/gm, '') : '',
                    image: m.coverImage.large,
                    release_day: releaseDay,
                    release_time: releaseTime
                };
            });

            this.cache.set(cacheKey, { data: results, timestamp: Date.now() });
            return results;
        } catch (error) {
            console.error('Anilist search error:', error.message);
            return [];
        }
    }

    async getSeriesDetails(id) {
        const cacheKey = `details-${id}`;
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < this.cacheTTL)) {
            return cached.data;
        }

        const alId = id.replace('al-', '');
        const graphqlQuery = `
            query ($id: Int) {
                Media(id: $id, type: ANIME) {
                    id
                    idMal
                    title {
                        romaji
                        english
                    }
                    description
                    coverImage {
                        large
                    }
                    nextAiringEpisode {
                        airingAt
                        episode
                    }
                    bannerImage
                    episodes
                    externalLinks {
                        site
                        url
                    }
                }
            }
        `;

        try {
            const response = await this._request({
                query: graphqlQuery,
                variables: { id: parseInt(alId) }
            });

            const m = response.data.data.Media;
            const crLink = m.externalLinks?.find(l => l.site === 'Crunchyroll');
            let crId = null;
            if (crLink) {
                const match = crLink.url.match(/series\/([^\/]+)/);
                if (match) crId = match[1];
            }

            let releaseDay = null;
            let releaseTime = null;
            if (m.nextAiringEpisode) {
                const date = new Date(m.nextAiringEpisode.airingAt * 1000);
                releaseDay = date.getUTCDay();
                releaseTime = `${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`;
            }

            const details = {
                id: `al-${m.id}`,
                title: m.title.english || m.title.romaji,
                description: m.description ? m.description.replace(/<[^>]*>?/gm, '') : '',
                image: m.coverImage.large,
                mal_id: m.idMal,
                crunchyroll_id: crId,
                release_day: releaseDay,
                release_time: releaseTime,
                seasons: [
                    {
                        id: `al-s-${m.id}`,
                        title: 'Complete Series',
                        season_number: 1,
                        episode_count: m.episodes || 0
                    }
                ]
            };

            this.cache.set(cacheKey, { data: details, timestamp: Date.now() });
            return details;
        } catch (error) {
            console.error('Anilist details error:', error.message);
            throw error;
        }
    }

    async getEpisodes(seasonIdOrMalId) {
        let malId = seasonIdOrMalId;
        if (typeof seasonIdOrMalId === 'string' && seasonIdOrMalId.startsWith('al-s-')) {
            const alId = seasonIdOrMalId.replace('al-s-', '');
            const details = await this.getSeriesDetails(`al-${alId}`);
            malId = details.mal_id;
        }

        if (!malId) return [];
        try {
            const jikanUrl = `https://api.jikan.moe/v4/anime/${malId}/episodes`;
            const response = await axios.get(jikanUrl);
            const episodes = response.data.data;
            return episodes.map(ep => ({
                id: `al-ep-${malId}-${ep.mal_id}`,
                title: ep.title,
                episode_number: ep.mal_id
            }));
        } catch (error) {
            console.error(`Error fetching MAL episodes for ${malId}:`, error.message);
            return [];
        }
    }
}

module.exports = new AnilistService();

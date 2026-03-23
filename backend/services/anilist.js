const axios = require('axios');

class AnilistService {
    constructor() {
        this.url = 'https://graphql.anilist.co';
    }

    async _request(data, retryCount = 0) {
        try {
            return await axios.post(this.url, data);
        } catch (error) {
            if (error.response && error.response.status === 429 && retryCount < 3) {
                const waitTime = (retryCount + 1) * 2000;
                console.warn(`[AniList] Rate limited. Retrying in ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                return this._request(data, retryCount + 1);
            }
            throw error;
        }
    }

    async searchSeries(query) {
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
            return media.map(m => {
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
        } catch (error) {
            console.error('Anilist search error:', error.message);
            return [];
        }
    }

    async getSeriesDetails(id) {
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

            return {
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

const anilistService = require('./anilist');
const tmdbService = require('./tmdb');
const tvdbService = require('./tvdb');
const catalogService = require('./catalog');
const anidbService = require('./anidb');

class MetadataHub {
    constructor() {
        this.providers = {
            crunchy: catalogService,
            anilist: anilistService,
            tmdb: tmdbService,
            tvdb: tvdbService,
            anidb: anidbService
        };
    }

    calculateSimilarity(s1, s2) {
        if (!s1 || !s2) return 0;
        const prepare = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        const a = prepare(s1);
        const b = prepare(s2);
        if (a === b) return 1.0;
        if (a.includes(b) || b.includes(a)) return 0.8;
        
        const getBigrams = (s) => {
            const res = new Set();
            for (let i = 0; i < s.length - 1; i++) res.add(s.substring(i, i + 2));
            return res;
        };
        const bSet1 = getBigrams(a);
        const bSet2 = getBigrams(b);
        const intersection = new Set([...bSet1].filter(x => bSet2.has(x)));
        return (2.0 * intersection.size) / (bSet1.size + bSet2.size);
    }

    /**
     * Search across providers and apply filters
     * @param {string} query Search query (usually folder name)
     * @param {Object} options Filter options
     * @param {string[]} options.providers List of providers to use
     * @param {number} options.minConfidence Minimum similarity score (0.0 - 1.0)
     * @param {boolean} options.requirePoster Must have an image
     * @param {boolean} options.requireDescription Must have a description
     * @param {string} options.apiKeyTMDB TMDB API Key if needed
     * @param {string} options.apiKeyTVDB TVDB API Key if needed
     */
    async search(query, options = {}) {
        const {
            providers = ['crunchy', 'anilist'],
            minConfidence = 0,
            requirePoster = false,
            requireDescription = false,
            apiKeyTMDB = null,
            apiKeyTVDB = null,
            language = 'en-US'
        } = options;

        const results = {};
        const promises = providers.map(async (p) => {
            try {
                const provider = this.providers[p];
                if (!provider) return;

                let providerResults = [];
                if (p === 'tmdb') {
                    if (!apiKeyTMDB) return; // Skip if no key
                    providerResults = await provider.searchSeries(query, apiKeyTMDB, language);
                } else if (p === 'tvdb') {
                    if (!apiKeyTVDB) return; // Skip if no key
                    providerResults = await provider.searchSeries(query, apiKeyTVDB, language);
                } else {
                    providerResults = await provider.searchSeries(query);
                }

                // Apply Filters
                results[p] = providerResults.filter(item => {
                    const confidence = this.calculateSimilarity(query, item.title);
                    if (confidence < minConfidence) return false;
                    if (requirePoster && !item.image) return false;
                    if (requireDescription && !item.description) return false;
                    
                    // Add confidence score to item
                    item.confidence = confidence;
                    return true;
                }).sort((a, b) => b.confidence - a.confidence);

            } catch (err) {
                console.error(`[MetadataHub] Error searching in ${p}:`, err.message);
                results[p] = [];
            }
        });

        await Promise.all(promises);
        return results;
    }

    /**
     * Get consolidated details for a series
     */
    async getFullDetails(id, providerName, options = {}) {
        const provider = this.providers[providerName];
        if (!provider) throw new Error(`Provider ${providerName} not found`);

        let details;
        if (providerName === 'tmdb') {
            details = await provider.getSeriesDetails(id, options.apiKeyTMDB, options.language);
        } else if (providerName === 'tvdb') {
            details = await provider.getSeriesDetails(id, options.apiKeyTVDB, options.language);
        } else {
            details = await provider.getSeriesDetails(id);
        }

        return details;
    }
}

module.exports = new MetadataHub();

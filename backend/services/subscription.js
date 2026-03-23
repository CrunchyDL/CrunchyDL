const path = require('path');
const fs = require('fs');

class SubscriptionService {
    constructor(db, cliService, catalogService, libraryService) {
        this.db = db;
        this.cliService = cliService;
        this.catalogService = catalogService;
        this.libraryService = libraryService;
        this.checkInterval = null;
        this.isChecking = false;
    }

    start(intervalMs = 30 * 60 * 1000) { // Default 30 mins
        if (this.checkInterval) return;
        console.log(`[Subscription] Starting auto-check every ${intervalMs / 1000 / 60} minutes`);
        this.checkInterval = setInterval(() => this.checkSubscriptions(), intervalMs);
        // Initial check
        setTimeout(() => this.checkSubscriptions(), 10000);
        // Sync airing status daily
        this.syncAiringStatus();
        setInterval(() => this.syncAiringStatus(), 24 * 60 * 60 * 1000);
    }

    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    async checkSubscriptions() {
        if (this.isChecking) return;
        this.isChecking = true;
        console.log('[Subscription] Running periodic check...');

        try {
            const activeSubscriptions = await this.db.all('SELECT * FROM subscriptions WHERE active = 1');
            const now = new Date();
            const currentDay = now.getUTCDay(); // 0-6
            const currentHours = now.getUTCHours();
            const currentMinutes = now.getUTCMinutes();
            const currentTimeStr = `${currentHours.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`;

            for (const sub of activeSubscriptions) {
                // If we have release info, check if it's time
                // Otherwise, we rely on checking metadata periodically
                let shouldCheckMetadata = false;

                if (sub.release_day !== null && sub.release_time) {
                    // 1. Time-based check (for new weekly episodes)
                    if (currentDay === sub.release_day) {
                        const [relH, relM] = sub.release_time.split(':').map(Number);
                        const releaseMinutesTotal = relH * 60 + relM + (sub.offset_minutes || 20);
                        const currentMinutesTotal = currentHours * 60 + currentMinutes;

                        if (currentMinutesTotal >= releaseMinutesTotal && currentMinutesTotal < releaseMinutesTotal + 60) {
                            shouldCheckMetadata = true;
                        }
                    }
                    
                    // 2. Catch-up check: If we just started or missed something, check periodically anyway 
                    // until we are caught up. We do this much less frequently (e.g., every 6 hours) 
                    // to avoid hitting the API too much if we are waiting for a new episode.
                    // For now, let's keep it simple: check every time if we are likely catching up.
                    if (!shouldCheckMetadata) {
                        // If it's not the release window, check metadata occasionally (every 4 hours)
                        const lastCheck = sub.last_check_at ? new Date(sub.last_check_at) : new Date(0);
                        if (now - lastCheck > 4 * 60 * 60 * 1000) {
                            shouldCheckMetadata = true;
                        }
                    }
                } else {
                    // No release info? Check anyway
                    shouldCheckMetadata = true; 
                }

                if (shouldCheckMetadata) {
                    await this.db.run('UPDATE subscriptions SET last_check_at = CURRENT_TIMESTAMP WHERE id = ?', sub.id);
                    await this.processSubscription(sub);
                }
            }
        } catch (err) {
            console.error('[Subscription] Error during periodic check:', err);
        } finally {
            this.isChecking = false;
        }
    }

    async processSubscription(sub) {
        console.log(`[Subscription] Checking for ${sub.title} (Ep ${sub.next_episode})...`);
        try {
            // 1. Get current metadata from Crunchyroll
            // We assume series_id is the Crunchyroll ID or we can find it
            let series = await this.db.get('SELECT * FROM series WHERE id = ?', sub.series_id);
            
            // BACKUP SEARCH: If ID changed (e.g. migration to AniList ID), search by title
            if (!series) {
                console.log(`[Subscription] Series ID ${sub.series_id} not found, searching by title: ${sub.title}`);
                series = await this.db.get('SELECT * FROM series WHERE title = ?', sub.title);
            }

            if (!series) {
                console.warn(`[Subscription] Series record NOT FOUND for ${sub.title} (ID: ${sub.series_id}). Skipping.`);
                return;
            }

            const crId = series.crunchyroll_id || (series.id && !series.id.startsWith('al-') && !series.id.startsWith('local-') ? series.id : null);

            const details = await this.catalogService.getSeriesDetails(crId);
            if (!details || !details.seasons) return;

            // 2. Loop through all available episodes to find any that are >= next_episode
            let currentNextEp = sub.next_episode;
            let episodesQueued = 0;
            let lastFoundEp = null;

            // 2. Fetch episodes for all seasons in parallel and flatten them
            const seasonsWithEpisodes = await Promise.all(details.seasons.map(async (s) => {
                try {
                    const episodes = await this.catalogService.getEpisodes(s.id);
                    return episodes.map(e => ({
                        ...e,
                        number: e.episode_number, // Ensure consistent naming
                        season_number: s.season_number
                    }));
                } catch (err) {
                    console.error(`[Subscription] Failed to fetch episodes for season ${s.id}:`, err.message);
                    return [];
                }
            }));

            const allAvailableEpisodes = seasonsWithEpisodes
                .flat()
                .sort((a, b) => parseFloat(a.number) - parseFloat(b.number));

            for (const ep of allAvailableEpisodes) {
                const epNum = parseFloat(ep.number);
                if (epNum === currentNextEp) {
                    // Check if already in queue to avoid double-processing
                    const alreadyQueued = await this.db.get(
                        'SELECT id FROM downloads WHERE show_id = ? AND episodes = ? AND status IN ("pending", "downloading", "processing")',
                        crId, epNum.toString()
                    );

                    if (alreadyQueued) {
                        console.log(`[Subscription] Ep ${epNum} for ${sub.title} is already in queue. Skipping.`);
                    } else {
                        console.log(`[Subscription] Catch-up/New episode found: ${sub.title} Ep ${epNum}`);
                        
                        await this.cliService.addDownload({
                            name: sub.title,
                            service: 'crunchy',
                            show_id: crId,
                            season_id: ep.season_id,
                            season_number: ep.season_number,
                            episodes: epNum.toString(),
                            rootPath: sub.root_path || series.lib_path,
                            triggered_by: 'system:subscription'
                        });
                        episodesQueued++;
                    }

                    currentNextEp++;
                    lastFoundEp = ep;
                }
            }

            if (episodesQueued > 0) {
                console.log(`[Subscription] Queued ${episodesQueued} episodes for ${sub.title}. Next expected: ${currentNextEp}`);
                await this.db.run('UPDATE subscriptions SET next_episode = ? WHERE id = ?', currentNextEp, sub.id);
                
                // 5. Check if we should deactivate
                const seriesStatus = await this.db.get('SELECT is_airing FROM series WHERE id = ?', series.id);
                if (seriesStatus && seriesStatus.is_airing === 0) {
                    // check if there are any episodes left in the list we fetched
                    const hasMore = allAvailableEpisodes.some(e => parseFloat(e.number) >= currentNextEp);
                    if (!hasMore) {
                        console.log(`[Subscription] Series ${sub.title} seems finished and all caught up. Deactivating.`);
                        await this.unsubscribe(sub.id);
                    }
                }
            }
        } catch (err) {
            console.error(`[Subscription] Error processing ${sub.title}:`, err);
        }
    }

    async subscribe(seriesId, title, nextEpisode = 1, day = null, time = null, rootPath = null) {
        // 0. ENRICHMENT: If day/time missing, try to get from AniList
        let finalDay = day;
        let finalTime = time;
        if (finalDay === null || !finalTime) {
            try {
                console.log(`[Subscription] [Enrichment] Seeking release info for ${title} from AniList...`);
                const matches = await require('./anilist').searchSeries(title);
                if (matches && matches.length > 0) {
                    const match = matches[0];
                    if (match.release_day !== null && match.release_time) {
                        console.log(`[Subscription] [Enrichment] Found schedule for ${title}: Day ${match.release_day} at ${match.release_time} UTC`);
                        finalDay = match.release_day;
                        finalTime = match.release_time;
                    }
                }
            } catch (e) {
                console.warn(`[Subscription] Schedule enrichment failed for ${title}:`, e.message);
            }
        }

        // 1. Ensure series exists in DB (even as stub)
        const series = await this.db.get('SELECT id, lib_path FROM series WHERE id = ?', seriesId);
        if (!series) {
            console.log(`[Subscription] Creating stub for new series: ${title} (${seriesId})`);
            const info = await this.catalogService.getSeriesInfo(seriesId);
            await this.db.run(`
                INSERT INTO series (id, title, description, image, crunchyroll_id)
                VALUES (?, ?, ?, ?, ?)
            `, seriesId, title, info?.description || '', info?.image || '', seriesId);
        }

        // 2. Resolve final rootPath: Prioritize manually selected, then existing library path
        const finalRootPath = rootPath || series?.lib_path;

        // 3. AUTO CATCH-UP: If nextEpisode is 1 (default) and we have a path, scan for existing files
        let finalNextEp = nextEpisode;
        if (finalNextEp <= 1 && finalRootPath) {
            try {
                const lastOnDisk = await this.libraryService.findLastEpisodeNumberOnDisk(finalRootPath);
                if (lastOnDisk > 0) {
                    console.log(`[Subscription] [AutoCatchUp] Found Ep ${lastOnDisk} on disk for ${title}. Starting from ${lastOnDisk + 1}`);
                    finalNextEp = lastOnDisk + 1;
                }
            } catch (e) {
                console.warn(`[Subscription] AutoCatchUp scan failed for ${title}:`, e.message);
            }
        }

        const existing = await this.db.get('SELECT id FROM subscriptions WHERE series_id = ?', seriesId);
        if (existing) {
            await this.db.run(`
                UPDATE subscriptions 
                SET active = 1, next_episode = ?, release_day = ?, release_time = ?, root_path = ? 
                WHERE id = ?
            `, finalNextEp, finalDay, finalTime, finalRootPath, existing.id);
        } else {
            await this.db.run(`
                INSERT INTO subscriptions (series_id, title, next_episode, release_day, release_time, root_path)
                VALUES (?, ?, ?, ?, ?, ?)
            `, seriesId, title, finalNextEp, finalDay, finalTime, finalRootPath);
        }

        const sub = await this.db.get('SELECT * FROM subscriptions WHERE series_id = ? AND active = 1', seriesId);
        if (sub) {
            console.log(`[Subscription] Triggering immediate process for ${title}`);
            // Don't await this so the response returns to UI immediately, 
            // but the background task starts.
            this.processSubscription(sub);
        }
    }

    async unsubscribe(id) {
        await this.db.run('UPDATE subscriptions SET active = 0 WHERE id = ?', id);
    }

    async syncAiringStatus() {
        console.log('[Subscription] Syncing airing status with seasonal catalog...');
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth(); // 0-11
            let season = 'Winter';
            if (month >= 3 && month <= 5) season = 'Spring';
            else if (month >= 6 && month <= 8) season = 'Summer';
            else if (month >= 9 && month <= 11) season = 'Fall';

            const catalog = await this.catalogService.getSeasonalCatalog(year, season);
            const simulcastIds = catalog.filter(item => item.is_simulcast).map(item => item.id);

            // 1. Reset all aired status to 0 (we will re-enable the active ones)
            await this.db.run('UPDATE series SET is_airing = 0');

            if (simulcastIds.length > 0) {
                const placeholders = simulcastIds.map(() => '?').join(',');
                // 2. Mark found ones as 1 (both by primary ID and by crunchyroll_id)
                await this.db.run(`
                    UPDATE series SET is_airing = 1 
                    WHERE id IN (${placeholders}) OR crunchyroll_id IN (${placeholders})
                `, ...simulcastIds, ...simulcastIds);
                
                console.log(`[Subscription] Airing sync: Updated database status. Marked active simulcasts.`);
            }
        } catch (err) {
            console.error('[Subscription] Error syncing airing status:', err);
        }
    }

    async getSubscriptions() {
        return await this.db.all('SELECT * FROM subscriptions');
    }
}

module.exports = SubscriptionService;

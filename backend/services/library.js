const fs = require('fs');
const path = require('path');
const catalogService = require('./catalog');
const anilistService = require('./anilist');
const tmdbService = require('./tmdb');
const tvdbService = require('./tvdb');
const anidbService = require('./anidb');
const metadataHub = require('./metadata-hub');
const offlineMetadata = require('./offline-metadata');
const axios = require('axios');
const crypto = require('crypto');

class LibraryService {
    constructor(db, cliService) {
        this.db = db;
        this.cliService = cliService;
        const pathsStr = process.env.LIBRARY_PATHS || process.env.DOWNLOAD_DIR || './downloads';
        this.libraryPaths = pathsStr.split(',').map(p => path.resolve(p.trim()));
        this.downloadDir = path.resolve(process.env.DOWNLOAD_DIR || './downloads');
        this.isScanning = false;

        const ConfigService = require('./config');
        this.configService = new ConfigService();

        const dbPath = process.env.DB_PATH || './data/database.sqlite';
        this.postersDir = path.join(path.dirname(path.resolve(dbPath)), 'posters');
        if (!fs.existsSync(this.postersDir)) fs.mkdirSync(this.postersDir, { recursive: true });
    }

    shouldPause() {
        const activeCount = this.cliService && this.cliService.activeDownloads ? this.cliService.activeDownloads.size : 0;
        if (activeCount > 0) {
            console.log(`[Library] Pausing scan check: ${activeCount} active tasks running.`);
            return true;
        }
        return false;
    }

    async _downloadPoster(url, seriesId) {
        if (!url || !url.startsWith('http')) return null;
        try {
            const filename = `${seriesId}.jpg`;
            const dest = path.join(this.postersDir, filename);

            if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) return filename;

            console.log(`[Library] Downloading poster for ${seriesId} to ${dest}...`);
            const response = await axios({ url, method: 'GET', responseType: 'stream', timeout: 15000 });

            return new Promise((resolve) => {
                const writer = fs.createWriteStream(dest);
                response.data.pipe(writer);
                writer.on('finish', () => resolve(filename));
                writer.on('error', (err) => {
                    console.error(`[Library] Stream error for ${seriesId}:`, err.message);
                    resolve(null);
                });
            });
        } catch (err) {
            console.error(`[Library] Poster download failed for ${seriesId}:`, err.message);
            return null;
        }
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

    async scan() {
        if (this.isScanning || this.shouldPause()) return;
        this.isScanning = true;
        console.log('[Library] Starting full scan...');
        try {
            await this._cleanupDuplicateSeasons();
            const muxConfig = await this.configService.getMuxingConfig();
            const concurrency = parseInt(muxConfig.scanConcurrency) || 4;

            const allFolders = [];
            for (const libPath of this.libraryPaths) {
                if (!fs.existsSync(libPath)) continue;
                const folders = fs.readdirSync(libPath).filter(f => {
                    const fullPath = path.resolve(path.join(libPath, f));
                    if (fullPath === this.downloadDir || f.toLowerCase() === 'downloads') return false;
                    try { return fs.statSync(fullPath).isDirectory(); } catch { return false; }
                });
                folders.forEach(f => allFolders.push({ libPath, folderName: f }));
            }

            console.log(`[Library] Total folders to scan: ${allFolders.length}. Concurrency: ${concurrency}`);

            const queue = [...allFolders];
            const workers = Array(Math.min(concurrency, queue.length)).fill(null).map(async () => {
                while (queue.length > 0) {
                    if (this.shouldPause()) break;
                    const item = queue.shift();
                    if (!item) break;
                    try { await this.syncSeries(item.libPath, item.folderName); } catch (e) { console.error(`[Library] Sync error ${item.folderName}:`, e.message); }
                }
            });
            await Promise.all(workers);
        } catch (err) {
            console.error('[Library] Scan error:', err);
        } finally {
            this.isScanning = false;
            console.log('[Library] Scan finished.');
            this.refreshAllMismatched().catch(e => console.error('[Library] Auto-id failed:', e.message));
        }
    }

    async syncSeries(libPath, folderName, forceRefresh = false, searchQuery = null) {
        const seriesPath = path.join(libPath, folderName);
        let series = await this.db.get('SELECT * FROM series WHERE folder_name = ?', folderName);

        if (!series) {
            const offlineMatch = await offlineMetadata.findByFolderName(folderName);
            if (offlineMatch) {
                console.log(`[Library] [Offline] Found global metadata for ${offlineMatch.title} linked to folder ${folderName}`);
                await this.db.run(`INSERT OR IGNORE INTO series (id, title, description, image, folder_name, metadata_provider, lib_path, crunchyroll_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    offlineMatch.id, offlineMatch.title, offlineMatch.description, offlineMatch.image, folderName, offlineMatch.source || 'unknown', libPath, offlineMatch.crunchyroll_id);
                await this.db.run('UPDATE series SET folder_name = ?, lib_path = ? WHERE id = ?', folderName, libPath, offlineMatch.id);
                series = await this.db.get('SELECT * FROM series WHERE id = ?', offlineMatch.id);
            }
        }

        if (!series) {
            const candidates = await this.db.all('SELECT * FROM series WHERE folder_name IS NULL OR folder_name = ""');
            for (const cand of candidates) {
                const similarity = this.calculateSimilarity(folderName, cand.title);
                const folderContainsTitle = folderName.toLowerCase().includes(cand.title.toLowerCase());
                const titleContainsFolder = cand.title.toLowerCase().includes(folderName.toLowerCase());
                
                if (similarity > 0.80 || folderContainsTitle || titleContainsFolder) {
                    console.log(`[Library] Auto-linked folder "${folderName}" to existing series "${cand.title}" (similarity: ${similarity.toFixed(2)})`);
                    await this.db.run('UPDATE series SET folder_name = ?, lib_path = ? WHERE id = ?', folderName, libPath, cand.id);
                    series = await this.db.get('SELECT * FROM series WHERE id = ?', cand.id);
                    break;
                }
            }
        }

        if (!series || forceRefresh || series.id.startsWith('local-') || series.metadata_provider !== 'anilist') {
            const queryName = searchQuery || (series ? series.title : folderName);
            const muxConfig = await this.configService.getMuxingConfig();
            const providers = muxConfig.metadataProviders || ['crunchy', 'anilist'];
            const metadataLang = await this.db.get('SELECT value FROM settings WHERE `key` = ?', 'metadata_language');
            const searchResults = await metadataHub.search(queryName, {
                providers, 
                minConfidence: muxConfig.minMetadataConfidence || 0.7,
                apiKeyTMDB: muxConfig.tmdbApiKey, 
                apiKeyTVDB: muxConfig.tvdbApiKey,
                language: metadataLang?.value || 'en-US'
            });

            let match = null, usedProvider = null;
            // Prioritize AniList in searches
            if (searchResults.anilist?.length > 0) {
                match = searchResults.anilist[0];
                usedProvider = 'anilist';
            } else {
                for (const p of providers) { if (searchResults[p] && searchResults[p].length > 0) { match = searchResults[p][0]; usedProvider = p; break; } }
            }

            if (match) {
                const needsReview = this.calculateSimilarity(folderName, match.title) < 0.7 ? 1 : 0;
                let finalId = match.id, crLinkId = match.crunchyroll_id || (usedProvider === 'crunchy' ? match.id : (series ? series.crunchyroll_id : null));

                // If match is not AniList but we want to prioritize it, try to find the AL ID
                if (usedProvider !== 'anilist' && (!finalId.startsWith('al-'))) {
                    try {
                        const alResults = await anilistService.searchSeries(match.title);
                        if (alResults?.[0] && this.calculateSimilarity(match.title, alResults[0].title) > 0.8) {
                            finalId = alResults[0].id;
                        }
                    } catch { }
                }

                const currentId = series ? series.id : null;
                
                // Try to find the existing series in DB by ID or Crunchyroll ID
                let existingById = await this.db.get('SELECT * FROM series WHERE id = ?', finalId);
                
                if (!existingById && crLinkId) {
                    existingById = await this.db.get('SELECT * FROM series WHERE crunchyroll_id = ?', crLinkId);
                    if (existingById && !finalId.startsWith('local-')) {
                        console.log(`[Library] Found existing series ${existingById.id} by Crunchyroll ID ${crLinkId}. Re-linking to ${finalId}`);
                        // We will let the migration logic below handle the ID change if needed
                    }
                }

                if (existingById) {
                    await this.db.run(`UPDATE series SET title = ?, description = ?, image = ?, folder_name = ?, metadata_provider = ?, needs_review = ?, lib_path = ?, crunchyroll_id = ? WHERE id = ?`,
                        match.title, match.description, match.image, folderName, usedProvider, needsReview, libPath, crLinkId, finalId);
                } else {
                    await this.db.run(`INSERT INTO series (id, title, description, image, folder_name, metadata_provider, needs_review, lib_path, crunchyroll_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        finalId, match.title, match.description, match.image, folderName, usedProvider, needsReview, libPath, crLinkId);
                }

                // Migration logic: If ID changed, update linked data
                if (currentId && currentId !== finalId) {
                    console.log(`[Library] Migrating series ${folderName} from ${currentId} to ${finalId}`);
                    
                    // Update all dependent tables
                    await this.db.run('UPDATE episodes SET series_id = ? WHERE series_id = ?', finalId, currentId);
                    await this.db.run('UPDATE seasons SET series_id = ? WHERE series_id = ?', finalId, currentId);
                    await this.db.run('UPDATE OR IGNORE suggestions SET series_id = ? WHERE series_id = ?', finalId, currentId);
                    
                    // Special handling for subscriptions (unique constraint)
                    try { 
                        await this.db.run('UPDATE subscriptions SET series_id = ? WHERE series_id = ?', finalId, currentId); 
                    } catch (e) {
                         // Likely unique constraint fail (already subscribed to the AniList version)
                         await this.db.run('DELETE FROM subscriptions WHERE series_id = ?', currentId);
                    }

                    if (currentId !== finalId) {
                        await this.db.run('DELETE FROM series WHERE id = ?', currentId);
                    }
                }

                await offlineMetadata.save(seriesPath, { ...match, id: finalId, crunchyroll_id: crLinkId, source: usedProvider });
                series = await this.db.get('SELECT * FROM series WHERE id = ?', finalId);
                if (match.image) {
                    const localFile = await this._downloadPoster(match.image, finalId);
                    if (localFile) { await this.db.run('UPDATE series SET image = ? WHERE id = ?', localFile, finalId); series.image = localFile; }
                }
            } else if (!series) {
                const dummyId = `local-${crypto.randomBytes(4).toString('hex')}`;
                await this.db.run(`INSERT OR IGNORE INTO series (id, title, folder_name, needs_review, metadata_provider, lib_path) VALUES (?, ?, ?, ?, ?, ?)`,
                    dummyId, folderName, folderName, 1, 'none', libPath);
                series = { id: dummyId, title: folderName, needs_review: 1 };
            }
        }

        if (series && !series.id.startsWith('local-')) {
            const hasNewEps = await this.scanLocalFiles(seriesPath, series.id);
            if (hasNewEps) {
                console.log(`[Library] New episodes detected for ${series.title}. Triggering catalog refresh...`);
                await this.refreshMetadata(series.id, true);
            } else {
                await this.refreshMetadata(series.id, false);
            }
        } else if (series) {
            await this.scanLocalFiles(seriesPath, series.id);
        }
    }

    async refreshAllMismatched() {
        const mismatched = await this.db.all('SELECT id, folder_name, lib_path FROM series WHERE needs_review = 1 OR id LIKE "local-%"');
        for (const item of mismatched) {
            if (item.lib_path && item.folder_name) await this.syncSeries(item.lib_path, item.folder_name, true);
        }
    }

    async refreshMetadata(seriesId, forceCatalogRefresh = false) {
        try {
            const series = await this.db.get('SELECT * FROM series WHERE id = ? OR crunchyroll_id = ?', seriesId, seriesId);
            if (!series || series.id.startsWith('local-')) return;

            // 1. Check Offline Metadata first (unless forcing catalog refresh)
            const offlineMatch = await offlineMetadata.read(series.id);
            if (offlineMatch && offlineMatch.seasons && offlineMatch.seasons.length > 0 && !forceCatalogRefresh) {
                console.log(`[Library] Loading metadata for ${series.title} from offline cache...`);
                await this._syncOfflineEps(series.id, offlineMatch.seasons);
                return;
            }

            // 2. Fetch from Catalog if offline is missing or refresh forced
            const crId = series.crunchyroll_id;
            if (crId) {
                console.log(`[Library] Fetching online metadata for ${series.title} (${crId})...`);
                const details = await catalogService.getSeriesDetails(crId);
                if (details?.seasons) {
                    for (const s of details.seasons) {
                        await this._mergeSeason(series.id, s.id, s.title, s.season_number);
                        const episodes = await catalogService.getEpisodes(s.id);
                        for (const ep of episodes) {
                            const ext = await this.db.get('SELECT path, is_downloaded FROM episodes WHERE id = ?', ep.id);
                            if (ext) await this.db.run(`UPDATE episodes SET season_id = ?, series_id = ?, title = ?, episode_number = ? WHERE id = ?`, s.id, series.id, ep.title, ep.episode_number, ep.id);
                            else await this.db.run(`INSERT INTO episodes (id, season_id, series_id, title, episode_number) VALUES (?, ?, ?, ?, ?)`, ep.id, s.id, series.id, ep.title, ep.episode_number);
                        }
                        s.episodes = episodes; // For later saving to JSON
                    }
                    
                    // 3. Update the offline metadata file with the full enriched data
                    const seriesPath = path.join(series.lib_path, series.folder_name);
                    await offlineMetadata.save(seriesPath, {
                        ...series,
                        seasons: details.seasons,
                        source: series.metadata_provider
                    });
                }
            }
        } catch (err) { console.error(`[Library] Metadata refresh error for ${seriesId}:`, err.message); }
    }

    async _syncOfflineEps(seriesId, seasons) {
        if (!seasons || !Array.isArray(seasons)) return;
        for (const s of seasons) {
            await this._mergeSeason(seriesId, s.id, s.title, s.season_number);
            if (s.episodes && Array.isArray(s.episodes)) {
                for (const ep of s.episodes) {
                    const ext = await this.db.get('SELECT id FROM episodes WHERE id = ?', ep.id);
                    if (ext) {
                        await this.db.run(`UPDATE episodes SET season_id = ?, series_id = ?, title = ?, episode_number = ? WHERE id = ?`, 
                            s.id, seriesId, ep.title, ep.episode_number, ep.id);
                    } else {
                        await this.db.run(`INSERT INTO episodes (id, season_id, series_id, title, episode_number) VALUES (?, ?, ?, ?, ?)`, 
                            ep.id, s.id, seriesId, ep.title, ep.episode_number);
                    }
                }
            }
        }
    }

    async _cleanupDuplicateSeasons() {
        console.log('[Library] Checking for duplicate seasons...');
        const duplicates = await this.db.all(`
            SELECT series_id, season_number, COUNT(*) as count 
            FROM seasons 
            GROUP BY series_id, season_number 
            HAVING count > 1
        `);

        for (const dup of duplicates) {
            console.log(`[Library] Fixing duplicate season ${dup.season_number} for series ${dup.series_id}`);
            const allVariants = await this.db.all(
                'SELECT id FROM seasons WHERE series_id = ? AND season_number = ? ORDER BY id DESC', 
                dup.series_id, dup.season_number
            );
            
            // Keep the first one (official IDs usually come last or are more specific)
            const masterId = allVariants[0].id;
            const toDelete = allVariants.slice(1);

            for (const other of toDelete) {
                console.log(`[Library] Merging ${other.id} into ${masterId}`);
                await this.db.run('UPDATE episodes SET season_id = ? WHERE season_id = ?', masterId, other.id);
                await this.db.run('DELETE FROM seasons WHERE id = ?', other.id);
            }
        }
    }

    async _mergeSeason(seriesId, newId, title, seasonNumber) {
        // 1. Check if a season with this number already exists for this series
        const existing = await this.db.get('SELECT id FROM seasons WHERE series_id = ? AND season_number = ?', seriesId, seasonNumber);
        
        if (existing) {
            if (existing.id === newId) {
                // Same ID, just update metadata
                await this.db.run('UPDATE seasons SET title = ? WHERE id = ?', title, newId);
            } else {
                // Different ID! (e.g. local placeholder vs official Crunchyroll ID)
                console.log(`[Library] Merging season ${seasonNumber} for series ${seriesId}: ${existing.id} -> ${newId}`);
                
                // 2. Ensure newId exists in seasons table
                const targetExists = await this.db.get('SELECT id FROM seasons WHERE id = ?', newId);
                if (!targetExists) {
                    // To insert newId with the same seasonNumber, we must temporarily rename the existing one's number
                    // to avoid the UNIQUE(series_id, season_number) constraint.
                    const tempNumber = -1 * Math.floor(Math.random() * 1000000);
                    await this.db.run('UPDATE seasons SET season_number = ? WHERE id = ?', tempNumber, existing.id);
                    
                    // Insert the new "official" season record
                    await this.db.run('INSERT INTO seasons (id, series_id, title, season_number) VALUES (?, ?, ?, ?)', 
                        newId, seriesId, title, seasonNumber);
                }
                
                // 3. Move episodes from the old ID to the new ID
                // Note: If episodes with same number exist in both, this might cause PK collisions in episodes table 
                // but the DB schema uses a single string ID for episodes (usually the CR id), so it should be fine.
                await this.db.run('UPDATE episodes SET season_id = ? WHERE season_id = ?', newId, existing.id);
                
                // 4. Delete the old redundant season record
                await this.db.run('DELETE FROM seasons WHERE id = ?', existing.id);
            }
        } else {
            // No season with this number exists. Check if the ID itself exists under a different number.
            const idExists = await this.db.get('SELECT id FROM seasons WHERE id = ?', newId);
            if (idExists) {
                await this.db.run('UPDATE seasons SET series_id = ?, title = ?, season_number = ? WHERE id = ?', 
                    seriesId, title, seasonNumber, newId);
            } else {
                await this.db.run('INSERT INTO seasons (id, series_id, title, season_number) VALUES (?, ?, ?, ?)', 
                    newId, seriesId, title, seasonNumber);
            }
        }
    }

    async scanLocalFiles(seriesPath, seriesId, currentSeasonNum = 1) {
        if (!fs.existsSync(seriesPath)) return false;
        const entries = fs.readdirSync(seriesPath);
        let foundNew = false;
        
        for (const entry of entries) {
            const entryPath = path.join(seriesPath, entry);
            const stats = fs.statSync(entryPath);
            if (stats.isDirectory()) {
                const seasonMatch = entry.match(/(?:Season|Temporada|S|T|Saga)\s*(\d+)/i);
                const res = await this.scanLocalFiles(entryPath, seriesId, seasonMatch ? parseInt(seasonMatch[1]) : currentSeasonNum);
                if (res) foundNew = true;
            } else if (stats.isFile()) {
                const ext = path.extname(entry).toLowerCase();
                if (!['.mp4', '.mkv', '.avi', '.ts', '.m4v', '.mov'].includes(ext)) continue;
                
                let cleanName = entry.replace(/[\[\(].*?[\]\)]/g, ' ').replace(/\./g, ' ');
                let seasonNum = currentSeasonNum, epNum = null;
                const sxxexxMatch = cleanName.match(/S(\d+)E(\d+)/i) || cleanName.match(/(\d+)x(\d+)/i);
                if (sxxexxMatch) { seasonNum = parseInt(sxxexxMatch[1]); epNum = parseInt(sxxexxMatch[2]); }
                else {
                    const epTagMatch = cleanName.match(/(?:Episode|Ep|Capitulo|Cap|E)\s*(\d+)/i);
                    if (epTagMatch) epNum = parseInt(epTagMatch[1]);
                    else { const genericNumMatch = cleanName.match(/(?:^|[\s\-\_\#])(\d+)(?:[\s\-\_\.\(]|$)/); if (genericNumMatch) epNum = parseInt(genericNumMatch[1]); }
                }

                if (epNum !== null) {
                    const episode = await this.db.get(`SELECT e.id, e.path FROM episodes e JOIN seasons s ON e.season_id = s.id WHERE e.series_id = ? AND s.season_number = ? AND e.episode_number = ?`, seriesId, seasonNum || 1, epNum);
                    if (episode) {
                        if (!episode.path) foundNew = true; // New file for known episode
                        await this.db.run('UPDATE episodes SET path = NULL, is_downloaded = 0 WHERE path = ?', entryPath);
                        await this.db.run('UPDATE episodes SET path = ?, is_downloaded = 1 WHERE id = ?', entryPath, episode.id);
                    } else if (seriesId.startsWith('local-') || seriesId.startsWith('al-')) {
                        foundNew = true; // Entirely new episode
                        let season = await this.db.get('SELECT id FROM seasons WHERE series_id = ? AND season_number = ?', seriesId, seasonNum || 1);
                        if (!season) {
                            const sid = `season-${seriesId}-${seasonNum || 1}`;
                            await this.db.run('INSERT INTO seasons (id, series_id, title, season_number) VALUES (?, ?, ?, ?)', sid, seriesId, `Season ${seasonNum || 1}`, seasonNum || 1);
                            season = { id: sid };
                        }
                        const eid = `ep-${seriesId}-${seasonNum || 1}-${epNum}`;
                        await this.db.run(`INSERT OR REPLACE INTO episodes (id, season_id, series_id, title, episode_number, path, is_downloaded) VALUES (?, ?, ?, ?, ?, ?, 1)`, eid, season.id, seriesId, `Episode ${epNum}`, epNum, entryPath);
                    }
                }
            }
        }
        return foundNew;
    }

    async approveSeries(id) { await this.db.run('UPDATE series SET needs_review = 0 WHERE id = ?', id); return true; }

    async getSeries(filter = null) {
        if (filter === 'mismatched') return await this.db.all('SELECT * FROM series WHERE needs_review = 1 ORDER BY created_at DESC');
        return await this.db.all('SELECT * FROM series ORDER BY created_at DESC');
    }

    async getSeriesEpisodesStatus(seriesId, title = null) {
        let matchedSeries = await this.db.all('SELECT id FROM series WHERE id = ? OR crunchyroll_id = ?', seriesId, seriesId);
        if (matchedSeries.length === 0 && title) {
            matchedSeries = await this.db.all('SELECT id FROM series WHERE title = ?', title);
        }
        if (matchedSeries.length === 0) return {};

        const seriesIds = matchedSeries.map(s => s.id);
        const placeholders = seriesIds.map(() => '?').join(',');
        const episodes = await this.db.all(`SELECT id, is_downloaded, path, episode_number FROM episodes WHERE series_id IN (${placeholders})`, ...seriesIds);
        
        const statusMap = {};
        const numberBestStatus = {};

        // Pass 1: Find best status for each episode number
        for (const ep of episodes) {
            const num = ep.episode_number;
            if (!numberBestStatus[num] || (!numberBestStatus[num].is_downloaded && ep.is_downloaded)) {
                numberBestStatus[num] = {
                    is_downloaded: !!ep.is_downloaded,
                    path: ep.path,
                    episode_number: num
                };
            }
        }

        // Pass 2: Populate status map using best status for numbers
        for (const ep of episodes) {
            const best = numberBestStatus[ep.episode_number];
            statusMap[ep.id] = best;
            statusMap[`number-${ep.episode_number}`] = best;
        }

        return statusMap;
    }

    async getSeriesFullDetails(seriesId) {
        const series = await this.db.get('SELECT * FROM series WHERE id = ? OR crunchyroll_id = ?', seriesId, seriesId);
        if (!series) return null;
        series.full_path = null;
        if (series.folder_name) {
            for (const libPath of this.libraryPaths) {
                const fullPath = path.join(libPath, series.folder_name);
                if (fs.existsSync(fullPath)) { series.full_path = fullPath; break; }
            }
        }
        const seasons = await this.db.all('SELECT * FROM seasons WHERE series_id = ? ORDER BY season_number', series.id);
        for (const s of seasons) s.episodes = await this.db.all('SELECT * FROM episodes WHERE season_id = ? ORDER BY episode_number', s.id);
        series.seasons = seasons;
        return series;
    }

    async updateSeriesImage(seriesId, imageUrl) {
        const localFile = await this._downloadPoster(imageUrl, seriesId);
        const imgPath = localFile || imageUrl;
        await this.db.run('UPDATE series SET image = ? WHERE id = ?', imgPath, seriesId);
        return imgPath;
    }

    async deleteEpisode(episodeId) {
        // Find series_id and episode_number for this record to handle duplicates
        const record = await this.db.get('SELECT series_id, episode_number FROM episodes WHERE id = ?', episodeId);
        if (!record) return false;

        // Find all records for the same "Logical Episode"
        const matchedEpisodes = await this.db.all(
            'SELECT id, path FROM episodes WHERE series_id = ? AND episode_number = ?',
            record.series_id, record.episode_number
        );

        for (const ep of matchedEpisodes) {
            if (ep.path && fs.existsSync(ep.path)) {
                try {
                    fs.unlinkSync(ep.path);
                    console.log(`[Library] Deleted file: ${ep.path}`);
                } catch (e) {
                    console.error(`[Library] Failed to delete file ${ep.path}:`, e.message);
                }
            }
            await this.db.run('UPDATE episodes SET path = NULL, is_downloaded = 0 WHERE id = ?', ep.id);
        }

        return true;
    }

    async refreshSeriesMetadata(seriesId, searchQuery = null) {
        const series = await this.db.get('SELECT * FROM series WHERE id = ? OR crunchyroll_id = ?', seriesId, seriesId);
        if (!series) throw new Error('Series not found');
        let foundLibPath = null;
        for (const lp of this.libraryPaths) { if (fs.existsSync(path.join(lp, series.folder_name))) { foundLibPath = lp; break; } }
        if (!foundLibPath) throw new Error('Folder not found on disk');
        await this.syncSeries(foundLibPath, series.folder_name, true, searchQuery);
        return await this.db.get('SELECT * FROM series WHERE id = ?', seriesId);
    }

    async searchMetadataMatches(query) {
        const config = await this.configService.getMuxingConfig();
        const results = await metadataHub.search(query, { providers: ['crunchy', 'anilist', 'tmdb', 'tvdb'], minConfidence: 0, apiKeyTMDB: config.tmdbApiKey, apiKeyTVDB: config.tvdbApiKey });
        if (results.crunchy) { results.crunchyroll = results.crunchy; delete results.crunchy; }
        return results;
    }

    async rebindSeries(oldSeriesId, match) {
        const oldSeries = await this.db.get('SELECT folder_name FROM series WHERE id = ?', oldSeriesId);
        if (!oldSeries?.folder_name) throw new Error('Series folder not found');

        const folderName = oldSeries.folder_name;
        let foundLibPath = null;
        for (const lp of this.libraryPaths) { if (fs.existsSync(path.join(lp, folderName))) { foundLibPath = lp; break; } }

        await this.db.run('UPDATE series SET folder_name = NULL WHERE folder_name = ?', folderName);
        await this.db.run('UPDATE episodes SET is_downloaded = 0, path = NULL WHERE series_id = ?', oldSeriesId);

        let existing = await this.db.get('SELECT * FROM series WHERE id = ?', match.id);
        const metaProvider = match.source === 'crunchyroll' ? 'crunchy' : (match.source || 'none');
        const crId = (metaProvider === 'crunchy') ? match.id : (match.crunchyroll_id || null);

        if (existing) await this.db.run(`UPDATE series SET title = ?, description = ?, image = ?, folder_name = ?, mal_id = ?, metadata_provider = ?, lib_path = ?, crunchyroll_id = ? WHERE id = ?`,
            match.title, match.description, match.image, folderName, match.mal_id || null, metaProvider, foundLibPath, crId, match.id);
        else await this.db.run(`INSERT INTO series (id, title, description, image, folder_name, mal_id, metadata_provider, lib_path, crunchyroll_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            match.id, match.title, match.description, match.image, folderName, match.mal_id || null, metaProvider, foundLibPath, crId);

        if (match.image) {
            const localFile = await this._downloadPoster(match.image, match.id);
            if (localFile) { await this.db.run('UPDATE series SET image = ? WHERE id = ?', localFile, match.id); match.image = localFile; }
        }

        if (foundLibPath) await offlineMetadata.save(path.join(foundLibPath, folderName), match);
        if (!match.id.startsWith('local-')) await this.refreshMetadata(match.id);
        if (foundLibPath) await this.scanLocalFiles(path.join(foundLibPath, folderName), match.id);

        if (oldSeriesId !== match.id) {
            const hasOther = await this.db.get('SELECT id FROM series WHERE id = ? AND folder_name IS NOT NULL', oldSeriesId);
            if (!hasOther) {
                await this.db.run('DELETE FROM episodes WHERE series_id = ?', oldSeriesId);
                await this.db.run('DELETE FROM seasons WHERE series_id = ?', oldSeriesId);
                await this.db.run('DELETE FROM series WHERE id = ?', oldSeriesId);
            }
        }
        return await this.db.get('SELECT * FROM series WHERE id = ?', match.id);
    }

    getLibraryPaths() { return this.libraryPaths; }

    async findLastEpisodeNumberOnDisk(seriesPath) {
        if (!seriesPath || !fs.existsSync(seriesPath)) return 0;
        let maxEp = 0;
        const scanDir = (dir) => {
            for (const entry of fs.readdirSync(dir)) {
                const p = path.join(dir, entry);
                const stats = fs.statSync(p);
                if (stats.isDirectory()) scanDir(p);
                else if (stats.isFile() && ['.mp4', '.mkv', '.avi', '.ts', '.m4v'].includes(path.extname(entry).toLowerCase())) {
                    let clean = entry.replace(/[\[\(].*?[\]\)]/g, ' ').replace(/\./g, ' ');
                    let epNum = null;
                    const m = clean.match(/S(\d+)E(\d+)/i) || clean.match(/(\d+)x(\d+)/i) || clean.match(/(?:Episode|Ep|Cap|E)\s*(\d+)/i) || clean.match(/(?:^|[\s\-\_\#])(\d+)(?:[\s\-\_\.\(]|$)/);
                    if (m) { epNum = parseInt(m[2] || m[1]); if (epNum < 2000 && epNum > maxEp) maxEp = epNum; }
                }
            }
        };
        try { scanDir(seriesPath); } catch { }
        return maxEp;
    }
}

module.exports = LibraryService;

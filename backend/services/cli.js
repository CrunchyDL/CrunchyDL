const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ConfigService = require('./config');

const encodingPresets = require('../constants/presets');

class CliService {
    constructor(db, io) {
        this.db = db;
        this.io = io;
        this.activeDownloads = new Map();
        this.cliPath = path.resolve(__dirname, '../multi-downloader-nx/lib/index.js');
        this.configService = new ConfigService();
        this.isProcessingQueue = false;
        this.encodingStarts = new Map();
        this.totalDurations = new Map();

        // Reset orphaned downloads from previous session
        this.resetStuckDownloads();
    }

    async resetStuckDownloads() {
        try {
            console.log('[Queue] Cleaning up stuck downloads from previous session...');
            await this.db.run("UPDATE downloads SET status = 'queued' WHERE status IN ('downloading', 'encoding')");
        } catch (err) {
            console.error('[Queue] Error resetting stuck downloads:', err);
        }
    }

    async processQueue() {
        if (this.isProcessingQueue) return;
        this.isProcessingQueue = true;

        try {
            // 1. Check physical memory (processes actually running in this instance)
            if (this.activeDownloads.size > 0) {
                console.log(`[Queue] A download is already active in memory (${this.activeDownloads.size}). Waiting...`);
                return;
            }

            // 2. Check logical database state vs physical memory
            const activeInDb = await this.db.all("SELECT id FROM downloads WHERE status IN ('downloading', 'encoding')");
            for (const item of activeInDb) {
                if (!this.activeDownloads.has(item.id)) {
                    console.log(`[Queue] Detected orphaned task in DB: ${item.id}. Resetting to queued.`);
                    await this.db.run("UPDATE downloads SET status = 'queued', progress = 0 WHERE id = ?", item.id);
                }
            }

            // 3. Re-check if we are truly busy after cleanup
            if (this.activeDownloads.size > 0) return;

            // 3. Find next queued/pending item
            const nextMatch = await this.db.get("SELECT id FROM downloads WHERE status IN ('queued', 'pending') ORDER BY id ASC LIMIT 1");

            if (nextMatch) {
                console.log(`[Queue] Starting next download in queue: ${nextMatch.id}`);
                await this.startDownload(nextMatch.id);
            } else {
                console.log('[Queue] No more items in queue.');
            }
        } catch (err) {
            console.error('[Queue] Error processing queue:', err);
        } finally {
            this.isProcessingQueue = false;
        }
    }

    async search(service, query) {
        return new Promise((resolve, reject) => {
            const args = ['--service', service, '--search', query];
            console.log(`[CLI] Searching ${service} for: "${query}"`);
            const child = spawn('node', [this.cliPath, ...args], {
                env: { 
                    ...process.env, 
                    contentDirectory: path.resolve(__dirname, '../multi-downloader-nx'),
                    CONTENT_DIR: process.env.DOWNLOAD_DIR || path.resolve(__dirname, '../../downloads')
                }
            });

            let output = '';
            let errorOutput = '';
            child.stdout.on('data', (data) => {
                output += data.toString();
            });

            child.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve(this.parseSearchResults(output));
                } else {
                    console.error(`[CLI] Search failed with code ${code}. Error: ${errorOutput}`);
                    reject(new Error(`Exit code ${code}: ${errorOutput}`));
                }
            });
        });
    }

    parseSearchResults(output) {
        const results = [];
        const lines = output.split('\n');
        for (const line of lines) {
            // Match [TYPE:ID] or [TYPE.ID] or [ID]
            // Pattern: optional whitespace, [, optional TYPE followed by : or ., then the ID (alphanumeric, underscores, pipes, dots, etc), then ], then whitespace, then title
            const match = line.match(/^\s*\[(?:[A-Z]+[:.])?([a-zA-Z0-9_|.-]+)\]\s+(.*)/);
            if (match) {
                let id = match[1];
                // Strip additional internal parts if it's a composite ID (e.g. ID|EPI.123 -> ID)
                if (id.includes('|')) {
                    id = id.split('|')[0];
                }
                // Clean up title (remove metadata in brackets at the end)
                const title = match[2].split('[')[0].trim();
                results.push({ id, title });
            }
        }
        console.log(`[CLI] Found ${results.length} search results`);
        return results;
    }

    setLibraryService(libService) {
        this.libService = libService;
    }

    async startDownload(downloadId) {
        const download = await this.db.get('SELECT * FROM downloads WHERE id = ?', downloadId);
        if (!download) return;

        let fileNameTemplate = '[${service}] ${showTitle} - S${season}E${episode} [${height}p]';
        let downloadDir = '';

        // Try to match with library or use pre-resolved path
        if (this.libService) {
            // Priority 1: Check if the download already has a full resolved path in the DB
            if (download.path && (download.path.includes('Season') || download.path.includes('Temporada'))) {
                console.log(`[CLI] Using pre-resolved path from DB: ${download.path}`);
                downloadDir = download.path;
                // fileNameTemplate remains base because downloadDir already includes Season
            } else {
                const seriesLocation = await this.libService.getSeriesFullDetails(download.show_id);
                if (seriesLocation && seriesLocation.full_path) {
                    console.log(`[CLI] Series found in library at: ${seriesLocation.full_path}. Using it.`);
                    downloadDir = seriesLocation.full_path;
                    fileNameTemplate = path.join('Season ${season}', fileNameTemplate);
                } else if (download.path) {
                    console.log(`[CLI] Using provided root path: ${download.path}`);
                    downloadDir = download.path;
                    fileNameTemplate = path.join('${showTitle}', 'Season ${season}', fileNameTemplate);
                }
            }
        }

        const muxConfig = await this.configService.getMuxingConfig();

        const args = [
            '--service', download.service,
            download.season_id ? '-s' : '--series', download.season_id || download.show_id || ''
        ];

        if (download.episodes === 'all') {
            args.push('--all');
        } else {
            args.push('-e', download.episodes);
        }

        // Add muxing/encoding flags from config
        if (muxConfig) {
            if (muxConfig.mp4) args.push('--mp4');
            if (muxConfig.ffmpegOptions && muxConfig.ffmpegOptions.length > 0) {
                args.push('--forceMuxer', 'ffmpeg');
            }
            if (muxConfig.defaultAudio) {
                const langCode = typeof muxConfig.defaultAudio === 'object' ? (muxConfig.defaultAudio.code || muxConfig.defaultAudio.locale) : muxConfig.defaultAudio;
                args.push('--defaultAudio', langCode);
            }
            if (muxConfig.dubLang && Array.isArray(muxConfig.dubLang)) {
                args.push('--dubLang', muxConfig.dubLang.join(','));
            }
            if (muxConfig.dlsubs && Array.isArray(muxConfig.dlsubs)) {
                args.push('--dlsubs', muxConfig.dlsubs.join(','));
            }
            if (muxConfig.audioPriority && Array.isArray(muxConfig.audioPriority)) {
                args.push('--audioPriority', muxConfig.audioPriority.join(','));
            }
            if (muxConfig.subtitlePriority && Array.isArray(muxConfig.subtitlePriority)) {
                const filteredPrio = muxConfig.subtitlePriority.filter(p => p !== 'none');
                if (filteredPrio.length > 0) {
                    args.push('--subtitlePriority', filteredPrio.join(','));
                }
            }
            const totalThreads = muxConfig.threads && muxConfig.threads > 0 ? muxConfig.threads : Math.min(os.cpus().length, 16);
            args.push('--threads', totalThreads.toString());

            if (muxConfig.videoEncodingEnabled !== false) {
                if (muxConfig.encodingPreset && muxConfig.encodingPreset !== 'custom') {
                    const preset = await this.db.get('SELECT * FROM presets WHERE id = ?', muxConfig.encodingPreset);
                    if (preset) {
                        const ffmpegOpts = [
                            `-c:v ${preset.codec}`,
                            `-crf ${preset.crf}`,
                            `-vf scale=${preset.resolution}`,
                            `-r ${preset.fps}`,
                            '-c:a copy'
                        ];
                        args.push('--ffmpegOptions=' + ffmpegOpts.join(' '));
                        if (muxConfig.x265Preset && muxConfig.x265Preset !== 'none' && (preset.codec === 'libx265' || preset.codec === 'libx264')) {
                            args.push('--preset', muxConfig.x265Preset);
                        }
                    }
                } else if (muxConfig.x265Enabled) {
                    // Ensure we use libx265 if re-encoding is requested
                    if (!muxConfig.ffmpegOptions?.some(o => o.includes('libx265'))) {
                        const crf = muxConfig.x265CRF ?? 23;
                        args.push('--ffmpegOptions=' + `-c:v libx265 -crf ${crf} -c:a copy`);
                    }
                    if (muxConfig.x265Preset && muxConfig.x265Preset !== 'none') {
                        args.push('--preset', muxConfig.x265Preset);
                    }
                }
            }
        }

        args.push(
            '--fileName', path.join(downloadDir, fileNameTemplate),
            '--force', 'Y',
            '--debug'
        );
        const destination = path.join(downloadDir, fileNameTemplate);
        console.log(`[CLI] Destination Path: ${destination}`);
        this.io.emit('downloadLogs', { id: downloadId, log: `Destination Path: ${destination}` });
        
        console.log(`[CLI] Launching with args: ${args.join(' ')}`);
        const child = spawn('node', [this.cliPath, ...args], {
            env: { 
                ...process.env, 
                contentDirectory: path.resolve(__dirname, '../multi-downloader-nx'),
                CONTENT_DIR: process.env.DOWNLOAD_DIR || path.resolve(__dirname, '../../downloads')
            }
        });
        this.activeDownloads.set(downloadId, child);

        await this.db.run('UPDATE downloads SET status = ? WHERE id = ?', 'downloading', downloadId);

        const handleLine = async (line) => {
            console.log(`[DL ${downloadId}] ${line}`);

            // Check for total duration (logged by our modified Merger)
            if (line.includes('[Merger] Total duration:')) {
                const durationMatch = line.match(/Total duration: ([\d.]+)s/);
                if (durationMatch) {
                    this.totalDurations.set(downloadId, parseFloat(durationMatch[1]));
                    console.log(`[DL ${downloadId}] Captured total duration: ${durationMatch[1]}s`);
                }
            }

            // Extract progress if possible (e.g. "Progress: 50%" or "[ffmpeg] 45.2%")
            let progress = null;
            const progressMatch = line.match(/(\d+(?:\.\d+)?)%/);
            if (progressMatch) {
                progress = parseFloat(progressMatch[1]);
            } else if (line.includes('time=')) {
                // Handle ffmpeg progress: "time=00:01:23.45"
                const timeMatch = line.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
                const totalDuration = this.totalDurations.get(downloadId);
                if (timeMatch && totalDuration) {
                    const hours = parseInt(timeMatch[1]);
                    const minutes = parseInt(timeMatch[2]);
                    const seconds = parseInt(timeMatch[3]);
                    const centiseconds = parseInt(timeMatch[4]);
                    const currentSeconds = (hours * 3600) + (minutes * 60) + seconds + (centiseconds / 100);
                    progress = Math.min(99.9, (currentSeconds / totalDuration) * 100);
                }
            }

            if (progress !== null) {
                // Throttle DB updates to integer changes to save I/O
                const currentProgress = await this.db.get('SELECT progress FROM downloads WHERE id = ?', downloadId);
                if (!currentProgress || Math.floor(progress) !== Math.floor(currentProgress.progress)) {
                    await this.db.run('UPDATE downloads SET progress = ? WHERE id = ?', Math.floor(progress), downloadId);
                }

                // Emit exact progress to UI for smooth bar
                this.io.emit('downloadProgress', { id: downloadId, progress });
            }

            // Check for encoding/merging start
            if (line.includes('Started merging') || line.includes('Starting merge')) {
                this.encodingStarts.set(downloadId, Date.now());
                await this.db.run('UPDATE downloads SET status = ? WHERE id = ?', 'encoding', downloadId);
                await this.db.run('UPDATE downloads SET progress = 0 WHERE id = ?', downloadId); // Reset progress for encoding phase
                this.io.emit('downloadStatus', { id: downloadId, status: 'encoding' });
                this.io.emit('downloadProgress', { id: downloadId, progress: 0 });
            }

            // Check for decryption start
            if (line.includes('Started decrypting')) {
                await this.db.run('UPDATE downloads SET status = ? WHERE id = ?', 'decrypting', downloadId);
                this.io.emit('downloadStatus', { id: downloadId, status: 'decrypting' });
            }

            // Check for completion markers
            if (line.includes('[ffmpeg Done]') || line.includes('[mkvmerge Done]') || line.includes('Done!')) {
                const start = this.encodingStarts.get(downloadId);
                let encodingTime = null;
                if (start) {
                    encodingTime = Math.round((Date.now() - start) / 1000);
                    this.encodingStarts.delete(downloadId);
                }

                await this.db.run(
                    'UPDATE downloads SET status = ?, progress = ?, encoding_time = ? WHERE id = ?',
                    'completed', 100, encodingTime, downloadId
                );
                this.io.emit('downloadStatus', { id: downloadId, status: 'completed' });
                this.io.emit('downloadProgress', { id: downloadId, progress: 100 });
            }

            this.io.emit('downloadLogs', { id: downloadId, log: line });
        };

        let lastOut = '';
        child.stdout.on('data', (data) => {
            lastOut += data.toString();
            const parts = lastOut.split(/[\r\n]+/);
            lastOut = parts.pop();
            for (const line of parts) {
                handleLine(line);
            }
        });

        let lastErr = '';
        child.stderr.on('data', (data) => {
            lastErr += data.toString();
            const parts = lastErr.split(/[\r\n]+/);
            lastErr = parts.pop();
            for (const line of parts) {
                // FFmpeg progress often goes to stderr
                handleLine(line);
            }
        });

        child.on('close', async (code) => {
            const stillActive = this.activeDownloads.has(downloadId);
            if (stillActive) {
                this.activeDownloads.delete(downloadId);
                const status = code === 0 ? 'completed' : 'error';

                // Fetch latest state to be safe
                const currentTask = await this.db.get('SELECT * FROM downloads WHERE id = ?', downloadId);
                if (!currentTask) return;

                await this.db.run('UPDATE downloads SET status = ?, progress = ? WHERE id = ?', status, code === 0 ? 100 : currentTask.progress, downloadId);
                this.io.emit('downloadStatus', { id: downloadId, status });

                // Mark as downloaded in the library/episodes table ONLY IF SUCCESSFUL
                if (code === 0) {
                    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
                    if (currentTask.episodes === 'all') {
                        await this.db.run(
                            'UPDATE episodes SET is_downloaded = 1, downloaded_at = ? WHERE series_id = ?',
                            now, currentTask.show_id
                        );
                    } else {
                        const epNum = parseInt(currentTask.episodes.toString().replace(/[^\d.]/g, ''));
                        if (!isNaN(epNum)) {
                            await this.db.run(
                                'UPDATE episodes SET is_downloaded = 1, downloaded_at = ? WHERE series_id = ? AND episode_number = ?',
                                now, currentTask.show_id, epNum
                            );
                        }
                    }
                }

                // Trigger library scan after download/encoding finished if enabled
                if (this.libService && muxConfig.autoScanLibrary === true) {
                    console.log(`[CLI] Download ${downloadId} finished, triggering library scan...`);
                    this.libService.scan();
                }

                // PROCESS NEXT ITEM
                this.processQueue();
            }
        });
    }

    async stopDownload(id) {
        const child = this.activeDownloads.get(id);
        if (child) {
            child.kill();
            this.activeDownloads.delete(id);
            await this.db.run('UPDATE downloads SET status = ? WHERE id = ?', 'error', id);
            return true;
        }
        return false;
    }

    async deleteDownload(id) {
        await this.stopDownload(id);
        await this.db.run('DELETE FROM downloads WHERE id = ?', id);
        return true;
    }

    async retryDownload(id) {
        // Reset progress and status in DB
        await this.db.run("UPDATE downloads SET status = 'queued', progress = 0 WHERE id = ?", id);
        // Start queue again
        this.processQueue();
        return true;
    }

    async clearFinished() {
        await this.db.run("DELETE FROM downloads WHERE status IN ('completed', 'error')");
        return true;
    }

    sanitizePathPart(n) {
        if (!n) return '_';
        const rep = {
            '/': '_', '\\': '_', ':': '_', '*': '∗', 
            '?': '？', '"': "'", '<': '‹', '>': '›', '|': '_'
        };
        const cleaned = n.replace(/[\/\\:\*\?"<>\|]/g, (ch) => rep[ch] || '_');
        return cleaned.replace(/[\x00-\x1f\x80-\x9f]/g, '_').replace(/^\.+$/, '_').replace(/[\. ]+$/, '_').trim();
    }

    async ensureSeriesFolder(show_id, title, rootPath, seasonNumber = null) {
        if (!rootPath) return null;
        
        try {
            // 1. Get/Assign folder name
            let series = await this.db.get('SELECT title, folder_name, lib_path FROM series WHERE id = ?', show_id);
            if (!series) {
                 // Try by Crunchyroll ID alias
                 series = await this.db.get('SELECT title, folder_name, lib_path FROM series WHERE crunchyroll_id = ?', show_id);
            }

            let folderName = series?.folder_name;
            const finalTitle = title || series?.title || 'Unknown Series';

            if (!folderName) {
                folderName = this.sanitizePathPart(finalTitle);
                console.log(`[Queue] Assigning folder name "${folderName}" for series "${finalTitle}"`);
                await this.db.run('UPDATE series SET folder_name = ?, lib_path = ? WHERE id = ?', folderName, rootPath, show_id);
                if (series?.crunchyroll_id) {
                    await this.db.run('UPDATE series SET folder_name = ?, lib_path = ? WHERE crunchyroll_id = ?', folderName, rootPath, show_id);
                }
            } else if (!series.lib_path) {
                await this.db.run('UPDATE series SET lib_path = ? WHERE id = ?', rootPath, show_id);
            }

            // 2. Create directories
            const seriesDir = path.join(rootPath, folderName);
            if (!fs.existsSync(seriesDir)) {
                console.log(`[Queue] Creating series directory: ${seriesDir}`);
                fs.mkdirSync(seriesDir, { recursive: true });
            }

            const seasonNum = parseInt(seasonNumber) || 1;
            const seasonDirName = `Season ${seasonNum.toString().padStart(2, '0')}`;
            const seasonDir = path.join(seriesDir, seasonDirName);
            if (!fs.existsSync(seasonDir)) {
                console.log(`[Queue] Creating season directory: ${seasonDir}`);
                fs.mkdirSync(seasonDir, { recursive: true });
            }

            return { seriesDir, seasonDir, folderName };
        } catch (err) {
            console.error(`[Queue] Failed to ensure folder structure for ${show_id}:`, err.message);
            return null;
        }
    }

    async addDownload({ name, service, show_id, season_id, episodes, rootPath, triggeredBy = 'SYSTEM', season_number = null, image = null }) {
        // Normalize service name
        const normalizedService = service === 'crunchyroll' ? 'crunchy' : service;

        // Auto-create folders if rootPath is provided
        let resolvedPath = rootPath;
        if (rootPath) {
            const folderInfo = await this.ensureSeriesFolder(show_id, name.split(' - ')[0], rootPath, season_number);
            if (folderInfo && folderInfo.seasonDir) {
                resolvedPath = folderInfo.seasonDir;
            }
        }

        const result = await this.db.run(
            'INSERT INTO downloads (name, service, show_id, season_id, episodes, path, status, progress, triggered_by, thumbnail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            name, normalizedService, show_id, season_id, episodes, resolvedPath, 'queued', 0, triggeredBy, image
        );

        // Trigger queue processing
        this.processQueue();

        return result.lastID;
    }
}

module.exports = CliService;

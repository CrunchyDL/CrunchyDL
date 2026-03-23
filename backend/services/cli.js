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
                env: { ...process.env, contentDirectory: path.resolve(__dirname, '../multi-downloader-nx') }
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

        // Try to match with library
        if (this.libService) {
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
                    const preset = encodingPresets.find(p => p.id === muxConfig.encodingPreset);
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

        console.log(`[CLI] Launching with args: ${args.join(' ')}`);
        const child = spawn('node', [this.cliPath, ...args], {
            env: { ...process.env, contentDirectory: path.resolve(__dirname, '../multi-downloader-nx') }
        });
        this.activeDownloads.set(downloadId, child);

        await this.db.run('UPDATE downloads SET status = ? WHERE id = ?', 'downloading', downloadId);

        const handleLine = async (line) => {
            console.log(`[DL ${downloadId}] ${line}`);

            // Extract progress if possible (e.g. "Progress: 50%" or "[ffmpeg] 45.2%")
            let progress = null;
            const progressMatch = line.match(/(\d+(?:\.\d+)?)%/);
            if (progressMatch) {
                progress = parseFloat(progressMatch[1]);
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
                this.io.emit('downloadStatus', { id: downloadId, status: 'encoding' });
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
                    const now = new Date().toISOString();
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

    async addDownload({ name, service, show_id, season_id, episodes, rootPath, triggeredBy = 'SYSTEM' }) {
        // Normalize service name
        const normalizedService = service === 'crunchyroll' ? 'crunchy' : service;

        const result = await this.db.run(
            'INSERT INTO downloads (name, service, show_id, season_id, episodes, path, status, progress, triggered_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            name, normalizedService, show_id, season_id, episodes, rootPath, 'queued', 0, triggeredBy
        );

        // Trigger queue processing
        this.processQueue();

        return result.lastID;
    }
}

module.exports = CliService;

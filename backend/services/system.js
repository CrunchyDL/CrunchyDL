const fs = require('fs').promises;
const path = require('path');

class SystemService {
    constructor() {
        // We'll calculate stats for library volumes
    }

    async getDiskSpace(targetPath) {
        try {
            // Ensure path exists before checking
            const stats = await fs.statfs(targetPath);
            
            const total = Number(stats.blocks * stats.bsize);
            const free = Number(stats.bavail * stats.bsize); // bavail is safer than bfree
            const used = total - free;
            const percentage = total > 0 ? Math.round((used / total) * 100) : 0;

            return {
                path: targetPath,
                total: this.formatBytes(total),
                free: this.formatBytes(free),
                used: this.formatBytes(used),
                totalRaw: total,
                freeRaw: free,
                usedRaw: used,
                percentage
            };
        } catch (error) {
            console.error(`[System] Error getting disk space for ${targetPath}:`, error.message);
            return {
                path: targetPath,
                error: error.message,
                total: '0 GB',
                free: '0 GB',
                used: '0 GB',
                percentage: 0
            };
        }
    }

    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
}

module.exports = new SystemService();

const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
class SystemService {
    constructor() {
        // We'll calculate stats for library volumes
    }

    async listDirectories(basePath) {
        // Root request
        if (!basePath || basePath === 'root' || basePath === '') {
            if (process.platform === 'win32') {
                let drives = [];
                try {
                    // Use .NET DriveInfo via powershell for most reliable listing
                    const { stdout } = await execPromise('powershell "[System.IO.DriveInfo]::GetDrives() | Select-Object -ExpandProperty Name"');
                    drives = stdout.split(/[\r\n]+/)
                        .map(line => line.trim())
                        .filter(line => line.includes(':')); // Extract "C:\", "D:\", etc.
                    console.log('[System] DriveInfo found drives:', drives);
                } catch (e) {
                    console.error('[System] DriveInfo detection failed:', e.message);
                }

                if (drives.length === 0) {
                    try {
                        // Fallback to Get-PSDrive
                        const { stdout } = await execPromise('powershell "Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Name"');
                        drives = stdout.split(/[\r\n]+/)
                            .map(line => line.trim())
                            .filter(line => line.length === 1)
                            .map(l => `${l}:\\`);
                    } catch (e) {
                        console.error('[System] PSDrive detection failed:', e.message);
                    }
                }

                if (drives.length === 0) drives = ['C:\\'];

                return drives.map(d => ({
                    name: d.endsWith('\\') ? d.slice(0, -1) : d,
                    path: d.endsWith('\\') ? d : `${d}\\`,
                    isDrive: true
                }));
            } else {
                basePath = '/';
            }
        }
        
        try {
            let targetPath = basePath;
            // Windows drive root normalization (C: -> C:\)
            if (process.platform === 'win32' && /^[A-Z]:$/i.test(basePath)) {
                targetPath = basePath + '\\';
            }

            const absolutePath = path.resolve(targetPath);
            const entries = await fs.readdir(absolutePath, { withFileTypes: true });
            
            const directories = entries
                .filter(e => e.isDirectory())
                .map(e => ({
                    name: e.name,
                    path: path.join(absolutePath, e.name)
                }))
                .sort((a, b) => a.name.localeCompare(b.name));

            return {
                current: absolutePath,
                parent: path.dirname(absolutePath) === absolutePath ? (process.platform === 'win32' ? 'root' : null) : path.dirname(absolutePath),
                directories
            };
        } catch (error) {
            console.error(`[System] Error listing directories in ${basePath}:`, error.message);
            throw error;
        }
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

    async detectPotentialLibraryRoots() {
        if (process.platform === 'win32') {
            return [];
        }

        const rawPotential = [];
        const standardDirs = ['bin', 'boot', 'dev', 'etc', 'home', 'lib', 'lib64', 'media', 'mnt', 'opt', 'proc', 'root', 'run', 'sbin', 'srv', 'sys', 'tmp', 'usr', 'var', 'app']; 

        try {
            // 1. Scan / for custom dirs and their first-level children
            const rootEntries = await fs.readdir('/', { withFileTypes: true });
            for (const entry of rootEntries) {
                const isDir = entry.isDirectory() || entry.isSymbolicLink();
                if (isDir && !standardDirs.includes(entry.name.toLowerCase())) {
                    const fullPath = `/${entry.name}`;
                    rawPotential.push(fullPath);
                    try {
                        const subEntries = await fs.readdir(fullPath, { withFileTypes: true });
                        for (const sub of subEntries) {
                            if (sub.isDirectory() || sub.isSymbolicLink()) {
                                rawPotential.push(`${fullPath}/${sub.name}`);
                            }
                        }
                    } catch (e) {}
                }
            }

            // 2. Scan /mnt and /media
            for (const parent of ['/mnt', '/media']) {
                try {
                    const subEntries = await fs.readdir(parent, { withFileTypes: true });
                    for (const sub of subEntries) {
                        if (sub.isDirectory() || sub.isSymbolicLink()) {
                            rawPotential.push(`${parent}/${sub.name}`);
                        }
                    }
                } catch (e) {}
            }
        } catch (e) {
            console.error('[System] Discovery failed:', e);
        }
        
        // Normalize and remove trailing slashes
        const normalized = [...new Set(rawPotential)]
            .map(p => p.replace(/\\/g, '/').replace(/\/+$/, ''))
            .filter(p => p && p !== '/' && !p.startsWith('/proc') && !p.startsWith('/sys') && !p.startsWith('/dev'));

        // Identify "Leaves": Keep a path only if no other path starts with (path + '/')
        // We use case-insensitive check for prefixing to be super safe
        const finalResults = normalized.filter(p => {
            const prefix = (p + '/').toLowerCase();
            return !normalized.some(other => other.toLowerCase().startsWith(prefix));
        });
        
        return finalResults.sort((a, b) => a.localeCompare(b));
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

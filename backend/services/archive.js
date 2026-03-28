const fs = require('fs');
const path = require('path');

class ArchiveService {
    constructor() {
        this.archivePath = path.resolve(__dirname, '../../multi-downloader-nx/config/archive.json');
    }

    load() {
        if (!fs.existsSync(this.archivePath)) {
            return {
                crunchy: { s: [], srz: [] },
                hidive: { s: [] },
                adn: { s: [] }
            };
        }
        try {
            return JSON.parse(fs.readFileSync(this.archivePath, 'utf8'));
        } catch (e) {
            console.error('Error loading archive.json:', e);
            return {
                crunchy: { s: [], srz: [] },
                hidive: { s: [] },
                adn: { s: [] }
            };
        }
    }

    save(data) {
        try {
            const dir = path.dirname(this.archivePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.archivePath, JSON.stringify(data, null, 4), 'utf8');
            return true;
        } catch (e) {
            console.error('Error saving archive.json:', e);
            return false;
        }
    }

    isDownloaded(service, type, id, episode) {
        const data = this.load();
        if (!data[service] || !data[service][type]) return false;
        const entry = data[service][type].find(item => item.id === id);
        return entry ? entry.already.includes(episode.toString()) : false;
    }

    toggle(service, type, id, episode) {
        const data = this.load();
        if (!data[service]) data[service] = {};
        if (!data[service][type]) data[service][type] = [];
        
        let entry = data[service][type].find(item => item.id === id);
        const epStr = episode.toString();

        if (!entry) {
            entry = { id: id, already: [epStr] };
            data[service][type].push(entry);
        } else {
            const index = entry.already.indexOf(epStr);
            if (index >= 0) {
                entry.already.splice(index, 1);
            } else {
                entry.already.push(epStr);
            }
        }
        
        return this.save(data);
    }

    clearSeries(service, id) {
        const data = this.load();
        if (!data[service]) return false;
        
        let found = false;
        for (const type in data[service]) {
            if (Array.isArray(data[service][type])) {
                const initialLength = data[service][type].length;
                data[service][type] = data[service][type].filter(item => item.id !== id);
                if (data[service][type].length !== initialLength) found = true;
            }
        }
        
        if (found) return this.save(data);
        return false;
    }

    clearEpisode(service, id, episodeNum) {
        const data = this.load();
        if (!data[service]) return false;
        
        let found = false;
        const epStr = episodeNum.toString();

        for (const type in data[service]) {
            if (Array.isArray(data[service][type])) {
                const entry = data[service][type].find(item => item.id === id);
                if (entry && entry.already.includes(epStr)) {
                    entry.already = entry.already.filter(ep => ep !== epStr);
                    found = true;
                    // Clean up entry if it has no more episodes
                    if (entry.already.length === 0) {
                        data[service][type] = data[service][type].filter(item => item.id !== id);
                    }
                }
            }
        }
        
        if (found) return this.save(data);
        return false;
    }
}

module.exports = new ArchiveService();

const fs = require('fs');
const path = require('path');

class OfflineMetadataService {
    constructor() {
        this.filename = 'metadata.json';
        const dbPath = process.env.DB_PATH || './data/database.sqlite';
        const dataDir = path.dirname(path.resolve(dbPath));
        this.metadataDir = path.join(dataDir, 'metadata');
        if (!fs.existsSync(this.metadataDir)) {
            fs.mkdirSync(this.metadataDir, { recursive: true });
        }
    }

    /**
     * Get the path to a specific metadata file by ID
     */
    getMetadataPathById(id) {
        return path.join(this.metadataDir, `${id}.json`);
    }

    /**
     * Try to find metadata by the series folder name (for recovery)
     * @param {string} folderName Name of the series folder
     */
    async findByFolderName(folderName) {
        if (!fs.existsSync(this.metadataDir)) return null;
        try {
            const files = fs.readdirSync(this.metadataDir);
            for (const file of files) {
                if (!file.endsWith('.json')) continue;
                const filePath = path.join(this.metadataDir, file);
                const content = fs.readFileSync(filePath, 'utf8');
                const meta = JSON.parse(content);
                if (meta.folder_name === folderName) return meta;
            }
        } catch (err) {
            console.error(`[OfflineMetadata] Error searching by folder ${folderName}:`, err.message);
        }
        return null;
    }

    /**
     * Read external metadata by ID
     */
    async read(id) {
        const filePath = this.getMetadataPathById(id);
        if (!fs.existsSync(filePath)) return null;
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        } catch (err) {
            return null;
        }
    }

    /**
     * Save/Update external metadata in a series folder
     * @param {string} seriesPath Absolute path to the series directory
     * @param {Object} metadata Metadata object to save
     */
    async save(seriesPath, metadata) {
        if (!metadata.id) {
            console.warn('[OfflineMetadata] Cannot save metadata without an ID.');
            return;
        }

        const folderName = path.basename(seriesPath);
        const filePath = this.getMetadataPathById(metadata.id);

        try {
            const dataToSave = {
                id: metadata.id,
                title: metadata.title,
                folder_name: folderName, // Crucial for recovery
                description: metadata.description || '',
                image: metadata.image || '',
                source: metadata.source || metadata.metadata_provider || 'unknown',
                crunchyroll_id: metadata.crunchyroll_id || null,
                mal_id: metadata.mal_id || null,
                tvdb_id: metadata.tvdb_id || null,
                seasons: metadata.seasons || [], // Added seasons/episodes list
                last_updated: new Date().toISOString()
            };

            fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2), 'utf8');
            console.log(`[OfflineMetadata] Saved metadata for "${metadata.title}" in ${seriesPath}`);
        } catch (err) {
            console.error(`[OfflineMetadata] Error saving metadata in ${seriesPath}:`, err.message);
        }
    }

    /**
     * Delete metadata file (e.g. if the user wants to re-identify from scratch)
     */
    async delete(id) {
        const filePath = this.getMetadataPathById(id);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                console.log(`[OfflineMetadata] Deleted metadata file: ${id}.json`);
            } catch (err) {
                console.error(`[OfflineMetadata] Error deleting metadata ${id}:`, err.message);
            }
        }
    }
}

module.exports = new OfflineMetadataService();

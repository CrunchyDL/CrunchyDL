const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { setupDb } = require('../db');

class SetupService {
    constructor() {
        this.configPath = path.join(__dirname, '..', '..', 'data', 'config.json');
        this.dataDir = path.dirname(this.configPath);
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    async isInstalled() {
        return fs.existsSync(this.configPath);
    }

    async install(config) {
        // config: { dbType, sqlitePath, mysql: { host, user, password, database, port }, admin: { username, password } }
        
        try {
            const dbConfig = {
                dbType: config.dbType,
                path: config.dbType === 'sqlite' ? (config.sqlitePath || './data/database.sqlite') : null,
                mysql: config.dbType === 'mysql' ? config.mysql : null
            };

            // 1. Try to connect and setup schema
            const db = await setupDb(dbConfig);
            if (!db) throw new Error('Failed to initialize database');

            // 2. Create Admin User
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(config.admin.password, salt);
            
            await db.run(
                'INSERT INTO users (username, password_hash, role, must_change_password) VALUES (?, ?, ?, ?)',
                config.admin.username, hash, 'admin', 0
            );

            // 3. Save Optional settings
            const metadataLang = config.metadataLanguage || 'es-ES';
            await db.run('INSERT INTO settings (`key`, value) VALUES (?, ?)', 'metadata_language', metadataLang);

            if (config.tmdbApiKey) {
                await db.run('INSERT INTO settings (`key`, value) VALUES (?, ?)', 'tmdb_api_key', config.tmdbApiKey);
            }
            if (config.tvdbApiKey) {
                await db.run('INSERT INTO settings (`key`, value) VALUES (?, ?)', 'tvdb_api_key', config.tvdbApiKey);
            }
            if (config.crEmail) {
                await db.run('INSERT INTO settings (`key`, value) VALUES (?, ?)', 'crunchyroll_email', config.crEmail);
            }
            if (config.crPassword) {
                await db.run('INSERT INTO settings (`key`, value) VALUES (?, ?)', 'crunchyroll_password', config.crPassword);
            }

            // 4. Save Config
            fs.writeFileSync(this.configPath, JSON.stringify({ ...dbConfig, installed: true }, null, 2), 'utf8');

            return { success: true };
        } catch (err) {
            console.error('[Setup] Installation failed:', err);
            throw err;
        }
    }

    async getStatus() {
        return {
            installed: await this.isInstalled(),
            env: {
                sqlite_default: './data/database.sqlite',
                mysql_available: true
            }
        };
    }
}

module.exports = new SetupService();

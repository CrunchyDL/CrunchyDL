const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

let dbInstance = null;
let dbPromise = null;

const SCHEMA = `
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(255) UNIQUE,
        password_hash TEXT,
        role VARCHAR(50) DEFAULT 'user',
        full_name TEXT,
        bio TEXT,
        avatar_url TEXT,
        must_change_password INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS series (
        id VARCHAR(255) PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        image TEXT,
        folder_name VARCHAR(255),
        metadata_provider VARCHAR(50),
        needs_review INTEGER DEFAULT 0,
        mal_id INTEGER,
        crunchyroll_id VARCHAR(255),
        lib_path TEXT,
        is_airing INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS seasons (
        id VARCHAR(255) PRIMARY KEY,
        series_id VARCHAR(255),
        title TEXT,
        season_number INTEGER,
        episode_count INTEGER,
        UNIQUE(series_id, season_number),
        FOREIGN KEY (series_id) REFERENCES series(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_seasons_series_number ON seasons(series_id, season_number);

    CREATE TABLE IF NOT EXISTS episodes (
        id VARCHAR(255) PRIMARY KEY,
        series_id VARCHAR(255),
        season_id VARCHAR(255),
        title TEXT,
        episode_number DOUBLE,
        is_downloaded INTEGER DEFAULT 0,
        path TEXT,
        downloaded_at DATETIME,
        FOREIGN KEY (series_id) REFERENCES series(id),
        FOREIGN KEY (season_id) REFERENCES seasons(id)
    );

    CREATE TABLE IF NOT EXISTS downloads (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        name TEXT,
        service VARCHAR(50),
        show_id VARCHAR(255),
        season_id VARCHAR(255),
        season_number INTEGER,
        episodes TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        rootPath TEXT,
        path TEXT,
        encoding_time INTEGER,
        triggered_by VARCHAR(255) DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        thumbnail TEXT
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        series_id VARCHAR(255) UNIQUE,
        title TEXT,
        next_episode DOUBLE DEFAULT 1,
        release_day INTEGER,
        release_time VARCHAR(50),
        offset_minutes INTEGER DEFAULT 20,
        last_check_at DATETIME,
        active INTEGER DEFAULT 1,
        root_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (series_id) REFERENCES series(id)
    );

    CREATE TABLE IF NOT EXISTS suggestions (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        user_id INTEGER,
        series_id VARCHAR(255),
        title TEXT,
        image TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        user_id INTEGER,
        username VARCHAR(255),
        action VARCHAR(100),
        target TEXT,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT
    );

    CREATE TABLE IF NOT EXISTS permissions (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        slug VARCHAR(50) UNIQUE NOT NULL,
        description TEXT
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INTEGER,
        permission_id INTEGER,
        PRIMARY KEY (role_id, permission_id),
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
        \`key\` VARCHAR(100) PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stock_avatars (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        name TEXT,
        url VARCHAR(255) UNIQUE NOT NULL,
        category VARCHAR(50) DEFAULT 'general',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS presets (
        id VARCHAR(100) PRIMARY KEY,
        name TEXT NOT NULL,
        codec VARCHAR(50) NOT NULL,
        resolution VARCHAR(50),
        fps VARCHAR(50),
        crf INTEGER,
        \`group\` VARCHAR(100),
        is_default INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE downloads ADD COLUMN thumbnail TEXT;
    -- Fix for MySQL: TEXT columns cannot be unique without a length
    ALTER TABLE series MODIFY COLUMN folder_name VARCHAR(255); 
    CREATE UNIQUE INDEX IF NOT EXISTS idx_series_folder_name ON series(folder_name);
`;

function normalizeSchema(sql, type) {
    if (type === 'sqlite') {
        return sql.replace(/AUTO_INCREMENT/g, 'AUTOINCREMENT')
            .replace(/VARCHAR\(\d+\)/g, 'TEXT')
            .replace(/DOUBLE/g, 'REAL')
            .replace(/\\\`key\\\`/g, 'key')
            .replace(/INSERT IGNORE INTO/g, 'INSERT OR IGNORE INTO')
            .replace(/ALTER TABLE \\w+ MODIFY COLUMN .*?;/gi, '');
    } else if (type === 'mysql') {
        return sql.replace(/INSERT OR IGNORE INTO/gi, 'INSERT IGNORE INTO')
            .replace(/UPDATE OR IGNORE/gi, 'UPDATE IGNORE')
            .replace(/INSERT OR REPLACE INTO/gi, 'REPLACE INTO')
            .replace(/CREATE (UNIQUE )?INDEX IF NOT EXISTS (\w+) ON (\w+)/gi, 'CREATE $1 INDEX $2 ON $3')
            .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'INTEGER PRIMARY KEY AUTO_INCREMENT')
            .replace(/INSERT INTO (\w+) \((.*?)\) VALUES \((.*?)\) ON CONFLICT\((.*?)\) DO UPDATE SET (.*)/gi, (match, table, cols, vals, conflictCol, update) => {
                // Convert SQLite ON CONFLICT to MySQL ON DUPLICATE KEY UPDATE
                const mysqlUpdate = update.replace(/excluded\.(\w+)/g, 'VALUES(`$1`)');
                return `INSERT INTO ${table} (${cols}) VALUES (${vals}) ON DUPLICATE KEY UPDATE ${mysqlUpdate}`;
            });
    }
    return sql;
}

async function setupDb(configInput = null) {
    if (dbInstance && !configInput) return dbInstance;
    if (dbPromise && !configInput) return dbPromise;

    dbPromise = (async () => {
        try {
            let config = configInput;
            const configPath = path.join(__dirname, '..', 'data', 'config.json');

            if (!config && fs.existsSync(configPath)) {
                config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            }

            if (!config) {
                // Return a temporary SQLite instance or handle as "not configured"
                // For now, let's keep the legacy behavior if no config exists, but redirect to setup via middleware
                config = { dbType: 'sqlite', path: process.env.DB_PATH || './data/database.sqlite' };
            }

            let db;
            if (config.dbType === 'mysql') {
                const connection = await mysql.createConnection({
                    host: config.mysql.host,
                    user: config.mysql.user,
                    password: config.mysql.password,
                    database: config.mysql.database,
                    port: config.mysql.port || 3306,
                    multipleStatements: true
                });

                // Wrap MySQL connection in an "adapter" that mimics the sqlite API
                db = {
                    get: async (sql, ...params) => {
                        try {
                            const sanitized = params.map(p => p === undefined ? null : p);
                            const [rows] = await connection.execute(normalizeSchema(sql, 'mysql'), sanitized);
                            return rows[0];
                        } catch (err) {
                            console.error('[DB] MySQL Get Error:', err.message, '| SQL:', sql);
                            throw err;
                        }
                    },
                    all: async (sql, ...params) => {
                        try {
                            const sanitized = params.map(p => p === undefined ? null : p);
                            const [rows] = await connection.execute(normalizeSchema(sql, 'mysql'), sanitized);
                            return rows;
                        } catch (err) {
                            console.error('[DB] MySQL All Error:', err.message, '| SQL:', sql);
                            throw err;
                        }
                    },
                    run: async (sql, ...params) => {
                        try {
                            const sanitized = params.map(p => p === undefined ? null : p);
                            const [result] = await connection.execute(normalizeSchema(sql, 'mysql'), sanitized);
                            return { lastID: result.insertId, changes: result.affectedRows };
                        } catch (err) {
                            console.error('[DB] MySQL Run Error:', err.message, '| SQL:', sql);
                            throw err;
                        }
                    },
                    exec: async (sql) => {
                        return await connection.query(normalizeSchema(sql, 'mysql'));
                    },
                    close: () => connection.end()
                };
            } else {
                const dbPath = process.env.DB_PATH || './data/database.sqlite';
                const dbDir = path.dirname(path.resolve(__dirname, '..', dbPath));

                if (!fs.existsSync(dbDir)) {
                    fs.mkdirSync(dbDir, { recursive: true });
                }

                db = await open({
                    filename: path.resolve(__dirname, '..', dbPath),
                    driver: sqlite3.Database
                });

                const postersDir = path.join(dbDir, 'posters');
                if (!fs.existsSync(postersDir)) fs.mkdirSync(postersDir, { recursive: true });

                const avatarsDir = path.join(dbDir, 'avatars');
                if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });

                await db.exec('PRAGMA journal_mode = WAL;');
                await db.exec('PRAGMA busy_timeout = 10000;');
            }

            // Cleanup duplicates for folder_name
            try {
                if (config.dbType === 'mysql') {
                    await db.exec(`
                        UPDATE series s1
                        JOIN (
                            SELECT id, ROW_NUMBER() OVER (PARTITION BY folder_name ORDER BY (id NOT LIKE 'local-%') DESC, created_at ASC) as rn
                            FROM series
                            WHERE folder_name IS NOT NULL AND folder_name != ''
                        ) s2 ON s1.id = s2.id
                        SET s1.folder_name = NULL
                        WHERE s2.rn > 1;
                    `);
                } else {
                    await db.exec(`
                        UPDATE series SET folder_name = NULL 
                        WHERE id NOT IN (
                            SELECT id FROM (
                                SELECT id, ROW_NUMBER() OVER (PARTITION BY folder_name ORDER BY (id NOT LIKE 'local-%') DESC, created_at ASC) as rn
                                FROM series
                                WHERE folder_name IS NOT NULL AND folder_name != ''
                            ) t WHERE t.rn = 1
                        ) AND folder_name IS NOT NULL;
                    `);
                }
            } catch (cleanupErr) {
                console.warn('[DB] Duplicate folder_name cleanup failed:', cleanupErr.message);
            }

            const normalizedSql = normalizeSchema(SCHEMA, config.dbType || 'sqlite');
            const statements = normalizedSql.split(';').filter(s => s.trim().length > 0);
            for (const s of statements) {
                try {
                    await db.exec(s + ';');
                } catch (e) {
                    const msg = e.message.toLowerCase();
                    if (msg.includes('already exists') || msg.includes('duplicate key') || msg.includes('duplicate column') || msg.includes('duplicate entry')) {
                        continue;
                    }
                    if (e.code === 'ER_DUP_KEYNAME' || e.code === 'ER_TABLE_EXISTS_ERROR' || e.code === 'ER_DUP_FIELDNAME') {
                        continue;
                    }
                    console.error("[DB] Error executing statement:", s.substring(0, 50), e.message);
                    if (msg.includes('syntax error') || e.code === 'ER_PARSE_ERROR') {
                        throw e;
                    }
                }
            }

            // Persistence directories for MySQL (SQLite handles its own above)
            if (config.dbType === 'mysql') {
                const baseDir = path.join(__dirname, '..', 'data');
                ['posters', 'avatars'].forEach(subdir => {
                    const p = path.join(baseDir, subdir);
                    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
                });
            }

            const rolesCount = await db.get('SELECT COUNT(*) as count FROM roles');
            if (rolesCount.count === 0) {
                await db.run('INSERT INTO roles (name, description) VALUES (?, ?)', 'admin', 'Full access');
                await db.run('INSERT INTO roles (name, description) VALUES (?, ?)', 'contributor', 'Can manage content');
                await db.run('INSERT INTO roles (name, description) VALUES (?, ?)', 'user', 'Standard user');

                const perms = [
                    ['access:admin', 'Full administrative access'],
                    ['content:download', 'Can trigger downloads'],
                    ['content:subscribe', 'Can manage subscriptions'],
                    ['content:suggest', 'Can suggest new anime'],
                    ['mod:approve-suggestions', 'Can approve/reject suggestions'],
                    ['sys:view-logs', 'Can view audit logs'],
                    ['sys:manage-users', 'Can manage users and roles'],
                    ['sys:view-storage', 'Can view system telemetry']
                ];
                for (const [slug, desc] of perms) {
                    await db.run('INSERT INTO permissions (slug, description) VALUES (?, ?)', slug, desc);
                }

                const allPerms = await db.all('SELECT id, slug FROM permissions');
                const adminRole = await db.get('SELECT id FROM roles WHERE name = "admin"');
                const colabRole = await db.get('SELECT id FROM roles WHERE name = "contributor"');
                const userRole = await db.get('SELECT id FROM roles WHERE name = "user"');

                // Mapping
                for (const p of allPerms) {
                    // Admin gets everything
                    await db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', adminRole.id, p.id);

                    // Contributor mapping
                    if (['content:download', 'content:subscribe', 'content:suggest', 'mod:approve-suggestions', 'sys:view-storage'].includes(p.slug)) {
                        await db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', colabRole.id, p.id);
                    }

                    // User mapping
                    if (['content:suggest'].includes(p.slug)) {
                        await db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', userRole.id, p.id);
                    }
                }
            }

            // Initial Stock Avatars
            const stockCount = await db.get('SELECT COUNT(*) as count FROM stock_avatars');
            if (stockCount.count === 0) {
                const defaults = [
                    ['Boy 1', '/avatars/stock/boy1.png', 'men'],
                    ['Girl 1', '/avatars/stock/girl1.png', 'women'],
                    ['Cyborg', '/avatars/stock/cyborg.png', 'sci-fi']
                ];
                for (const [name, url, cat] of defaults) {
                    await db.run('INSERT INTO stock_avatars (name, url, category) VALUES (?, ?, ?)', name, url, cat);
                }
            }

            dbInstance = db;
            return db;
        } catch (error) {
            dbPromise = null;
            throw error;
        }
    })();
    return dbPromise;
}

module.exports = { setupDb };

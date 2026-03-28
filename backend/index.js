require('dotenv').config();
const os = require('os');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { setupDb } = require('./db');
const CliService = require('./services/cli');
const packageJson = require('./package.json');
const corePackageJson = require('./multi-downloader-nx/package.json');

const appVersion = packageJson.version;
const coreVersion = corePackageJson.version;
const libraryService = require('./services/library');
const catalogService = require('./services/catalog');
const ConfigService = require('./services/config');
const archiveService = require('./services/archive');
const anilistService = require('./services/anilist');
const tmdbService = require('./services/tmdb');
const tvdbService = require('./services/tvdb');
const anidbService = require('./services/anidb');
const SubscriptionService = require('./services/subscription');
const systemService = require('./services/system');
const setupService = require('./services/setup');
const encodingPresets = require('./constants/presets');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Setup Middleware: Only allow /api/setup if not installed
app.use(async (req, res, next) => {
    if (req.path.startsWith('/api/setup')) return next();
    if (req.path.startsWith('/api/system/browse')) return next();
    if (req.path.startsWith('/health')) return next();

    const isInstalled = await setupService.isInstalled();
    if (!isInstalled && req.path.startsWith('/api')) {
        return res.status(418).json({ needsSetup: true });
    }
    next();
});

// Path for data storage (posters, avatars, etc.)
const avatarsDir = path.join(__dirname, '..', 'data', 'avatars');

if (!fs.existsSync(avatarsDir)) {
    fs.mkdirSync(avatarsDir, { recursive: true });
}

app.use('/avatars', express.static(avatarsDir));

// Multer Config for Avatars
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, avatarsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `avatar-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only images allowed'));
    }
});

const JWT_SECRET = process.env.JWT_SECRET || 'crunchy-downloader-secret-key-1337';

// Middleware to authenticate JWT
const authenticate = (req, res, next) => {
    // Skip auth for health, login, public resources and posters
    // Since this middleware is used with app.use('/api', authenticate),
    // the req.path is relative to /api (e.g., /auth/login, /stock-avatars)
    if (req.path === '/health' ||
        req.path === '/version' ||
        req.path === '/auth/login' ||
        req.path === '/setup/status' ||
        req.path === '/setup/install' ||
        req.path === '/stock-avatars' ||
        req.path === '/config/presets' ||
        req.path === '/system/browse' ||
        req.path.includes('/poster')) {
        return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};

// Middleware to check for Admin role
const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        return next();
    }
    res.status(403).json({ error: 'Requires Admin role' });
};

// Middleware to check for Contributor or Admin role
const isContributor = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'contributor')) {
        return next();
    }
    res.status(403).json({ error: 'Requires Contributor or Admin role' });
};

// New Middleware: Check Granular Permission
const hasPermission = (slug) => async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (req.user.role === 'admin') return next(); // Administrator bypass

    try {
        const db = await setupDb();
        const hasPerm = await db.get(`
            SELECT 1 FROM role_permissions rp
            JOIN permissions p ON rp.permission_id = p.id
            JOIN users u ON u.role_id = rp.role_id
            WHERE u.id = ? AND p.slug = ?
        `, req.user.id, slug);

        if (hasPerm) return next();
        res.status(403).json({ error: `Requires permission: ${slug}` });
    } catch (err) {
        res.status(500).json({ error: 'Authorization error' });
    }
};

// Helper: Add entry to audit log
async function addAuditLog(req, action, target, details = null) {
    try {
        const db = await setupDb();
        const userId = req.user ? req.user.id : null;
        const username = req.user ? req.user.username : 'SYSTEM';

        // Purge sensitive data from details before logging
        let safeDetails = details;
        if (details && typeof details === 'object') {
            const { password, token, secret, key, password_hash, ...rest } = details;
            safeDetails = rest;
        }

        await db.run(
            'INSERT INTO audit_logs (user_id, username, action, target, details) VALUES (?, ?, ?, ?, ?)',
            userId, username, action, target, safeDetails ? JSON.stringify(safeDetails) : null
        );
    } catch (err) {
        console.error('Audit Log Error:', err);
    }
}

// Serve static frontend in production
if (process.env.NODE_ENV === 'production' || true) {
    app.use(express.static(path.join(__dirname, 'public')));
}

// Apply authentication to all /api routes except login
app.use('/api', authenticate);
app.use(morgan('dev'));

// Auth Endpoints
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    console.log(`Login attempt for: ${username}`);
    try {
        const db = await setupDb();
        let user;
        try {
            user = await db.get('SELECT id, username, role, password_hash, full_name, avatar_url, bio, must_change_password FROM users WHERE username = ?', username);
        } catch (e) {
            console.warn('[Login] Extended columns missing, falling back to basic select:', e.message);
            user = await db.get('SELECT id, username, role, password_hash FROM users WHERE username = ?', username);
        }

        if (!user) {
            console.log(`Login FAILED: User ${username} not found`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            console.log(`Login FAILED: Wrong password for ${username}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        console.log(`Login SUCCESS: ${username}`);

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, must_change_password: !!user.must_change_password },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                full_name: user.full_name || null,
                avatar_url: user.avatar_url || null,
                bio: user.bio || null,
                must_change_password: !!user.must_change_password
            }
        });
    } catch (err) {
        console.error('[Login] Critical login error:', err.message);
        res.status(500).json({ error: 'Login failed due to server error' });
    }
});

app.get('/api/auth/me', async (req, res) => {
    try {
        const db = await setupDb();
        let user;
        try {
            user = await db.get('SELECT id, username, role, must_change_password, full_name, avatar_url FROM users WHERE id = ?', req.user.id);
        } catch (e) {
            console.warn('[AuthMe] Extended columns missing, falling back to basic select:', e.message);
            user = await db.get('SELECT id, username, role FROM users WHERE id = ?', req.user.id);
        }

        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json({
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                must_change_password: !!user.must_change_password,
                full_name: user.full_name || null,
                avatar_url: user.avatar_url || null
            }
        });
    } catch (err) {
        console.error('[AuthMe] Critical session verify error:', err.message);
        res.status(500).json({ error: 'Auth initialization failed' });
    }
});

app.post('/api/auth/change-password', authenticate, async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) {
        return res.status(400).json({ error: 'Password too short' });
    }

    const db = await setupDb();
    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);

        await db.run(
            'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
            hash, req.user.id
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin User Management Endpoints
app.get('/api/admin/users', authenticate, hasPermission('sys:manage-users'), async (req, res) => {
    try {
        const db = await setupDb();
        const users = await db.all('SELECT id, username, role, must_change_password FROM users');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/users', authenticate, hasPermission('sys:manage-users'), async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

    try {
        const db = await setupDb();
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        await db.run(
            'INSERT INTO users (username, password_hash, role, must_change_password) VALUES (?, ?, ?, 1)',
            username, hash, role || 'user'
        );
        addAuditLog(req, 'USER_CREATE', username, { role: role || 'user' });
        res.json({ message: 'User created successfully' });
    } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username already exists' });
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/users/:id', authenticate, hasPermission('sys:manage-users'), async (req, res) => {
    const { role, must_change_password } = req.body;
    try {
        const db = await setupDb();
        const targetUser = await db.get('SELECT username FROM users WHERE id = ?', req.params.id);
        await db.run(
            'UPDATE users SET role = ?, must_change_password = ? WHERE id = ?',
            role, must_change_password ? 1 : 0, req.params.id
        );
        if (targetUser) {
            addAuditLog(req, 'USER_UPDATE', targetUser.username, { role, must_change_password: !!must_change_password });
        }
        res.json({ message: 'User updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/users/:id', authenticate, hasPermission('sys:manage-users'), async (req, res) => {
    if (parseInt(req.params.id) === req.user.id) {
        return res.status(400).json({ error: 'Cannot delete yourself' });
    }
    try {
        const db = await setupDb();
        const targetUser = await db.get('SELECT username FROM users WHERE id = ?', req.params.id);
        await db.run('DELETE FROM users WHERE id = ?', req.params.id);
        if (targetUser) {
            addAuditLog(req, 'USER_DELETE', targetUser.username);
        }
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



// System Info
app.get('/api/system/info', (req, res) => {
    res.json({
        cpus: os.cpus().length,
        totalMem: Math.round(os.totalmem() / (1024 * 1024 * 1024)), // GB
        freeMem: Math.round(os.freemem() / (1024 * 1024 * 1024)), // GB
        platform: os.platform(),
        release: os.release()
    });
});

// Services
let cliServiceInstance;
let libServiceInstance;
let configService;
let subService;

// Catalog Routes
app.get('/api/seasonal', async (req, res) => {
    try {
        const { year, season } = req.query;
        console.log(`[Backend] Seasonal request for ${year} ${season}`);
        if (!year || !season) return res.status(400).json({ error: 'Year and season are required' });
        const items = await catalogService.getSeasonalCatalog(year, season.toLowerCase());
        res.json(items);
    } catch (error) {
        console.error('[Backend] Seasonal Catalog error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/catalog/series/:id', async (req, res) => {
    try {
        if (req.params.id.startsWith('al-')) {
            const details = await anilistService.getSeriesDetails(req.params.id);
            return res.json(details);
        }
        const details = await catalogService.getSeriesDetails(req.params.id);
        res.json(details);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/catalog/season/:id/episodes', async (req, res) => {
    try {
        if (req.params.id.startsWith('al-s-')) {
            const episodes = await anilistService.getEpisodes(req.params.id);
            return res.json(episodes);
        }
        const episodes = await catalogService.getEpisodes(req.params.id);
        res.json(episodes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/search', authenticate, async (req, res) => {
    const { service, query } = req.body;
    try {
        let results = [];
        if (service === 'crunchy') {
            results = await catalogService.searchSeries(query);
        } else if (service === 'anilist') {
            results = await anilistService.searchSeries(query);
        } else if (service === 'tmdb') {
            const db = await setupDb();
            results = await tmdbService.searchSeries(query, db);
        } else if (service === 'tvdb') {
            const db = await setupDb();
            results = await tvdbService.searchSeries(query, db);
        } else {
            results = await catalogService.searchSeries(query);
        }
        res.json(results);
    } catch (e) {
        console.error('Search error:', e);
        res.status(500).json({ error: 'Failed to perform search' });
    }
});

// NEW: Missing Catalog routes for Web UI
app.get('/api/catalog/browse', authenticate, async (req, res) => {
    const { sort, n, start } = req.query;
    try {
        const items = await catalogService.getBrowseCatalog({
            sort: sort || 'popularity',
            n: n ? parseInt(n) : 100,
            start: start ? parseInt(start) : 0
        });
        res.json(items);
    } catch (e) {
        console.error('Browse catalog error:', e);
        res.status(500).json({ error: 'Failed to fetch browse catalog' });
    }
});

app.get('/api/series/:id/details', authenticate, async (req, res) => {
    try {
        const details = await catalogService.getSeriesDetails(req.params.id);
        const db = await setupDb();
        const localSeries = await db.get('SELECT lib_path, folder_name FROM series WHERE id = ? OR crunchyroll_id = ?', req.params.id, req.params.id);
        if (localSeries) {
            details.lib_path = localSeries.lib_path;
            details.folder_name = localSeries.folder_name;
        }
        res.json(details);
    } catch (e) {
        console.error('Get series details error:', e);
        res.status(500).json({ error: 'Failed to fetch series details' });
    }
});

app.get('/api/seasons/:id/episodes', authenticate, async (req, res) => {
    try {
        const episodes = await catalogService.getEpisodes(req.params.id);
        res.json(episodes);
    } catch (e) {
        console.error('Get episodes error:', e);
        res.status(500).json({ error: 'Failed to fetch episodes' });
    }
});

app.get('/api/series/:id/episodes-status', authenticate, async (req, res) => {
    try {
        const title = req.query.title;
        const status = await libServiceInstance.getSeriesEpisodesStatus(req.params.id, title);
        res.json(status);
    } catch (e) {
        console.error('Get episodes status error:', e);
        res.status(500).json({ error: 'Failed to fetch episodes status' });
    }
});

app.patch('/api/episodes/:id/status', authenticate, async (req, res) => {
    const { isDownloaded } = req.body;
    try {
        const db = await setupDb();
        await db.run('UPDATE episodes SET is_downloaded = ? WHERE id = ?', isDownloaded ? 1 : 0, req.params.id);
        res.json({ success: true });
    } catch (e) {
        console.error('Update episode status error:', e);
        res.status(500).json({ error: 'Failed to update episode status' });
    }
});

app.get('/api/auth/status', async (req, res) => {
    try {
        const status = await catalogService.getAuthStatus();
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/catalog/login', async (req, res) => {
    console.log('[Catalog] Crunchyroll Login request received');
    const { username, password, token } = req.body;
    if (!token && (!username || !password)) {
        return res.status(400).json({ error: 'Username/Password or Token required' });
    }
    try {
        const result = await catalogService.login(req.body);
        res.json(result);
    } catch (err) {
        res.status(401).json({ error: err.message });
    }
});

// Library Routes
app.get('/api/library/series', async (req, res) => {
    try {
        const items = await libServiceInstance.getSeries(req.query.filter);
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/library/series/:id', async (req, res) => {
    try {
        const details = await libServiceInstance.getSeriesFullDetails(req.params.id);
        if (!details) return res.status(404).json({ error: 'Series not found' });
        res.json(details);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/library/episode/delete', async (req, res) => {
    const { episodeId } = req.body;
    try {
        const success = await libServiceInstance.deleteEpisode(episodeId);
        res.json({ success });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/library/scan', async (req, res) => {
    try {
        await libServiceInstance.scan();
        res.json({ status: 'Scan started' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/library/rescan-mismatched', async (req, res) => {
    try {
        await libServiceInstance.refreshAllMismatched();
        res.json({ status: 'Bulk refresh started' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/library/series/:id/refresh', async (req, res) => {
    try {
        const { searchQuery } = req.body;
        const series = await libServiceInstance.refreshSeriesMetadata(req.params.id, searchQuery);
        res.json(series);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/library/search-matches', async (req, res) => {
    try {
        const results = await libServiceInstance.searchMetadataMatches(req.query.q);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/library/series/:id/status', async (req, res) => {
    try {
        const status = await libServiceInstance.getSeriesEpisodesStatus(req.params.id);
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/library/series/:id', async (req, res) => {
    try {
        await libServiceInstance.deleteSeries(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/library/series/:id/rebind', async (req, res) => {
    try {
        console.log(`Rebind requested for ${req.params.id} to content:`, JSON.stringify(req.body));
        const series = await libServiceInstance.rebindSeries(req.params.id, req.body.match);
        res.json(series);
    } catch (err) {
        console.error('Rebind error:', err);
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

app.get('/api/library/orphaned', async (req, res) => {
    try {
        const paths = await libServiceInstance.getOrphanedPaths();
        res.json(paths);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/library/bulk-rebind', async (req, res) => {
    try {
        const { mapping } = req.body;
        if (!mapping) return res.status(400).json({ error: 'Mapping required' });
        await libServiceInstance.rebindLibraryPaths(mapping);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/settings/library-roots', async (req, res) => {
    try {
        const db = await setupDb();
        const setting = await db.get('SELECT value FROM settings WHERE `key` = ?', 'library_roots');
        const roots = setting && setting.value ? JSON.parse(setting.value) : [];
        res.json(roots);
    } catch (err) {
        console.error('[API] GET /api/settings/library-roots ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/settings/library-roots', async (req, res) => {
    try {
        const { roots } = req.body;
        if (!Array.isArray(roots)) return res.status(400).json({ error: 'Array of roots required' });
        const db = await setupDb();
        await db.run('INSERT INTO settings (`key`, value) VALUES (?, ?) ON CONFLICT(`key`) DO UPDATE SET value = excluded.value', 'library_roots', JSON.stringify(roots));
        if (typeof libServiceInstance !== 'undefined' && libServiceInstance) {
            await libServiceInstance.updateLibraryPaths();
        }
        res.json({ success: true });
    } catch (err) {
        console.error('[API] POST /api/settings/library-roots ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/system/browse', async (req, res) => {
    try {
        const { path } = req.query;
        const result = await systemService.listDirectories(path);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/library/episodes/:id', async (req, res) => {
    try {
        const success = await libServiceInstance.deleteEpisode(req.params.id);
        res.json({ success });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/episodes/:id', authenticate, async (req, res) => {
    try {
        const success = await libServiceInstance.deleteEpisode(req.params.id);
        res.json({ success });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/library/config/volumes', async (req, res) => {
    try {
        const paths = libServiceInstance.getLibraryPaths();
        res.json(paths);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/library/series/:id/location', async (req, res) => {
    try {
        const details = await libServiceInstance.getSeriesFullDetails(req.params.id);
        res.json({ full_path: details ? details.full_path : null });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/archive/status', (req, res) => {
    const { service, type, id, episode } = req.query;
    if (!service || !type || !id || !episode) return res.status(400).json({ error: 'Missing parameters' });
    const downloaded = archiveService.isDownloaded(service, type, id, episode);
    res.json({ downloaded });
});

app.post('/api/archive/toggle', (req, res) => {
    const { service, type, id, episode } = req.body;
    if (!service || !type || !id || !episode) return res.status(400).json({ error: 'Missing parameters' });
    const success = archiveService.toggle(service, type, id, episode);
    res.json({ success });
});

app.post('/api/library/series/:id/approve', async (req, res) => {
    try {
        await libServiceInstance.approveSeries(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/library/series/:id/poster', async (req, res) => {
    try {
        const seriesId = req.params.id;
        const postersDir = path.resolve(__dirname, '..', 'data', 'posters');
        const db = await setupDb();
        const series = await db.get('SELECT crunchyroll_id, image FROM series WHERE id = ?', seriesId);

        // 1. Discovery by ID or CR alias (filenames like tmdb-XXXX.jpg or GXXXX.jpg)
        const possibleIds = [seriesId];
        if (series && series.crunchyroll_id) possibleIds.push(series.crunchyroll_id);

        for (const pid of possibleIds) {
            const possibleFiles = [`${pid}.jpg`, `${pid}.png`, `${pid}.webp`];
            for (const file of possibleFiles) {
                const filePath = path.join(postersDir, file);
                if (fs.existsSync(filePath)) return res.sendFile(path.resolve(filePath));
            }
        }

        // 1.5 Fallback for Suggestions (if not in series table)
        const suggestion = await db.get('SELECT image FROM suggestions WHERE series_id = ?', seriesId);
        if (suggestion && suggestion.image) {
            if (suggestion.image.startsWith('http')) return res.redirect(suggestion.image);

            const fileName = path.basename(suggestion.image);
            const filePath = path.join(postersDir, fileName);
            if (fs.existsSync(filePath)) return res.sendFile(path.resolve(filePath));
        }

        // 2. Fetch from DB (handles both relative and absolute paths)
        if (series && series.image) {
            if (series.image.startsWith('http')) return res.redirect(series.image);

            // Get just the filename in case the DB has a hardcoded Docker path (/app/data/...)
            const fileName = path.basename(series.image);
            const filePath = path.join(postersDir, fileName);
            if (fs.existsSync(filePath)) return res.sendFile(path.resolve(filePath));
        }

        // 3. Fallback for AniList IDs
        if (seriesId.startsWith('al-')) {
            try {
                const details = await anilistService.getSeriesDetails(seriesId);
                if (details && details.image) return res.redirect(details.image);
            } catch (e) { }
        }

        // 4. Fallback for local folders (look for poster.jpg, folder.jpg in the directory)
        if (seriesId.startsWith('local-') || (series && !series.image)) {
            try {
                const details = await libServiceInstance.getSeriesFullDetails(seriesId);
                if (details && details.full_path) {
                    const localPossible = ['poster.jpg', 'poster.png', 'folder.jpg', 'folder.png', 'cover.jpg', 'cover.png'];
                    for (const fileName of localPossible) {
                        const localPath = path.join(details.full_path, fileName);
                        if (fs.existsSync(localPath)) return res.sendFile(path.resolve(localPath));
                    }
                }
            } catch (e) { }
        }

        // 5. Final fallback - Placeholder
        const fallbackPath = path.resolve(__dirname, 'multi-downloader-nx', 'gui', 'react', 'public', 'notFound.png');
        if (fs.existsSync(fallbackPath)) {
            return res.sendFile(fallbackPath);
        }

        res.status(404).send('Poster not found');
    } catch (err) {
        console.error('[Poster] Error serving image:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/library/series/:id/rebind', authenticate, async (req, res) => {
    try {
        const { match } = req.body;
        if (!match || !match.id) return res.status(400).json({ error: 'Missing match details' });

        await libServiceInstance.rebindSeries(req.params.id, match);
        res.json({ success: true });
    } catch (err) {
        console.error('[Rebind] Error rebinding series:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/library/series/:id/update-image', async (req, res) => {
    try {
        const imageUrl = await libServiceInstance.updateSeriesImage(req.params.id, req.body.image);
        res.json({ success: true, image: imageUrl });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Subscription Endpoints
app.get('/api/subscriptions', async (req, res) => {
    try {
        const subs = await subService.getSubscriptions();
        res.json(subs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/subscriptions', async (req, res) => {
    const { seriesId, title, nextEpisode, releaseDay, releaseTime, rootPath } = req.body;
    try {
        await subService.subscribe(seriesId, title, nextEpisode, releaseDay, releaseTime, rootPath);
        addAuditLog(req, 'SUBSCRIPTION_ADD', title);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/subscriptions/:id', async (req, res) => {
    try {
        const db = await setupDb();
        const sub = await db.get('SELECT title FROM subscriptions WHERE id = ?', req.params.id);
        await subService.unsubscribe(req.params.id);
        if (sub) {
            addAuditLog(req, 'SUBSCRIPTION_DELETE', sub.title);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Downloads Management
app.get('/api/downloads', authenticate, async (req, res) => {
    try {
        const db = await setupDb();
        const items = await db.all(`
            SELECT d.*, COALESCE(s.image, d.thumbnail) as thumbnail 
            FROM downloads d
            LEFT JOIN series s ON d.show_id = s.id
            ORDER BY 
                CASE 
                    WHEN d.status = 'downloading' THEN 0 
                    WHEN d.status = 'encoding' THEN 1 
                    WHEN d.status = 'queued' THEN 2 
                    WHEN d.status = 'pending' THEN 3
                    ELSE 4 
                END, 
                d.name ASC, 
                d.id ASC
        `);
        const stats = await db.get('SELECT AVG(encoding_time) as avgTime FROM downloads WHERE encoding_time IS NOT NULL');
        res.json({
            items,
            avgEncodingTime: Math.round(stats.avgTime || 0)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/downloads', authenticate, hasPermission('content:download'), async (req, res) => {
    const { name, service, show_id, season_id, season_number, episodes = 'all', rootPath, image, force } = req.body;

    let episodeList = (episodes !== 'all' && typeof episodes === 'string' && episodes.includes(','))
        ? episodes.split(',').map(e => e.trim())
        : (Array.isArray(episodes) ? episodes : [episodes]);

    if (episodes !== 'all') {
        episodeList.sort((a, b) => {
            const numA = parseFloat(a.toString().replace(/[^\d.]/g, '')) || 0;
            const numB = parseFloat(b.toString().replace(/[^\d.]/g, '')) || 0;
            return numA - numB;
        });
    }

    const ids = [];
    for (const ep of episodeList) {
        let taskName = name;
        if (ep !== 'all') {
            const sStr = season_number ? `S${season_number} ` : '';
            taskName = `${name} - ${sStr}E${ep}`;
        }

        const taskId = await cliServiceInstance.addDownload({
            name: taskName,
            service,
            show_id,
            season_id,
            season_number,
            episodes: ep,
            rootPath,
            triggeredBy: req.user.username,
            image,
            force
        });
        ids.push(taskId);
    }
    addAuditLog(req, 'DOWNLOAD_START', name, { episodes });
    res.json({ ids });
});

app.delete('/api/downloads/:id', authenticate, hasPermission('sys:manage-users'), async (req, res) => {
    try {
        const success = await cliServiceInstance.deleteDownload(parseInt(req.params.id));
        res.json({ success });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/downloads/clear-finished', authenticate, hasPermission('sys:manage-users'), async (req, res) => {
    try {
        const success = await cliServiceInstance.clearFinished();
        res.json({ success });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/downloads/queue-status', authenticate, async (req, res) => {
    res.json({ paused: cliServiceInstance.isQueuePaused });
});

app.post('/api/downloads/pause', authenticate, hasPermission('content:download'), async (req, res) => {
    await cliServiceInstance.pauseQueue();
    res.json({ success: true });
});

app.post('/api/downloads/resume', authenticate, hasPermission('content:download'), async (req, res) => {
    await cliServiceInstance.resumeQueue();
    res.json({ success: true });
});

// Versioning
app.get('/api/version', (req, res) => {
    res.json({
        version: appVersion,
        coreVersion: coreVersion
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Final blocks... 

app.post('/api/library/episodes/:id/toggle-downloaded', async (req, res) => {
    const { id } = req.params;
    const db = await setupDb();
    try {
        await db.run('UPDATE episodes SET is_downloaded = 1 - is_downloaded WHERE id = ?', id);
        res.json({ success: true });
    } catch (err) {
        console.error('Error toggling episode status:', err);
        res.status(500).json({ error: 'Failed to toggle status' });
    }
});

// Serve library series...

app.get('/api/library/series', authenticate, async (req, res) => {
    try {
        const db = await setupDb();
        const series = await db.all('SELECT * FROM series ORDER BY title ASC');
        res.json(series);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/library/series/:id', authenticate, async (req, res) => {
    try {
        const db = await setupDb();
        const series = await db.get('SELECT * FROM series WHERE id = ?', req.params.id);
        if (!series) return res.status(404).json({ error: 'Series not found' });

        const seasons = await db.all('SELECT * FROM seasons WHERE series_id = ? ORDER BY season_number ASC', series.id);
        for (const s of seasons) {
            s.episodes = await db.all('SELECT * FROM episodes WHERE season_id = ? ORDER BY episode_number ASC', s.id);
        }
        series.seasons = seasons;
        res.json(series);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serving library metadata...

// Config Routes
app.get('/api/config/muxing', authenticate, hasPermission('sys:manage-users'), async (req, res) => {
    try {
        const config = await configService.getMuxingConfig();
        res.json(config);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/config/muxing', authenticate, hasPermission('sys:manage-users'), async (req, res) => {
    try {
        await configService.updateMuxingConfig(req.body);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/config/metadata-language', authenticate, async (req, res) => {
    try {
        const db = await setupDb();
        const setting = await db.get('SELECT value FROM settings WHERE `key` = ?', 'metadata_language');
        res.json({ language: setting ? setting.value : 'en-US' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/config/metadata-language', authenticate, hasPermission('sys:manage-users'), async (req, res) => {
    try {
        const { language } = req.body;
        const db = await setupDb();
        await db.run('INSERT OR REPLACE INTO settings (`key`, value) VALUES (?, ?)', 'metadata_language', language);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/downloads/:id/retry', async (req, res) => {
    try {
        const success = await cliServiceInstance.retryDownload(parseInt(req.params.id));
        res.json({ success });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Suggestions Endpoints
app.get('/api/suggestions', authenticate, hasPermission('mod:approve-suggestions'), async (req, res) => {
    try {
        const db = await setupDb();
        const suggestions = await db.all(`
            SELECT s.*, u.username as suggested_by 
            FROM suggestions s 
            JOIN users u ON s.user_id = u.id 
            ORDER BY s.created_at DESC
        `);
        res.json(suggestions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/suggestions', authenticate, async (req, res) => {
    const { series_id, title, image } = req.body;
    if (!series_id || !title) return res.status(400).json({ error: 'Missing parameters' });
    try {
        const db = await setupDb();
        await db.run(
            'INSERT INTO suggestions (user_id, series_id, title, image) VALUES (?, ?, ?, ?)',
            req.user.id, series_id, title, image
        );

        // Download poster asynchronously so it's available on the dashboard
        if (image && image.startsWith('http') && libServiceInstance) {
            libServiceInstance._downloadPoster(image, series_id).catch(e => {
                console.error('[Suggestions] Poster download failed:', e.message);
            });
        }

        addAuditLog(req, 'SUGGESTION_ADD', title);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/suggestions/:id', authenticate, hasPermission('mod:approve-suggestions'), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // approved, rejected
    try {
        const db = await setupDb();
        const suggestion = await db.get('SELECT s.*, u.username FROM suggestions s JOIN users u ON s.user_id = u.id WHERE s.id = ?', id);
        if (!suggestion) return res.status(404).json({ error: 'Suggestion not found' });

        await db.run('UPDATE suggestions SET status = ? WHERE id = ?', status, id);

        if (status === 'approved') {
            // Trigger download
            await cliServiceInstance.addDownload({
                name: suggestion.title,
                service: 'crunchy',
                show_id: suggestion.series_id,
                episodes: 'all',
                triggeredBy: suggestion.username, // User who suggested it
                image: suggestion.image
            });
        }
        addAuditLog(req, status === 'approved' ? 'SUGGESTION_APPROVE' : 'SUGGESTION_REJECT', suggestion.title);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/config/muxing', authenticate, hasPermission('sys:manage-users'), async (req, res) => {
    try {
        const config = await configService.updateMuxingConfig(req.body);
        res.json(config);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/config/presets', async (req, res) => {
    try {
        const db = await setupDb();
        const presets = await db.all('SELECT * FROM presets ORDER BY `group` ASC, name ASC');
        res.json(presets);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/config/presets', authenticate, hasPermission('sys:manage-users'), async (req, res) => {
    const { id, name, codec, resolution, fps, crf, group } = req.body;
    try {
        const db = await setupDb();
        // MySQL ON DUPLICATE KEY UPDATE / SQLite ON CONFLICT handled by normalizeSchema
        await db.run(
            'INSERT INTO presets (id, name, codec, resolution, fps, crf, `group`) VALUES (?, ?, ?, ?, ?, ?, ?) ' +
            'ON CONFLICT(id) DO UPDATE SET name=excluded.name, codec=excluded.codec, resolution=excluded.resolution, fps=excluded.fps, crf=excluded.crf, `group`=excluded.group',
            id, name, codec, resolution, fps, crf, group
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/config/presets/:id', authenticate, hasPermission('sys:manage-users'), async (req, res) => {
    try {
        const db = await setupDb();
        await db.run('DELETE FROM presets WHERE id = ?', req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/system/storage', authenticate, async (req, res) => {
    try {
        const volumes = libServiceInstance.getLibraryPaths();
        if (!volumes || volumes.length === 0) return res.json([]);
        
        const stats = await Promise.all(volumes.map(async (v) => {
            const rootPath = typeof v === 'string' ? v : v.path;
            const diskInfo = await systemService.getDiskSpace(rootPath);
            return {
                ...diskInfo,
                name: typeof v === 'string' ? path.basename(v) : v.name,
                path: rootPath
            };
        }));
        res.json(stats);
    } catch (err) {
        console.error('Storage info error:', err);
        res.status(500).json({ error: 'Failed to fetch storage info' });
    }
});

app.get('/api/system/logs', authenticate, hasPermission('sys:view-logs'), async (req, res) => {
    try {
        const db = await setupDb();
        const logs = await db.all('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200');
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/user/dashboard', authenticate, async (req, res) => {
    try {
        const db = await setupDb();
        const userId = req.user.id;

        // 1. Stats
        const stats = await db.get(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
            FROM suggestions 
            WHERE user_id = ?
        `, userId);

        // 2. User's Recent Suggestions
        const myRecent = await db.all(`
            SELECT * FROM suggestions 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT 5
        `, userId);

        // 3. Global New Arrivals (Latest added to library)
        const arrivals = await db.all(`
            SELECT * FROM series 
            ORDER BY created_at DESC 
            LIMIT 6
        `);

        // 4. Recent Episodes (Granular latest downloads)
        const recentEpisodes = await db.all(`
            SELECT e.*, s.title as series_title, s.image as series_image
            FROM episodes e
            JOIN series s ON e.series_id = s.id
            WHERE e.downloaded_at IS NOT NULL
            ORDER BY e.downloaded_at DESC
            LIMIT 6
        `);

        res.json({
            stats: {
                total: stats.total || 0,
                approved: stats.approved || 0,
                pending: stats.pending || 0
            },
            recentSuggestions: myRecent,
            newArrivals: arrivals,
            recentEpisodes: recentEpisodes
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// User Profile Endpoints
app.get('/api/user/profile', authenticate, async (req, res) => {
    try {
        const db = await setupDb();
        let user;
        try {
            user = await db.get('SELECT id, username, role, bio, avatar_url, full_name FROM users WHERE id = ?', req.user.id);
        } catch (e) {
            console.warn('[Profile] Error fetching extended profile, falling back to basic data:', e.message);
            user = await db.get('SELECT id, username, role FROM users WHERE id = ?', req.user.id);
        }
        res.json(user);
    } catch (err) {
        console.error('[Profile] Critical auth error:', err.message);
        res.status(500).json({ error: 'Auth initialization failed' });
    }
});

app.post('/api/user/avatar', authenticate, upload.single('avatar'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const avatarUrl = `/avatars/${req.file.filename}`;

    try {
        const db = await setupDb();
        await db.run('UPDATE users SET avatar_url = ? WHERE id = ?', avatarUrl, req.user.id);
        addAuditLog(req, 'AVATAR_UPDATE', 'Custom Avatar', { url: avatarUrl });
        res.json({ url: avatarUrl });
    } catch (err) {
        res.status(500).json({ error: 'Failed to persist avatar' });
    }
});

// Subscription Routes
app.get('/api/subscriptions', authenticate, async (req, res) => {
    try {
        const subs = await subService.getSubscriptions();
        res.json(subs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/subscriptions', authenticate, async (req, res) => {
    const { id, title, nextEpisode, day, time, rootPath } = req.body;
    try {
        await subService.subscribe(id, title, nextEpisode, day, time, rootPath);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/subscriptions/:id', authenticate, async (req, res) => {
    try {
        await subService.unsubscribe(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Configuration & Settings ---

app.get('/api/config/muxing', authenticate, async (req, res) => {
    try {
        const config = await configService.getMuxingConfig();
        const db = await setupDb();
        const tmdbKey = await tmdbService.getApiKey(db);
        const tvdbKey = await tvdbService.getApiKey(db);
        res.json({
            ...config,
            tmdbApiKey: tmdbKey,
            tvdbApiKey: tvdbKey
        });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch config' });
    }
});

app.post('/api/config/muxing', authenticate, async (req, res) => {
    try {
        const newConfig = await configService.updateMuxingConfig(req.body);
        res.json(newConfig);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- System & User Activity ---

app.get('/api/system/info', authenticate, (req, res) => {
    try {
        const cpus = os.cpus().length;
        const totalMem = Math.round(os.totalmem() / (1024 * 1024 * 1024));
        const freeMem = Math.round(os.freemem() / (1024 * 1024 * 1024));
        res.json({
            cpus,
            totalMem,
            freeMem,
            platform: os.platform(),
            release: os.release(),
            uptime: os.uptime(),
            loadavg: os.loadavg()
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/system/storage', authenticate, async (req, res) => {
    try {
        const volumes = libServiceInstance.getLibraryPaths();
        if (!volumes || volumes.length === 0) return res.json([]);
        
        const stats = await Promise.all(volumes.map(async (v) => {
            const rootPath = typeof v === 'string' ? v : v.path;
            const diskInfo = await systemService.getDiskSpace(rootPath);
            return {
                ...diskInfo,
                name: typeof v === 'string' ? path.basename(v) : v.name,
                path: rootPath
            };
        }));
        res.json(stats);
    } catch (err) {
        console.error('Storage info error:', err);
        res.status(500).json({ error: 'Failed to fetch storage info' });
    }
});

app.get('/api/system/logs', authenticate, hasPermission('sys:view-logs'), async (req, res) => {
    try {
        const db = await setupDb();
        const logs = await db.all('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200');
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/user/dashboard', authenticate, async (req, res) => {
    try {
        const db = await setupDb();
        const userId = req.user.id;

        const stats = await db.get(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
            FROM suggestions 
            WHERE user_id = ?
        `, userId);

        const myRecent = await db.all(`
            SELECT * FROM suggestions 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT 5
        `, userId);

        const arrivals = await db.all(`
            SELECT * FROM series 
            ORDER BY created_at DESC 
            LIMIT 6
        `);

        const recentEpisodes = await db.all(`
            SELECT e.*, s.title as series_title, s.image as series_image
            FROM episodes e
            JOIN series s ON e.series_id = s.id
            WHERE e.downloaded_at IS NOT NULL
            ORDER BY e.downloaded_at DESC
            LIMIT 6
        `);

        res.json({
            stats: { total: stats.total || 0, approved: stats.approved || 0, pending: stats.pending || 0 },
            recentSuggestions: myRecent,
            newArrivals: arrivals,
            recentEpisodes: recentEpisodes
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/user/profile', authenticate, async (req, res) => {
    try {
        const db = await setupDb();
        let user;
        try {
            user = await db.get('SELECT id, username, role, bio, avatar_url, full_name FROM users WHERE id = ?', req.user.id);
        } catch (e) {
            user = await db.get('SELECT id, username, role FROM users WHERE id = ?', req.user.id);
        }
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Auth initialization failed' });
    }
});

app.post('/api/user/avatar', authenticate, upload.single('avatar'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const avatarUrl = `/avatars/${req.file.filename}`;
    try {
        const db = await setupDb();
        await db.run('UPDATE users SET avatar_url = ? WHERE id = ?', avatarUrl, req.user.id);
        addAuditLog(req, 'AVATAR_UPDATE', 'Custom Avatar', { url: avatarUrl });
        res.json({ url: avatarUrl });
    } catch (err) {
        res.status(500).json({ error: 'Failed to persist avatar' });
    }
});

// Stock Avatars Endpoints
app.get('/api/stock-avatars', async (req, res) => {
    try {
        const db = await setupDb();
        const avatars = await db.all('SELECT * FROM stock_avatars ORDER BY created_at DESC');
        res.json(avatars);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/stock-avatars', authenticate, hasPermission('sys:manage-users'), async (req, res) => {
    const { url, name } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });
    try {
        const db = await setupDb();
        await db.run('INSERT INTO stock_avatars (url, name) VALUES (?, ?)', url, name || 'Stock Avatar');
        await addAuditLog(req, 'STOCK_AVATAR_ADD', url, `Name: ${name}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/stock-avatars/:id', authenticate, hasPermission('sys:manage-users'), async (req, res) => {
    try {
        const db = await setupDb();
        const avatar = await db.get('SELECT url FROM stock_avatars WHERE id = ?', req.params.id);
        await db.run('DELETE FROM stock_avatars WHERE id = ?', req.params.id);
        if (avatar) await addAuditLog(req, 'STOCK_AVATAR_DELETE', avatar.url);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/user/profile', authenticate, async (req, res) => {
    const { username, full_name, bio, avatar_url, password } = req.body;
    try {
        const db = await setupDb();

        // Fetch current user data for fallback
        const currentUser = await db.get('SELECT * FROM users WHERE id = ?', req.user.id);
        if (!currentUser) return res.status(404).json({ error: 'User not found' });

        let query = 'UPDATE users SET full_name = ?, bio = ?, avatar_url = ?';
        let params = [
            full_name !== undefined ? full_name : currentUser.full_name,
            bio !== undefined ? bio : currentUser.bio,
            avatar_url !== undefined ? avatar_url : currentUser.avatar_url
        ];

        if (username) {
            query += ', username = ?';
            params.push(username);
        }

        if (password) {
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash(password, 10);
            query += ', password_hash = ?';
            params.push(hashedPassword);
        }

        query += ' WHERE id = ?';
        params.push(req.user.id);

        await db.run(query, ...params);
        addAuditLog(req, 'PROFILE_UPDATE', req.user.username);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Role Management Endpoints
app.get('/api/admin/roles', authenticate, hasPermission('sys:manage-users'), async (req, res) => {
    try {
        const db = await setupDb();
        const roles = await db.all('SELECT * FROM roles');
        // Fetch permissions for each role
        for (const role of roles) {
            const perms = await db.all(`
                SELECT p.slug FROM role_permissions rp
                JOIN permissions p ON rp.permission_id = p.id
                WHERE rp.role_id = ?
            `, role.id);
            role.permissions = perms.map(p => p.slug);
        }
        res.json(roles);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/permissions', authenticate, hasPermission('sys:manage-users'), async (req, res) => {
    try {
        const db = await setupDb();
        const perms = await db.all('SELECT * FROM permissions');
        res.json(perms);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/roles', authenticate, hasPermission('sys:manage-users'), async (req, res) => {
    const { name, description, permissions } = req.body; // permissions is array of slugs
    try {
        const db = await setupDb();
        const result = await db.run('INSERT INTO roles (name, description) VALUES (?, ?)', name, description);
        const roleId = result.lastID;

        if (permissions && permissions.length > 0) {
            for (const slug of permissions) {
                const perm = await db.get('SELECT id FROM permissions WHERE slug = ?', slug);
                if (perm) {
                    await db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', roleId, perm.id);
                }
            }
        }
        addAuditLog(req, 'ROLE_CREATE', name, { permissions });
        res.json({ id: roleId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/roles/:id', authenticate, hasPermission('sys:manage-users'), async (req, res) => {
    const { name, description, permissions } = req.body;
    try {
        const db = await setupDb();
        await db.run('UPDATE roles SET name = ?, description = ? WHERE id = ?', name, description, req.params.id);

        // Update permissions: clear and re-add
        await db.run('DELETE FROM role_permissions WHERE role_id = ?', req.params.id);
        if (permissions && permissions.length > 0) {
            for (const slug of permissions) {
                const perm = await db.get('SELECT id FROM permissions WHERE slug = ?', slug);
                if (perm) {
                    await db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', req.params.id, perm.id);
                }
            }
        }
        addAuditLog(req, 'ROLE_UPDATE', name, { permissions });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/roles/:id', authenticate, hasPermission('sys:manage-users'), async (req, res) => {
    try {
        const db = await setupDb();
        const role = await db.get('SELECT name FROM roles WHERE id = ?', req.params.id);
        if (role && (role.name === 'admin' || role.name === 'user')) {
            return res.status(400).json({ error: 'Cannot delete system roles' });
        }
        await db.run('DELETE FROM roles WHERE id = ?', req.params.id);
        if (role) addAuditLog(req, 'ROLE_DELETE', role.name);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// SPA Fallback: Serve index.html for unknown non-API routes
app.get(/^(?!\/api).+/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Setup ---
app.get('/api/setup/status', async (req, res) => {
    try {
        const status = await setupService.getStatus();
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/setup/install', async (req, res) => {
    try {
        const isInstalled = await setupService.isInstalled();
        if (isInstalled) return res.status(400).json({ error: 'Already installed' });

        const result = await setupService.install(req.body);

        // After install, we need to re-initialize services
        console.log('[Setup] Installation successful. Rebooting services...');
        await start();

        // Generate token for automatic login
        const db = await setupDb();
        const user = await db.get('SELECT id, username, role FROM users WHERE username = ?', req.body.admin.username);

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, must_change_password: false },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            ...result,
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                must_change_password: false
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3001;

async function seedPresets(db) {
    try {
        const count = await db.get('SELECT COUNT(*) as count FROM presets');
        if (count.count === 0) {
            console.log('[Presets] Seeding default presets...');
            for (const p of encodingPresets) {
                await db.run(
                    'INSERT INTO presets (id, name, codec, resolution, fps, crf, `group`, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    p.id, p.name, p.codec, p.resolution, p.fps, p.crf, p.group || 'General', p.is_default ? 1 : 0
                );
            }
        }
    } catch (err) {
        console.error('[Presets] Seeding failed:', err.message);
    }
}

async function start() {
    try {
        const isInstalled = await setupService.isInstalled();
        if (!isInstalled) {
            console.log('[System] Waiting for first-time setup...');
            if (!server.listening) {
                server.listen(PORT, () => console.log(`Installer running on port ${PORT}`));
            }
            return;
        }

        const db = await setupDb();
        console.log('Database connected');

        // Seed default presets
        await seedPresets(db);

        cliServiceInstance = new CliService(db, io);
        libServiceInstance = new libraryService(db, cliServiceInstance);
        await libServiceInstance.updateLibraryPaths();
        cliServiceInstance.setLibraryService(libServiceInstance);
        configService = new ConfigService();

        subService = new SubscriptionService(db, cliServiceInstance, catalogService, libServiceInstance);
        subService.start();
        cliServiceInstance.processQueue();

        if (!server.listening) {
            server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
        }

        libServiceInstance.scan();
        libServiceInstance.startAutoRefresh();
    } catch (err) {
        console.error('Failed to start server:', err);
    }
}

start();

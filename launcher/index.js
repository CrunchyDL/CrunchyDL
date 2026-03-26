const { app, Tray, Menu, shell, Notification, dialog } = require('electron');
const path = require('path');
const { spawn, exec, execSync } = require('child_process');
const fs = require('fs');
const translations = require('./translations');

// --- Single Instance Lock ---
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
    process.exit(0);
}

let tray = null;
let serverProcess = null;
let rootDir = null;
let currentLang = 'en';

const IS_WIN = process.platform === 'win32';
const SCRIPT_NAME = IS_WIN ? 'run-windows.bat' : 'run-linux.sh';
const APP_URL = 'http://localhost:3001';

// Path detection
const isPackaged = app.isPackaged;
const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
const execDir = isPackaged ? (portableDir || path.dirname(process.execPath)) : __dirname;
const CONFIG_FILE = path.join(execDir, 'launcher-config.json');

const LAUNCHER_LOG = path.join(execDir, 'launcher.log');
const SERVER_LOG = path.join(execDir, 'server.log');

// Truncate launcher log on startup
try {
    fs.writeFileSync(LAUNCHER_LOG, '');
} catch (e) {
    console.error('Failed to clear logs:', e);
}

// Translation helper
function t(key, ...args) {
    try {
        if (!translations[currentLang]) currentLang = 'en';
        let str = translations[currentLang][key] || translations['en'][key] || key;
        args.forEach(arg => { str = str.replace('%s', arg); });
        return str;
    } catch (e) { return key; }
}

function logLauncher(msg) {
    const timestamp = new Date().toISOString();
    const formattedMsg = `[${timestamp}] ${msg}`;
    console.log(formattedMsg);
    try {
        fs.appendFileSync(LAUNCHER_LOG, formattedMsg + '\n');
    } catch (e) { console.error('Launcher log error:', e); }
}

function logServer(msg) {
    const timestamp = new Date().toISOString();
    const formattedMsg = `[${timestamp}] ${msg}`;
    try {
        fs.appendFileSync(SERVER_LOG, formattedMsg + '\n');
    } catch (e) { console.error('Server log error:', e); }
}

function loadConfig() {
    logLauncher('Loading configuration...');
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            if (config.lang) currentLang = config.lang;
            if (config.rootDir && fs.existsSync(config.rootDir)) {
                rootDir = config.rootDir;
            }
            logLauncher(`Config loaded: lang=${currentLang}, rootDir=${rootDir}`);
        } catch (e) {
            logLauncher('Config load error: ' + e.message);
        }
    }
}

function saveConfig() {
    try {
        const config = { lang: currentLang, rootDir: rootDir };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    } catch (e) {
        logLauncher('Config save error: ' + e.message);
    }
}

function findRootDir() {
    const possibleRoots = [
        execDir,
        path.resolve(execDir, '..'),
        path.resolve(execDir, '../..'),
        path.resolve(__dirname, '..'),
        process.cwd()
    ];
    
    logLauncher(`Searching root in: ${possibleRoots.join(', ')}`);
    let found = possibleRoots.find(r => fs.existsSync(path.join(r, SCRIPT_NAME)));
    return found || null;
}

// Initial setup
logLauncher('--- CrunchyDL Electron Launcher ---');
logLauncher(`Version: ${app.getVersion()}`);
loadConfig();
if (!rootDir) rootDir = findRootDir();

logLauncher(`Exec Dir: ${execDir}`);
logLauncher(`Root Dir: ${rootDir}`);

async function startServer() {
    if (!rootDir) {
        promptForRootDir();
        return;
    }

    if (serverProcess) {
        new Notification({ title: 'CrunchyDL', body: t('server_running') }).show();
        return;
    }

    // Aggressive cleanup before starting
    if (IS_WIN) {
        logLauncher('Cleaning up potential stale processes...');
        try {
            // Kill any node process using port 3001
            execSync('powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue).OwningProcess -Force -ErrorAction SilentlyContinue"', { stdio: 'ignore' });
        } catch (e) {}
    }

    // Truncate server log on every start
    try { fs.writeFileSync(SERVER_LOG, ''); } catch (e) {}

    const scriptPath = path.join(rootDir, SCRIPT_NAME);
    logLauncher(`Starting server: ${IS_WIN ? 'cmd.exe /c' : 'bash'} "${scriptPath}"`);

    serverProcess = spawn(IS_WIN ? 'cmd.exe' : 'bash', [IS_WIN ? '/c' : '', `"${scriptPath}"`].filter(Boolean), {
        cwd: rootDir,
        shell: true,
        windowsHide: true,
        env: { ...process.env, FORCE_COLOR: '1' }
    });

    serverProcess.on('error', (err) => {
        logLauncher(`Process ERROR: ${err.message}`);
        new Notification({ title: t('error_title'), body: err.message }).show();
        serverProcess = null;
        updateMenu();
    });

    serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        logServer(output.trim());
        if (output.includes('Server running on port') || output.includes('Installer running on port')) {
            new Notification({ 
                title: t('server_ready_title'), 
                body: t('server_ready_body') 
            }).show();
        }
    });

    serverProcess.stderr.on('data', (data) => {
        logServer(`[STDERR] ${data.toString().trim()}`);
    });

    serverProcess.on('exit', (code) => {
        if (code !== null) {
            logLauncher(`Server exit code: ${code}`);
        }
        serverProcess = null;
        updateMenu();
    });

    updateMenu();
    new Notification({ title: 'CrunchyDL', body: t('server_starting') }).show();
}

function stopServer() {
    if (serverProcess) {
        logLauncher(`Stopping server (PID: ${serverProcess.pid})...`);
        if (IS_WIN) {
            exec(`taskkill /pid ${serverProcess.pid} /f /t`, (err) => {
                if (err) {
                    logLauncher(`Taskkill failed: ${err.message}. Trying direct kill.`);
                    try { process.kill(serverProcess.pid, 'SIGKILL'); } catch(e) {}
                } else {
                    logLauncher('Taskkill successful.');
                }
            });
        } else {
            try {
                process.kill(-serverProcess.pid, 'SIGKILL');
            } catch (e) {
                try { serverProcess.kill('SIGKILL'); } catch(ee) {}
            }
        }
        serverProcess = null;
        updateMenu();
    }
}

function promptForRootDir() {
    logLauncher('Prompting for root directory...');
    const result = dialog.showOpenDialogSync({
        properties: ['openDirectory'],
        title: t('select_repo'),
        defaultPath: rootDir || execDir
    });

    if (result && result.length > 0) {
        const selected = result[0];
        if (fs.existsSync(path.join(selected, SCRIPT_NAME))) {
            rootDir = selected;
            saveConfig();
            updateMenu();
            new Notification({ title: 'CrunchyDL', body: t('repo_configured') }).show();
        } else {
            dialog.showErrorBox(t('invalid_folder_title'), t('invalid_folder_body', SCRIPT_NAME));
        }
    }
}

function updateMenu() {
    try {
        const contextMenu = Menu.buildFromTemplate([
            { label: t('start_server'), click: startServer, enabled: !serverProcess && !!rootDir },
            { label: t('stop_server'), click: stopServer, enabled: !!serverProcess },
            { type: 'separator' },
            { 
                label: rootDir ? t('location', path.basename(rootDir)) : t('select_repo'), 
                click: promptForRootDir 
            },
            { label: t('open_ui'), click: () => shell.openExternal(APP_URL) },
            { type: 'separator' },
            { label: t('view_logs_launcher'), click: () => shell.openPath(LAUNCHER_LOG) },
            { label: t('view_logs_server'), click: () => shell.openPath(SERVER_LOG) },
            { type: 'separator' },
            {
                label: t('language'),
                submenu: [
                    { label: 'English', type: 'radio', checked: currentLang === 'en', click: () => switchLang('en') },
                    { label: 'Español', type: 'radio', checked: currentLang === 'es', click: () => switchLang('es') }
                ]
            },
            { type: 'separator' },
            { label: t('exit'), click: () => { stopServer(); app.quit(); } }
        ]);
        if (tray) tray.setContextMenu(contextMenu);
    } catch (e) {
        logLauncher('Menu update ERROR: ' + e.message);
    }
}

function switchLang(lang) {
    logLauncher(`Switching language to: ${lang}`);
    currentLang = lang;
    saveConfig();
    updateMenu();
    if (tray) tray.setToolTip(t('tray_tooltip'));
}

app.on('second-instance', (event, commandLine, workingDirectory) => {
    logLauncher('Second instance attempt blocked.');
    new Notification({ 
        title: t('second_instance_title'), 
        body: t('second_instance_body') 
    }).show();
});

app.whenReady().then(() => {
    logLauncher('App ready. Initializing Tray...');
    try {
        const ICON_PATH = path.join(__dirname, 'icon.png');
        tray = new Tray(ICON_PATH);
        tray.setToolTip(t('tray_tooltip'));
        updateMenu();

        logLauncher('Launcher started successfully.');
        
        if (rootDir) {
            logLauncher('Auto-starting server...');
            startServer();
        } else {
            new Notification({ title: t('repo_not_found_title'), body: t('repo_not_found_body') }).show();
        }
    } catch (e) {
        logLauncher('Initialization ERROR: ' + e.message);
        dialog.showErrorBox(t('error_title'), e.message);
    }

    if (app.dock) app.dock.hide();
});

app.on('window-all-closed', (e) => e.preventDefault());

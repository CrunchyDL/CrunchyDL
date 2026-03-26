const SysTray = require('systray2').default;
const open = require('open');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Detect if running as pkg bundle
const isPkg = typeof process.pkg !== 'undefined';
const execDir = isPkg ? path.dirname(process.execPath) : __dirname;
const rootDir = isPkg ? path.resolve(execDir, '..') : path.resolve(__dirname, '..');

const ICON_PATH = path.join(__dirname, 'icon.png');
const IS_WIN = process.platform === 'win32';
const RUN_SCRIPT = path.join(rootDir, IS_WIN ? 'run-windows.bat' : 'run-linux.sh');
const APP_URL = 'http://localhost:3001';

let serverProcess = null;

const itemStart = {
    title: 'Iniciar Servidor',
    tooltip: 'Ejecutar CrunchyDL en segundo plano',
    checked: false,
    enabled: true
};

const itemOpen = {
    title: 'Abrir Interfaz Web',
    tooltip: 'Abrir en el navegador',
    checked: false,
    enabled: true
};

const itemExit = {
    title: 'Salir',
    tooltip: 'Cerrar launcher y servidor',
    checked: false,
    enabled: true
};

const systray = new SysTray({
    menu: {
        icon: fs.readFileSync(ICON_PATH).toString('base64'),
        title: 'CrunchyDL',
        tooltip: 'Crunchyroll Downloader Docker Launcher',
        items: [
            itemStart,
            itemOpen,
            { title: '-', tooltip: '', checked: false, enabled: true },
            itemExit
        ]
    },
    debug: false,
    copyDir: true, // copy go-tray binaries to temporary directory
});

systray.on('click', (action) => {
    switch (action.item.title) {
        case 'Iniciar Servidor':
            startServer();
            break;
        case 'Abrir Interfaz Web':
            open(APP_URL);
            break;
        case 'Salir':
            systray.kill();
            if (serverProcess) {
                // Try to kill the process tree on Windows
                spawn('taskkill', ['/pid', serverProcess.pid, '/f', '/t']);
            }
            process.exit(0);
            break;
    }
});

function startServer() {
    if (serverProcess) {
        console.log('El servidor ya se está ejecutando.');
        return;
    }

    console.log(`Iniciando servidor via ${RUN_SCRIPT}...`);
    serverProcess = spawn(IS_WIN ? 'cmd.exe' : 'bash', [IS_WIN ? '/c' : '', RUN_SCRIPT].filter(Boolean), {
        cwd: rootDir,
        detached: false, 
        stdio: 'inherit'
    });

    serverProcess.on('exit', (code) => {
        console.log(`Servidor finalizado con código ${code}`);
        serverProcess = null;
    });
}

systray.ready().then(() => {
    console.log('Launcher del System Tray iniciado correctamente.');
    // Optional: Auto-start or auto-open
});

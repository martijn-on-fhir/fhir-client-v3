const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('path');
const log = require('electron-log/main');
const { registerAuthHandlers } = require('./auth/auth-handler');
const { registerTerminologyHandlers } = require('./terminology/terminology-handler');
const { registerFileHandlers } = require('./file/file-handler');
const { registerProfileHandlers } = require('./profile/profile-handler');
const { registerLogHandlers } = require('./logs/log-handler');
const { createApplicationMenu } = require('./menu/menu-handler');

// Initialize electron-log for IPC communication
log.initialize();

// Configure electron-log
log.transports.file.level = 'info';
log.transports.console.level = 'debug';
log.transports.file.maxSize = 1 * 1024 * 1024; // 1MB (smaller for better performance)
log.transports.file.maxFiles = 5; // Keep last 5 log files

// Register logging IPC handlers
ipcMain.handle('log:error', (event, ...args) => {
  log.error('[Renderer]', ...args);
});

ipcMain.handle('log:warn', (event, ...args) => {
  log.warn('[Renderer]', ...args);
});

ipcMain.handle('log:info', (event, ...args) => {
  log.info('[Renderer]', ...args);
});

ipcMain.handle('log:debug', (event, ...args) => {
  log.debug('[Renderer]', ...args);
});

ipcMain.handle('log:verbose', (event, ...args) => {
  log.verbose('[Renderer]', ...args);
});

log.info('Application starting...');

let mainWindow;
let splashWindow;
let splashStartTime;

/**
 * Create splash screen window
 */
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 400,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'splash-preload.js')
    }
  });

  // Configure CSP for splash screen to allow FontAwesome local files
  splashWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "font-src 'self' data:; " +
          "img-src 'self' data:; " +
          "script-src 'self' 'unsafe-inline'"
        ]
      }
    });
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.center();

  // Record when splash screen was created
  splashStartTime = Date.now();
}

function createWindow() {

  // Resolve icon path for both dev and production
  const iconPath = path.join(__dirname, 'assets/icons/icon.png');

  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false, // Disabled for ESM preload compatibility - would need CommonJS preload for sandbox
      v8CacheOptions: 'code'
    },
    title: 'FHIR Client MX',
    show: false, // Don't show until ready
    alwaysOnTop: false
  });

  // Configure Content Security Policy
  const isDev = process.env.NODE_ENV !== 'production';

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const cspPolicy = isDev
      ? [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' http://localhost:4200",
          "worker-src 'self' blob:",
          "style-src 'self' 'unsafe-inline' http://localhost:4200",
          "img-src 'self' data: http://localhost:4200",
          "connect-src 'self' http://localhost:4200 http://localhost:* https://*",
          "font-src 'self' data:",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'"
        ].join('; ')
      : [
          "default-src 'self'",
          "script-src 'self'",
          "worker-src 'self' blob:",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:",
          "connect-src 'self' https://*",
          "font-src 'self' data:",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'"
        ].join('; ');

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspPolicy]
      }
    });
  });

  // Load Angular app

  if (isDev) {
    mainWindow.loadURL('http://localhost:4200');
    // mainWindow.webContents.openDevTools(); // Commented out to prevent auto-opening
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/fhir-client/browser/index.html'));
  }

  // Show main window when ready and close splash
  mainWindow.once('ready-to-show', () => {
    // Ensure splash screen is visible for at least 5 seconds
    const elapsedTime = Date.now() - splashStartTime;
    const remainingTime = Math.max(0, 4000 - elapsedTime);

    setTimeout(() => {
      // Close splash window
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }

      // Show main window
      mainWindow.show();
    }, remainingTime);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialize app
app.whenReady().then(() => {
  // Register IPC handlers before creating window
  registerAuthHandlers();
  registerTerminologyHandlers();
  registerFileHandlers();
  registerProfileHandlers();

  // Create application menu
  createApplicationMenu();

  // Create splash window first
  createSplashWindow();

  // Create main window (hidden initially)
  createWindow();

  // Register log handlers (requires mainWindow)
  registerLogHandlers(mainWindow);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const log = require('electron-log');
const { registerAuthHandlers } = require('./auth/auth-handler');
const { registerTerminologyHandlers } = require('./terminology/terminology-handler');
const { registerFileHandlers } = require('./file/file-handler');
const { registerProfileHandlers } = require('./profile/profile-handler');
const { createApplicationMenu } = require('./menu/menu-handler');

// Configure electron-log
log.transports.file.level = 'info';
log.transports.console.level = 'debug';
log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB
log.info('Application starting...');

let mainWindow;

function createWindow() {

  // Resolve icon path for both dev and production
  const iconPath = path.join(__dirname, 'assets/icons/icon.png');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false, // Disabled for ESM preload compatibility - would need CommonJS preload for sandbox
      v8CacheOptions: 'code'
    },
    title: 'FHIR Client',
    show: true, // Show immediately for debugging
    alwaysOnTop: false
  });

  // Configure Content Security Policy
  const isDev = process.env.NODE_ENV !== 'production';

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const cspPolicy = isDev
      ? [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:4200 https://cdn.jsdelivr.net",
          "worker-src 'self' blob: data: https://cdn.jsdelivr.net",
          "style-src 'self' 'unsafe-inline' http://localhost:4200 https://cdn.jsdelivr.net",
          "img-src 'self' data: http://localhost:4200",
          "connect-src 'self' http://localhost:4200 http://localhost:* https://*",
          "font-src 'self' data:",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
          "upgrade-insecure-requests"
        ].join('; ')
      : [
          "default-src 'self'",
          "script-src 'self' 'unsafe-eval' https://cdn.jsdelivr.net",
          "worker-src 'self' blob: data: https://cdn.jsdelivr.net",
          "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
          "img-src 'self' data:",
          "connect-src 'self' https://*",
          "font-src 'self' data:",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
          "upgrade-insecure-requests"
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

  // Create window
  createWindow();
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

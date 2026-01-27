const { app, BrowserWindow, session, ipcMain, shell } = require('electron');
const path = require('path');
const log = require('electron-log/main');
const secureKeyManager = require('./security/secure-key-manager');
const { registerAuthHandlers } = require('./auth/auth-handler');
const { registerTerminologyHandlers } = require('./terminology/terminology-handler');
const { registerFileHandlers } = require('./file/file-handler');
const { registerProfileHandlers } = require('./profile/profile-handler');
const { registerLogHandlers } = require('./logs/log-handler');
const { registerCertificateHandlers } = require('./certificates/certificate-handler');
const { registerMtlsHandlers } = require('./mtls/mtls-handler');
const { registerConfigHandlers } = require('./config/config-handler');
const { registerNarrativeHandlers } = require('./narratives/narrative-handler');
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

// Security status handler - check if OS-level secure storage is available
ipcMain.handle('security:isSecureStorageAvailable', () => {
  return secureKeyManager.isSecureStorageAvailable();
});

// Shell API handler - open URLs in external browser
// Security: Only allow http:// and https:// URLs to prevent malicious protocols
ipcMain.handle('shell:openExternal', async (event, url) => {
  try {
    // Validate URL to prevent protocol injection attacks
    const parsedUrl = new URL(url);
    const allowedProtocols = ['http:', 'https:'];

    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      log.warn(`[Main] Blocked shell.openExternal with disallowed protocol: ${parsedUrl.protocol}`);
      return { success: false, error: `Protocol not allowed: ${parsedUrl.protocol}` };
    }

    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    log.error('[Main] shell.openExternal error:', error.message);
    return { success: false, error: error.message };
  }
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

  // Inject version number after page loads
  splashWindow.webContents.on('did-finish-load', () => {
    const version = app.getVersion();
    splashWindow.webContents.executeJavaScript(`
      document.getElementById('app-version').textContent = 'Version ${version}';
    `);
  });

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
  // Use app.isPackaged for reliable detection - NODE_ENV may not be set in portable builds
  const isDev = !app.isPackaged;

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
          "script-src 'self' 'unsafe-inline'",
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
    // Ensure splash screen is visible for at least 2 seconds
    const elapsedTime = Date.now() - splashStartTime;
    const remainingTime = Math.max(0, 2000 - elapsedTime);

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
// Register IPC handlers before creating window
app.whenReady().then(() => {
  // Initialize secure key manager with user data path
  // This must happen before any handlers that use encrypted stores
  secureKeyManager.initialize(app.getPath('userData'));

  if (secureKeyManager.isSecureStorageAvailable()) {
    log.info('[Main] OS-level secure storage available (using DPAPI/Keychain/SecretService)');
  } else {
    log.warn('[Main] OS-level secure storage NOT available - using fallback encryption');
  }

  registerConfigHandlers();
  registerAuthHandlers();
  registerTerminologyHandlers();
  registerFileHandlers();
  registerProfileHandlers();
  registerCertificateHandlers();
  registerMtlsHandlers();
  registerNarrativeHandlers();
  createApplicationMenu();
  createSplashWindow();
  createWindow();
  registerLogHandlers(mainWindow);
});

app.on('window-all-closed', () => {
  // Clear encryption key cache on app close for security
  secureKeyManager.clearCache();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {

  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

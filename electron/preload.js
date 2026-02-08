const { contextBridge, ipcRenderer } = require('electron');
const log = require('electron-log/main');

/**
 * Electron Preload Script
 *
 * Safely exposes IPC APIs to the renderer process via contextBridge
 * Provides authentication, file, and platform APIs
 */

log.info('[Preload] Loading preload script');

// Expose Electron APIs to Angular app
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform information
  platform: process.platform,

  // Event listeners
  on: (channel, callback) => {

    const validChannels = ['show-about', 'show-server-info', 'show-settings', 'show-certificate-manager', 'show-server-accounts', 'file-open', 'file-save', 'menu-switch-profile'];

    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, callback);
    }
  },

  off: (channel, callback) => {
    const validChannels = ['show-about', 'show-server-info', 'show-settings', 'show-certificate-manager', 'show-server-accounts', 'file-open', 'file-save', 'menu-switch-profile'];
    if (validChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, callback);
    }
  },

  // Authentication API
  auth: {
    /**
     * Start OAuth2 login
     * @param {string} clientId - OAuth2 client ID
     * @param {string} clientSecret - OAuth2 client secret
     * @param {string} environment - Environment identifier (development, local, acceptance, production)
     * @returns {Promise<{success: boolean}>}
     */
    login: (clientId, clientSecret, environment) =>
      ipcRenderer.invoke('auth:login', clientId, clientSecret, environment),

    /**
     * Get stored authentication token
     * @returns {Promise<Object|null>} Stored token or null
     */
    getToken: () =>
      ipcRenderer.invoke('auth:getToken'),

    /**
     * Set authentication token
     * @param {Object} token - Token object to store
     * @returns {Promise<{success: boolean}>}
     */
    setToken: (token) =>
      ipcRenderer.invoke('auth:setToken', token),

    /**
     * Clear authentication token (logout)
     * @returns {Promise<{success: boolean}>}
     */
    clearToken: () =>
      ipcRenderer.invoke('auth:clearToken'),

    /**
     * Check if user is authenticated
     * @returns {Promise<boolean>}
     */
    checkAuth: () =>
      ipcRenderer.invoke('auth:checkAuth'),

    /**
     * Set two-factor authentication secret
     * @param {string} secret - TOTP secret
     * @returns {Promise<{success: boolean}>}
     */
    setTwoFactorSecret: (secret) =>
      ipcRenderer.invoke('auth:setTwoFactorSecret', secret),

    /**
     * Get two-factor authentication secret
     * @returns {Promise<string|null>}
     */
    getTwoFactorSecret: () =>
      ipcRenderer.invoke('auth:getTwoFactorSecret'),

    /**
     * Remove two-factor authentication secret
     * @returns {Promise<{success: boolean}>}
     */
    removeTwoFactorSecret: () =>
      ipcRenderer.invoke('auth:removeTwoFactorSecret'),

    /**
     * Set saved accounts
     * @param {Array} accounts - Array of saved account objects
     * @returns {Promise<{success: boolean}>}
     */
    setSavedAccounts: (accounts) =>
      ipcRenderer.invoke('auth:setSavedAccounts', accounts),

    /**
     * Get saved accounts
     * @returns {Promise<Array>}
     */
    getSavedAccounts: () =>
      ipcRenderer.invoke('auth:getSavedAccounts'),

    /**
     * Clear all saved accounts
     * @returns {Promise<{success: boolean}>}
     */
    clearSavedAccounts: () =>
      ipcRenderer.invoke('auth:clearSavedAccounts'),

    /**
     * OAuth2 login with custom token endpoint (for server profiles)
     * @param {string} tokenEndpoint - Token endpoint URL
     * @param {string} clientId - Client ID
     * @param {string} clientSecret - Client secret
     * @param {string} [scope] - Optional OAuth2 scope
     * @returns {Promise<Object>} Token response
     */
    oauth2Login: (tokenEndpoint, clientId, clientSecret, scope) =>
      ipcRenderer.invoke('auth:oauth2Login', tokenEndpoint, clientId, clientSecret, scope)
  },

  // Server Profiles API
  profiles: {
    /**
     * Get all server profiles
     * @returns {Promise<Array>}
     */
    getAll: () =>
      ipcRenderer.invoke('profiles:getAll'),

    /**
     * Save all server profiles
     * @param {Array} profiles - Array of profile objects
     * @returns {Promise<{success: boolean}>}
     */
    save: (profiles) =>
      ipcRenderer.invoke('profiles:save', profiles),

    /**
     * Get active profile ID
     * @returns {Promise<string|null>}
     */
    getActive: () =>
      ipcRenderer.invoke('profiles:getActive'),

    /**
     * Set active profile ID
     * @param {string|null} id - Profile ID
     * @returns {Promise<{success: boolean}>}
     */
    setActive: (id) =>
      ipcRenderer.invoke('profiles:setActive', id),

    /**
     * Clear all profiles
     * @returns {Promise<{success: boolean}>}
     */
    clear: () =>
      ipcRenderer.invoke('profiles:clear')
  },

  // Profile Sessions API
  sessions: {
    /**
     * Get session for a profile
     * @param {string} profileId - Profile ID
     * @returns {Promise<Object|null>}
     */
    get: (profileId) =>
      ipcRenderer.invoke('sessions:get', profileId),

    /**
     * Set session for a profile
     * @param {string} profileId - Profile ID
     * @param {Object} session - Session object
     * @returns {Promise<{success: boolean}>}
     */
    set: (profileId, session) =>
      ipcRenderer.invoke('sessions:set', profileId, session),

    /**
     * Clear session for a profile
     * @param {string} profileId - Profile ID
     * @returns {Promise<{success: boolean}>}
     */
    clear: (profileId) =>
      ipcRenderer.invoke('sessions:clear', profileId),

    /**
     * Get all sessions
     * @returns {Promise<Object>}
     */
    getAll: () =>
      ipcRenderer.invoke('sessions:getAll'),

    /**
     * Save all sessions
     * @param {Object} sessions - Sessions object
     * @returns {Promise<{success: boolean}>}
     */
    saveAll: (sessions) =>
      ipcRenderer.invoke('sessions:saveAll', sessions),

    /**
     * Clear all sessions
     * @returns {Promise<{success: boolean}>}
     */
    clearAll: () =>
      ipcRenderer.invoke('sessions:clearAll')
  },

  // File API
  file: {
    /**
     * Open file dialog and read content
     * @returns {Promise<{path: string, content: string}|{error: string}|null>}
     */
    openFile: () =>
      ipcRenderer.invoke('file:open'),

    /**
     * Save file dialog and write content
     * @param {string} content - Content to save
     * @param {string} defaultFileName - Default filename
     * @returns {Promise<{path: string, success: boolean}|{error: string}|null>}
     */
    saveFile: (content, defaultFileName) =>
      ipcRenderer.invoke('file:save', content, defaultFileName),

    /**
     * Create a temporary file for streaming exports
     * @param {string} prefix - Filename prefix
     * @returns {Promise<{path: string, success: boolean}|{error: string}>}
     */
    createTempExport: (prefix) =>
      ipcRenderer.invoke('file:createTempExport', prefix),

    /**
     * Append a line to a file
     * @param {string} filePath - Path to the file
     * @param {string} line - Line to append
     * @returns {Promise<{success: boolean}|{error: string}>}
     */
    appendLine: (filePath, line) =>
      ipcRenderer.invoke('file:appendLine', filePath, line),

    /**
     * Append multiple lines to a file (batch)
     * @param {string} filePath - Path to the file
     * @param {Array} lines - Lines to append (strings or objects to JSON stringify)
     * @returns {Promise<{success: boolean}|{error: string}>}
     */
    appendLines: (filePath, lines) =>
      ipcRenderer.invoke('file:appendLines', filePath, lines),

    /**
     * Save temp export file via dialog (converts NDJSON to JSON if needed)
     * @param {string} tempFilePath - Path to temp file
     * @param {string} defaultFileName - Default filename for save dialog
     * @returns {Promise<{path: string, success: boolean}|{canceled: boolean}|{error: string}>}
     */
    saveTempExport: (tempFilePath, defaultFileName) =>
      ipcRenderer.invoke('file:saveTempExport', tempFilePath, defaultFileName),

    /**
     * Delete a temporary file
     * @param {string} filePath - Path to temp file
     * @returns {Promise<{success: boolean}|{error: string}>}
     */
    deleteTempFile: (filePath) =>
      ipcRenderer.invoke('file:deleteTempFile', filePath),

    /**
     * Get line count of a file
     * @param {string} filePath - Path to file
     * @returns {Promise<{count: number}|{error: string}>}
     */
    getLineCount: (filePath) =>
      ipcRenderer.invoke('file:getLineCount', filePath),

    /**
     * Read a sample of lines from a file
     * @param {string} filePath - Path to file
     * @param {number} maxLines - Maximum lines to read
     * @returns {Promise<{sample: Array, totalCount: number, hasMore: boolean}|{error: string}>}
     */
    readSample: (filePath, maxLines) =>
      ipcRenderer.invoke('file:readSample', filePath, maxLines)
  },

  // Shell API
  shell: {
    /**
     * Open URL in external browser
     * @param {string} url - URL to open
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    openExternal: (url) =>
      ipcRenderer.invoke('shell:openExternal', url)
  },

  // Terminology API
  terminology: {
    /**
     * CodeSystem/$lookup operation
     * @param {Object} params - Lookup parameters
     * @returns {Promise<Object>} FHIR Parameters resource
     */
    lookup: (params) =>
      ipcRenderer.invoke('terminology:lookup', params),

    /**
     * ValueSet/$expand operation
     * @param {Object} params - Expand parameters
     * @returns {Promise<Object>} FHIR ValueSet resource
     */
    expand: (params) =>
      ipcRenderer.invoke('terminology:expand', params),

    /**
     * ValueSet/$validate-code operation
     * @param {Object} params - Validate parameters
     * @returns {Promise<Object>} FHIR Parameters resource
     */
    validateCode: (params) =>
      ipcRenderer.invoke('terminology:validateCode', params),

    /**
     * ConceptMap/$translate operation
     * @param {Object} params - Translate parameters
     * @returns {Promise<Object>} FHIR Parameters resource
     */
    translate: (params) =>
      ipcRenderer.invoke('terminology:translate', params),

    /**
     * Get server metadata (CapabilityStatement)
     * @returns {Promise<Object>} FHIR CapabilityStatement resource
     */
    getMetadata: () =>
      ipcRenderer.invoke('terminology:getMetadata')
  },

  // Profile Cache API
  profileCache: {
    /**
     * Get cached profile by title
     * @param {string} title - Profile title/key
     * @returns {Promise<Object|null>} Cached profile or null
     */
    getProfile: (title) =>
      ipcRenderer.invoke('profile-cache:get-profile', title),

    /**
     * Save profile to cache
     * @param {string} title - Profile title/key
     * @param {Object} data - Profile data to cache
     * @returns {Promise<{success: boolean}>}
     */
    setProfile: (title, data) =>
      ipcRenderer.invoke('profile-cache:set-profile', title, data),

    /**
     * Clear all cached profiles
     * @returns {Promise<{success: boolean}>}
     */
    clear: () =>
      ipcRenderer.invoke('profile-cache:clear'),

    /**
     * Get cache statistics
     * @returns {Promise<{fileCount: number, totalSize: number}>}
     */
    stats: () =>
      ipcRenderer.invoke('profile-cache:stats')
  },

  // Logging API
  log: {
    /**
     * Log an error message
     * @param {...any} args - Arguments to log
     */
    error: (...args) => ipcRenderer.invoke('log:error', ...args),

    /**
     * Log a warning message
     * @param {...any} args - Arguments to log
     */
    warn: (...args) => ipcRenderer.invoke('log:warn', ...args),

    /**
     * Log an info message
     * @param {...any} args - Arguments to log
     */
    info: (...args) => ipcRenderer.invoke('log:info', ...args),

    /**
     * Log a debug message
     * @param {...any} args - Arguments to log
     */
    debug: (...args) => ipcRenderer.invoke('log:debug', ...args),

    /**
     * Log a verbose message
     * @param {...any} args - Arguments to log
     */
    verbose: (...args) => ipcRenderer.invoke('log:verbose', ...args)
  },

  // Log File Viewing API
  logs: {
    /**
     * Get log file paths
     * @returns {Promise<{mainLog: string, rendererLog: string}|{error: string}>}
     */
    getPaths: () =>
      ipcRenderer.invoke('logs:getPaths'),

    /**
     * Read log file entries
     * @param {Object} options - Read options
     * @param {number} options.tail - Number of lines from end
     * @returns {Promise<{logs: Array}|{error: string}>}
     */
    read: (options) =>
      ipcRenderer.invoke('logs:read', options),

    /**
     * Start watching log file for changes
     * @returns {Promise<{success: boolean}|{error: string}>}
     */
    watch: () =>
      ipcRenderer.invoke('logs:watch'),

    /**
     * Stop watching log file
     * @returns {Promise<{success: boolean}|{error: string}>}
     */
    unwatch: () =>
      ipcRenderer.invoke('logs:unwatch'),

    /**
     * Export logs to file
     * @returns {Promise<{success: boolean, path?: string}|{error: string, canceled?: boolean}>}
     */
    export: () =>
      ipcRenderer.invoke('logs:export')
  },

  /**
   * Listen for log file updates
   * @param {Function} callback - Callback when logs are updated
   * @returns {Function} Cleanup function
   */
  onLogsUpdated: (callback) => {
    ipcRenderer.on('logs-updated', callback);
    return () => ipcRenderer.removeListener('logs-updated', callback);
  },

  // Certificate Management API
  certificates: {
    /**
     * Get all certificates (sanitized, without private keys)
     * @returns {Promise<{success: boolean, certificates?: Array, error?: string}>}
     */
    getAll: () =>
      ipcRenderer.invoke('certificate:getAll'),

    /**
     * Save a new certificate
     * @param {Object} entry - Certificate entry data
     * @returns {Promise<{success: boolean, certificate?: Object, error?: string}>}
     */
    save: (entry) =>
      ipcRenderer.invoke('certificate:save', entry),

    /**
     * Update an existing certificate
     * @param {string} id - Certificate ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<{success: boolean, certificate?: Object, error?: string}>}
     */
    update: (id, updates) =>
      ipcRenderer.invoke('certificate:update', id, updates),

    /**
     * Delete a certificate
     * @param {string} id - Certificate ID
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    delete: (id) =>
      ipcRenderer.invoke('certificate:delete', id),

    /**
     * Import certificate from file (opens file dialog)
     * @param {string} type - 'pfx', 'certificate', 'key', or 'all'
     * @returns {Promise<{success: boolean, filePath?: string, data?: Object, needsPassphrase?: boolean, error?: string}>}
     */
    import: (type) =>
      ipcRenderer.invoke('certificate:import', type),

    /**
     * Parse a PFX file with passphrase
     * @param {string} filePath - Path to PFX file
     * @param {string} passphrase - Passphrase for the PFX
     * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
     */
    parsePfx: (filePath, passphrase) =>
      ipcRenderer.invoke('certificate:parsePfx', filePath, passphrase),

    /**
     * Validate certificate data without saving
     * @param {Object} data - Certificate data to validate
     * @returns {Promise<{success: boolean, valid: boolean, metadata?: Object, error?: string}>}
     */
    validate: (data) =>
      ipcRenderer.invoke('certificate:validate', data),

    /**
     * Validate a stored certificate by ID
     * @param {string} id - Certificate ID
     * @returns {Promise<{success: boolean, valid: boolean, metadata?: Object, error?: string}>}
     */
    validateStored: (id) =>
      ipcRenderer.invoke('certificate:validateStored', id),

    /**
     * Test mTLS connection using a stored certificate
     * @param {string} id - Certificate ID
     * @param {string} testUrl - URL to test
     * @returns {Promise<{success: boolean, status?: number, error?: string}>}
     */
    testConnection: (id, testUrl) =>
      ipcRenderer.invoke('certificate:testConnection', { id, testUrl }),

    /**
     * Test mTLS connection with certificate data (before saving)
     * @param {Object} params - Test parameters
     * @returns {Promise<{success: boolean, status?: number, error?: string}>}
     */
    testConnectionWithData: (params) =>
      ipcRenderer.invoke('certificate:testConnectionWithData', params)
  },

  // HTTP Proxy API (bypasses CORS, no client certificates)
  http: {
    /**
     * Make an HTTP request through the Electron main process (CORS-free)
     * @param {Object} options - Request options
     * @param {string} options.url - Full URL to request
     * @param {string} options.method - HTTP method (GET, POST, PUT, DELETE)
     * @param {Object} options.headers - Request headers
     * @param {any} options.data - Request body
     * @param {number} options.timeout - Request timeout in ms
     * @returns {Promise<{success: boolean, status?: number, data?: any, error?: string}>}
     */
    request: (options) =>
      ipcRenderer.invoke('http:request', options)
  },

  // mTLS Request Proxy API
  mtls: {
    /**
     * Check if a domain has a configured certificate
     * @param {string} hostname - Hostname to check
     * @returns {Promise<{hasCertificate: boolean, enabled: boolean}>}
     */
    hasCertificate: (hostname) =>
      ipcRenderer.invoke('mtls:hasCertificate', hostname),

    /**
     * Make an HTTP request with mTLS client certificate
     * @param {Object} options - Request options
     * @param {string} options.url - Full URL to request
     * @param {string} options.method - HTTP method (GET, POST, PUT, DELETE)
     * @param {Object} options.headers - Request headers
     * @param {any} options.data - Request body
     * @param {number} options.timeout - Request timeout in ms
     * @returns {Promise<{success: boolean, status?: number, data?: any, error?: string}>}
     */
    request: (options) =>
      ipcRenderer.invoke('mtls:request', options),

    /**
     * Get certificate info for a domain
     * @param {string} hostname - Hostname to check
     * @returns {Promise<{found: boolean, certificate?: Object}>}
     */
    getCertificateInfo: (hostname) =>
      ipcRenderer.invoke('mtls:getCertificateInfo', hostname)
  },

  // Narrative Templates API
  narrativeTemplates: {
    /**
     * Get template by name
     * @param {string} name - Template name (profile name)
     * @returns {Promise<{content: string, path: string}|null>}
     */
    get: (name) =>
      ipcRenderer.invoke('narrative-templates:get', name),

    /**
     * Save template
     * @param {string} name - Template name (profile name)
     * @param {string} content - Template content
     * @returns {Promise<{success: boolean, path: string}>}
     */
    set: (name, content) =>
      ipcRenderer.invoke('narrative-templates:set', name, content),

    /**
     * Delete template
     * @param {string} name - Template name (profile name)
     * @returns {Promise<{success: boolean}>}
     */
    delete: (name) =>
      ipcRenderer.invoke('narrative-templates:delete', name),

    /**
     * List all templates
     * @returns {Promise<Array<{name: string, filename: string}>>}
     */
    list: () =>
      ipcRenderer.invoke('narrative-templates:list'),

    /**
     * Get templates directory path
     * @returns {Promise<string>}
     */
    getDir: () =>
      ipcRenderer.invoke('narrative-templates:getDir'),

    /**
     * Compile template with data (Handlebars compilation in main process)
     * @param {string} name - Template name (profile name)
     * @param {Object} data - Data to pass to the template
     * @returns {Promise<{success: boolean, html?: string, error?: string}>}
     */
    compile: (name, data) =>
      ipcRenderer.invoke('narrative-templates:compile', name, data)
  },

  // Configuration API
  config: {
    /**
     * Get all environment configurations
     * @returns {Promise<{success: boolean, environments?: Object, error?: string}>}
     */
    getEnvironments: () =>
      ipcRenderer.invoke('config:getEnvironments'),

    /**
     * Get list of available environment names
     * @returns {Promise<{success: boolean, environments?: string[], error?: string}>}
     */
    getAvailableEnvironments: () =>
      ipcRenderer.invoke('config:getAvailableEnvironments'),

    /**
     * Get specific environment configuration
     * @param {string} envName - Environment name
     * @returns {Promise<{success: boolean, environment?: Object, error?: string}>}
     */
    getEnvironment: (envName) =>
      ipcRenderer.invoke('config:getEnvironment', envName)
  },

  // Security API
  security: {
    /**
     * Check if OS-level secure storage is available
     * Returns true if using Windows DPAPI, macOS Keychain, or Linux Secret Service
     * Returns false if using fallback encryption (less secure)
     * @returns {Promise<boolean>}
     */
    isSecureStorageAvailable: () =>
      ipcRenderer.invoke('security:isSecureStorageAvailable')
  }
});

log.info('[Preload] electronAPI exposed to renderer process');

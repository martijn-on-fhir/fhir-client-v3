const { contextBridge, ipcRenderer } = require('electron');

/**
 * Electron Preload Script
 *
 * Safely exposes IPC APIs to the renderer process via contextBridge
 * Provides authentication, file, and platform APIs
 */

console.log('[Preload] Loading preload script');

// Expose Electron APIs to Angular app
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform information
  platform: process.platform,

  // Event listeners
  on: (channel, callback) => {
    const validChannels = ['show-about', 'show-server-info', 'show-settings', 'show-certificate-manager', 'file-open', 'file-save'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, callback);
    }
  },

  off: (channel, callback) => {
    const validChannels = ['show-about', 'show-server-info', 'show-settings', 'show-certificate-manager', 'file-open', 'file-save'];
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
      ipcRenderer.invoke('auth:clearSavedAccounts')
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
      ipcRenderer.invoke('file:save', content, defaultFileName)
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
  }
});

console.log('[Preload] electronAPI exposed to renderer process');

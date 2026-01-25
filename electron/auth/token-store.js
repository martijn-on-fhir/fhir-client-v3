const log = require('electron-log/main');
const secureKeyManager = require('../security/secure-key-manager');

/**
 * Secure Token Storage using electron-store with OS-level encrypted keys
 *
 * Manages OAuth2 tokens, 2FA secrets, and saved accounts with encrypted persistence.
 * Encryption keys are secured using Electron's safeStorage API (OS credential storage).
 */

// Lazy-loaded stores (initialized after secureKeyManager is ready)
let tokenStore = null;
let accountsStore = null;
let profileStore = null;
let sessionStore = null;

/**
 * Get or initialize the token store
 * @returns {Store} Token store instance
 */
function getTokenStore() {
  if (!tokenStore) {
    const Store = require('electron-store').default || require('electron-store');
    tokenStore = new Store({
      name: 'fhir-tokens',
      encryptionKey: secureKeyManager.getTokensKey()
    });
    log.info('[TokenStore] Token store initialized with secure key');
  }
  return tokenStore;
}

/**
 * Get or initialize the accounts store
 * @returns {Store} Accounts store instance
 */
function getAccountsStore() {
  if (!accountsStore) {
    const Store = require('electron-store').default || require('electron-store');
    accountsStore = new Store({
      name: 'fhir-accounts',
      encryptionKey: secureKeyManager.getAccountsKey()
    });
    log.info('[TokenStore] Accounts store initialized with secure key');
  }
  return accountsStore;
}

/**
 * Get or initialize the profile store
 * @returns {Store} Profile store instance
 */
function getProfileStore() {
  if (!profileStore) {
    const Store = require('electron-store').default || require('electron-store');
    profileStore = new Store({
      name: 'fhir-profiles',
      encryptionKey: secureKeyManager.getProfilesKey()
    });
    log.info('[TokenStore] Profile store initialized with secure key');
  }
  return profileStore;
}

/**
 * Get or initialize the session store
 * @returns {Store} Session store instance
 */
function getSessionStore() {
  if (!sessionStore) {
    const Store = require('electron-store').default || require('electron-store');
    sessionStore = new Store({
      name: 'fhir-sessions',
      encryptionKey: secureKeyManager.getSessionsKey()
    });
    log.info('[TokenStore] Session store initialized with secure key');
  }
  return sessionStore;
}

/**
 * Save OAuth2 token with metadata
 * @param {Object} tokenResponse - Token response from OAuth server
 * @param {string} tokenResponse.access_token - Access token
 * @param {string} tokenResponse.refresh_token - Refresh token (optional)
 * @param {number} tokenResponse.expires_in - Expiry in seconds
 * @param {string} tokenResponse.scope - OAuth scopes
 * @param {string} tokenResponse.token_type - Token type (usually 'Bearer')
 * @param {string} tokenResponse.id_token - ID token (optional)
 * @param {string} fhirServer - FHIR server URL
 * @param {string} clientId - OAuth client ID
 * @param {string} clientSecret - OAuth client secret
 * @param {string} environment - Environment identifier
 */
function saveToken(tokenResponse, fhirServer, clientId, clientSecret, environment) {
  const expiresAt = Date.now() + (tokenResponse.expires_in * 1000);

  const storedToken = {
    access_token: tokenResponse.access_token,
    refresh_token: tokenResponse.refresh_token,
    expires_at: expiresAt,
    scope: tokenResponse.scope,
    token_type: tokenResponse.token_type,
    fhir_server: fhirServer,
    client_id: clientId,
    client_secret: clientSecret, // Store for re-auth
    environment: environment,
    id_token: tokenResponse.id_token
  };

  getTokenStore().set('token', storedToken);
  log.info('[TokenStore] Token saved successfully');
}

/**
 * Get stored token
 * @returns {Object|null} Stored token or null if not found/expired
 */
function getToken() {
  const token = getTokenStore().get('token');

  if (!token) {
    return null;
  }

  // Check if expired
  if (token.expires_at < Date.now()) {
    // If we have client credentials, return token for re-auth attempt
    if (token.client_id && token.client_secret && token.environment) {
      log.info('[TokenStore] Token expired but credentials available for refresh');
      return token;
    }

    // No way to refresh, clear and return null
    log.info('[TokenStore] Token expired and no refresh available');
    clearToken();
    return null;
  }

  return token;
}

/**
 * Check if valid token exists
 * @returns {boolean} True if valid token exists
 */
function hasValidToken() {
  const token = getTokenStore().get('token');

  if (!token) {
    return false;
  }

  // Token is valid if not expired OR has refresh capability
  return token.expires_at >= Date.now() ||
         (token.client_id && token.client_secret && token.environment);
}

/**
 * Clear stored token
 */
function clearToken() {
  getTokenStore().delete('token');
  log.info('[TokenStore] Token cleared');
}

// =============================================================================
// Two-Factor Authentication (2FA) Management
// =============================================================================

/**
 * Set 2FA secret
 * @param {string} secret - TOTP secret
 */
function setTwoFactorSecret(secret) {
  getTokenStore().set('twoFactorSecret', secret);
  log.info('[TokenStore] 2FA secret saved');
}

/**
 * Get 2FA secret
 * @returns {string|null} TOTP secret or null
 */
function getTwoFactorSecret() {
  return getTokenStore().get('twoFactorSecret', null);
}

/**
 * Remove 2FA secret
 */
function removeTwoFactorSecret() {
  getTokenStore().delete('twoFactorSecret');
  log.info('[TokenStore] 2FA secret removed');
}

// =============================================================================
// Saved Accounts Management
// =============================================================================

/**
 * Set saved accounts
 * @param {Array} accounts - Array of saved account objects
 */
function setSavedAccounts(accounts) {
  getAccountsStore().set('savedAccounts', accounts);
  log.info(`[TokenStore] Saved ${accounts.length} accounts`);
}

/**
 * Get saved accounts
 * @returns {Array} Array of saved accounts
 */
function getSavedAccounts() {
  return getAccountsStore().get('savedAccounts', []);
}

/**
 * Clear all saved accounts
 */
function clearSavedAccounts() {
  getAccountsStore().delete('savedAccounts');
  log.info('[TokenStore] Saved accounts cleared');
}

// =============================================================================
// Server Profiles Management
// =============================================================================

/**
 * Get all server profiles
 * @returns {Array} Array of server profile objects
 */
function getProfiles() {
  return getProfileStore().get('profiles', []);
}

/**
 * Save all server profiles
 * @param {Array} profiles - Array of server profile objects
 */
function setProfiles(profiles) {
  getProfileStore().set('profiles', profiles);
  log.info(`[TokenStore] Saved ${profiles.length} server profiles`);
}

/**
 * Get active profile ID
 * @returns {string|null} Active profile ID or null
 */
function getActiveProfileId() {
  return getProfileStore().get('activeProfileId', null);
}

/**
 * Set active profile ID
 * @param {string|null} id - Profile ID to set as active
 */
function setActiveProfileId(id) {
  if (id) {
    getProfileStore().set('activeProfileId', id);
  } else {
    getProfileStore().delete('activeProfileId');
  }
  log.info(`[TokenStore] Active profile set to: ${id || 'none'}`);
}

/**
 * Clear all profiles
 */
function clearProfiles() {
  getProfileStore().delete('profiles');
  getProfileStore().delete('activeProfileId');
  log.info('[TokenStore] Server profiles cleared');
}

// =============================================================================
// Profile Sessions Management
// =============================================================================

/**
 * Get session for a profile
 * @param {string} profileId - Profile ID
 * @returns {Object|null} Session object or null
 */
function getSession(profileId) {
  const sessions = getSessionStore().get('sessions', {});
  return sessions[profileId] || null;
}

/**
 * Set session for a profile
 * @param {string} profileId - Profile ID
 * @param {Object} session - Session object
 */
function setSession(profileId, session) {
  const sessions = getSessionStore().get('sessions', {});
  sessions[profileId] = session;
  getSessionStore().set('sessions', sessions);
  log.info(`[TokenStore] Session saved for profile: ${profileId}`);
}

/**
 * Clear session for a profile
 * @param {string} profileId - Profile ID
 */
function clearSession(profileId) {
  const sessions = getSessionStore().get('sessions', {});
  delete sessions[profileId];
  getSessionStore().set('sessions', sessions);
  log.info(`[TokenStore] Session cleared for profile: ${profileId}`);
}

/**
 * Get all sessions
 * @returns {Object} Map of profileId -> session
 */
function getAllSessions() {
  return getSessionStore().get('sessions', {});
}

/**
 * Save all sessions
 * @param {Object} sessions - Map of profileId -> session
 */
function setAllSessions(sessions) {
  getSessionStore().set('sessions', sessions);
  log.info(`[TokenStore] Saved ${Object.keys(sessions).length} sessions`);
}

/**
 * Clear all sessions
 */
function clearAllSessions() {
  getSessionStore().delete('sessions');
  log.info('[TokenStore] All sessions cleared');
}

/**
 * Reset all stores (for migration or complete reset)
 * Clears the lazy-loaded store instances so they reinitialize with new keys
 */
function resetStores() {
  tokenStore = null;
  accountsStore = null;
  profileStore = null;
  sessionStore = null;
  log.info('[TokenStore] All store instances reset');
}

module.exports = {
  // Token management
  saveToken,
  getToken,
  hasValidToken,
  clearToken,
  // 2FA management
  setTwoFactorSecret,
  getTwoFactorSecret,
  removeTwoFactorSecret,
  // Saved accounts (legacy)
  setSavedAccounts,
  getSavedAccounts,
  clearSavedAccounts,
  // Server profiles
  getProfiles,
  setProfiles,
  getActiveProfileId,
  setActiveProfileId,
  clearProfiles,
  // Profile sessions
  getSession,
  setSession,
  clearSession,
  getAllSessions,
  setAllSessions,
  clearAllSessions,
  // Store management
  resetStores
};

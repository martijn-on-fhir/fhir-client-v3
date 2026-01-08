const Store = require('electron-store').default || require('electron-store');

/**
 * Secure Token Storage using electron-store with encryption
 *
 * Manages OAuth2 tokens, 2FA secrets, and saved accounts with encrypted persistence
 */

// Encrypted store for sensitive authentication data
const tokenStore = new Store({
  name: 'fhir-tokens',
  encryptionKey: 'fhir-client-v3-encryption-key-change-in-production'
});

// Separate store for saved accounts (less sensitive)
const accountsStore = new Store({
  name: 'fhir-accounts',
  encryptionKey: 'fhir-client-v3-accounts-key-change-in-production'
});

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

  tokenStore.set('token', storedToken);
  console.log('[TokenStore] Token saved successfully');
}

/**
 * Get stored token
 * @returns {Object|null} Stored token or null if not found/expired
 */
function getToken() {
  const token = tokenStore.get('token');

  if (!token) {
    return null;
  }

  // Check if expired
  if (token.expires_at < Date.now()) {
    // If we have client credentials, return token for re-auth attempt
    if (token.client_id && token.client_secret && token.environment) {
      console.log('[TokenStore] Token expired but credentials available for refresh');
      return token;
    }

    // No way to refresh, clear and return null
    console.log('[TokenStore] Token expired and no refresh available');
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
  const token = tokenStore.get('token');

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
  tokenStore.delete('token');
  console.log('[TokenStore] Token cleared');
}

// =============================================================================
// Two-Factor Authentication (2FA) Management
// =============================================================================

/**
 * Set 2FA secret
 * @param {string} secret - TOTP secret
 */
function setTwoFactorSecret(secret) {
  tokenStore.set('twoFactorSecret', secret);
  console.log('[TokenStore] 2FA secret saved');
}

/**
 * Get 2FA secret
 * @returns {string|null} TOTP secret or null
 */
function getTwoFactorSecret() {
  return tokenStore.get('twoFactorSecret', null);
}

/**
 * Remove 2FA secret
 */
function removeTwoFactorSecret() {
  tokenStore.delete('twoFactorSecret');
  console.log('[TokenStore] 2FA secret removed');
}

// =============================================================================
// Saved Accounts Management
// =============================================================================

/**
 * Set saved accounts
 * @param {Array} accounts - Array of saved account objects
 */
function setSavedAccounts(accounts) {
  accountsStore.set('savedAccounts', accounts);
  console.log(`[TokenStore] Saved ${accounts.length} accounts`);
}

/**
 * Get saved accounts
 * @returns {Array} Array of saved accounts
 */
function getSavedAccounts() {
  return accountsStore.get('savedAccounts', []);
}

/**
 * Clear all saved accounts
 */
function clearSavedAccounts() {
  accountsStore.delete('savedAccounts');
  console.log('[TokenStore] Saved accounts cleared');
}

module.exports = {
  saveToken,
  getToken,
  hasValidToken,
  clearToken,
  setTwoFactorSecret,
  getTwoFactorSecret,
  removeTwoFactorSecret,
  setSavedAccounts,
  getSavedAccounts,
  clearSavedAccounts
};

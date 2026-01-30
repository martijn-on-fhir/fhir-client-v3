const { ipcMain } = require('electron');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const tokenStore = require('./token-store');
const log = require('electron-log/main');

/**
 * Authentication IPC Handlers
 *
 * Handles OAuth2 Client Credentials authentication with Keycloak
 * Manages tokens, 2FA, and saved accounts via IPC
 */

/**
 * Load environment configurations from external JSON file
 * This keeps sensitive URLs out of the source code
 */
function loadEnvironments() {
  const configPath = path.join(__dirname, '..', 'config', 'environments.json');
  const examplePath = path.join(__dirname, '..', 'config', 'environments.example.json');

  if (!fs.existsSync(configPath)) {
    log.error('[AuthHandler] ERROR: environments.json not found!');
    log.error(`[AuthHandler] Please create ${configPath}`);
    log.error(`[AuthHandler] You can copy from ${examplePath} and fill in your values`);

    // Return empty object - app will show errors when trying to authenticate
    return {};
  }

  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    const environments = JSON.parse(configContent);
    log.info(`[AuthHandler] Loaded ${Object.keys(environments).length} environment(s) from config`);
    return environments;
  } catch (error) {
    log.error('[AuthHandler] ERROR: Failed to parse environments.json:', error.message);
    return {};
  }
}

// Load environment configurations from external file
const ENVIRONMENTS = loadEnvironments();

/**
 * Register all authentication IPC handlers
 */
function registerAuthHandlers() {
  log.info('[AuthHandler] Registering authentication IPC handlers');

  // =============================================================================
  // OAuth2 Authentication Handlers
  // =============================================================================

  /**
   * Start OAuth2 Client Credentials login
   */
  ipcMain.handle('auth:login', async (event, clientId, clientSecret, environment) => {
    try {
      log.info(`[AuthHandler] Starting login for environment: ${environment}`);

      const config = ENVIRONMENTS[environment];
      if (!config) {
        throw new Error(`Unknown environment: ${environment}`);
      }

      // Prepare token request
      const params = new URLSearchParams({
        grant_type: config.grantType,
        client_id: clientId,
        client_secret: clientSecret,
        scope: config.scope
      });

      // Make token request
      const response = await axios.post(config.tokenEndpoint, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      // Save token with metadata
      tokenStore.saveToken(
        response.data,
        config.fhirServer,
        clientId,
        clientSecret,
        environment
      );

      log.info('[AuthHandler] Login successful');
      return { success: true };

    } catch (error) {
      log.error('[AuthHandler] Login failed:', error.message);
      throw new Error(error.response?.data?.error_description || 'Authentication failed');
    }
  });

  /**
   * Get stored token
   */
  ipcMain.handle('auth:getToken', async () => {
    return tokenStore.getToken();
  });

  /**
   * Set token (called after successful login from renderer)
   */
  ipcMain.handle('auth:setToken', async (event, token) => {
    // Extract components for saveToken
    const config = ENVIRONMENTS[token.environment];
    if (!config) {
      throw new Error(`Unknown environment: ${token.environment}`);
    }

    // Reconstruct token response format for saveToken
    const tokenResponse = {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_in: Math.floor((token.expires_at - Date.now()) / 1000), // Convert back to seconds
      scope: token.scope,
      token_type: token.token_type,
      id_token: token.id_token
    };

    tokenStore.saveToken(
      tokenResponse,
      token.fhir_server,
      token.client_id,
      token.client_secret,
      token.environment
    );

    return { success: true };
  });

  /**
   * Clear stored token (logout)
   */
  ipcMain.handle('auth:clearToken', async () => {
    tokenStore.clearToken();
    return { success: true };
  });

  /**
   * Check if authenticated
   */
  ipcMain.handle('auth:checkAuth', async () => {
    return tokenStore.hasValidToken();
  });

  // =============================================================================
  // Two-Factor Authentication Handlers
  // =============================================================================

  /**
   * Set 2FA secret
   */
  ipcMain.handle('auth:setTwoFactorSecret', async (event, secret) => {
    tokenStore.setTwoFactorSecret(secret);
    return { success: true };
  });

  /**
   * Get 2FA secret
   */
  ipcMain.handle('auth:getTwoFactorSecret', async () => {
    return tokenStore.getTwoFactorSecret();
  });

  /**
   * Remove 2FA secret
   */
  ipcMain.handle('auth:removeTwoFactorSecret', async () => {
    tokenStore.removeTwoFactorSecret();
    return { success: true };
  });

  // =============================================================================
  // Saved Accounts Handlers
  // =============================================================================

  /**
   * Set saved accounts
   */
  ipcMain.handle('auth:setSavedAccounts', async (event, accounts) => {
    tokenStore.setSavedAccounts(accounts);
    return { success: true };
  });

  /**
   * Get saved accounts
   */
  ipcMain.handle('auth:getSavedAccounts', async () => {
    return tokenStore.getSavedAccounts();
  });

  /**
   * Clear saved accounts
   */
  ipcMain.handle('auth:clearSavedAccounts', async () => {
    tokenStore.clearSavedAccounts();
    return { success: true };
  });

  // =============================================================================
  // Server Profiles Handlers
  // =============================================================================

  /**
   * Get all server profiles
   */
  ipcMain.handle('profiles:getAll', async () => {
    return tokenStore.getProfiles();
  });

  /**
   * Save all server profiles
   */
  ipcMain.handle('profiles:save', async (event, profiles) => {
    tokenStore.setProfiles(profiles);
    return { success: true };
  });

  /**
   * Get active profile ID
   */
  ipcMain.handle('profiles:getActive', async () => {
    return tokenStore.getActiveProfileId();
  });

  /**
   * Set active profile ID
   */
  ipcMain.handle('profiles:setActive', async (event, id) => {
    tokenStore.setActiveProfileId(id);
    return { success: true };
  });

  /**
   * Clear all profiles
   */
  ipcMain.handle('profiles:clear', async () => {
    tokenStore.clearProfiles();
    return { success: true };
  });

  // =============================================================================
  // Profile Sessions Handlers
  // =============================================================================

  /**
   * Get session for a profile
   */
  ipcMain.handle('sessions:get', async (event, profileId) => {
    return tokenStore.getSession(profileId);
  });

  /**
   * Set session for a profile
   */
  ipcMain.handle('sessions:set', async (event, profileId, session) => {
    tokenStore.setSession(profileId, session);
    return { success: true };
  });

  /**
   * Clear session for a profile
   */
  ipcMain.handle('sessions:clear', async (event, profileId) => {
    tokenStore.clearSession(profileId);
    return { success: true };
  });

  /**
   * Get all sessions
   */
  ipcMain.handle('sessions:getAll', async () => {
    return tokenStore.getAllSessions();
  });

  /**
   * Save all sessions
   */
  ipcMain.handle('sessions:saveAll', async (event, sessions) => {
    tokenStore.setAllSessions(sessions);
    return { success: true };
  });

  /**
   * Clear all sessions
   */
  ipcMain.handle('sessions:clearAll', async () => {
    tokenStore.clearAllSessions();
    return { success: true };
  });

  // =============================================================================
  // OAuth2 Login for Profiles (custom token endpoint)
  // =============================================================================

  /**
   * OAuth2 login with custom token endpoint (for server profiles)
   */
  ipcMain.handle('auth:oauth2Login', async (event, tokenEndpoint, clientId, clientSecret, scope) => {

    try {

      log.info(`[AuthHandler] OAuth2 login to: ${tokenEndpoint}${scope ? ` with scope: ${scope}` : ''}`);

      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      });

      if (scope) {
        params.append('scope', scope);
      }

      const response = await axios.post(tokenEndpoint, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      log.info('[AuthHandler] OAuth2 login successful');
      return response.data;

    } catch (error) {
      log.error('[AuthHandler] OAuth2 login failed:', error.message);
      throw new Error(error.response?.data?.error_description || 'OAuth2 authentication failed');
    }
  });

  log.info('[AuthHandler] Authentication IPC handlers registered successfully');
}

module.exports = { registerAuthHandlers };

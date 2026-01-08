const { ipcMain } = require('electron');
const axios = require('axios');
const tokenStore = require('./token-store');

/**
 * Authentication IPC Handlers
 *
 * Handles OAuth2 Client Credentials authentication with Keycloak
 * Manages tokens, 2FA, and saved accounts via IPC
 */

// Environment configurations
const ENVIRONMENTS = {
  development: {
    name: 'development',
    displayName: 'Development',
    fhirServer: 'https://fhir-adapcare.dev.carebeat-connector.nl',
    authServer: 'https://keycloak.dev.carebeat-connector.nl',
    tokenEndpoint: 'https://keycloak.dev.carebeat-connector.nl/realms/adapcare-careconnector/protocol/openid-connect/token',
    realm: 'adapcare-careconnector',
    grantType: 'client_credentials',
    scope: 'user/*.cruds'
  },
  local: {
    name: 'local',
    displayName: 'Local',
    fhirServer: 'http://localhost:8080/fhir',
    authServer: 'http://localhost:8081',
    tokenEndpoint: 'http://localhost:8081/realms/adapcare-careconnector/protocol/openid-connect/token',
    realm: 'adapcare-careconnector',
    grantType: 'client_credentials',
    scope: 'user/*.cruds'
  },
  acceptance: {
    name: 'acceptance',
    displayName: 'Acceptance',
    fhirServer: 'https://fhir.acc.carebeat-connector.nl/fhir',
    authServer: 'https://keycloak.acc.carebeat-connector.nl',
    tokenEndpoint: 'https://keycloak.acc.carebeat-connector.nl/realms/adapcare-careconnector/protocol/openid-connect/token',
    realm: 'adapcare-careconnector',
    grantType: 'client_credentials',
    scope: 'user/*.cruds'
  },
  production: {
    name: 'production',
    displayName: 'Production',
    fhirServer: 'https://fhir.carebeat-connector.nl/fhir',
    authServer: 'https://keycloak.carebeat-connector.nl',
    tokenEndpoint: 'https://keycloak.carebeat-connector.nl/realms/adapcare-careconnector/protocol/openid-connect/token',
    realm: 'adapcare-careconnector',
    grantType: 'client_credentials',
    scope: 'user/*.cruds'
  }
};

/**
 * Register all authentication IPC handlers
 */
function registerAuthHandlers() {
  console.log('[AuthHandler] Registering authentication IPC handlers');

  // =============================================================================
  // OAuth2 Authentication Handlers
  // =============================================================================

  /**
   * Start OAuth2 Client Credentials login
   */
  ipcMain.handle('auth:login', async (event, clientId, clientSecret, environment) => {
    try {
      console.log(`[AuthHandler] Starting login for environment: ${environment}`);

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

      console.log('[AuthHandler] Login successful');
      return { success: true };

    } catch (error) {
      console.error('[AuthHandler] Login failed:', error.message);
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

  console.log('[AuthHandler] Authentication IPC handlers registered successfully');
}

module.exports = { registerAuthHandlers };

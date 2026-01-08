const { ipcMain } = require('electron');
const axios = require('axios');

/**
 * Terminology Service IPC Handler
 *
 * Handles FHIR Terminology Service operations via Electron IPC
 * Implements OAuth2 password grant authentication with automatic token management
 */

// Configuration
const TERMINOLOGY_CONFIG = {
  baseUrl: 'https://terminologieserver.nl',
  authUrl: 'https://terminologieserver.nl/authorisation/auth/realms/nictiz/protocol/openid-connect/token',
  user: 'm.schimmel@adapcare.nl',
  password: 'JoopEnKaas2016',
  clientId: 'cli_client',
  grantType: 'password'
};

// Token management
let accessToken = null;
let tokenExpiry = 0;

/**
 * Acquire OAuth2 token using Resource Owner Password Credentials
 */
async function acquireToken() {
  console.log('[TerminologyHandler] Acquiring OAuth2 token...');

  const params = new URLSearchParams({
    username: TERMINOLOGY_CONFIG.user,
    password: TERMINOLOGY_CONFIG.password,
    client_id: TERMINOLOGY_CONFIG.clientId,
    grant_type: TERMINOLOGY_CONFIG.grantType
  });

  try {
    const response = await axios.post(TERMINOLOGY_CONFIG.authUrl, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      }
    });

    accessToken = response.data.access_token;
    // Set expiry with 60-second buffer
    tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000;

    console.log('[TerminologyHandler] Token acquired successfully, expires in', response.data.expires_in, 'seconds');
    return accessToken;
  } catch (error) {
    console.error('[TerminologyHandler] Token acquisition failed:', error.message);
    throw new Error('Failed to authenticate with terminology server: ' + error.message);
  }
}

/**
 * Ensure we have a valid token (auto-refresh if needed)
 */
async function ensureValidToken() {
  // Check if token is valid (exists and not expired)
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  // Token is missing or expired, acquire new one
  return await acquireToken();
}

/**
 * Make authenticated request to terminology server
 */
async function makeRequest(path, params) {
  // Ensure we have valid token
  const token = await ensureValidToken();

  const url = `${TERMINOLOGY_CONFIG.baseUrl}/fhir${path}`;

  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json'
      },
      params
    });

    return response.data;
  } catch (error) {
    console.error('[TerminologyHandler] Request failed:', error.message);

    // If 401, try refreshing token once
    if (error.response?.status === 401) {
      console.log('[TerminologyHandler] 401 error, refreshing token and retrying...');
      accessToken = null;
      tokenExpiry = 0;
      const newToken = await ensureValidToken();

      const retryResponse = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${newToken}`,
          'Content-Type': 'application/fhir+json',
          'Accept': 'application/fhir+json'
        },
        params
      });

      return retryResponse.data;
    }

    throw error;
  }
}

/**
 * Register all terminology IPC handlers
 */
function registerTerminologyHandlers() {
  console.log('[TerminologyHandler] Registering terminology IPC handlers');

  /**
   * CodeSystem/$lookup operation
   */
  ipcMain.handle('terminology:lookup', async (event, params) => {
    try {
      console.log('[TerminologyHandler] Lookup:', params);

      const queryParams = {
        system: params.system,
        code: params.code
      };

      if (params.version) queryParams.version = params.version;
      if (params.displayLanguage) queryParams.displayLanguage = params.displayLanguage;
      if (params.property) queryParams.property = params.property;

      const result = await makeRequest('/CodeSystem/$lookup', queryParams);
      return result;
    } catch (error) {
      console.error('[TerminologyHandler] Lookup failed:', error.message);
      throw new Error(error.response?.data?.issue?.[0]?.diagnostics || error.message || 'Lookup operation failed');
    }
  });

  /**
   * ValueSet/$expand operation
   */
  ipcMain.handle('terminology:expand', async (event, params) => {
    try {
      console.log('[TerminologyHandler] Expand:', params);

      const queryParams = {
        url: params.url
      };

      if (params.filter) queryParams.filter = params.filter;
      if (params.count !== undefined) queryParams.count = params.count;
      if (params.offset !== undefined) queryParams.offset = params.offset;
      if (params.includeDesignations !== undefined) queryParams.includeDesignations = params.includeDesignations;
      if (params.displayLanguage) queryParams.displayLanguage = params.displayLanguage;

      const result = await makeRequest('/ValueSet/$expand', queryParams);
      return result;
    } catch (error) {
      console.error('[TerminologyHandler] Expand failed:', error.message);
      throw new Error(error.response?.data?.issue?.[0]?.diagnostics || error.message || 'Expand operation failed');
    }
  });

  /**
   * ValueSet/$validate-code operation
   */
  ipcMain.handle('terminology:validateCode', async (event, params) => {
    try {
      console.log('[TerminologyHandler] Validate code:', params);

      const queryParams = {
        url: params.url,
        code: params.code,
        system: params.system
      };

      if (params.display) queryParams.display = params.display;
      if (params.version) queryParams.version = params.version;

      const result = await makeRequest('/ValueSet/$validate-code', queryParams);
      return result;
    } catch (error) {
      console.error('[TerminologyHandler] Validate code failed:', error.message);
      throw new Error(error.response?.data?.issue?.[0]?.diagnostics || error.message || 'Validate operation failed');
    }
  });

  /**
   * ConceptMap/$translate operation
   */
  ipcMain.handle('terminology:translate', async (event, params) => {
    try {
      console.log('[TerminologyHandler] Translate:', params);

      const queryParams = {
        url: params.url,
        code: params.code,
        system: params.system
      };

      if (params.source) queryParams.source = params.source;
      if (params.target) queryParams.target = params.target;

      const result = await makeRequest('/ConceptMap/$translate', queryParams);
      return result;
    } catch (error) {
      console.error('[TerminologyHandler] Translate failed:', error.message);
      throw new Error(error.response?.data?.issue?.[0]?.diagnostics || error.message || 'Translate operation failed');
    }
  });

  /**
   * Get server metadata
   */
  ipcMain.handle('terminology:getMetadata', async () => {
    try {
      console.log('[TerminologyHandler] Getting metadata');
      const result = await makeRequest('/metadata', {});
      return result;
    } catch (error) {
      console.error('[TerminologyHandler] Get metadata failed:', error.message);
      throw new Error(error.message || 'Failed to fetch metadata');
    }
  });

  console.log('[TerminologyHandler] Terminology IPC handlers registered successfully');
}

module.exports = { registerTerminologyHandlers };

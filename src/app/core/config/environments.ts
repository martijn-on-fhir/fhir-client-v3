/**
 * Environment Configuration
 *
 * OAuth2/OIDC endpoints and FHIR server configurations
 * Based on Keycloak realms for different environments
 *
 * NOTE: This application runs exclusively in Electron
 * Configuration is loaded from electron/config/environments.json
 */

export type Environment = 'development' | 'local' | 'acceptance' | 'production';

export interface EnvironmentConfig {
  name: string;
  displayName: string;
  fhirServer: string;
  authServer: string;
  tokenEndpoint: string;
  realm: string;
  grantType: 'client_credentials';
  scope: string;
}

// Cache for loaded environments
let _environments: Record<string, EnvironmentConfig> | null = null;
let _loadPromise: Promise<void> | null = null;

/**
 * Load environments from Electron IPC
 * Called once at app startup
 */
export const loadEnvironments = async (): Promise<void> => {
  if (_environments) {
    return; // Already loaded
  }

  if (_loadPromise) {
    return _loadPromise; // Loading in progress
  }

  _loadPromise = (async () => {
    if (!window.electronAPI?.config) {
      console.error('[Environments] Electron config API not available');
      return;
    }

    try {
      const result = await window.electronAPI.config.getEnvironments();

      if (result.success && result.environments) {
        _environments = result.environments as Record<string, EnvironmentConfig>;
      } else {
        console.error('[Environments] Failed to load:', result.error);k
      }
    } catch (error) {
      console.error('[Environments] Error loading environments:', error);
    }
  })();

  return _loadPromise;
}

/**
 * Get environment configuration
 * Returns undefined if environment not found or not loaded
 */
export const getEnvironmentConfig = (env: Environment): EnvironmentConfig | undefined => {
  if (!_environments) {
    console.warn('[Environments] Config not loaded yet. Call loadEnvironments() first.');
    return undefined;
  }

  return _environments[env];
}

/**
 * Get all available environments
 */
export const getAvailableEnvironments = (): Environment[] => {
  if (!_environments) {
    console.warn('[Environments] Config not loaded yet. Call loadEnvironments() first.');
    return [];
  }

  return Object.keys(_environments) as Environment[];
}

/**
 * Check if environments are loaded
 */
export const isEnvironmentsLoaded = (): boolean => _environments !== null

import { Environment } from '../config/environments';

/**
 * OAuth2 Token Response
 */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
}

/**
 * Stored Token Data
 * Includes additional metadata for token management
 */
export interface StoredToken {
  access_token: string;
  refresh_token?: string;
  expires_at: number; // timestamp in milliseconds
  scope: string;
  token_type: string;
  fhir_server?: string;
  client_id?: string;
  client_secret?: string; // stored for automatic re-authentication
  environment?: Environment;
  patient?: string;
  id_token?: string;
}

/**
 * Login Credentials
 */
export interface LoginCredentials {
  clientId: string;
  clientSecret: string;
  environment: Environment;
}

/**
 * Saved Account (for "Remember Me" functionality)
 */
export interface SavedAccount {
  id: string;
  name: string;
  clientId: string;
  clientSecret?: string; // Encrypted in electron-store
  environment: Environment;
  lastUsed: number;
  autoLogin?: boolean; // Auto-login on app start
}

/**
 * Authentication State
 */
export interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  expiresAt: number | null;
  environment: Environment | null;
  clientId: string | null;
  twoFactorEnabled: boolean;
  twoFactorVerified: boolean;
}

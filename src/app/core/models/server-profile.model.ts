/**
 * Authentication type for server profiles
 */
export type AuthType = 'none' | 'basic' | 'bearer' | 'oauth2' | 'mtls';

/**
 * Authentication configuration based on auth type
 */
export interface AuthConfig {
  // OAuth2 (client credentials)
  clientId?: string;
  clientSecret?: string;
  tokenEndpoint?: string;
  // Basic auth
  username?: string;
  password?: string;
  // Bearer token (static)
  bearerToken?: string;
}

/**
 * Server Profile
 * Represents a configured FHIR server with authentication settings
 */
export interface ServerProfile {
  /** Unique identifier */
  id: string;
  /** User-friendly name */
  name: string;
  /** FHIR server base URL */
  fhirServerUrl: string;
  /** Authentication type */
  authType: AuthType;
  /** Authentication configuration */
  authConfig?: AuthConfig;
  /** Reference to certificate in certificate manager (for mTLS) */
  mtlsCertificateId?: string;
  /** Color for visual indicator (hex color) */
  color?: string;
  /** Auto-select this profile on app start */
  isDefault?: boolean;
  /** Last used timestamp in milliseconds */
  lastUsed?: number;
}

/**
 * Server Session
 * Represents an active session for a server profile
 */
export interface ServerSession {
  /** Profile this session belongs to */
  profileId: string;
  /** OAuth2/Bearer access token */
  accessToken?: string;
  /** Token expiration timestamp in milliseconds */
  expiresAt?: number;
  /** Whether this session is currently active */
  isActive: boolean;
}

/**
 * Predefined profile colors for quick selection
 */
export const PROFILE_COLORS = [
  '#28a745', // Green - Production
  '#ffc107', // Yellow - Acceptance
  '#17a2b8', // Cyan - Development
  '#6c757d', // Gray - Local
  '#dc3545', // Red - Warning/Test
  '#6f42c1', // Purple
  '#fd7e14', // Orange
  '#20c997', // Teal
];

/**
 * Default profile template for new profiles
 */
export const DEFAULT_PROFILE: Partial<ServerProfile> = {
  authType: 'none',
  color: PROFILE_COLORS[2], // Cyan/Development
  isDefault: false,
};

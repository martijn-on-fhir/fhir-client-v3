/**
 * Settings Models
 *
 * Interfaces for application settings and preferences
 */

/**
 * UI Settings - User interface preferences
 */
export interface UISettings {
  theme: 'light' | 'dark';
  logViewerEnabled: boolean;
  sidebarVisible: boolean;
  sidebarWidth: number; // Width in pixels (150-500)
  enabledTabs: string[]; // List of enabled tab IDs
}

/**
 * Application Settings - Complete settings object
 */
export interface AppSettings {
  ui: UISettings;
  version: string;
  lastModified: number;
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: AppSettings = {
  ui: {
    theme: 'light',
    logViewerEnabled: false,
    sidebarVisible: true,
    sidebarWidth: 250,
    enabledTabs: ['query', 'predefined', 'terminology', 'validator', 'profiles', 'nictiz', 'fhirpath', 'pluriform', 'logs']
  },
  version: '3.0.0',
  lastModified: Date.now()
};

/**
 * Settings Models
 *
 * Interfaces for application settings and preferences
 */

/**
 * General Settings - General application preferences
 */
export interface GeneralSettings {
  pluriformBaseUrl: string;
}

/**
 * Notification Settings - Notification preferences
 */
export interface NotificationSettings {
  loginNotificationEnabled: boolean;
}

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
  general: GeneralSettings;
  ui: UISettings;
  notifications: NotificationSettings;
  version: string;
  lastModified: number;
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    pluriformBaseUrl: 'http://localhost:3030'
  },
  ui: {
    theme: 'light',
    logViewerEnabled: false,
    sidebarVisible: true,
    sidebarWidth: 250,
    enabledTabs: ['query', 'predefined', 'terminology', 'validator', 'profiles', 'nictiz', 'fhirpath', 'pluriform', 'resource-info', 'logs', 'subscriptions', 'narratives', 'reference-graph', 'bulk-import-export']
  },
  notifications: {
    loginNotificationEnabled: true
  },
  version: '3.0.0',
  lastModified: Date.now()
};

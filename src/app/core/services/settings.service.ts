import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { AppSettings, UISettings, GeneralSettings, DEFAULT_SETTINGS } from '../models/settings.model';
import { LoggerService } from './logger.service';

/**
 * Settings Service
 *
 * Manages application settings and preferences using Signals
 * Persists settings to localStorage
 */
@Injectable({
  providedIn: 'root'
})
export class SettingsService {

  /**
   * LocalStorage key for persisting application settings
   */
  private readonly STORAGE_KEY = 'fhir_app_settings';

  /**
   * Logger service instance
   */
  private loggerService = inject(LoggerService);

  /**
   * Component-specific logger
   */
  private logger = this.loggerService.component('SettingsService');

  /**
   * Application settings state signal
   */
  private settings = signal<AppSettings>(this.loadSettings());

  /**
   * Computed signal for current theme setting
   */
  readonly theme = computed(() => this.settings().ui.theme);

  /**
   * Computed signal for log viewer enabled state
   */
  readonly logViewerEnabled = computed(() => this.settings().ui.logViewerEnabled);

  /**
   * Computed signal for sidebar visibility state
   */
  readonly sidebarVisible = computed(() => this.settings().ui.sidebarVisible);

  /**
   * Computed signal for sidebar width in pixels
   */
  readonly sidebarWidth = computed(() => this.settings().ui.sidebarWidth);

  /**
   * Computed signal for array of enabled tab IDs
   */
  readonly enabledTabs = computed(() => this.settings().ui.enabledTabs);

  /**
   * Computed signal for pluriform base URL
   */
  readonly pluriformBaseUrl = computed(() => this.settings().general.pluriformBaseUrl);

  constructor() {
    effect(() => {
      this.saveSettings(this.settings());
    });
  }

  /**
   * Get all settings
   * @returns Current application settings
   */
  getSettings(): AppSettings {
    return this.settings();
  }

  /**
   * Update general settings
   * @param generalSettings Partial general settings to merge with current settings
   */
  updateGeneralSettings(generalSettings: Partial<GeneralSettings>): void {
    this.settings.update(current => ({
      ...current,
      general: {
        ...current.general,
        ...generalSettings
      },
      lastModified: Date.now()
    }));
  }

  /**
   * Update UI settings
   * @param uiSettings Partial UI settings to merge with current settings
   */
  updateUISettings(uiSettings: Partial<UISettings>): void {
    this.settings.update(current => ({
      ...current,
      ui: {
        ...current.ui,
        ...uiSettings
      },
      lastModified: Date.now()
    }));
  }

  /**
   * Toggle theme
   */
  toggleTheme(): void {
    const newTheme = this.theme() === 'light' ? 'dark' : 'light';
    this.updateUISettings({ theme: newTheme });
  }

  /**
   * Set theme
   * @param theme Theme to apply ('light' or 'dark')
   */
  setTheme(theme: 'light' | 'dark'): void {
    this.updateUISettings({ theme });
  }

  /**
   * Toggle log viewer
   */
  toggleLogViewer(): void {
    this.updateUISettings({ logViewerEnabled: !this.logViewerEnabled() });
  }

  /**
   * Enable log viewer
   */
  enableLogViewer(): void {
    this.updateUISettings({ logViewerEnabled: true });
  }

  /**
   * Disable log viewer
   */
  disableLogViewer(): void {
    this.updateUISettings({ logViewerEnabled: false });
  }

  /**
   * Toggle sidebar visibility
   */
  toggleSidebar(): void {
    this.updateUISettings({ sidebarVisible: !this.sidebarVisible() });
  }

  /**
   * Set sidebar width
   * @param width Desired width in pixels (constrained to 150-500px range)
   */
  setSidebarWidth(width: number): void {
    const constrainedWidth = Math.min(Math.max(width, 150), 500);
    this.updateUISettings({ sidebarWidth: constrainedWidth });
  }

  /**
   * Show sidebar
   */
  showSidebar(): void {
    this.updateUISettings({ sidebarVisible: true });
  }

  /**
   * Hide sidebar
   */
  hideSidebar(): void {
    this.updateUISettings({ sidebarVisible: false });
  }

  /**
   * Check if a tab is enabled
   * @param tabId ID of the tab to check
   * @returns True if the tab is enabled, false otherwise
   */
  isTabEnabled(tabId: string): boolean {
    return this.enabledTabs().includes(tabId);
  }

  /**
   * Toggle tab visibility
   * @param tabId ID of the tab to toggle
   */
  toggleTab(tabId: string): void {
    const currentTabs = this.enabledTabs();
    const newTabs = currentTabs.includes(tabId)
      ? currentTabs.filter(id => id !== tabId)
      : [...currentTabs, tabId];
    this.updateUISettings({ enabledTabs: newTabs });
  }

  /**
   * Enable a tab
   * @param tabId ID of the tab to enable
   */
  enableTab(tabId: string): void {
    const currentTabs = this.enabledTabs();
    if (!currentTabs.includes(tabId)) {
      this.updateUISettings({ enabledTabs: [...currentTabs, tabId] });
    }
  }

  /**
   * Disable a tab
   * @param tabId ID of the tab to disable
   */
  disableTab(tabId: string): void {
    const currentTabs = this.enabledTabs();
    this.updateUISettings({ enabledTabs: currentTabs.filter(id => id !== tabId) });
  }

  /**
   * Set Pluriform base URL
   * @param url Base URL for Pluriform API endpoint
   */
  setPluriformBaseUrl(url: string): void {
    this.updateGeneralSettings({ pluriformBaseUrl: url });
  }

  /**
   * Reset settings to defaults
   */
  resetSettings(): void {
    this.settings.set({
      ...DEFAULT_SETTINGS,
      lastModified: Date.now()
    });
  }

  /**
   * Load settings from localStorage
   * @returns Loaded settings merged with defaults, or default settings if loading fails
   */
  private loadSettings(): AppSettings {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          general: {
            ...DEFAULT_SETTINGS.general,
            ...parsed.general
          },
          ui: {
            ...DEFAULT_SETTINGS.ui,
            ...parsed.ui
          }
        };
      }
    } catch (error) {
      this.logger.error('Failed to load settings:', error);
    }
    return DEFAULT_SETTINGS;
  }

  /**
   * Save settings to localStorage
   * @param settings Settings object to persist
   */
  private saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      this.logger.error('Failed to save settings:', error);
    }
  }
}

import { Injectable, signal, computed, effect } from '@angular/core';
import { AppSettings, UISettings, DEFAULT_SETTINGS } from '../models/settings.model';

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
  private readonly STORAGE_KEY = 'fhir_app_settings';

  // Settings state
  private settings = signal<AppSettings>(this.loadSettings());

  // Public computed values
  readonly theme = computed(() => this.settings().ui.theme);
  readonly logViewerEnabled = computed(() => this.settings().ui.logViewerEnabled);
  readonly sidebarVisible = computed(() => this.settings().ui.sidebarVisible);
  readonly sidebarWidth = computed(() => this.settings().ui.sidebarWidth);
  readonly enabledTabs = computed(() => this.settings().ui.enabledTabs);

  constructor() {
    // Auto-save settings whenever they change
    effect(() => {
      this.saveSettings(this.settings());
    });
  }

  /**
   * Get all settings
   */
  getSettings(): AppSettings {
    return this.settings();
  }

  /**
   * Update UI settings
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
   */
  setSidebarWidth(width: number): void {
    // Constrain to 150-500px range
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
   */
  isTabEnabled(tabId: string): boolean {
    return this.enabledTabs().includes(tabId);
  }

  /**
   * Toggle tab visibility
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
   */
  enableTab(tabId: string): void {
    const currentTabs = this.enabledTabs();
    if (!currentTabs.includes(tabId)) {
      this.updateUISettings({ enabledTabs: [...currentTabs, tabId] });
    }
  }

  /**
   * Disable a tab
   */
  disableTab(tabId: string): void {
    const currentTabs = this.enabledTabs();
    this.updateUISettings({ enabledTabs: currentTabs.filter(id => id !== tabId) });
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
   */
  private loadSettings(): AppSettings {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle version upgrades
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          ui: {
            ...DEFAULT_SETTINGS.ui,
            ...parsed.ui
          }
        };
      }
    } catch (error) {
      console.error('[SettingsService] Failed to load settings:', error);
    }
    return DEFAULT_SETTINGS;
  }

  /**
   * Save settings to localStorage
   */
  private saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('[SettingsService] Failed to save settings:', error);
    }
  }
}

import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, computed, inject, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ServerProfile } from '../../../core/models/server-profile.model';
import { APP_TABS } from '../../../core/models/tab.model';
import { AuthService } from '../../../core/services/auth.service';
import { LoggerService } from '../../../core/services/logger.service';
import { ServerProfileService } from '../../../core/services/server-profile.service';
import { SettingsService } from '../../../core/services/settings.service';
import { ThemeService } from '../../../core/services/theme.service';
import { ToastService } from '../../../core/services/toast.service';
import { ServerProfileDialogComponent } from '../server-profile-dialog/server-profile-dialog.component';

/**
 * Settings Dialog Component
 *
 * Comprehensive settings management with sections for:
 * - Server Profiles Management
 * - Two-Factor Authentication
 * - UI Preferences
 * - Server Information
 */
@Component({
  selector: 'app-settings-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ServerProfileDialogComponent],
  templateUrl: './settings-dialog.component.html',
  styleUrls: ['./settings-dialog.component.scss']
})
export class SettingsDialogComponent implements OnInit {
  private authService = inject(AuthService);
  private profileService = inject(ServerProfileService);
  private settingsService = inject(SettingsService);
  private themeService = inject(ThemeService);
  private toastService = inject(ToastService);
  private loggerService = inject(LoggerService);
  private router = inject(Router);
  private logger = this.loggerService.component('SettingsDialogComponent');

  @ViewChild(ServerProfileDialogComponent) profileDialog!: ServerProfileDialogComponent;

  // Dialog state
  isOpen = signal(false);
  activeTab = signal<'general' | 'servers' | '2fa' | 'ui' | 'server'>('general');

  // Server Profiles
  readonly profiles = this.profileService.sortedProfiles;
  readonly activeProfile = this.profileService.activeProfile;
  readonly activeProfileId = this.profileService.activeProfileId;

  // 2FA
  twoFactorEnabled = signal(false);
  twoFactorSecret = signal('');
  twoFactorQRCode = signal('');
  showQRCode = signal(false);
  verificationCode = signal('');
  twoFactorError = signal<string | null>(null);

  // General Settings
  pluriformBaseUrl = signal('');

  // UI Settings
  readonly theme = computed(() => this.themeService.currentTheme());
  readonly logViewerEnabled = computed(() => this.settingsService.logViewerEnabled());
  readonly enabledTabs = computed(() => this.settingsService.enabledTabs());

  // Notification Settings
  readonly loginNotificationEnabled = computed(() => this.settingsService.loginNotificationEnabled());

  // Available tabs
  availableTabs = APP_TABS;

  // Loading states
  loading = signal(false);

  async ngOnInit() {
    await this.loadData();
  }

  /**
   * Load initial data
   */
  async loadData() {
    const twoFactorEnabled = await this.authService.isTwoFactorEnabled();
    this.twoFactorEnabled.set(twoFactorEnabled);
    this.pluriformBaseUrl.set(this.settingsService.pluriformBaseUrl());
  }

  /**
   * Open dialog
   */
  open() {
    this.isOpen.set(true);
    this.loadData();
  }

  /**
   * Close dialog
   */
  close() {
    this.isOpen.set(false);
    this.resetForms();
  }

  /**
   * Switch tab
   */
  switchTab(tab: 'general' | 'servers' | '2fa' | 'ui' | 'server') {
    this.activeTab.set(tab);
    this.resetForms();
  }

  // =============================================================================
  // General Settings
  // =============================================================================

  /**
   * Save Pluriform base URL
   */
  savePlurifromBaseUrl() {
    const url = this.pluriformBaseUrl().trim();

    if (!url) {
      this.toastService.error('URL mag niet leeg zijn');

      return;
    }

    this.settingsService.setPluriformBaseUrl(url);
    this.toastService.success('Pluriform URL opgeslagen');
  }

  // =============================================================================
  // Server Profile Management
  // =============================================================================

  /**
   * Open add profile dialog
   */
  openAddProfile() {
    this.profileDialog.openAdd();
  }

  /**
   * Open edit profile dialog
   */
  openEditProfile(profile: ServerProfile) {
    this.profileDialog.openEdit(profile);
  }

  /**
   * Delete profile
   */
  async deleteProfile(profile: ServerProfile) {
    if (!confirm(`Server "${profile.name}" verwijderen?`)) {
      return;
    }

    this.loading.set(true);

    try {
      await this.profileService.deleteProfile(profile.id);
      this.toastService.success(`Server "${profile.name}" verwijderd`);
    } catch (error) {
      this.logger.error('Failed to delete profile:', error);
      this.toastService.error('Verwijderen mislukt');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Get auth type label
   */
  getAuthTypeLabel(authType: string): string {
    switch (authType) {
      case 'none': return 'Open';
      case 'basic': return 'Basic';
      case 'bearer': return 'Token';
      case 'oauth2': return 'OAuth2';
      case 'mtls': return 'mTLS';
      default: return authType;
    }
  }

  /**
   * Get auth type icon
   */
  getAuthTypeIcon(authType: string): string {
    switch (authType) {
      case 'none': return 'fa-unlock';
      case 'basic': return 'fa-user-lock';
      case 'bearer': return 'fa-key';
      case 'oauth2': return 'fa-shield-alt';
      case 'mtls': return 'fa-certificate';
      default: return 'fa-server';
    }
  }

  // =============================================================================
  // Two-Factor Authentication
  // =============================================================================

  /**
   * Enable 2FA
   */
  async enable2FA() {
    this.loading.set(true);
    this.twoFactorError.set(null);

    try {
      const { secret, qrCode } = await this.authService.enableTwoFactor('FHIR Client MX');
      this.twoFactorSecret.set(secret);
      this.twoFactorQRCode.set(qrCode);
      this.showQRCode.set(true);
    } catch (error: any) {
      this.twoFactorError.set(error.message || 'Failed to enable 2FA');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Verify and save 2FA
   */
  async verify2FA() {
    this.loading.set(true);
    this.twoFactorError.set(null);

    try {
      const success = await this.authService.verifyAndSaveTwoFactor(
        this.twoFactorSecret(),
        this.verificationCode()
      );

      if (success) {
        this.twoFactorEnabled.set(true);
        this.showQRCode.set(false);
        this.verificationCode.set('');
        this.twoFactorSecret.set('');
        this.twoFactorQRCode.set('');
      } else {
        this.twoFactorError.set('Invalid verification code');
      }
    } catch (error: any) {
      this.twoFactorError.set(error.message || 'Verification failed');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Disable 2FA
   */
  async disable2FA() {
    if (!confirm('Weet je zeker dat je twee-factor authenticatie wilt uitschakelen?')) {
      return;
    }

    this.loading.set(true);

    try {
      await this.authService.disableTwoFactor();
      this.twoFactorEnabled.set(false);
      this.showQRCode.set(false);
    } catch (error) {
      this.logger.error('Failed to disable 2FA:', error);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Cancel 2FA setup
   */
  cancel2FASetup() {
    this.showQRCode.set(false);
    this.verificationCode.set('');
    this.twoFactorSecret.set('');
    this.twoFactorQRCode.set('');
    this.twoFactorError.set(null);
  }

  /**
   * Copy 2FA secret to clipboard
   */
  async copy2FASecret() {
    try {
      await navigator.clipboard.writeText(this.twoFactorSecret());
      this.toastService.success('Secret gekopieerd naar klembord');
    } catch (error) {
      this.logger.error('Failed to copy secret:', error);
    }
  }

  // =============================================================================
  // UI Preferences
  // =============================================================================

  /**
   * Toggle theme
   */
  toggleTheme() {
    this.themeService.toggleTheme();
  }

  /**
   * Toggle login notification
   */
  toggleLoginNotification() {
    this.settingsService.toggleLoginNotification();
  }

  /**
   * Toggle log viewer
   */
  toggleLogViewer() {
    this.settingsService.toggleLogViewer();
  }

  /**
   * Toggle tab visibility
   */
  toggleTabVisibility(tabId: string) {
    this.settingsService.toggleTab(tabId);
  }

  /**
   * Check if a tab is enabled
   */
  isTabEnabled(tabId: string): boolean {
    return this.enabledTabs().includes(tabId);
  }

  /**
   * Reset settings to defaults
   */
  resetSettings() {
    if (!confirm('Alle UI instellingen terugzetten naar standaard?')) {
      return;
    }

    this.settingsService.resetSettings();
    this.toastService.success('Instellingen gereset');
  }

  // =============================================================================
  // Helpers
  // =============================================================================

  /**
   * Reset all forms
   */
  private resetForms() {
    this.cancel2FASetup();
  }

  /**
   * Format last used date
   */
  formatLastUsed(timestamp: number | undefined): string {
    if (!timestamp) {
return 'Nooit';
}

    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) {
return 'Zojuist';
}

    if (minutes < 60) {
return `${minutes}m geleden`;
}

    if (hours < 24) {
return `${hours}u geleden`;
}

    if (days < 7) {
return `${days}d geleden`;
}

    return new Date(timestamp).toLocaleDateString();
  }

  /**
   * Logout
   */
  async logout() {
    if (!confirm('Weet je zeker dat je wilt uitloggen?')) {
      return;
    }

    await this.profileService.logout();
    this.close();
    this.router.navigate(['/login']);
  }
}

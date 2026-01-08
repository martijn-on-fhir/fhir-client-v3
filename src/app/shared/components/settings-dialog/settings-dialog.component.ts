import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { SettingsService } from '../../../core/services/settings.service';
import { ThemeService } from '../../../core/services/theme.service';
import { LoggerService } from '../../../core/services/logger.service';
import { SavedAccount } from '../../../core/models/auth.model';
import { Environment, getAvailableEnvironments } from '../../../core/config/environments';
import { APP_TABS } from '../../../core/models/tab.model';

/**
 * Settings Dialog Component
 *
 * Comprehensive settings management with sections for:
 * - Account Management (Saved FHIR credentials)
 * - Two-Factor Authentication
 * - UI Preferences
 * - Server Information
 */
@Component({
  selector: 'app-settings-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings-dialog.component.html',
  styleUrls: ['./settings-dialog.component.scss']
})
export class SettingsDialogComponent implements OnInit {
  private authService = inject(AuthService);
  private settingsService = inject(SettingsService);
  private themeService = inject(ThemeService);
  private loggerService = inject(LoggerService);
  private logger = this.loggerService.component('SettingsDialogComponent');

  // Dialog state
  isOpen = signal(false);
  activeTab = signal<'accounts' | '2fa' | 'ui' | 'server'>('accounts');

  // Account Management
  savedAccounts = signal<SavedAccount[]>([]);
  editingAccount = signal<SavedAccount | null>(null);
  isAddingAccount = signal(false);
  accountForm = signal({
    name: '',
    clientId: '',
    environment: 'development' as Environment
  });

  // 2FA
  twoFactorEnabled = signal(false);
  twoFactorSecret = signal('');
  twoFactorQRCode = signal('');
  showQRCode = signal(false);
  verificationCode = signal('');
  twoFactorError = signal<string | null>(null);

  // UI Settings
  readonly theme = computed(() => this.themeService.currentTheme());
  readonly logViewerEnabled = computed(() => this.settingsService.logViewerEnabled());
  readonly enabledTabs = computed(() => this.settingsService.enabledTabs());

  // Available tabs
  availableTabs = APP_TABS;

  // Server Info
  readonly currentEnvironment = computed(() => this.authService.environment());
  readonly isAuthenticated = computed(() => this.authService.isAuthenticated());

  // Available environments
  availableEnvironments = getAvailableEnvironments();

  // Loading states
  loading = signal(false);

  async ngOnInit() {
    await this.loadData();
  }

  /**
   * Load initial data
   */
  async loadData() {
    const accounts = await this.authService.getSavedAccounts();
    this.savedAccounts.set(accounts.sort((a, b) => b.lastUsed - a.lastUsed));

    const twoFactorEnabled = await this.authService.isTwoFactorEnabled();
    this.twoFactorEnabled.set(twoFactorEnabled);
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
  switchTab(tab: 'accounts' | '2fa' | 'ui' | 'server') {
    this.activeTab.set(tab);
    this.resetForms();
  }

  // =============================================================================
  // Account Management
  // =============================================================================

  /**
   * Start adding new account
   */
  startAddAccount() {
    this.isAddingAccount.set(true);
    this.editingAccount.set(null);
    this.accountForm.set({
      name: '',
      clientId: '',
      environment: 'development'
    });
  }

  /**
   * Start editing account
   */
  startEditAccount(account: SavedAccount) {
    this.isAddingAccount.set(false);
    this.editingAccount.set(account);
    this.accountForm.set({
      name: account.name,
      clientId: account.clientId,
      environment: account.environment
    });
  }

  /**
   * Save account (add or update)
   */
  async saveAccount() {
    const form = this.accountForm();

    if (!form.name || !form.clientId) {
      return;
    }

    this.loading.set(true);

    try {
      if (this.editingAccount()) {
        // Update existing account
        const updated: SavedAccount = {
          ...this.editingAccount()!,
          name: form.name,
          clientId: form.clientId,
          environment: form.environment,
          lastUsed: Date.now()
        };

        // Remove old and add updated
        await this.authService.removeSavedAccount(updated.id);
        await this.authService.saveAccount({
          name: updated.name,
          clientId: updated.clientId,
          environment: updated.environment
        });
      } else {
        // Add new account
        await this.authService.saveAccount({
          name: form.name,
          clientId: form.clientId,
          environment: form.environment
        });
      }

      await this.loadData();
      this.cancelAccountEdit();
    } catch (error) {
      this.logger.error('Failed to save account:', error);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Delete account
   */
  async deleteAccount(accountId: string) {
    if (!confirm('Are you sure you want to delete this account?')) {
      return;
    }

    this.loading.set(true);

    try {
      await this.authService.removeSavedAccount(accountId);
      await this.loadData();
    } catch (error) {
      this.logger.error('Failed to delete account:', error);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Cancel account edit
   */
  cancelAccountEdit() {
    this.isAddingAccount.set(false);
    this.editingAccount.set(null);
    this.accountForm.set({
      name: '',
      clientId: '',
      environment: 'development'
    });
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
      const { secret, qrCode } = await this.authService.enableTwoFactor('FHIR Client Account');
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
    if (!confirm('Are you sure you want to disable two-factor authentication?')) {
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
      alert('Secret copied to clipboard!');
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
    if (!confirm('Reset all UI settings to defaults?')) {
      return;
    }

    this.settingsService.resetSettings();
  }

  // =============================================================================
  // Helpers
  // =============================================================================

  /**
   * Reset all forms
   */
  private resetForms() {
    this.cancelAccountEdit();
    this.cancel2FASetup();
  }

  /**
   * Format last used date
   */
  formatLastUsed(timestamp: number): string {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString();
  }

  /**
   * Logout
   */
  async logout() {
    if (!confirm('Are you sure you want to logout?')) {
      return;
    }

    await this.authService.logout().toPromise();
    this.close();
  }
}

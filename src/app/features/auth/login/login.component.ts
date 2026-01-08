import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { Environment, getAvailableEnvironments } from '../../../core/config/environments';
import { SavedAccount } from '../../../core/models/auth.model';

/**
 * Login Component
 *
 * Handles user authentication with:
 * - Environment selection
 * - Client credentials input
 * - Saved accounts management
 * - 2FA integration
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Form state
  clientId = signal('');
  clientSecret = signal('');
  selectedEnvironment = signal<Environment>('development');
  rememberMe = signal(false);
  autoLogin = signal(false);
  accountName = signal('');

  // UI state
  loading = signal(false);
  error = signal<string | null>(null);
  showPassword = signal(false);
  show2FAVerification = signal(false);
  twoFactorCode = signal('');

  // Saved accounts
  savedAccounts = signal<SavedAccount[]>([]);
  selectedAccount = signal<SavedAccount | null>(null);

  // Available environments
  availableEnvironments = getAvailableEnvironments();

  async ngOnInit() {
    // Load saved accounts
    const accounts = await this.authService.getSavedAccounts();
    this.savedAccounts.set(accounts.sort((a, b) => b.lastUsed - a.lastUsed));

    // Auto-login with most recent account if autoLogin is enabled
    if (accounts.length > 0 && accounts[0].autoLogin && accounts[0].clientSecret) {
      this.selectAccount(accounts[0]);
      await this.performAutoLogin();
    } else if (accounts.length > 0) {
      // Just select without auto-login
      this.selectAccount(accounts[0]);
    }
  }

  /**
   * Select a saved account
   */
  selectAccount(account: SavedAccount) {
    this.selectedAccount.set(account);
    this.clientId.set(account.clientId);
    this.clientSecret.set(account.clientSecret || '');
    this.selectedEnvironment.set(account.environment);
    this.accountName.set(account.name);
    this.autoLogin.set(account.autoLogin || false);
    this.error.set(null);
  }

  /**
   * Remove a saved account
   */
  async removeSavedAccount(event: Event, accountId: string) {
    event.stopPropagation();

    if (confirm('Remove this saved account?')) {
      await this.authService.removeSavedAccount(accountId);
      const accounts = await this.authService.getSavedAccounts();
      this.savedAccounts.set(accounts);

      if (this.selectedAccount()?.id === accountId) {
        this.selectedAccount.set(null);
        this.clientId.set('');
        this.clientSecret.set('');
        this.accountName.set('');
        this.rememberMe.set(false);
        this.autoLogin.set(false);
      }
    }
  }

  /**
   * Handle login form submission
   */
  async onLogin() {
    this.error.set(null);

    // Validation
    if (!this.clientId() || !this.clientSecret()) {
      this.error.set('Please enter both Client ID and Client Secret');
      return;
    }

    // Check for 2FA
    const twoFactorEnabled = await this.authService.isTwoFactorEnabled();

    if (twoFactorEnabled) {
      // Show 2FA verification screen
      this.show2FAVerification.set(true);
      return;
    }

    // Proceed with login
    await this.performLogin();
  }

  /**
   * Verify 2FA code and proceed with login
   */
  async onVerify2FA() {
    this.error.set(null);

    const isValid = await this.authService.verifyTwoFactorCode(this.twoFactorCode());

    if (!isValid) {
      this.error.set('Invalid verification code');
      return;
    }

    // Proceed with login
    await this.performLogin();
  }

  /**
   * Perform auto-login with saved credentials
   */
  private async performAutoLogin() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const success = await this.authService.login({
        clientId: this.clientId(),
        clientSecret: this.clientSecret(),
        environment: this.selectedEnvironment()
      }).toPromise();

      if (success) {
        // Navigate to return URL or default to app
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/app/profiles';
        this.router.navigate([returnUrl]);
      }
    } catch (error: any) {
      // Don't navigate away on auto-login failure, just show error
      this.error.set(error.message || 'Auto-login failed');
      this.clientSecret.set(''); // Clear password on failed auto-login
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Perform the actual login
   */
  private async performLogin() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const success = await this.authService.login({
        clientId: this.clientId(),
        clientSecret: this.clientSecret(),
        environment: this.selectedEnvironment()
      }).toPromise();

      if (success) {
        // Save account if "Save Account" is checked
        if (this.rememberMe() && this.accountName()) {
          await this.authService.saveAccount({
            name: this.accountName(),
            clientId: this.clientId(),
            clientSecret: this.clientSecret(),
            environment: this.selectedEnvironment(),
            autoLogin: this.autoLogin()
          });
        }

        // Navigate to return URL or default to app
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/app/profiles';
        this.router.navigate([returnUrl]);
      }
    } catch (error: any) {
      this.error.set(error.message || 'Authentication failed');
      this.show2FAVerification.set(false);
      this.twoFactorCode.set('');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Cancel 2FA verification
   */
  cancel2FA() {
    this.show2FAVerification.set(false);
    this.twoFactorCode.set('');
    this.error.set(null);
  }

  /**
   * Toggle password visibility
   */
  togglePasswordVisibility() {
    this.showPassword.update(val => !val);
  }

  /**
   * Navigate to 2FA setup
   */
  navigateTo2FASetup() {
    this.router.navigate(['/auth/2fa-setup']);
  }
}

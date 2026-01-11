import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Environment, getAvailableEnvironments } from '../../../core/config/environments';
import { SavedAccount } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Login Component
 *
 * Handles user authentication and account management.
 *
 * Features:
 * - Environment selection (development, test, production)
 * - Client credentials input (OAuth 2.0 client credentials flow)
 * - Saved accounts management with encryption
 * - Auto-login functionality with most recent account
 * - Two-factor authentication (2FA) integration
 * - Password visibility toggle
 * - Return URL navigation after successful login
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {

  /** Service for authentication operations */
  private authService = inject(AuthService);

  /** Angular router for navigation */
  private router = inject(Router);

  /** Current route for accessing query parameters */
  private route = inject(ActivatedRoute);

  /** OAuth 2.0 client ID input value */
  clientId = signal('');

  /** OAuth 2.0 client secret input value */
  clientSecret = signal('');

  /** Currently selected FHIR server environment */
  selectedEnvironment = signal<Environment>('development');

  /** Whether to save account credentials for future use */
  rememberMe = signal(false);

  /** Whether to automatically login with this account on app start */
  autoLogin = signal(false);

  /** User-friendly name for the saved account */
  accountName = signal('');

  /** Loading state during authentication */
  loading = signal(false);

  /** Error message from authentication failures */
  error = signal<string | null>(null);

  /** Whether to show client secret in plain text */
  showPassword = signal(false);

  /** Whether to display 2FA verification screen */
  show2FAVerification = signal(false);

  /** Two-factor authentication code entered by user */
  twoFactorCode = signal('');

  /** List of saved account credentials */
  savedAccounts = signal<SavedAccount[]>([]);

  /** Currently selected saved account */
  selectedAccount = signal<SavedAccount | null>(null);

  /** Array of available FHIR server environments */
  availableEnvironments = getAvailableEnvironments();

  /**
   * Angular lifecycle hook called on component initialization
   *
   * Workflow:
   * 1. Loads saved accounts from secure storage
   * 2. Sorts accounts by last used timestamp
   * 3. Attempts auto-login if most recent account has autoLogin enabled
   * 4. Otherwise selects most recent account without logging in
   *
   * @returns Promise that resolves when initialization completes
   */
  async ngOnInit() {
    const accounts = await this.authService.getSavedAccounts();
    this.savedAccounts.set(accounts.sort((a, b) => b.lastUsed - a.lastUsed));

    if (accounts.length > 0 && accounts[0].autoLogin && accounts[0].clientSecret) {
      this.selectAccount(accounts[0]);
      await this.performAutoLogin();
    } else if (accounts.length > 0) {
      this.selectAccount(accounts[0]);
    }
  }

  /**
   * Selects a saved account and populates the login form
   *
   * Loads the account's credentials and settings into the form fields:
   * - Client ID and secret
   * - Environment selection
   * - Account name and auto-login preference
   * Clears any previous error messages.
   *
   * @param account - The saved account to select and load
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
   * Removes a saved account from secure storage
   *
   * Shows confirmation dialog before deletion.
   * If the deleted account is currently selected, clears the form.
   * Updates the saved accounts list after removal.
   *
   * @param event - Click event (propagation stopped to prevent account selection)
   * @param accountId - Unique identifier of the account to remove
   * @returns Promise that resolves when account is removed
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
   * Handles login form submission
   *
   * Workflow:
   * 1. Validates that both client ID and secret are provided
   * 2. Checks if two-factor authentication is enabled
   * 3. If 2FA is enabled, shows verification screen
   * 4. If 2FA is disabled, proceeds directly with login
   *
   * @returns Promise that resolves when login process completes
   */
  async onLogin() {
    this.error.set(null);

    if (!this.clientId() || !this.clientSecret()) {
      this.error.set('Please enter both Client ID and Client Secret');

      return;
    }

    const twoFactorEnabled = await this.authService.isTwoFactorEnabled();

    if (twoFactorEnabled) {
      this.show2FAVerification.set(true);

      return;
    }

    await this.performLogin();
  }

  /**
   * Verifies two-factor authentication code and proceeds with login
   *
   * Validates the 2FA code entered by the user.
   * If valid, proceeds with login.
   * If invalid, displays error message.
   *
   * @returns Promise that resolves when verification completes
   */
  async onVerify2FA() {
    this.error.set(null);

    const isValid = await this.authService.verifyTwoFactorCode(this.twoFactorCode());

    if (!isValid) {
      this.error.set('Invalid verification code');

      return;
    }

    await this.performLogin();
  }

  /**
   * Performs automatic login with saved credentials
   *
   * Called during component initialization when an account has autoLogin enabled.
   * Attempts to authenticate without user interaction.
   *
   * Workflow:
   * 1. Attempts login with saved credentials
   * 2. On success, navigates to return URL or default profiles page
   * 3. On failure, displays error and clears client secret for security
   * 4. Does not navigate away on failure, allowing user to retry
   *
   * @returns Promise that resolves when auto-login completes
   * @private
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
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/app/profiles';
        this.router.navigate([returnUrl]);
      }
    } catch (error: any) {
      this.error.set(error.message || 'Auto-login failed');
      this.clientSecret.set('');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Performs the actual login authentication
   *
   * Called after validation and 2FA verification (if enabled).
   *
   * Workflow:
   * 1. Attempts OAuth 2.0 client credentials authentication
   * 2. On success, saves account if "Remember Me" is checked
   * 3. Navigates to return URL or default profiles page
   * 4. On failure, displays error and clears 2FA state
   *
   * @returns Promise that resolves when login completes
   * @private
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
        if (this.rememberMe() && this.accountName()) {
          await this.authService.saveAccount({
            name: this.accountName(),
            clientId: this.clientId(),
            clientSecret: this.clientSecret(),
            environment: this.selectedEnvironment(),
            autoLogin: this.autoLogin()
          });
        }

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
   * Cancels two-factor authentication verification
   *
   * Hides the 2FA verification screen and resets the 2FA code input.
   * Clears any error messages.
   * User returns to the main login form.
   */
  cancel2FA() {
    this.show2FAVerification.set(false);
    this.twoFactorCode.set('');
    this.error.set(null);
  }

  /**
   * Toggles the visibility of the client secret field
   *
   * Switches between showing the client secret in plain text
   * and hiding it with password masking.
   */
  togglePasswordVisibility() {
    this.showPassword.update(val => !val);
  }

  /**
   * Navigates to the two-factor authentication setup page
   *
   * Redirects user to configure or manage their 2FA settings.
   */
  navigateTo2FASetup() {
    this.router.navigate(['/auth/2fa-setup']);
  }
}

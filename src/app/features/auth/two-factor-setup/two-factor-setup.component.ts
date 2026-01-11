import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { LoggerService } from '../../../core/services/logger.service';

/**
 * Two-Factor Authentication Setup Component
 *
 * Provides interface for enabling and managing TOTP-based two-factor authentication.
 *
 * Features:
 * - Generates TOTP secret and QR code for authenticator apps
 * - Supports popular authenticator apps (Google Authenticator, Authy, etc.)
 * - Verification code validation before enabling 2FA
 * - Ability to disable 2FA with confirmation
 * - Secret copying to clipboard for manual entry
 * - Setup completion tracking
 * - Navigation back to login after setup
 */
@Component({
  selector: 'app-two-factor-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './two-factor-setup.component.html',
  styleUrls: ['./two-factor-setup.component.scss']
})
export class TwoFactorSetupComponent implements OnInit {

  /** Service for authentication operations */
  private authService = inject(AuthService);

  /** Angular router for navigation */
  private router = inject(Router);

  /** Service for application logging */
  private loggerService = inject(LoggerService);

  /** Component-specific logger instance */
  private logger = this.loggerService.component('TwoFactorSetupComponent');

  /** Generated TOTP secret key */
  secret = signal('');

  /** Base64-encoded QR code image for authenticator app scanning */
  qrCode = signal('');

  /** User-friendly account name displayed in authenticator app */
  accountName = signal('My FHIR Account');

  /** Six-digit verification code entered by user */
  verificationCode = signal('');

  /** Loading state during 2FA operations */
  loading = signal(false);

  /** Error message from 2FA setup or verification failures */
  error = signal<string | null>(null);

  /** Whether 2FA setup has been successfully completed */
  setupComplete = signal(false);

  /** Whether 2FA is currently enabled for the account */
  twoFactorEnabled = signal(false);

  /**
   * Angular lifecycle hook called on component initialization
   *
   * Checks if two-factor authentication is already enabled for the user
   * and updates the twoFactorEnabled signal accordingly.
   *
   * @returns Promise that resolves when initialization completes
   */
  async ngOnInit() {
    this.twoFactorEnabled.set(await this.authService.isTwoFactorEnabled());
  }

  /**
   * Generates new TOTP secret and QR code for 2FA setup
   *
   * Creates a new time-based one-time password (TOTP) secret and generates
   * a QR code image that can be scanned by authenticator apps.
   * Uses the account name to label the account in the authenticator app.
   *
   * Sets loading state during generation and error state on failure.
   *
   * @returns Promise that resolves when secret generation completes
   */
  async generate2FASecret() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const { secret, qrCode } = await this.authService.enableTwoFactor(this.accountName());
      this.secret.set(secret);
      this.qrCode.set(qrCode);
    } catch (error: any) {
      this.error.set(error.message || 'Failed to generate 2FA secret');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Verifies the TOTP code and saves 2FA configuration
   *
   * Validates the six-digit verification code from the user's authenticator app
   * against the generated secret. If valid, enables 2FA for the account and
   * marks setup as complete.
   *
   * Workflow:
   * 1. Verifies the entered code matches the secret
   * 2. On success, enables 2FA and marks setup as complete
   * 3. On failure, displays error message for retry
   *
   * @returns Promise that resolves when verification completes
   */
  async verify2FASetup() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const success = await this.authService.verifyAndSaveTwoFactor(
        this.secret(),
        this.verificationCode()
      );

      if (success) {
        this.setupComplete.set(true);
        this.twoFactorEnabled.set(true);
      } else {
        this.error.set('Invalid verification code. Please try again.');
      }
    } catch (error: any) {
      this.error.set(error.message || 'Verification failed');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Disables two-factor authentication for the account
   *
   * Shows confirmation dialog before disabling.
   * Removes 2FA requirement from the account and clears all setup state.
   * User will no longer need to provide verification codes during login.
   *
   * @returns Promise that resolves when 2FA is disabled
   */
  async disable2FA() {
    if (!confirm('Are you sure you want to disable two-factor authentication?')) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      await this.authService.disableTwoFactor();
      this.twoFactorEnabled.set(false);
      this.secret.set('');
      this.qrCode.set('');
      this.setupComplete.set(false);
    } catch (error: any) {
      this.error.set(error.message || 'Failed to disable 2FA');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Copies the TOTP secret to clipboard
   *
   * Allows users to manually enter the secret into their authenticator app
   * if they cannot scan the QR code. Shows alert on successful copy.
   *
   * @returns Promise that resolves when copy operation completes
   */
  async copySecret() {
    try {
      await navigator.clipboard.writeText(this.secret());
      alert('Secret copied to clipboard!');
    } catch (error) {
      this.logger.error('Failed to copy secret:', error);
    }
  }

  /**
   * Navigates back to the login page
   *
   * Redirects user to the login screen, typically after completing
   * or canceling the 2FA setup process.
   */
  backToLogin() {
    this.router.navigate(['/login']);
  }

  /**
   * Resets the setup flow to start a new 2FA configuration
   *
   * Clears all setup state including:
   * - Secret and QR code
   * - Verification code input
   * - Setup completion status
   * - Error messages
   *
   * Allows user to generate a new secret and QR code.
   */
  startNewSetup() {
    this.secret.set('');
    this.qrCode.set('');
    this.verificationCode.set('');
    this.setupComplete.set(false);
    this.error.set(null);
  }
}

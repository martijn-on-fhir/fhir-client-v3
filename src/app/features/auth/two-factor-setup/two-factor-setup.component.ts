import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { LoggerService } from '../../../core/services/logger.service';

/**
 * Two-Factor Setup Component
 *
 * Allows users to enable TOTP-based 2FA
 * Shows QR code and secret for authenticator apps
 */
@Component({
  selector: 'app-two-factor-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './two-factor-setup.component.html',
  styleUrls: ['./two-factor-setup.component.scss']
})
export class TwoFactorSetupComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private loggerService = inject(LoggerService);
  private logger = this.loggerService.component('TwoFactorSetupComponent');

  // Setup state
  secret = signal('');
  qrCode = signal('');
  accountName = signal('My FHIR Account');
  verificationCode = signal('');

  // UI state
  loading = signal(false);
  error = signal<string | null>(null);
  setupComplete = signal(false);
  twoFactorEnabled = signal(false);

  async ngOnInit() {
    this.twoFactorEnabled.set(await this.authService.isTwoFactorEnabled());
  }

  /**
   * Generate new 2FA secret and QR code
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
   * Verify and save 2FA setup
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
   * Disable 2FA
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
   * Copy secret to clipboard
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
   * Navigate back to login
   */
  backToLogin() {
    this.router.navigate(['/login']);
  }

  /**
   * Start new setup
   */
  startNewSetup() {
    this.secret.set('');
    this.qrCode.set('');
    this.verificationCode.set('');
    this.setupComplete.set(false);
    this.error.set(null);
  }
}

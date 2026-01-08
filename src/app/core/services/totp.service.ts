import { Injectable, inject } from '@angular/core';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { LoggerService } from './logger.service';

/**
 * TOTP Service
 *
 * Handles Time-based One-Time Password (TOTP) generation and verification
 * Used for two-factor authentication (2FA/MFA)
 */
@Injectable({
  providedIn: 'root'
})
export class TotpService {
  private loggerService = inject(LoggerService);
  private logger = this.loggerService.component('TotpService');
  /**
   * Generate a new TOTP secret
   * @param accountName - Account identifier (e.g., email or client ID)
   * @param issuer - Issuer name (app name)
   * @returns Base32-encoded secret string
   */
  generateSecret(accountName: string, issuer: string = 'FHIR Client'): string {
    const totp = new OTPAuth.TOTP({
      issuer,
      label: accountName,
      algorithm: 'SHA1',
      digits: 6,
      period: 30
    });

    return totp.secret.base32;
  }

  /**
   * Generate QR code data URL for authenticator apps
   * @param secret - Base32-encoded TOTP secret
   * @param accountName - Account identifier
   * @param issuer - Issuer name
   * @returns Promise resolving to data URL for QR code image
   */
  async generateQRCode(
    secret: string,
    accountName: string,
    issuer: string = 'FHIR Client'
  ): Promise<string> {
    const totp = new OTPAuth.TOTP({
      issuer,
      label: accountName,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret)
    });

    const otpauthUrl = totp.toString();

    try {
      return await QRCode.toDataURL(otpauthUrl);
    } catch (error) {
      this.logger.error('QR code generation failed:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Verify a TOTP code
   * @param code - 6-digit code from authenticator app
   * @param secret - Base32-encoded TOTP secret
   * @param window - Time window for validation (±window * 30 seconds)
   * @returns true if code is valid, false otherwise
   */
  verifyCode(code: string, secret: string, window: number = 2): boolean {
    try {
      const totp = new OTPAuth.TOTP({
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secret)
      });

      // Validate current code
      const delta = totp.validate({
        token: code,
        window
      });

      // delta is null if invalid, or a number indicating time step difference
      return delta !== null;
    } catch (error) {
      this.logger.error('Code verification failed:', error);
      return false;
    }
  }

  /**
   * Generate current TOTP code (for testing purposes)
   * @param secret - Base32-encoded TOTP secret
   * @returns Current 6-digit TOTP code
   */
  generateCurrentCode(secret: string): string {
    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret)
    });

    return totp.generate();
  }

  /**
   * Get time remaining until next code
   * @returns Seconds remaining until next 30-second period
   */
  getTimeRemaining(): number {
    const now = Math.floor(Date.now() / 1000);
    const period = 30;
    return period - (now % period);
  }
}

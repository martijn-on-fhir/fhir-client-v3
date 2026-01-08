import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, from, throwError, of } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import {
  LoginCredentials,
  TokenResponse,
  StoredToken,
  AuthState,
  SavedAccount
} from '../models/auth.model';
import { Environment } from '../config/environments';
import { TotpService } from './totp.service';

/**
 * Authentication Service
 *
 * Handles OAuth2 Client Credentials authentication with Keycloak via Electron IPC
 * Manages tokens, 2FA, and authentication state
 *
 * Note: Uses Electron's main process for OAuth requests to bypass CORS restrictions
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private router = inject(Router);
  private totpService = inject(TotpService);

  // Authentication state using Signals
  private authState = signal<AuthState>({
    isAuthenticated: false,
    accessToken: null,
    expiresAt: null,
    environment: null,
    clientId: null,
    twoFactorEnabled: false,
    twoFactorVerified: false
  });

  // Public readonly signals
  readonly isAuthenticated = computed(() => this.authState().isAuthenticated);
  readonly accessToken = computed(() => this.authState().accessToken);
  readonly environment = computed(() => this.authState().environment);
  readonly twoFactorEnabled = computed(() => this.authState().twoFactorEnabled);
  readonly twoFactorVerified = computed(() => this.authState().twoFactorVerified);

  constructor() {
    // Check for existing authentication on service initialization
    this.checkAuth();
  }

  /**
   * Login with OAuth2 Client Credentials
   * Uses Electron IPC to avoid CORS issues
   */
  login(credentials: LoginCredentials): Observable<boolean> {
    // Use Electron IPC for authentication (bypasses CORS)
    return from((window as any).electronAPI.auth.login(
      credentials.clientId,
      credentials.clientSecret,
      credentials.environment
    )).pipe(
      switchMap(() => {
        // Get the token that was just stored by the main process
        return from(this.getStoredToken());
      }),
      tap(token => {
        if (token) {
          // Update auth state with the stored token
          this.authState.update(state => ({
            ...state,
            isAuthenticated: true,
            accessToken: token.access_token,
            expiresAt: token.expires_at,
            environment: credentials.environment,
            clientId: credentials.clientId
          }));
        }
      }),
      map(() => true),
      catchError(error => {
        console.error('[AuthService] Login failed:', error);
        return throwError(() => new Error(error.message || 'Authentication failed'));
      })
    );
  }

  /**
   * Logout and clear authentication state
   */
  logout(): Observable<void> {
    return from(this.clearToken()).pipe(
      tap(() => {
        this.authState.set({
          isAuthenticated: false,
          accessToken: null,
          expiresAt: null,
          environment: null,
          clientId: null,
          twoFactorEnabled: false,
          twoFactorVerified: false
        });

        this.router.navigate(['/login']);
      })
    );
  }

  /**
   * Check if user is authenticated
   * Called on app initialization
   */
  async checkAuth(): Promise<boolean> {
    const token = await this.getStoredToken();

    if (!token) {
      return false;
    }

    // Check if token is expired
    if (this.isTokenExpired(token)) {
      // Try to refresh
      const refreshed = await this.refreshToken();
      return refreshed;
    }

    // Check for 2FA status
    const twoFactorSecret = await this.getTwoFactorSecret();
    const twoFactorEnabled = !!twoFactorSecret;

    // Update auth state
    this.authState.update(state => ({
      ...state,
      isAuthenticated: true,
      accessToken: token.access_token,
      expiresAt: token.expires_at,
      environment: token.environment || null,
      clientId: token.client_id || null,
      twoFactorEnabled,
      twoFactorVerified: twoFactorEnabled // If 2FA enabled, assume verified if we have a valid token
    }));

    return true;
  }

  /**
   * Validate and refresh token if needed
   * Called before making FHIR requests
   */
  async validateAndRefreshToken(): Promise<string | null> {
    const token = await this.getStoredToken();

    if (!token) {
      return null;
    }

    // Refresh if token expires within 1 minute
    const expiresIn = token.expires_at - Date.now();
    const oneMinute = 60 * 1000;

    if (expiresIn < oneMinute) {
      const refreshed = await this.refreshToken();
      if (!refreshed) {
        return null;
      }

      const newToken = await this.getStoredToken();
      return newToken?.access_token || null;
    }

    return token.access_token;
  }

  /**
   * Refresh token (re-authenticate with stored credentials)
   * Since client_credentials flow typically doesn't provide refresh tokens
   */
  private async refreshToken(): Promise<boolean> {
    const token = await this.getStoredToken();

    if (!token || !token.client_id || !token.client_secret || !token.environment) {
      return false;
    }

    try {
      const credentials: LoginCredentials = {
        clientId: token.client_id,
        clientSecret: token.client_secret,
        environment: token.environment
      };

      await this.login(credentials).toPromise();
      return true;
    } catch (error) {
      console.error('[AuthService] Token refresh failed:', error);
      await this.clearToken();
      return false;
    }
  }

  /**
   * Check if token is expired
   */
  private isTokenExpired(token: StoredToken): boolean {
    return token.expires_at < Date.now();
  }

  // =============================================================================
  // Two-Factor Authentication (2FA/MFA)
  // =============================================================================

  /**
   * Enable 2FA for the current account
   */
  async enableTwoFactor(accountName: string): Promise<{ secret: string; qrCode: string }> {
    const secret = this.totpService.generateSecret(accountName);
    const qrCode = await this.totpService.generateQRCode(secret, accountName);

    return { secret, qrCode };
  }

  /**
   * Verify and save 2FA secret
   */
  async verifyAndSaveTwoFactor(secret: string, code: string): Promise<boolean> {
    const isValid = this.totpService.verifyCode(code, secret);

    if (isValid) {
      await this.setTwoFactorSecret(secret);
      this.authState.update(state => ({
        ...state,
        twoFactorEnabled: true,
        twoFactorVerified: true
      }));
      return true;
    }

    return false;
  }

  /**
   * Verify 2FA code during login
   */
  async verifyTwoFactorCode(code: string): Promise<boolean> {
    const secret = await this.getTwoFactorSecret();

    if (!secret) {
      return false;
    }

    const isValid = this.totpService.verifyCode(code, secret);

    if (isValid) {
      this.authState.update(state => ({
        ...state,
        twoFactorVerified: true
      }));
    }

    return isValid;
  }

  /**
   * Disable 2FA
   */
  async disableTwoFactor(): Promise<void> {
    await this.removeTwoFactorSecret();
    this.authState.update(state => ({
      ...state,
      twoFactorEnabled: false,
      twoFactorVerified: false
    }));
  }

  /**
   * Check if 2FA is enabled
   */
  async isTwoFactorEnabled(): Promise<boolean> {
    const secret = await this.getTwoFactorSecret();
    return !!secret;
  }

  // =============================================================================
  // Electron IPC Integration (Token Storage)
  // =============================================================================

  /**
   * Store token via Electron IPC (encrypted storage)
   */
  private async storeToken(token: StoredToken): Promise<void> {
    return (window as any).electronAPI.auth.setToken(token);
  }

  /**
   * Get stored token via Electron IPC
   */
  private async getStoredToken(): Promise<StoredToken | null> {
    return (window as any).electronAPI.auth.getToken();
  }

  /**
   * Clear stored token via Electron IPC
   */
  private async clearToken(): Promise<void> {
    return (window as any).electronAPI.auth.clearToken();
  }

  /**
   * Set 2FA secret via Electron IPC
   */
  private async setTwoFactorSecret(secret: string): Promise<void> {
    return (window as any).electronAPI.auth.setTwoFactorSecret(secret);
  }

  /**
   * Get 2FA secret via Electron IPC
   */
  private async getTwoFactorSecret(): Promise<string | null> {
    return (window as any).electronAPI.auth.getTwoFactorSecret();
  }

  /**
   * Remove 2FA secret via Electron IPC
   */
  private async removeTwoFactorSecret(): Promise<void> {
    return (window as any).electronAPI.auth.removeTwoFactorSecret();
  }

  // =============================================================================
  // Saved Accounts Management
  // =============================================================================

  /**
   * Save account for "Remember Me" functionality
   */
  async saveAccount(account: Omit<SavedAccount, 'id' | 'lastUsed'>): Promise<void> {
    const accounts = await this.getSavedAccounts();

    const newAccount: SavedAccount = {
      ...account,
      id: crypto.randomUUID(),
      lastUsed: Date.now()
    };

    accounts.push(newAccount);
    await (window as any).electronAPI.auth.setSavedAccounts(accounts);
  }

  /**
   * Get saved accounts
   */
  async getSavedAccounts(): Promise<SavedAccount[]> {
    return (window as any).electronAPI.auth.getSavedAccounts() || [];
  }

  /**
   * Remove saved account
   */
  async removeSavedAccount(accountId: string): Promise<void> {
    const accounts = await this.getSavedAccounts();
    const filtered = accounts.filter(acc => acc.id !== accountId);
    await (window as any).electronAPI.auth.setSavedAccounts(filtered);
  }
}

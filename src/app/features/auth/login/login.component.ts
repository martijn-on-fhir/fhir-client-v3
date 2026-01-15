import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, inject, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ServerProfile } from '../../../core/models/server-profile.model';
import { AuthService } from '../../../core/services/auth.service';
import { ServerProfileService } from '../../../core/services/server-profile.service';
import { ToastService } from '../../../core/services/toast.service';
import { ServerProfileDialogComponent } from '../../../shared/components/server-profile-dialog/server-profile-dialog.component';

/**
 * Login Component
 *
 * Handles user authentication via server profiles.
 *
 * Features:
 * - Server profile selection
 * - One-click login with saved profiles
 * - Add new server profiles
 * - Two-factor authentication (2FA) integration
 * - Auto-login with default profile
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ServerProfileDialogComponent],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private profileService = inject(ServerProfileService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  @ViewChild(ServerProfileDialogComponent) profileDialog!: ServerProfileDialogComponent;

  // State
  loading = signal(false);
  selectedProfileId = signal<string | null>(null);
  show2FAVerification = signal(false);
  twoFactorCode = signal('');

  // Expose profile service signals
  readonly profiles = this.profileService.sortedProfiles;
  readonly initialized = this.profileService.initialized;

  /**
   * Selected profile computed from ID
   */
  get selectedProfile(): ServerProfile | null {
    const id = this.selectedProfileId();

    return id ? this.profiles().find(p => p.id === id) ?? null : null;
  }

  async ngOnInit() {
    // Wait for profile service to initialize
    await this.waitForInitialization();

    const profiles = this.profiles();

    if (profiles.length > 0) {
      // Select first profile
      this.selectedProfileId.set(profiles[0].id);
    }
  }

  /**
   * Wait for profile service to be initialized
   */
  private async waitForInitialization(): Promise<void> {
    return new Promise((resolve) => {
      const checkInit = () => {
        if (this.initialized()) {
          resolve();
        } else {
          setTimeout(checkInit, 50);
        }
      };
      checkInit();
    });
  }

  /**
   * Select a profile
   */
  selectProfile(profile: ServerProfile): void {
    this.selectedProfileId.set(profile.id);
  }

  /**
   * Handle login button click
   */
  async onLogin(): Promise<void> {
    const profile = this.selectedProfile;

    if (!profile) {
      this.toastService.warning('Selecteer eerst een server profiel');

      return;
    }

    // Check if 2FA is enabled
    const twoFactorEnabled = await this.authService.isTwoFactorEnabled();

    if (twoFactorEnabled) {
      this.show2FAVerification.set(true);

      return;
    }

    await this.performLogin(profile);
  }

  /**
   * Verify 2FA code and proceed with login
   */
  async onVerify2FA(): Promise<void> {
    const isValid = await this.authService.verifyTwoFactorCode(this.twoFactorCode());

    if (!isValid) {
      this.toastService.error('Ongeldige verificatiecode');

      return;
    }

    const profile = this.selectedProfile;

    if (profile) {
      await this.performLogin(profile);
    }
  }

  /**
   * Perform auto-login with default profile
   */
  private async performAutoLogin(profile: ServerProfile): Promise<void> {
    // Only auto-login if profile has auth configured
    if (profile.authType === 'none' ||
        (profile.authType === 'oauth2' && profile.authConfig?.clientId) ||
        (profile.authType === 'basic' && profile.authConfig?.username) ||
        (profile.authType === 'bearer' && profile.authConfig?.bearerToken) ||
        (profile.authType === 'mtls' && profile.mtlsCertificateId)) {

      this.loading.set(true);

      try {
        const success = await this.profileService.switchToProfile(profile.id);

        if (success) {
          const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/app/query';
          this.router.navigate([returnUrl]);
        }
      } catch (error: any) {
        this.toastService.error(error.message || 'Auto-login mislukt');
      } finally {
        this.loading.set(false);
      }
    }
  }

  /**
   * Perform login with selected profile
   */
  private async performLogin(profile: ServerProfile): Promise<void> {
    this.loading.set(true);

    try {
      const success = await this.profileService.switchToProfile(profile.id);

      if (success) {
        this.toastService.success(`Verbonden met ${profile.name}`);
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/app/query';
        this.router.navigate([returnUrl]);
      } else {
        this.toastService.error('Authenticatie mislukt', 'Controleer de server instellingen');
      }
    } catch (error: any) {
      this.toastService.error(error.message || 'Login mislukt');
      this.show2FAVerification.set(false);
      this.twoFactorCode.set('');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Cancel 2FA verification
   */
  cancel2FA(): void {
    this.show2FAVerification.set(false);
    this.twoFactorCode.set('');
  }

  /**
   * Open dialog to add new profile
   */
  openAddProfile(): void {
    this.profileDialog.openAdd();
  }

  /**
   * Open dialog to edit a profile
   */
  openEditProfile(event: Event, profile: ServerProfile): void {
    event.stopPropagation();
    this.profileDialog.openEdit(profile);
  }

  /**
   * Delete a profile
   */
  async deleteProfile(event: Event, profile: ServerProfile): Promise<void> {
    event.stopPropagation();

    if (confirm(`Server "${profile.name}" verwijderen?`)) {
      await this.profileService.deleteProfile(profile.id);

      if (this.selectedProfileId() === profile.id) {
        const remaining = this.profiles();
        this.selectedProfileId.set(remaining.length > 0 ? remaining[0].id : null);
      }

      this.toastService.success(`Server "${profile.name}" verwijderd`);
    }
  }

  /**
   * Handle profile saved from dialog
   */
  onProfileSaved(profile: ServerProfile): void {
    this.selectedProfileId.set(profile.id);
  }

  /**
   * Get auth type display label
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
}

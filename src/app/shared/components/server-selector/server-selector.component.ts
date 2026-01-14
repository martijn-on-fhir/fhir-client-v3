import {Component, inject, signal, computed, OnInit, OnDestroy, Output, EventEmitter} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ServerProfileService} from '../../../core/services/server-profile.service';
import {ServerProfile, PROFILE_COLORS} from '../../../core/models/server-profile.model';

/**
 * Server Selector Component
 *
 * Dropdown for quickly switching between server profiles.
 * Shows current server and allows switching without full re-login.
 */
@Component({
  selector: 'app-server-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './server-selector.component.html',
  styleUrls: ['./server-selector.component.scss']
})
export class ServerSelectorComponent implements OnInit, OnDestroy {
  private profileService = inject(ServerProfileService);

  @Output() addProfile = new EventEmitter<void>();
  @Output() manageProfiles = new EventEmitter<void>();

  isOpen = signal(false);
  switching = signal<string | null>(null);

  // Expose service signals
  readonly profiles = this.profileService.sortedProfiles;
  readonly activeProfile = this.profileService.activeProfile;
  readonly activeProfileId = this.profileService.activeProfileId;
  readonly initialized = this.profileService.initialized;

  // Computed
  readonly hasProfiles = computed(() => this.profiles().length > 0);

  readonly displayName = computed(() => {
    const profile = this.activeProfile();
    if (profile) {
      return profile.name;
    }
    return 'Geen server';
  });

  readonly displayColor = computed(() => {
    const profile = this.activeProfile();
    return profile?.color || PROFILE_COLORS[2];
  });

  private documentClickHandler = this.onDocumentClick.bind(this);

  ngOnInit(): void {
    document.addEventListener('click', this.documentClickHandler);
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.documentClickHandler);
  }

  private onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const dropdown = target.closest('.server-selector');

    if (!dropdown && this.isOpen()) {
      this.isOpen.set(false);
    }
  }

  toggleDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isOpen.update(v => !v);
  }

  async selectProfile(profile: ServerProfile, event: MouseEvent): Promise<void> {
    event.stopPropagation();

    if (profile.id === this.activeProfileId()) {
      this.isOpen.set(false);
      return;
    }

    this.switching.set(profile.id);

    try {
      await this.profileService.switchToProfile(profile.id);
    } finally {
      this.switching.set(null);
      this.isOpen.set(false);
    }
  }

  onAddProfile(event: MouseEvent): void {
    event.stopPropagation();
    this.isOpen.set(false);
    this.addProfile.emit();
  }

  onManageProfiles(event: MouseEvent): void {
    event.stopPropagation();
    this.isOpen.set(false);
    this.manageProfiles.emit();
  }

  hasValidSession(profileId: string): boolean {
    return this.profileService.hasValidSession(profileId);
  }

  getAuthTypeLabel(authType: string): string {
    switch (authType) {
      case 'none': return 'Open';
      case 'basic': return 'Basic';
      case 'bearer': return 'Bearer';
      case 'oauth2': return 'OAuth2';
      case 'mtls': return 'mTLS';
      default: return authType;
    }
  }
}

import {CommonModule} from '@angular/common';
import {Component, inject, signal, computed, OnInit, OnDestroy, Output, EventEmitter, ViewEncapsulation} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ServerProfile, FhirVersion, PROFILE_COLORS} from '../../../core/models/server-profile.model';
import {ServerProfileService} from '../../../core/services/server-profile.service';
import {ToastService} from '../../../core/services/toast.service';

/**
 * Server Selector Component
 *
 * Dropdown for quickly switching between server profiles.
 * Shows current server and allows switching without full re-login.
 */
@Component({
  selector: 'app-server-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './server-selector.component.html',
  styleUrls: ['./server-selector.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class ServerSelectorComponent implements OnInit, OnDestroy {
  private profileService = inject(ServerProfileService);
  private toastService = inject(ToastService);

  @Output() addProfile = new EventEmitter<void>();
  @Output() editProfile = new EventEmitter<ServerProfile>();
  @Output() manageProfiles = new EventEmitter<void>();

  isOpen = signal(false);
  switching = signal<string | null>(null);
  filterText = signal('');

  // Expose service signals
  readonly profiles = this.profileService.sortedProfiles;
  readonly activeProfile = this.profileService.activeProfile;
  readonly activeProfileId = this.profileService.activeProfileId;
  readonly initialized = this.profileService.initialized;

  // Computed
  readonly hasProfiles = computed(() => this.profiles().length > 0);

  readonly filteredProfiles = computed(() => {
    const filter = this.filterText().toLowerCase().trim();

    if (!filter) {
      return this.profiles();
    }

    return this.profiles().filter(p =>
      p.name.toLowerCase().includes(filter) ||
      p.fhirServerUrl.toLowerCase().includes(filter) ||
      this.getAuthTypeLabel(p.authType).toLowerCase().includes(filter)
    );
  });

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
      this.filterText.set('');
    }
  }

  toggleDropdown(event: MouseEvent): void {
    event.stopPropagation();
    const opening = !this.isOpen();
    this.isOpen.set(opening);

    if (!opening) {
      this.filterText.set('');
    }
  }

  async selectProfile(profile: ServerProfile, event: MouseEvent): Promise<void> {
    event.stopPropagation();

    if (profile.id === this.activeProfileId()) {
      this.isOpen.set(false);

      return;
    }

    this.switching.set(profile.id);

    try {
      const success = await this.profileService.switchToProfile(profile.id);

      if (!success) {
        this.toastService.error(
          `Kon niet wisselen naar "${profile.name}". Controleer de authenticatie-instellingen.`,
          'Profiel wisselen mislukt'
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Onbekende fout';
      this.toastService.error(
        `Fout bij wisselen naar "${profile.name}": ${message}`,
        'Profiel wisselen mislukt'
      );
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

  onEditProfile(profile: ServerProfile, event: MouseEvent): void {
    event.stopPropagation();
    this.isOpen.set(false);
    this.editProfile.emit(profile);
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

  getVersionLabel(fhirVersion?: FhirVersion): string {
    return fhirVersion || '';
  }
}

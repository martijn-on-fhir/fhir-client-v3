import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProfileInfo, StructureDefinition } from '../../core/models/profile.model';
import { FhirService } from '../../core/services/fhir.service';
import { LoggerService } from '../../core/services/logger.service';
import { ProfileLoadingService } from '../../core/services/profile-loading.service';
import { formatElementPath, renderElementType, getCardinalityBadgeClass, getSeverityBadgeClass, loadCacheStats } from '../../core/utils/profile-utils';
import { ProfileCacheDropdownComponent } from '../../shared/components/profile-cache-dropdown/profile-cache-dropdown.component';
import { ResourceEditorDialogComponent } from '../../shared/components/resource-editor-dialog/resource-editor-dialog.component';

/**
 * FHIR Profiles Component
 *
 * Displays and manages FHIR StructureDefinition profiles from server metadata.
 *
 * Features:
 * - Lists all profiles from CapabilityStatement
 * - Loads and displays StructureDefinition details
 * - Merges profile elements from inheritance chain (baseDefinition)
 * - Extracts and displays constraints
 * - Caches profiles to disk for performance
 * - Provides cache management (clear, refresh)
 * - Opens profiles in resource editor dialog
 */
@Component({
  selector: 'app-profiles',
  standalone: true,
  imports: [CommonModule, FormsModule, ResourceEditorDialogComponent, ProfileCacheDropdownComponent],
  templateUrl: './profiles.component.html',
  styleUrls: ['./profiles.component.scss']
})
export class ProfilesComponent implements OnInit {
  /** Service for FHIR server communication */
  private fhirService = inject(FhirService);

  /** Service for application logging */
  private loggerService = inject(LoggerService);

  /** Component-specific logger instance */
  private logger = this.loggerService.component('ProfilesComponent');

  /** Service for loading profiles with caching */
  private profileLoadingService = inject(ProfileLoadingService);

  /** Reference to resource editor dialog component */
  @ViewChild(ResourceEditorDialogComponent) editorDialog!: ResourceEditorDialogComponent;

  /** Array of available profile information from server metadata */
  profiles = signal<ProfileInfo[]>([]);

  /** Loading state while fetching metadata */
  loading = signal(false);

  /** URL of currently selected profile */
  selectedProfileUrl = signal('');

  /** Title/resource type of currently selected profile */
  selectedProfileTitle = signal('');

  /** Loaded StructureDefinition for selected profile */
  structureDefinition = signal<StructureDefinition | null>(null);

  /** Array of base definitions in inheritance chain */
  baseDefinitions = signal<any[]>([]);

  /** Merged elements from profile and base definitions */
  mergedElements = signal<any[]>([]);

  /** Extracted constraints from profile */
  constraints = signal<any[]>([]);

  /** Loading state while fetching profile details */
  loadingProfile = signal(false);

  /** Error message from profile loading */
  profileError = signal<string | null>(null);

  /** Cache statistics (size, count) */
  cacheStats = signal<any>(null);

  /** Utility function for formatting element paths in template */
  formatElementPath = formatElementPath;

  /** Utility function for rendering element types in template */
  renderElementType = renderElementType;

  /** Utility function for cardinality badge CSS classes in template */
  getCardinalityBadgeClass = getCardinalityBadgeClass;

  /** Utility function for severity badge CSS classes in template */
  getSeverityBadgeClass = getSeverityBadgeClass;

  /**
   * Angular lifecycle hook called on component initialization
   * Loads metadata and cache statistics
   */
  async ngOnInit() {
    await this.loadMetadata();
    await this.loadCacheStatsData();
  }

  /**
   * Loads profile cache statistics
   * Updates cacheStats signal with disk cache size and profile count
   */
  async loadCacheStatsData() {
    const stats = await loadCacheStats();
    this.cacheStats.set(stats);
  }

  /**
   * Loads FHIR server metadata and extracts profile information
   *
   * Workflow:
   * 1. Fetches CapabilityStatement from server
   * 2. Extracts profile and supportedProfile URLs from each resource type
   * 3. Sorts profiles by resource type
   * 4. Auto-selects Account profile if available
   *
   * @private
   */
  private async loadMetadata() {
    this.loading.set(true);

    this.fhirService.getMetadata().subscribe({
      next: async (metadata) => {
        const profileList: ProfileInfo[] = [];

        if (metadata.rest?.[0]?.resource) {
          metadata.rest[0].resource.forEach((resource: any) => {
            if (resource.profile) {
              this.extractProfiles(resource.profile, resource.type, profileList);
            } else {
              // Include resource types without explicit profile using base FHIR StructureDefinition URL
              profileList.push({
                url: `http://hl7.org/fhir/StructureDefinition/${resource.type}`,
                resourceType: resource.type
              });
            }

            if (resource.supportedProfile) {
              this.extractProfiles(resource.supportedProfile, resource.type, profileList);
            }
          });
        }

        profileList.sort((a, b) => a.resourceType.localeCompare(b.resourceType));
        this.profiles.set(profileList);

        const accountProfile = profileList.find(p => p.resourceType === 'Account');

        if (accountProfile) {
          this.selectedProfileUrl.set(accountProfile.url);
          this.selectedProfileTitle.set(accountProfile.resourceType);
          await this.loadStructureDefinition(accountProfile.url, accountProfile.resourceType);
        }

        this.loading.set(false);
      },
      error: (error) => {
        this.logger.error('Failed to load metadata:', error);
        this.loading.set(false);
      }
    });
  }

  /**
   * Extracts profile URLs from metadata and adds to profile list
   *
   * Handles both string URLs and reference objects.
   * Supports single profile or array of profiles.
   *
   * @param profiles - Profile URL(s) from metadata (string, object, or array)
   * @param resourceType - FHIR resource type for the profile
   * @param list - Profile list to append to
   * @private
   */
  private extractProfiles(profiles: any, resourceType: string, list: ProfileInfo[]) {
    const profileArray = Array.isArray(profiles) ? profiles : [profiles];

    profileArray.forEach((profile: any) => {
      const url = typeof profile === 'string' ? profile : profile.reference;

      if (url) {
        list.push({ url, resourceType });
      }
    });
  }

  /**
   * Loads StructureDefinition for selected profile
   *
   * Uses ProfileLoadingService for unified loading with caching.
   *
   * @param url - Canonical URL of the StructureDefinition
   * @param profileTitle - Title/resource type for cache key
   * @returns Promise that resolves when loading completes
   */
  async loadStructureDefinition(url: string, profileTitle: string) {
    if (!url) {
      this.profileError.set('Please select a profile');

      return;
    }

    this.loadingProfile.set(true);
    this.profileError.set(null);
    this.structureDefinition.set(null);
    this.baseDefinitions.set([]);
    this.mergedElements.set([]);
    this.constraints.set([]);

    try {
      const result = await this.profileLoadingService.loadProfile(url, profileTitle);

      if (!result) {
        this.profileError.set('StructureDefinition not available on this server.');
        this.loadingProfile.set(false);

        return;
      }

      this.structureDefinition.set(result.structureDefinition);
      this.baseDefinitions.set(result.baseChain);
      this.mergedElements.set(result.mergedElements);
      this.constraints.set(result.constraints);
      await this.loadCacheStatsData();
    } catch (err: any) {
      this.logger.error('Error fetching StructureDefinition:', err);
      this.profileError.set(err.message || 'Failed to fetch StructureDefinition');
    } finally {
      this.loadingProfile.set(false);
    }
  }

  /**
   * Handles profile selection change from dropdown
   *
   * Updates selected profile URL and title, then loads the StructureDefinition.
   * Clears all profile data if no selection.
   *
   * @param event - DOM change event from select element
   * @returns Promise that resolves when profile is loaded
   */
  async onProfileChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedProfileUrl.set(value);

    if (!value) {
      this.structureDefinition.set(null);
      this.profileError.set(null);
      this.selectedProfileTitle.set('');
      this.baseDefinitions.set([]);
      this.mergedElements.set([]);
      this.constraints.set([]);

      return;
    }

    const profile = this.profiles().find(p => p.url === value);

    if (profile) {
      this.selectedProfileTitle.set(profile.resourceType);
      await this.loadStructureDefinition(value, profile.resourceType);
    }
  }

  /**
   * Executes/refreshes the currently selected profile
   * Reloads the StructureDefinition for the selected profile
   *
   * @returns Promise that resolves when profile is reloaded
   */
  async execute() {
    const url = this.selectedProfileUrl();
    const title = this.selectedProfileTitle();

    if (url && title) {
      await this.loadStructureDefinition(url, title);
    }
  }

  /**
   * Clears all cached profiles from disk
   *
   * Shows confirmation dialog before clearing.
   * Clears profile cache, updates cache stats, and resets current profile view.
   *
   * @returns Promise that resolves when cache is cleared
   */
  async handleClearCache() {
    if (!confirm('Are you sure you want to clear all cached profiles? This will force profiles to be re-downloaded from the server.')) {
      return;
    }

    try {
      await window.electronAPI?.profileCache?.clear();
      await this.loadCacheStatsData();
      this.structureDefinition.set(null);
      this.baseDefinitions.set([]);
      this.mergedElements.set([]);
      this.constraints.set([]);
      alert('Cache cleared successfully');
    } catch (error) {
      this.logger.error('Failed to clear cache:', error);
      alert('Failed to clear cache');
    }
  }

  /**
   * Refreshes the currently selected profile from server
   *
   * Shows confirmation dialog before refreshing.
   * Clears cache for this specific profile and re-downloads from server.
   *
   * @returns Promise that resolves when profile is refreshed
   */
  async handleRefreshProfile() {
    const url = this.selectedProfileUrl();
    const title = this.selectedProfileTitle();

    if (!url || !title) {
      alert('Please select a profile first');

      return;
    }

    if (!confirm('Refresh this profile from server? This will re-download and update the cached data.')) {
      return;
    }

    try {
      await window.electronAPI?.profileCache?.setProfile(title, null);
      await this.loadStructureDefinition(url, title);
      await this.loadCacheStatsData();
      alert('Profile refreshed successfully');
    } catch (error) {
      this.logger.error('Failed to refresh profile:', error);
      alert('Failed to refresh profile');
    }
  }

  /**
   * Opens the current StructureDefinition in resource editor dialog
   * Only opens if a StructureDefinition is currently loaded
   */
  openEditor() {
    const sd = this.structureDefinition();

    if (sd) {
      this.editorDialog.open(sd);
    }
  }
}

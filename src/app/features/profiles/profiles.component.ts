import { Component, OnInit, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FhirService } from '../../core/services/fhir.service';
import { ProfileInfo, StructureDefinition } from '../../core/models/profile.model';
import { mergeProfileElements, extractConstraints } from '../../core/utils/profile-merge';
import { formatElementPath, renderElementType, getCardinalityBadgeClass, getSeverityBadgeClass, loadCacheStats } from '../../core/utils/profile-utils';
import { ResourceEditorDialogComponent } from '../../shared/components/resource-editor-dialog/resource-editor-dialog.component';
import { ProfileCacheDropdownComponent } from '../../shared/components/profile-cache-dropdown/profile-cache-dropdown.component';

/**
 * Profiles Component - Angular version with Signals
 *
 * Displays FHIR profiles from server metadata (CapabilityStatement)
 * Uses merged elements from profile inheritance chain
 */
@Component({
  selector: 'app-profiles',
  standalone: true,
  imports: [CommonModule, FormsModule, ResourceEditorDialogComponent, ProfileCacheDropdownComponent],
  templateUrl: './profiles.component.html',
  styleUrls: ['./profiles.component.scss']
})
export class ProfilesComponent implements OnInit {
  private fhirService = inject(FhirService);

  @ViewChild(ResourceEditorDialogComponent) editorDialog!: ResourceEditorDialogComponent;

  // State signals
  profiles = signal<ProfileInfo[]>([]);
  loading = signal(false);
  selectedProfileUrl = signal('');
  selectedProfileTitle = signal('');
  structureDefinition = signal<StructureDefinition | null>(null);
  baseDefinitions = signal<any[]>([]);
  mergedElements = signal<any[]>([]);
  constraints = signal<any[]>([]);
  loadingProfile = signal(false);
  profileError = signal<string | null>(null);
  cacheStats = signal<any>(null);

  // Export utilities for template
  formatElementPath = formatElementPath;
  renderElementType = renderElementType;
  getCardinalityBadgeClass = getCardinalityBadgeClass;
  getSeverityBadgeClass = getSeverityBadgeClass;

  async ngOnInit() {
    await this.loadMetadata();
    await this.loadCacheStatsData();
  }

  async loadCacheStatsData() {
    const stats = await loadCacheStats();
    this.cacheStats.set(stats);
  }

  /**
   * Load metadata and extract profiles
   */
  private async loadMetadata() {
    this.loading.set(true);

    this.fhirService.getMetadata().subscribe({
      next: async (metadata) => {
        const profileList: ProfileInfo[] = [];

        if (metadata.rest?.[0]?.resource) {
          metadata.rest[0].resource.forEach((resource: any) => {
            // Extract profiles from resource
            if (resource.profile) {
              this.extractProfiles(resource.profile, resource.type, profileList);
            }
            if (resource.supportedProfile) {
              this.extractProfiles(resource.supportedProfile, resource.type, profileList);
            }
          });
        }

        // Sort by resourceType
        profileList.sort((a, b) => a.resourceType.localeCompare(b.resourceType));
        this.profiles.set(profileList);

        // Auto-select Account
        const accountProfile = profileList.find(p => p.resourceType === 'Account');
        if (accountProfile) {
          this.selectedProfileUrl.set(accountProfile.url);
          this.selectedProfileTitle.set(accountProfile.resourceType);
          await this.loadStructureDefinition(accountProfile.url, accountProfile.resourceType);
        }

        this.loading.set(false);
      },
      error: (error) => {
        console.error('Failed to load metadata:', error);
        this.loading.set(false);
      }
    });
  }

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
   * Load StructureDefinition for selected profile
   * Uses disk cache and merges inheritance chain
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
      // Try to load from disk cache first
      const cached = await window.electronAPI?.profileCache?.getProfile(profileTitle);

      if (cached) {
        this.structureDefinition.set(cached.profile);
        this.baseDefinitions.set(cached.baseChain || []);
        this.mergedElements.set(cached.mergedElements || []);
        this.constraints.set(cached.constraints || []);
        this.loadingProfile.set(false);
        return;
      }

      // Fetch from server
      this.fhirService.getStructureDefinition(url).subscribe({
        next: async (sd) => {
          this.structureDefinition.set(sd);

          // Fetch base definition chain (if exists)
          let baseChain: any[] = [];
          if (sd.baseDefinition) {
            baseChain = await this.fetchBaseDefinitionChain(sd.baseDefinition);
            this.baseDefinitions.set(baseChain);
          }

          // Merge elements and extract constraints
          const merged = mergeProfileElements(sd, baseChain);
          const extractedConstraints = extractConstraints(sd, baseChain);

          this.mergedElements.set(merged);
          this.constraints.set(extractedConstraints);

          // Cache the merged profile
          try {
            await window.electronAPI?.profileCache?.setProfile(profileTitle, {
              profile: {
                id: sd.id,
                url: sd.url,
                name: sd.name,
                type: sd.type,
                title: sd.title || sd.name,
                description: sd.description,
                purpose: sd.purpose,
                baseDefinition: sd.baseDefinition,
                version: sd.version,
              },
              baseChain: baseChain.map((bd) => ({
                name: bd.name,
                url: bd.url,
              })),
              mergedElements: merged,
              constraints: extractedConstraints,
            });

            await this.loadCacheStatsData();
          } catch (cacheError) {
            console.error('Failed to cache profile:', cacheError);
          }

          this.loadingProfile.set(false);
        },
        error: (error) => {
          this.profileError.set(error.message || 'Failed to load StructureDefinition');
          this.loadingProfile.set(false);
        }
      });
    } catch (err: any) {
      console.error('Error fetching StructureDefinition:', err);
      this.profileError.set(err.message || 'Failed to fetch StructureDefinition');
      this.loadingProfile.set(false);
    }
  }

  /**
   * Recursively fetch base definition chain
   */
  async fetchBaseDefinitionChain(baseDefUrl: string): Promise<any[]> {
    const chain: any[] = [];
    let currentUrl = baseDefUrl;
    let depth = 0;
    const maxDepth = 10;

    while (currentUrl && depth < maxDepth) {
      try {
        const baseDef = await new Promise<any>((resolve, reject) => {
          this.fhirService.getStructureDefinition(currentUrl).subscribe({
            next: (sd) => resolve(sd),
            error: (err) => reject(err)
          });
        });

        chain.push(baseDef);

        // Stop at base FHIR resources
        if (currentUrl.includes('http://hl7.org/fhir/StructureDefinition/')) {
          break;
        }

        currentUrl = baseDef.baseDefinition;
        depth++;
      } catch (error) {
        console.error('Failed to fetch base definition:', currentUrl, error);
        break;
      }
    }

    return chain;
  }

  /**
   * Handle profile selection change
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
   * Execute/refresh current profile
   */
  async execute() {
    const url = this.selectedProfileUrl();
    const title = this.selectedProfileTitle();
    if (url && title) {
      await this.loadStructureDefinition(url, title);
    }
  }

  /**
   * Clear all cached profiles
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
      console.error('Failed to clear cache:', error);
      alert('Failed to clear cache');
    }
  }

  /**
   * Refresh current profile from server
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
      // Clear cache for this profile
      await window.electronAPI?.profileCache?.setProfile(title, null);
      await this.loadStructureDefinition(url, title);
      await this.loadCacheStatsData();
      alert('Profile refreshed successfully');
    } catch (error) {
      console.error('Failed to refresh profile:', error);
      alert('Failed to refresh profile');
    }
  }

  /**
   * Open resource editor dialog
   */
  openEditor() {
    const sd = this.structureDefinition();
    if (sd) {
      this.editorDialog.open(sd);
    }
  }
}

import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NictizService } from '../../core/services/nictiz.service';
import { mergeProfileElements, extractConstraints } from '../../core/utils/profile-merge';
import { formatElementPath, renderElementType, getCardinalityBadgeClass, getSeverityBadgeClass, loadCacheStats } from '../../core/utils/profile-utils';
import { ResourceEditorDialogComponent } from '../../shared/components/resource-editor-dialog/resource-editor-dialog.component';
import { ProfileCacheDropdownComponent } from '../../shared/components/profile-cache-dropdown/profile-cache-dropdown.component';

@Component({
  selector: 'app-nictiz',
  standalone: true,
  imports: [CommonModule, FormsModule, ResourceEditorDialogComponent, ProfileCacheDropdownComponent],
  templateUrl: './nictiz.component.html',
  styleUrl: './nictiz.component.scss'
})
export class NictizComponent implements OnInit {
  @ViewChild(ResourceEditorDialogComponent) editorDialog!: ResourceEditorDialogComponent;
  selectedProfileUrl = signal<string>('');
  selectedProfileTitle = signal<string>('');
  structureDefinition = signal<any>(null);
  baseDefinitions = signal<any[]>([]);
  mergedElements = signal<any[]>([]);
  constraints = signal<any[]>([]);
  loadingProfile = signal<boolean>(false);
  profileError = signal<string | null>(null);
  cacheStats = signal<any>(null);

  // Export utilities for template
  formatElementPath = formatElementPath;
  renderElementType = renderElementType;
  getCardinalityBadgeClass = getCardinalityBadgeClass;
  getSeverityBadgeClass = getSeverityBadgeClass;

  constructor(public nictizService: NictizService) {}

  async ngOnInit() {
    await this.nictizService.fetchStructureDefinitions();
    await this.loadCacheStatsData();

    // Auto-load Hcim OutcomeOfCare profile
    if (this.nictizService.structureDefinitions().length > 0) {
      const profiles = this.nictizService.structureDefinitions();

      // Try to find "Hcim OutcomeOfCare" profile
      const outcomeProfile = profiles.find(p =>
        p.title?.includes('OutcomeOfCare') || p.name?.includes('OutcomeOfCare')
      );

      const profileToLoad = outcomeProfile || profiles[0];
      this.selectedProfileUrl.set(profileToLoad.url);
      this.selectedProfileTitle.set(profileToLoad.title);
      await this.fetchStructureDefinition(profileToLoad.url, profileToLoad.title);
    }
  }

  async loadCacheStatsData() {
    const stats = await loadCacheStats();
    this.cacheStats.set(stats);
  }

  async onProfileChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedProfileUrl.set(value);

    if (!value) {
      this.structureDefinition.set(null);
      this.profileError.set(null);
      this.selectedProfileTitle.set('');
      return;
    }

    const profile = this.nictizService.structureDefinitions().find(p => p.url === value);
    if (profile) {
      this.selectedProfileTitle.set(profile.title);
      await this.fetchStructureDefinition(value, profile.title);
    }
  }

  async fetchStructureDefinition(profileUrl: string, profileTitle: string) {
    if (!profileUrl) {
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
        // Reconstruct full StructureDefinition with snapshot from cache
        const fullSD = {
          ...cached.profile,
          snapshot: {
            element: cached.mergedElements || []
          }
        };

        this.structureDefinition.set(fullSD);
        this.baseDefinitions.set(cached.baseChain || []);
        this.mergedElements.set(cached.mergedElements || []);
        this.constraints.set(cached.constraints || []);
        this.loadingProfile.set(false);
        return;
      }

      // Fetch from server
      const sd = await this.nictizService.fetchSingleStructureDefinition(profileUrl);

      if (!sd) {
        this.profileError.set('StructureDefinition not available on this server.');
        this.loadingProfile.set(false);
        return;
      }

      // Fetch base definition chain
      let baseChain: any[] = [];
      if (sd.baseDefinition) {
        baseChain = await this.nictizService.fetchBaseDefinitionChain(sd.baseDefinition);
        this.baseDefinitions.set(baseChain);
      }

      // Merge elements and extract constraints
      const merged = mergeProfileElements(sd, baseChain);
      const extractedConstraints = extractConstraints(sd, baseChain);

      this.mergedElements.set(merged);
      this.constraints.set(extractedConstraints);

      // Update StructureDefinition with merged snapshot
      const fullSD = {
        ...sd,
        snapshot: {
          element: merged
        }
      };
      this.structureDefinition.set(fullSD);

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
    } catch (err: any) {
      console.error('Error fetching StructureDefinition:', err);
      this.profileError.set(err.message || 'Failed to fetch StructureDefinition');
    } finally {
      this.loadingProfile.set(false);
    }
  }

  async handleExecute() {
    const url = this.selectedProfileUrl();
    const title = this.selectedProfileTitle();
    if (url && title) {
      await this.fetchStructureDefinition(url, title);
    }
  }

  async handleRefreshProfiles() {
    if (!confirm('Refresh profile list from server? This will re-download the profile index.')) {
      return;
    }

    try {
      await this.nictizService.clearCache();
      await this.nictizService.fetchStructureDefinitions();
      await this.loadCacheStatsData();
      alert('Profiles refreshed successfully');
    } catch (error) {
      console.error('Failed to refresh profiles:', error);
      alert('Failed to refresh profiles');
    }
  }

  async handleClearCache() {
    if (!confirm('Are you sure you want to clear all cached profiles? This will force profiles to be re-downloaded from the server.')) {
      return;
    }

    try {
      await this.nictizService.clearCache();
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

  getSortedProfiles() {
    return [...this.nictizService.structureDefinitions()]
      .sort((a, b) => {
        const titleA = this.formatTitle(a.title);
        const titleB = this.formatTitle(b.title);
        return titleA.localeCompare(titleB);
      });
  }

  getProfileDisplayName(title: string): string {
    return this.formatTitle(title);
  }

  formatTitle(title: string): string {
    let entity = title;

    if (title.startsWith('HCIM')) {
      entity = title.replace('HCIM ', '').trim();
    } else if (title.startsWith('nl-core-')) {
      const label = title.replace('nl-core-', '').trim();
      entity = label.charAt(0).toUpperCase() + label.slice(1);
    } else if (title.startsWith('Zib ')) {
      entity = title.replace(/^Zib\s+/i, '').trim();
    }

    return entity;
  }

  openSimplifierUrl(url: string) {
    const searchUrl = `https://simplifier.net/search?q=${encodeURIComponent(url)}`;
    window.electronAPI?.shell?.openExternal(searchUrl).catch((err) => {
      console.error('Failed to open URL:', err);
    });
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

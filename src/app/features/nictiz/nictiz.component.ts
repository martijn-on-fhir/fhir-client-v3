import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LoggerService } from '../../core/services/logger.service';
import { NictizService } from '../../core/services/nictiz.service';
import { ProfileLoadingService } from '../../core/services/profile-loading.service';
import { formatElementPath, renderElementType, getCardinalityBadgeClass, getSeverityBadgeClass, loadCacheStats } from '../../core/utils/profile-utils';
import { ProfileCacheDropdownComponent } from '../../shared/components/profile-cache-dropdown/profile-cache-dropdown.component';
import { ResourceEditorDialogComponent } from '../../shared/components/resource-editor-dialog/resource-editor-dialog.component';

/**
 * Nictiz Component
 *
 * Displays and manages Nictiz FHIR profiles (Dutch healthcare information standards).
 *
 * Features:
 * - Lists Nictiz StructureDefinition profiles from Simplifier.net
 * - Loads and displays StructureDefinition details with full element hierarchy
 * - Merges profile elements from inheritance chain (baseDefinition)
 * - Extracts and displays constraints
 * - Caches profiles to disk for performance
 * - Provides cache management (clear, refresh)
 * - Opens profiles in resource editor dialog
 * - Integration with Simplifier.net for profile documentation
 */
@Component({
  selector: 'app-nictiz',
  standalone: true,
  imports: [CommonModule, FormsModule, ResourceEditorDialogComponent, ProfileCacheDropdownComponent],
  templateUrl: './nictiz.component.html',
  styleUrl: './nictiz.component.scss'
})
export class NictizComponent implements OnInit {

  /** Reference to resource editor dialog component */
  @ViewChild(ResourceEditorDialogComponent) editorDialog!: ResourceEditorDialogComponent;

  /** URL of currently selected profile */
  selectedProfileUrl = signal<string>('');

  /** Title/name of currently selected profile */
  selectedProfileTitle = signal<string>('');

  /** Loaded StructureDefinition for selected profile */
  structureDefinition = signal<any>(null);

  /** Array of base definitions in inheritance chain */
  baseDefinitions = signal<any[]>([]);

  /** Merged elements from profile and base definitions */
  mergedElements = signal<any[]>([]);

  /** Extracted constraints from profile */
  constraints = signal<any[]>([]);

  /** Loading state while fetching profile details */
  loadingProfile = signal<boolean>(false);

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

  /** Service for application logging */
  private loggerService = inject(LoggerService);

  /** Component-specific logger instance */
  private logger = this.loggerService.component('NictizComponent');

  /** Service for loading profiles with caching */
  private profileLoadingService = inject(ProfileLoadingService);

  /**
   * Creates an instance of NictizComponent
   *
   * @param nictizService - Service for Nictiz profile management and caching
   */
  constructor(public nictizService: NictizService) {}

  /**
   * Angular lifecycle hook called on component initialization
   *
   * Workflow:
   * 1. Fetches Nictiz StructureDefinition profiles from Simplifier.net or cache
   * 2. Loads cache statistics
   * 3. Auto-loads a default profile (prioritizes "OutcomeOfCare" profile)
   *
   * @returns Promise that resolves when initialization completes
   */
  async ngOnInit() {
    await this.nictizService.fetchStructureDefinitions();
    await this.loadCacheStatsData();

    if (this.nictizService.structureDefinitions().length > 0) {
      const profiles = this.nictizService.structureDefinitions();

      const outcomeProfile = profiles.find(p =>
        p.title?.includes('OutcomeOfCare') || p.name?.includes('OutcomeOfCare')
      );

      const profileToLoad = outcomeProfile || profiles[0];
      this.selectedProfileUrl.set(profileToLoad.url);
      this.selectedProfileTitle.set(profileToLoad.title);
      await this.fetchStructureDefinition(profileToLoad.url, profileToLoad.title);
    }
  }

  /**
   * Loads profile cache statistics
   *
   * Updates cacheStats signal with disk cache size and profile count.
   *
   * @returns Promise that resolves when cache stats are loaded
   */
  async loadCacheStatsData() {
    const stats = await loadCacheStats();
    this.cacheStats.set(stats);
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

      return;
    }

    const profile = this.nictizService.structureDefinitions().find(p => p.url === value);

    if (profile) {
      this.selectedProfileTitle.set(profile.title);
      await this.fetchStructureDefinition(value, profile.title);
    }
  }

  /**
   * Fetches and loads a StructureDefinition profile
   *
   * Uses ProfileLoadingService for unified loading with caching.
   *
   * @param profileUrl - Canonical URL of the StructureDefinition
   * @param profileTitle - Title/name for cache key
   * @returns Promise that resolves when loading completes
   */
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
      const result = await this.profileLoadingService.loadProfile(profileUrl, profileTitle);

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
   * Executes/refreshes the currently selected profile
   *
   * Reloads the StructureDefinition for the selected profile.
   *
   * @returns Promise that resolves when profile is reloaded
   */
  async handleExecute() {
    const url = this.selectedProfileUrl();
    const title = this.selectedProfileTitle();

    if (url && title) {
      await this.fetchStructureDefinition(url, title);
    }
  }

  /**
   * Refreshes the profile list from Simplifier.net
   *
   * Shows confirmation dialog before refreshing.
   * Clears cache, re-downloads profile index from server, and updates cache stats.
   *
   * @returns Promise that resolves when refresh completes
   */
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
      this.logger.error('Failed to refresh profiles:', error);
      alert('Failed to refresh profiles');
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
      await this.nictizService.clearCache();
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
   * Returns sorted list of profiles by formatted title
   *
   * Sorts profiles alphabetically by their formatted display name
   * (with prefixes like "HCIM", "nl-core-", "Zib" removed).
   *
   * @returns Sorted array of StructureDefinition profile metadata
   */
  getSortedProfiles() {
    return [...this.nictizService.structureDefinitions()]
      .sort((a, b) => {
        const titleA = this.formatTitle(a.title);
        const titleB = this.formatTitle(b.title);

        return titleA.localeCompare(titleB);
      });
  }

  /**
   * Gets formatted display name for a profile
   *
   * Removes Dutch healthcare standard prefixes for cleaner display.
   *
   * @param title - Original profile title
   * @returns Formatted profile display name
   */
  getProfileDisplayName(title: string): string {
    return this.formatTitle(title);
  }

  /**
   * Formats profile title by removing Dutch healthcare standard prefixes
   *
   * Removes common prefixes:
   * - "HCIM " (Health and Care Information Models)
   * - "nl-core-" (Dutch core profiles)
   * - "Zib " (Zorginformatiebouwstenen)
   *
   * @param title - Original profile title
   * @returns Formatted title without prefix
   */
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

  /**
   * Opens Simplifier.net search page for the profile URL
   *
   * Opens external browser with Simplifier.net search query for the profile.
   * Uses Electron shell API to open the system default browser.
   *
   * @param url - Canonical URL of the StructureDefinition to search for
   */
  openSimplifierUrl(url: string) {
    const searchUrl = `https://simplifier.net/search?q=${encodeURIComponent(url)}`;
    window.electronAPI?.shell?.openExternal(searchUrl).catch((err) => {
      this.logger.error('Failed to open URL:', err);
    });
  }

  /**
   * Opens the current StructureDefinition in resource editor dialog
   *
   * Only opens if a StructureDefinition is currently loaded.
   */
  openEditor() {
    const sd = this.structureDefinition();

    if (sd) {
      this.editorDialog.open(sd);
    }
  }
}

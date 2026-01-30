import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, signal, computed, inject, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FavoriteResource } from '../../core/models/favorite-resource.model';
import { RecentResource } from '../../core/models/recent-resource.model';
import { FavoritesService } from '../../core/services/favorites.service';
import { FhirService } from '../../core/services/fhir.service';
import { LoggerService } from '../../core/services/logger.service';
import { NavigationService } from '../../core/services/navigation.service';
import { RecentResourcesService } from '../../core/services/recent-resources.service';
import { SettingsService } from '../../core/services/settings.service';

/**
 * Sidebar Component
 *
 * Displays filterable list of FHIR resource types
 * Resizable from 150px to 500px
 * Persists visibility and width to settings
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit, OnDestroy {
  private fhirService = inject(FhirService);
  private settingsService = inject(SettingsService);
  private navigationService = inject(NavigationService);
  private favoritesService = inject(FavoritesService);
  private recentResourcesService = inject(RecentResourcesService);
  private router = inject(Router);
  private loggerService = inject(LoggerService);
  private logger = this.loggerService.component('SidebarComponent');

  // Resource types
  resourceTypes = signal<string[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  // Favorites
  private allFavorites = this.favoritesService.currentProfileFavorites;
  favoritesExpanded = this.settingsService.sidebarFavoritesExpanded;

  // Recent resources
  private allRecentResources = this.recentResourcesService.currentProfileRecent;
  recentExpanded = this.settingsService.sidebarRecentExpanded;

  // Resource types section
  resourceTypesExpanded = this.settingsService.sidebarResourceTypesExpanded;

  // Filter
  filterText = signal('');

  // Filtered lists
  filteredResourceTypes = computed(() => {
    const filter = this.filterText().toLowerCase();

    if (!filter) {
return this.resourceTypes();
}

    return this.resourceTypes().filter(type =>
      type.toLowerCase().includes(filter)
    );
  });

  favorites = computed(() => {
    const filter = this.filterText().toLowerCase();

    if (!filter) {
return this.allFavorites();
}

    return this.allFavorites().filter(fav =>
      fav.displayName.toLowerCase().includes(filter) ||
      fav.resourceType.toLowerCase().includes(filter)
    );
  });

  recentResources = computed(() => {
    const filter = this.filterText().toLowerCase();

    if (!filter) {
return this.allRecentResources();
}

    return this.allRecentResources().filter(item =>
      item.displayName.toLowerCase().includes(filter) ||
      item.resourceType.toLowerCase().includes(filter)
    );
  });

  // Resize state
  isResizing = signal(false);
  private startX = 0;
  private startWidth = 0;

  // Get sidebar width from settings
  readonly sidebarWidth = computed(() => this.settingsService.sidebarWidth());

  async ngOnInit() {
    await this.loadResourceTypes();
  }

  ngOnDestroy() {
    this.stopResizing();
  }

  /**
   * Load FHIR resource types from server metadata
   */
  async loadResourceTypes() {
    this.loading.set(true);
    this.error.set(null);

    try {
      // Try to get from cache first
      const cacheKey = this.getCacheKey();
      const cached = localStorage.getItem(cacheKey);

      if (cached) {
        this.resourceTypes.set(JSON.parse(cached));
        this.loading.set(false);

        return;
      }

      // Fetch from server
      const metadata = await this.fhirService.getMetadata().toPromise();

      if (metadata?.rest?.[0]?.resource) {
        const types = metadata.rest[0].resource
          .map((r: any) => r.type)
          .filter((type: string) => type)
          .sort();

        this.resourceTypes.set(types);

        // Cache the results
        localStorage.setItem(cacheKey, JSON.stringify(types));
      }
    } catch (err: any) {
      this.logger.error('Failed to load resource types:', err);
      this.error.set('Failed to load resource types');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Get cache key based on current FHIR server
   */
  private getCacheKey(): string {
    // Use a simple key for now - in production, would use base64 of server URL
    return 'fhir_resource_types_cache';
  }

  /**
   * Handle resource type selection
   */
  selectResourceType(resourceType: string) {
    this.logger.info('Selected resource type:', resourceType);

    // Navigate to query tab
    this.navigationService.navigateToQuery(resourceType, 'text');

    // Navigate to the query route if not already there
    this.router.navigate(['/app/query']);
  }

  /**
   * Start resizing
   */
  startResizing(event: MouseEvent) {
    event.preventDefault();
    this.isResizing.set(true);
    this.startX = event.clientX;
    this.startWidth = this.sidebarWidth();

    // Prevent text selection during resize
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }

  /**
   * Handle mouse move during resize
   */
  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.isResizing()) {
return;
}

    const deltaX = event.clientX - this.startX;
    const newWidth = this.startWidth + deltaX;

    this.settingsService.setSidebarWidth(newWidth);
  }

  /**
   * Stop resizing
   */
  @HostListener('document:mouseup')
  stopResizing() {
    if (this.isResizing()) {
      this.isResizing.set(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }
  }

  /**
   * Clear filter
   */
  clearFilter() {
    this.filterText.set('');
  }

  /**
   * Toggle favorites section expansion
   */
  toggleFavorites() {
    this.settingsService.toggleSidebarFavorites();
  }

  /**
   * Toggle recent section expansion
   */
  toggleRecent() {
    this.settingsService.toggleSidebarRecent();
  }

  /**
   * Toggle resource types section expansion
   */
  toggleResourceTypes() {
    this.settingsService.toggleSidebarResourceTypes();
  }

  /**
   * Navigate to a favorite query
   */
  navigateToFavorite(favorite: FavoriteResource) {
    this.logger.info('Navigating to favorite:', favorite.query);

    // Update last accessed timestamp
    this.favoritesService.updateLastAccessed(favorite.id);

    // Use navigation service to trigger query execution
    this.navigationService.navigateToFavoriteQuery(favorite.query);

    // Navigate to query tab (if not already there)
    this.router.navigate(['/app/query']);
  }

  /**
   * Remove a favorite
   */
  removeFavorite(favorite: FavoriteResource, event: Event) {
    event.stopPropagation();
    this.favoritesService.removeFavorite(favorite.id);
    this.logger.info('Removed favorite:', favorite.id);
  }

  /**
   * Navigate to a recent resource query
   */
  navigateToRecent(recent: RecentResource) {
    this.logger.info('Navigating to recent:', recent.query);

    // Use navigation service to trigger query execution
    this.navigationService.navigateToFavoriteQuery(recent.query);

    // Navigate to query tab (if not already there)
    this.router.navigate(['/app/query']);
  }

  /**
   * Clear all recent resources for current profile
   */
  clearRecent(event: Event) {
    event.stopPropagation();
    this.recentResourcesService.clearRecent();
    this.logger.info('Cleared recent resources');
  }
}

import { Component, OnInit, OnDestroy, signal, computed, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FhirService } from '../../core/services/fhir.service';
import { SettingsService } from '../../core/services/settings.service';
import { NavigationService } from '../../core/services/navigation.service';

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
  private router = inject(Router);

  // Resource types
  resourceTypes = signal<string[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  // Filter
  filterText = signal('');

  // Filtered resource types
  filteredResourceTypes = computed(() => {
    const filter = this.filterText().toLowerCase();
    if (!filter) return this.resourceTypes();
    return this.resourceTypes().filter(type =>
      type.toLowerCase().includes(filter)
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
      console.error('[Sidebar] Failed to load resource types:', err);
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
    console.log('[Sidebar] Selected resource type:', resourceType);

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
    if (!this.isResizing()) return;

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
}

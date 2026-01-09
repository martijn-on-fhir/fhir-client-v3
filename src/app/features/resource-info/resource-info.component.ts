import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FhirService } from '../../core/services/fhir.service';
import { LoggerService } from '../../core/services/logger.service';

interface SearchParameter {
  name: string;
  type: string;
  documentation?: string;
}

interface ResourceTypeInfo {
  type: string;
  searchInclude?: string[];
  searchRevInclude?: string[];
  searchParam?: SearchParameter[];
}

/**
 * Resource Info Component - Display FHIR server metadata and resource capabilities
 *
 * Features:
 * - Shows FHIR resource search parameters, includes, and reverse includes
 * - Resource type selector with all available resources
 * - Displays Patient resource by default
 * - Real-time resource information lookup
 */
@Component({
  selector: 'app-resource-info',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './resource-info.component.html',
  styleUrl: './resource-info.component.scss'
})
export class ResourceInfoComponent implements OnInit {

  private get logger() {
    return this.loggerService.component('ResourceInfoComponent');
  }

  // State signals
  metadata = signal<any>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  selectedResourceType = signal<string>('Patient');

  // Computed resource types list
  resourceTypes = computed(() => {
    const meta = this.metadata();
    if (!meta?.rest?.[0]?.resource) {
      return [];
    }

    return meta.rest[0].resource
      .map((r: any) => r.type)
      .sort();
  });

  // Computed current resource info
  currentResourceInfo = computed(() => {
    const meta = this.metadata();
    const selectedType = this.selectedResourceType();

    if (!meta?.rest?.[0]?.resource) {
      return null;
    }

    const resource = meta.rest[0].resource.find((r: any) => r.type === selectedType);

    if (!resource) {
      return null;
    }

    return {
      type: resource.type,
      searchInclude: resource.searchInclude || [],
      searchRevInclude: resource.searchRevInclude || [],
      searchParam: resource.searchParam || []
    } as ResourceTypeInfo;
  });

  constructor(
    private fhirService: FhirService,
    private loggerService: LoggerService
  ) {}

  async ngOnInit() {
    await this.loadMetadata();
  }

  /**
   * Load FHIR server metadata
   */
  async loadMetadata() {
    this.loading.set(true);
    this.error.set(null);

    try {
      // Try to get from electron store first
      if (window.electronAPI?.metadata?.get) {
        const stored = await window.electronAPI.metadata.get();
        if (stored) {
          this.metadata.set(stored);
          this.loading.set(false);
          this.logger.info('Loaded metadata from electron store');
          return;
        }
      }

      // Fallback to fetching from FHIR server
      this.fhirService.getMetadata().subscribe({
        next: (data) => {
          this.metadata.set(data);
          this.loading.set(false);
          this.logger.info('Loaded metadata from FHIR server');

          // Store for future use
          if (window.electronAPI?.metadata?.save) {
            window.electronAPI.metadata.save(data);
          }
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to load metadata');
          this.loading.set(false);
          this.logger.error('Failed to load metadata:', err);
        }
      });
    } catch (err: any) {
      this.error.set(err.message || 'Failed to load metadata');
      this.loading.set(false);
      this.logger.error('Error loading metadata:', err);
    }
  }

  /**
   * Handle resource type selection change
   */
  onResourceTypeChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.selectedResourceType.set(select.value);
    this.logger.debug('Selected resource type:', select.value);
  }

  /**
   * Refresh metadata
   */
  async refresh() {
    // Clear stored metadata and fetch fresh
    if (window.electronAPI?.metadata?.clear) {
      await window.electronAPI.metadata.clear();
    }
    await this.loadMetadata();
  }
}

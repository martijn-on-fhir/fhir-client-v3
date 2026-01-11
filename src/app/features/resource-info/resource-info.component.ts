import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FhirService } from '../../core/services/fhir.service';
import { LoggerService } from '../../core/services/logger.service';

/**
 * Represents a FHIR search parameter for a resource type
 */
interface SearchParameter {
  /** Name of the search parameter */
  name: string;
  /** Data type of the search parameter (string, token, reference, etc.) */
  type: string;
  /** Optional documentation describing the search parameter */
  documentation?: string;
}

/**
 * Information about a FHIR resource type from CapabilityStatement
 */
interface ResourceTypeInfo {
  /** Resource type name (e.g., Patient, Observation) */
  type: string;
  /** Array of _include paths supported for this resource */
  searchInclude?: string[];
  /** Array of _revinclude paths supported for this resource */
  searchRevInclude?: string[];
  /** Array of search parameters supported for this resource */
  searchParam?: SearchParameter[];
}

/**
 * Resource Info Component
 *
 * Displays FHIR server metadata and resource type capabilities from CapabilityStatement.
 *
 * Features:
 * - Lists all available FHIR resource types from server
 * - Shows search parameters for selected resource type
 * - Displays _include and _revinclude paths
 * - Caches metadata in Electron store for performance
 * - Real-time resource information lookup
 * - Defaults to Patient resource type
 */
@Component({
  selector: 'app-resource-info',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './resource-info.component.html',
  styleUrl: './resource-info.component.scss'
})
export class ResourceInfoComponent implements OnInit {

  /**
   * Component-specific logger instance
   * @private
   */
  private get logger() {
    return this.loggerService.component('ResourceInfoComponent');
  }

  /** Server CapabilityStatement metadata */
  metadata = signal<any>(null);

  /** Loading state while fetching metadata */
  loading = signal(false);

  /** Error message from metadata loading failures */
  error = signal<string | null>(null);

  /** Currently selected resource type for display */
  selectedResourceType = signal<string>('Patient');

  /**
   * Computed list of all available resource types from server
   * Extracted from CapabilityStatement and sorted alphabetically
   */
  resourceTypes = computed(() => {
    const meta = this.metadata();

    if (!meta?.rest?.[0]?.resource) {
      return [];
    }

    return meta.rest[0].resource
      .map((r: any) => r.type)
      .sort();
  });

  /**
   * Computed information about currently selected resource type
   *
   * Extracts and formats:
   * - Resource type name
   * - Supported search parameters
   * - Supported _include paths (sorted)
   * - Supported _revinclude paths (sorted)
   *
   * Returns null if resource type not found in metadata.
   */
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
      searchInclude: (resource.searchInclude || []).sort((a: string, b: string) => a.localeCompare(b)),
      searchRevInclude: (resource.searchRevInclude || []).sort((a: string, b: string) => a.localeCompare(b)),
      searchParam: resource.searchParam || []
    } as ResourceTypeInfo;
  });

  /**
   * Creates an instance of ResourceInfoComponent
   *
   * @param fhirService - Service for FHIR server communication
   * @param loggerService - Service for application logging
   */
  constructor(
    private fhirService: FhirService,
    private loggerService: LoggerService
  ) {}

  /**
   * Angular lifecycle hook called on component initialization
   * Loads FHIR server metadata from cache or server
   */
  async ngOnInit() {
    await this.loadMetadata();
  }

  /**
   * Loads FHIR server CapabilityStatement metadata
   *
   * Loading strategy:
   * 1. First attempts to load from Electron store cache
   * 2. If not cached, fetches from FHIR server via FhirService
   * 3. Saves fetched metadata to cache for future use
   *
   * Updates metadata signal on success or error signal on failure.
   * Sets loading state during operation.
   *
   * @returns Promise that resolves when metadata is loaded
   */
  async loadMetadata() {
    this.loading.set(true);
    this.error.set(null);

    try {
      if (window.electronAPI?.metadata?.get) {
        const stored = await window.electronAPI.metadata.get();

        if (stored) {
          this.metadata.set(stored);
          this.loading.set(false);
          this.logger.info('Loaded metadata from electron store');

          return;
        }
      }

      this.fhirService.getMetadata().subscribe({
        next: (data) => {
          this.metadata.set(data);
          this.loading.set(false);
          this.logger.info('Loaded metadata from FHIR server');

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
   * Handles resource type selection change from dropdown
   *
   * Updates selectedResourceType signal with new value.
   * This triggers recomputation of currentResourceInfo.
   *
   * @param event - DOM change event from select element
   */
  onResourceTypeChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.selectedResourceType.set(select.value);
    this.logger.debug('Selected resource type:', select.value);
  }

  /**
   * Refreshes metadata by clearing cache and fetching from server
   *
   * Workflow:
   * 1. Clears cached metadata from Electron store
   * 2. Fetches fresh metadata from FHIR server
   * 3. Updates cache with new metadata
   *
   * Useful when server capabilities have changed.
   *
   * @returns Promise that resolves when refresh completes
   */
  async refresh() {
    if (window.electronAPI?.metadata?.clear) {
      await window.electronAPI.metadata.clear();
    }
    await this.loadMetadata();
  }
}

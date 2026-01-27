/**
 * Bulk Operation Service
 *
 * Handles bulk import and export of FHIR resources
 */

import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ImportOptions,
  ExportOptions,
  BulkOperationProgress,
  ResourceOperationResult,
  DEFAULT_IMPORT_OPTIONS
} from '../models/bulk-operation.model';
import { FhirService } from './fhir.service';
import { LoggerService } from './logger.service';

@Injectable({
  providedIn: 'root'
})
export class BulkOperationService {
  private fhirService = inject(FhirService);
  private loggerService = inject(LoggerService);
  private logger = this.loggerService.component('BulkOperationService');

  /** Current operation progress */
  readonly progress = signal<BulkOperationProgress | null>(null);

  /** Results of individual operations */
  readonly results = signal<ResourceOperationResult[]>([]);

  /** Whether an operation is in progress */
  readonly isRunning = signal<boolean>(false);

  /** Cancellation flag */
  private cancelRequested = false;

  /**
   * Parse import file content
   */
  parseImportFile(content: string, format: 'json-array' | 'ndjson'): any[] {
    if (format === 'ndjson') {
      return content
        .split('\n')
        .filter(line => line.trim())
        .map((line, index) => {
          try {
            return JSON.parse(line);
          } catch (e) {
            throw new Error(`Invalid JSON on line ${index + 1}: ${(e as Error).message}`);
          }
        });
    } else {
      const parsed = JSON.parse(content);

      // Handle array of resources
      if (Array.isArray(parsed)) {
        return parsed;
      }

      // Handle Bundle
      if (parsed.resourceType === 'Bundle' && Array.isArray(parsed.entry)) {
        return parsed.entry.map((e: any) => e.resource).filter(Boolean);
      }

      // Single resource
      return [parsed];
    }
  }

  /**
   * Import resources from parsed data
   */
  async importResources(
    resources: any[],
    options: Partial<ImportOptions> = {}
  ): Promise<ResourceOperationResult[]> {
    const opts: ImportOptions = { ...DEFAULT_IMPORT_OPTIONS, ...options };

    this.cancelRequested = false;
    this.isRunning.set(true);
    this.results.set([]);
    this.progress.set({
      total: resources.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      isComplete: false,
      isCancelled: false
    });

    const allResults: ResourceOperationResult[] = [];

    try {
      // Process in batches
      for (let i = 0; i < resources.length; i += opts.batchSize) {
        if (this.cancelRequested) {
          this.progress.update(p => p ? { ...p, isCancelled: true, isComplete: true } : null);
          break;
        }

        const batch = resources.slice(i, i + opts.batchSize);
        const batchPromises = batch.map((resource, batchIndex) =>
          this.processResource(resource, i + batchIndex, opts)
        );

        const batchResults = await Promise.all(batchPromises);
        allResults.push(...batchResults);
        this.results.set([...allResults]);

        // Update progress
        const succeeded = allResults.filter(r => r.status === 'success').length;
        const failed = allResults.filter(r => r.status === 'error').length;
        const skipped = allResults.filter(r => r.status === 'skipped').length;

        this.progress.set({
          total: resources.length,
          processed: allResults.length,
          succeeded,
          failed,
          skipped,
          currentResource: batch[batch.length - 1]?.resourceType,
          isComplete: false,
          isCancelled: false
        });

        // Check if we should stop on error
        if (!opts.continueOnError && failed > 0) {
          break;
        }
      }

      // Mark complete
      this.progress.update(p => p ? { ...p, isComplete: true } : null);
      this.logger.info('Import complete', {
        total: resources.length,
        succeeded: allResults.filter(r => r.status === 'success').length,
        failed: allResults.filter(r => r.status === 'error').length
      });

    } catch (error) {
      this.logger.error('Import failed:', error);
      throw error;
    } finally {
      this.isRunning.set(false);
    }

    return allResults;
  }

  /**
   * Process a single resource for import
   */
  private async processResource(
    resource: any,
    index: number,
    options: ImportOptions
  ): Promise<ResourceOperationResult> {
    const resourceType = resource?.resourceType;
    const resourceId = resource?.id;

    if (!resourceType) {
      return {
        index,
        resourceType: 'Unknown',
        status: 'error',
        error: 'Resource has no resourceType'
      };
    }

    // Dry run - just validate
    if (options.dryRun) {
      try {
        const validationResult = await firstValueFrom(
          this.fhirService.validateOnServer(resource)
        );

        const hasErrors = validationResult?.issue?.some(
          (i: any) => i.severity === 'error' || i.severity === 'fatal'
        );

        if (hasErrors) {
          const errorMsg = validationResult?.issue
            ?.filter((i: any) => i.severity === 'error' || i.severity === 'fatal')
            ?.map((i: any) => i.diagnostics || i.details?.text)
            ?.join('; ') || 'Validation failed';

          return {
            index,
            resourceType,
            resourceId,
            status: 'skipped',
            error: errorMsg
          };
        }

        return {
          index,
          resourceType,
          resourceId,
          status: 'success',
          response: validationResult
        };
      } catch (error: any) {
        return {
          index,
          resourceType,
          resourceId,
          status: 'error',
          error: error.message || 'Validation request failed'
        };
      }
    }

    // Actual import - create or update
    try {
      let response: any;

      if (resourceId) {
        // Has ID - use PUT (update/create)
        response = await firstValueFrom(this.fhirService.update(resource));
      } else {
        // No ID - use POST (create)
        response = await firstValueFrom(this.fhirService.create(resource));
      }

      return {
        index,
        resourceType,
        resourceId: response?.id || resourceId,
        status: 'success',
        response
      };
    } catch (error: any) {
      const errorMsg = error?.error?.issue?.[0]?.diagnostics
        || error?.message
        || 'Operation failed';

      return {
        index,
        resourceType,
        resourceId,
        status: 'error',
        error: errorMsg
      };
    }
  }

  /**
   * Export resources from the server
   */
  async exportResources(options: ExportOptions): Promise<any[]> {
    this.cancelRequested = false;
    this.isRunning.set(true);
    this.progress.set({
      total: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      isComplete: false,
      isCancelled: false
    });

    const allResources: any[] = [];

    try {
      // If no resource type, we need to get all resource types first
      if (!options.resourceType) {
        const metadata = await firstValueFrom(this.fhirService.getMetadata());
        const resourceTypes = metadata?.rest?.[0]?.resource
          ?.map((r: any) => r.type)
          ?.filter(Boolean) || [];

        for (const rt of resourceTypes) {
          if (this.cancelRequested) {
break;
}
          if (options.maxResources > 0 && allResources.length >= options.maxResources) {
break;
}

          const resources = await this.fetchAllOfType(rt, options);
          allResources.push(...resources);

          this.progress.update(p => p ? {
            ...p,
            processed: allResources.length,
            succeeded: allResources.length,
            currentResource: rt
          } : null);
        }
      } else {
        // Export single resource type
        const resources = await this.fetchAllOfType(options.resourceType, options);
        allResources.push(...resources);
      }

      this.progress.update(p => p ? {
        ...p,
        total: allResources.length,
        processed: allResources.length,
        succeeded: allResources.length,
        isComplete: true
      } : null);

      this.logger.info('Export complete', { count: allResources.length });

    } catch (error) {
      this.logger.error('Export failed:', error);
      throw error;
    } finally {
      this.isRunning.set(false);
    }

    return allResources;
  }

  /**
   * Fetch all resources of a specific type
   */
  private async fetchAllOfType(resourceType: string, options: ExportOptions): Promise<any[]> {
    const resources: any[] = [];
    let nextUrl: string | null = `/${resourceType}?_count=100`;

    if (options.searchParams) {
      const params = new URLSearchParams(options.searchParams);
      nextUrl += `&${params.toString()}`;
    }

    while (nextUrl && !this.cancelRequested) {
      if (options.maxResources > 0 && resources.length >= options.maxResources) {
        break;
      }

      try {
        const bundle: any = await firstValueFrom(this.fhirService.executeQuery<any>(nextUrl));

        if (bundle?.entry) {
          const entries = bundle.entry
            .map((e: any) => e.resource)
            .filter(Boolean);

          // Limit to max if set
          if (options.maxResources > 0) {
            const remaining = options.maxResources - resources.length;
            resources.push(...entries.slice(0, remaining));
          } else {
            resources.push(...entries);
          }
        }

        // Get next page link
        const links: any[] = bundle?.link || [];
        const nextLink = links.find((l: any) => l.relation === 'next');
        if (nextLink?.url) {
          // Extract relative path from full URL
          const parsedUrl = new URL(nextLink.url);
          nextUrl = parsedUrl.pathname + parsedUrl.search;
        } else {
          nextUrl = null;
        }

        this.progress.update(p => p ? {
          ...p,
          processed: resources.length,
          succeeded: resources.length,
          currentResource: resourceType
        } : null);

      } catch (error) {
        this.logger.error(`Failed to fetch ${resourceType}:`, error);
        break;
      }
    }

    return resources;
  }

  /**
   * Cancel the current operation
   */
  cancelOperation(): void {
    this.cancelRequested = true;
    this.logger.info('Operation cancellation requested');
  }

  /**
   * Reset state
   */
  reset(): void {
    this.progress.set(null);
    this.results.set([]);
    this.cancelRequested = false;
  }
}

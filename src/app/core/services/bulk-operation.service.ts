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

      const errorMsg = error?.error?.issue?.[0]?.diagnostics  || error?.message || 'Operation failed';

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
   * Export resources from the server (legacy - keeps in memory)
   * @deprecated Use exportToTempFile for large exports
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
      currentResource: 'Counting resources...',
      isComplete: false,
      isCancelled: false
    });

    // First, get the total count for accurate progress
    const estimatedTotal = await this.getTotalExportCount(options);
    this.progress.update(p => p ? { ...p, total: estimatedTotal } : null);

    const allResources: any[] = [];

    try {
      // If no resource type, we need to get all resource types first
      if (!options.resourceType) {

        const metadata = await firstValueFrom(this.fhirService.getMetadata());
        const resourceTypes = metadata?.rest?.[0]?.resource ?.map((r: any) => r.type) ?.filter(Boolean) || [];

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
   * Get the count of resources for a specific type using _summary=count
   */
  private async getResourceCount(resourceType: string, searchParams?: Record<string, string>): Promise<number> {
    try {
      let url = `/${resourceType}?_summary=count`;
      if (searchParams) {
        const params = new URLSearchParams(searchParams);
        url += `&${params.toString()}`;
      }
      const bundle: any = await firstValueFrom(this.fhirService.executeQuery<any>(url));
      return bundle?.total ?? 0;
    } catch (error) {
      this.logger.warn(`Failed to get count for ${resourceType}:`, error);
      return 0;
    }
  }

  /**
   * Get total count for export (single type or all types)
   */
  private async getTotalExportCount(options: ExportOptions): Promise<number> {
    if (options.resourceType) {
      // Single resource type
      const count = await this.getResourceCount(options.resourceType, options.searchParams);
      return options.maxResources > 0 ? Math.min(count, options.maxResources) : count;
    }

    // All resource types - sum up counts
    const metadata = await firstValueFrom(this.fhirService.getMetadata());
    const resourceTypes = metadata?.rest?.[0]?.resource
      ?.map((r: any) => r.type)
      ?.filter(Boolean) || [];

    let totalCount = 0;
    for (const rt of resourceTypes) {
      if (this.cancelRequested) {
break;
}
      if (options.maxResources > 0 && totalCount >= options.maxResources) {
break;
}

      const count = await this.getResourceCount(rt, options.searchParams);
      totalCount += count;

      // Update progress to show counting phase
      this.progress.update(p => p ? {
        ...p,
        currentResource: `Counting ${rt}...`
      } : null);
    }

    return options.maxResources > 0 ? Math.min(totalCount, options.maxResources) : totalCount;
  }

  /**
   * Export resources from the server to a temp file (streaming)
   * Returns the temp file path for later saving
   */
  async exportToTempFile(options: ExportOptions): Promise<{ tempFilePath: string; count: number }> {

    if (!window.electronAPI?.file?.createTempExport) {
      throw new Error('Electron file API not available');
    }

    this.cancelRequested = false;
    this.isRunning.set(true);
    this.progress.set({
      total: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      currentResource: 'Counting resources...',
      isComplete: false,
      isCancelled: false
    });

    // First, get the total count for accurate progress
    const estimatedTotal = await this.getTotalExportCount(options);
    this.progress.update(p => p ? { ...p, total: estimatedTotal } : null);

    // Create temp file
    const prefix = options.resourceType || 'all-resources';
    const tempResult = await window.electronAPI.file.createTempExport(prefix);

    if ('error' in tempResult) {
      throw new Error(tempResult.error);
    }
    const tempFilePath = tempResult.path;

    let totalCount = 0;

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
          if (options.maxResources > 0 && totalCount >= options.maxResources) {
            break;
          }

          const count = await this.streamResourceTypeToFile(rt, options, tempFilePath, totalCount);
          totalCount += count;

          this.progress.update(p => p ? {
            ...p,
            processed: totalCount,
            succeeded: totalCount,
            currentResource: rt
          } : null);
        }
      } else {
        // Export single resource type
        totalCount = await this.streamResourceTypeToFile(options.resourceType, options, tempFilePath, 0);
      }

      this.progress.update(p => p ? {
        ...p,
        total: totalCount,
        processed: totalCount,
        succeeded: totalCount,
        isComplete: true
      } : null);

      this.logger.info('Export to temp file complete', { count: totalCount, path: tempFilePath });

    } catch (error) {
      this.logger.error('Export failed:', error);
      // Clean up temp file on error
      await window.electronAPI.file.deleteTempFile?.(tempFilePath);
      throw error;
    } finally {
      this.isRunning.set(false);
    }

    return { tempFilePath, count: totalCount };
  }

  /**
   * Stream resources of a type directly to temp file
   */
  private async streamResourceTypeToFile(
    resourceType: string,
    options: ExportOptions,
    tempFilePath: string,
    currentTotal: number
  ): Promise<number> {
    let count = 0;
    let nextUrl: string | null = `/${resourceType}?_count=50`;

    if (options.searchParams) {
      const params = new URLSearchParams(options.searchParams);
      nextUrl += `&${params.toString()}`;
    }

    while (nextUrl && !this.cancelRequested) {
      if (options.maxResources > 0 && (currentTotal + count) >= options.maxResources) {
        break;
      }

      try {
        const bundle: any = await firstValueFrom(this.fhirService.executeQuery<any>(nextUrl));

        if (bundle?.entry) {
          let entries = bundle.entry
            .map((e: any) => e.resource)
            .filter((r: any) => r && r.resourceType && r.resourceType !== 'OperationOutcome');

          // Limit to max if set
          if (options.maxResources > 0) {
            const remaining = options.maxResources - (currentTotal + count);
            entries = entries.slice(0, remaining);
          }

          // Stream to temp file
          if (entries.length > 0) {
            const result = await window.electronAPI!.file!.appendLines!(tempFilePath, entries);
            if ('error' in result) {
              throw new Error(result.error);
            }
            count += entries.length;
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
          processed: currentTotal + count,
          succeeded: currentTotal + count,
          currentResource: resourceType
        } : null);

      } catch (error) {
        this.logger.error(`Failed to fetch ${resourceType}:`, error);
        break;
      }
    }

    return count;
  }

  /**
   * Fetch all resources of a specific type (in memory)
   */
  private async fetchAllOfType(resourceType: string, options: ExportOptions): Promise<any[]> {

    const resources: any[] = [];
    let nextUrl: string | null = `/${resourceType}?_count=50`;

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
            .filter((r: any) => r && r.resourceType && r.resourceType !== 'OperationOutcome');

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

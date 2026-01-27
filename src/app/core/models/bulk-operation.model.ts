/**
 * Bulk Operation Models
 *
 * Types and interfaces for bulk import/export operations
 */

/**
 * Import file format
 */
export type ImportFormat = 'json-array' | 'ndjson';

/**
 * Operation status for individual resources
 */
export type OperationStatus = 'pending' | 'processing' | 'success' | 'error' | 'skipped';

/**
 * Result of a single resource operation
 */
export interface ResourceOperationResult {
  /** Index in the import file */
  index: number;
  /** Resource type */
  resourceType: string;
  /** Resource ID (if available) */
  resourceId?: string;
  /** Operation status */
  status: OperationStatus;
  /** Error message if failed */
  error?: string;
  /** Server response (for successful operations) */
  response?: any;
}

/**
 * Progress information for bulk operations
 */
export interface BulkOperationProgress {
  /** Total number of resources */
  total: number;
  /** Number of resources processed */
  processed: number;
  /** Number of successful operations */
  succeeded: number;
  /** Number of failed operations */
  failed: number;
  /** Number of skipped (validation errors in dry-run) */
  skipped: number;
  /** Current resource being processed */
  currentResource?: string;
  /** Whether operation is complete */
  isComplete: boolean;
  /** Whether operation was cancelled */
  isCancelled: boolean;
}

/**
 * Import options
 */
export interface ImportOptions {
  /** File format */
  format: ImportFormat;
  /** Run validation only without creating resources */
  dryRun: boolean;
  /** Continue on errors */
  continueOnError: boolean;
  /** Batch size for parallel processing */
  batchSize: number;
}

/**
 * Export options
 */
export interface ExportOptions {
  /** Resource type to export (empty = all) */
  resourceType: string;
  /** Maximum resources to export (0 = unlimited) */
  maxResources: number;
  /** Include search parameters */
  searchParams?: Record<string, string>;
}

/**
 * Default import options
 */
export const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  format: 'json-array',
  dryRun: false,
  continueOnError: true,
  batchSize: 5
};

/**
 * Default export options
 */
export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  resourceType: '',
  maxResources: 0
};

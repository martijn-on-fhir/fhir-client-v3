import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, signal, computed, inject, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  ImportFormat,
  ImportOptions,
  ExportOptions
} from '../../core/models/bulk-operation.model';
import { BulkOperationService } from '../../core/services/bulk-operation.service';
import { FhirService } from '../../core/services/fhir.service';
import { LoggerService } from '../../core/services/logger.service';
import { ToastService } from '../../core/services/toast.service';

/**
 * Bulk Import/Export Component
 *
 * Provides functionality to:
 * - Import multiple FHIR resources from JSON or NDJSON files
 * - Export resources to JSON files
 * - Track progress with visual progress bar
 * - Report errors per resource
 * - Support dry-run validation
 */
@Component({
  selector: 'app-bulk-import-export',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bulk-import-export.component.html',
  styleUrl: './bulk-import-export.component.scss'
})
export class BulkImportExportComponent implements OnInit, OnDestroy {
  private bulkService = inject(BulkOperationService);
  private fhirService = inject(FhirService);
  private loggerService = inject(LoggerService);
  private logger = this.loggerService.component('BulkImportExportComponent');
  private toastService = inject(ToastService);

  /** Active tab */
  activeTab = signal<'import' | 'export'>('export');

  /** Available resource types from server */
  resourceTypes = signal<string[]>([]);

  /** Loading resource types */
  loadingResourceTypes = signal<boolean>(false);

  // === Import State ===

  /** File content for import */
  importFileContent = signal<string>('');

  /** Parsed resources from file */
  parsedResources = signal<any[]>([]);

  /** Parse error message */
  parseError = signal<string | null>(null);

  /** Import format */
  importFormat = signal<ImportFormat>('json-array');

  /** Dry run mode */
  dryRun = signal<boolean>(false);

  /** Continue on error */
  continueOnError = signal<boolean>(true);

  /** Drag over state */
  isDragOver = signal<boolean>(false);

  /** File name */
  fileName = signal<string>('');

  // === Export State ===

  /** Selected resource type for export */
  exportResourceType = signal<string>('');

  /** Max resources to export */
  maxResources = signal<number>(0);

  /** Temp file path for streamed export */
  tempExportPath = signal<string | null>(null);

  /** Total count of exported resources */
  exportedCount = signal<number>(0);

  /** Sample of exported data (for preview) */
  exportSample = signal<any[]>([]);

  /** Whether there are more records than the sample */
  exportHasMore = signal<boolean>(false);

  /** Exported data (deprecated - kept for backward compat in template) */
  exportedData = signal<any[] | null>(null);

  // === Shared State from Service ===

  readonly progress = this.bulkService.progress;
  readonly results = this.bulkService.results;
  readonly isRunning = this.bulkService.isRunning;

  /** Computed: progress percentage */
  progressPercent = computed(() => {
    const p = this.progress();

    if (!p || p.total === 0) {
      return 0;
    }

    return Math.round((p.processed / p.total) * 100);
  });

  /** Computed: failed results only */
  failedResults = computed(() =>
    this.results().filter(r => r.status === 'error' || r.status === 'skipped')
  );

  /** Computed: success results only */
  successResults = computed(() =>
    this.results().filter(r => r.status === 'success')
  );

  ngOnInit(): void {
    this.loadResourceTypes();
  }

  ngOnDestroy(): void {
    // Cancel any running operation
    if (this.isRunning()) {
      this.bulkService.cancelOperation();
    }
    // Clean up temp export file
    this.cleanupTempFile();
  }

  /**
   * Clean up temp file if exists
   */
  private async cleanupTempFile(): Promise<void> {
    const tempPath = this.tempExportPath();

    if (tempPath && window.electronAPI?.file?.deleteTempFile) {
      await window.electronAPI.file.deleteTempFile(tempPath);
      this.tempExportPath.set(null);
    }
  }

  /**
   * Load available resource types from server
   */
  async loadResourceTypes(): Promise<void> {
    this.loadingResourceTypes.set(true);

    try {
      const metadata = await firstValueFrom(this.fhirService.getMetadata());
      const types = metadata?.rest?.[0]?.resource
        ?.map((r: any) => r.type)
        ?.filter(Boolean)
        ?.sort() || [];

      this.resourceTypes.set(types);
    } catch (error) {
      this.logger.error('Failed to load resource types:', error);
      this.toastService.error('Failed to load resource types', 'Error');
    } finally {
      this.loadingResourceTypes.set(false);
    }
  }

  /**
   * Switch active tab
   */
  setActiveTab(tab: 'import' | 'export'): void {
    this.activeTab.set(tab);
    this.bulkService.reset();
  }

  // === Drag and Drop Handlers ===

  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.activeTab() === 'import') {
      this.isDragOver.set(true);
    }
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    if (this.activeTab() !== 'import') {
return;
}

    const files = event.dataTransfer?.files;

    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  /**
   * Handle file input change
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  /**
   * Handle file upload via Electron dialog
   */
  async openFileDialog(): Promise<void> {
    if (!window.electronAPI?.file?.openFile) {
      this.toastService.error('File API not available', 'Error');

      return;
    }

    const result = await window.electronAPI.file.openFile();

    if (result && !('error' in result)) {
      // Determine format from content or file path
      const isNdjson = result.path?.endsWith('.ndjson') || result.path?.endsWith('.jsonl');

      if (isNdjson) {
        this.importFormat.set('ndjson');
      }

      this.fileName.set(result.path?.split(/[/\\]/).pop() || 'Uploaded file');
      this.parseFileContent(result.content);
    } else if (result && 'error' in result) {
      this.toastService.error(result.error, 'File Error');
    }
  }

  /**
   * Handle dropped or selected file
   */
  private handleFile(file: File): void {
    this.fileName.set(file.name);

    // Auto-detect format
    if (file.name.endsWith('.ndjson') || file.name.endsWith('.jsonl')) {
      this.importFormat.set('ndjson');
    } else {
      this.importFormat.set('json-array');
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      this.parseFileContent(content);
    };
    reader.onerror = () => {
      this.parseError.set('Failed to read file');
    };
    reader.readAsText(file);
  }

  /**
   * Parse file content
   */
  private parseFileContent(content: string): void {
    this.importFileContent.set(content);
    this.parseError.set(null);
    this.parsedResources.set([]);
    this.bulkService.reset();

    try {
      const resources = this.bulkService.parseImportFile(content, this.importFormat());
      this.parsedResources.set(resources);
      this.logger.info(`Parsed ${resources.length} resources`);
    } catch (error: any) {
      this.parseError.set(error.message || 'Failed to parse file');
      this.logger.error('Parse error:', error);
    }
  }

  /**
   * Re-parse when format changes
   */
  onFormatChange(): void {
    if (this.importFileContent()) {
      this.parseFileContent(this.importFileContent());
    }
  }

  /**
   * Start import operation
   */
  async startImport(): Promise<void> {
    const resources = this.parsedResources();

    if (resources.length === 0) {
      this.toastService.warning('No resources to import', 'Warning');

      return;
    }

    const options: Partial<ImportOptions> = {
      format: this.importFormat(),
      dryRun: this.dryRun(),
      continueOnError: this.continueOnError()
    };

    try {
      await this.bulkService.importResources(resources, options);

      const p = this.progress();

      if (p) {
        if (this.dryRun()) {
          this.toastService.info(
            `Validation complete: ${p.succeeded} valid, ${p.skipped} invalid`,
            'Dry Run Complete'
          );
        } else {
          this.toastService.success(
            `Import complete: ${p.succeeded} succeeded, ${p.failed} failed`,
            'Import Complete'
          );
        }
      }
    } catch (error: any) {
      this.toastService.error(error.message || 'Import failed', 'Error');
    }
  }

  /**
   * Start export operation (streams to temp file)
   */
  async startExport(): Promise<void> {
    // Clean up any previous temp file
    await this.cleanupTempFile();

    const options: ExportOptions = {
      resourceType: this.exportResourceType(),
      maxResources: this.maxResources()
    };

    try {
      // Use streaming export to temp file
      const result = await this.bulkService.exportToTempFile(options);
      this.tempExportPath.set(result.tempFilePath);
      this.exportedCount.set(result.count);

      // Load a sample for preview
      await this.loadExportSample();

      this.toastService.success(
        `Exported ${result.count} resources to temp file`,
        'Export Complete'
      );
    } catch (error: any) {
      this.toastService.error(error.message || 'Export failed', 'Error');
    }
  }

  /**
   * Load a sample of exported data for preview
   */
  private async loadExportSample(): Promise<void> {
    const tempPath = this.tempExportPath();

    if (!tempPath || !window.electronAPI?.file?.readSample) {
      return;
    }

    try {
      const result = await window.electronAPI.file.readSample(tempPath, 20);

      if (!('error' in result)) {
        this.exportSample.set(result.sample);
        this.exportHasMore.set(result.hasMore);
        // Also set exportedData for backward compat with template
        this.exportedData.set(result.sample);
      }
    } catch (error) {
      this.logger.error('Failed to load export sample:', error);
    }
  }

  /**
   * Save exported data to file (from temp file)
   */
  async saveExport(): Promise<void> {
    const tempPath = this.tempExportPath();

    if (!tempPath) {
      this.toastService.warning('No export data available', 'Warning');

      return;
    }

    const resourceType = this.exportResourceType() || 'all-resources';
    const filename = `${resourceType}-export-${new Date().toISOString().split('T')[0]}.json`;

    try {
      if (window.electronAPI?.file?.saveTempExport) {
        const result = await window.electronAPI.file.saveTempExport(tempPath, filename);

        if ('error' in result) {
          this.toastService.error(result.error, 'Save Error');
        } else if ('canceled' in result) {
          // User cancelled, do nothing
        } else if (result.success) {
          this.toastService.success(`Saved ${this.exportedCount()} resources to file`, 'Saved');
        }
      } else {
        this.toastService.error('Save API not available', 'Error');
      }
    } catch (error: any) {
      this.toastService.error(error.message || 'Failed to save file', 'Error');
    }
  }

  /**
   * Cancel current operation
   */
  cancelOperation(): void {
    this.bulkService.cancelOperation();
  }

  /**
   * Clear import state
   */
  clearImport(): void {
    this.importFileContent.set('');
    this.parsedResources.set([]);
    this.parseError.set(null);
    this.fileName.set('');
    this.bulkService.reset();
  }

  /**
   * Clear export state
   */
  async clearExport(): Promise<void> {
    await this.cleanupTempFile();
    this.exportedData.set(null);
    this.exportSample.set([]);
    this.exportedCount.set(0);
    this.exportHasMore.set(false);
    this.bulkService.reset();
  }

  /**
   * Copy exported data to clipboard
   */
  async copyToClipboard(): Promise<void> {
    const data = this.exportedData();

    if (!data) {
return;
}

    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      this.toastService.success('Copied to clipboard', 'Copied');
    } catch {
      this.toastService.error('Failed to copy', 'Error');
    }
  }

  /**
   * Get status badge class
   */
  getStatusClass(status: string): string {
    switch (status) {
      case 'success': return 'bg-success';
      case 'error': return 'bg-danger';
      case 'skipped': return 'bg-warning text-dark';
      case 'processing': return 'bg-info';
      default: return 'bg-secondary';
    }
  }

  /**
   * Get summary of resource types in exported sample
   * Note: This only counts the preview sample, not the full export
   */
  getResourceTypeSummary(): { type: string; count: number }[] {
    const data = this.exportSample();

    if (!data || data.length === 0) {
      return [];
    }

    const counts = new Map<string, number>();
    for (const resource of data) {
      const type = resource?.resourceType || 'Unknown';
      counts.set(type, (counts.get(type) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Check if there's export data available
   */
  hasExportData(): boolean {
    return this.tempExportPath() !== null && this.exportedCount() > 0;
  }
}

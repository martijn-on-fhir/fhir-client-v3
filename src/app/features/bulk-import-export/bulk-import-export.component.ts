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
  activeTab = signal<'import' | 'export'>('import');

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

  /** Exported data */
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
    this.parseError.set(null);
    this.exportedData.set(null);
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
   * Start export operation
   */
  async startExport(): Promise<void> {
    const options: ExportOptions = {
      resourceType: this.exportResourceType(),
      maxResources: this.maxResources()
    };

    try {
      const resources = await this.bulkService.exportResources(options);
      this.exportedData.set(resources);

      this.toastService.success(
        `Exported ${resources.length} resources`,
        'Export Complete'
      );
    } catch (error: any) {
      this.toastService.error(error.message || 'Export failed', 'Error');
    }
  }

  /**
   * Save exported data to file
   */
  async saveExport(): Promise<void> {
    const data = this.exportedData();

    if (!data) {
return;
}

    const resourceType = this.exportResourceType() || 'all-resources';
    const filename = `${resourceType}-export-${new Date().toISOString().split('T')[0]}.json`;
    const content = JSON.stringify(data, null, 2);

    try {
      if (window.electronAPI?.file?.saveFile) {
        const result = await window.electronAPI.file.saveFile(content, filename);

        if (result && 'error' in result) {
          this.toastService.error(result.error, 'Save Error');
        } else if (result?.success) {
          this.toastService.success('File saved successfully', 'Saved');
        }
      } else {
        // Fallback: browser download
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
        this.toastService.success('File downloaded', 'Downloaded');
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
  clearExport(): void {
    this.exportedData.set(null);
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
   * Get summary of resource types in exported data
   */
  getResourceTypeSummary(): { type: string; count: number }[] {
    const data = this.exportedData();

    if (!data) {
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
}

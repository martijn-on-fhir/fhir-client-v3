import { CommonModule } from '@angular/common';
import {
  Component,
  OnDestroy,
  Output,
  EventEmitter,
  signal,
  computed,
  HostListener,
  inject,
  ViewChild,
  ElementRef,
  AfterViewInit
} from '@angular/core';
import { FormsModule } from '@angular/forms';
// eslint-disable-next-line @typescript-eslint/naming-convention
import type * as Monaco from 'monaco-editor';
import { FhirService } from '../../../core/services/fhir.service';
import { LoggerService } from '../../../core/services/logger.service';
import { MonacoLoaderService } from '../../../core/services/monaco-loader.service';
import { ThemeService } from '../../../core/services/theme.service';
import { ToastService } from '../../../core/services/toast.service';

/**
 * Resource Diff Dialog Component
 *
 * Modal dialog for comparing two FHIR resources side-by-side with visual diff.
 * Features:
 * - Compare two different resources
 * - Compare current vs historical version
 * - Inline or side-by-side diff view modes
 * - Fetch resources by reference or paste JSON
 */
@Component({
  selector: 'app-resource-diff-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './resource-diff-dialog.component.html',
  styleUrl: './resource-diff-dialog.component.scss'
})
export class ResourceDiffDialogComponent implements AfterViewInit, OnDestroy {
  @ViewChild('diffContainer') diffContainer!: ElementRef<HTMLDivElement>;

  private fhirService = inject(FhirService);
  private loggerService = inject(LoggerService);
  private toastService = inject(ToastService);
  private monacoLoaderService = inject(MonacoLoaderService);
  private themeService = inject(ThemeService);

  private logger = this.loggerService.component('ResourceDiffDialog');

  // Dialog state
  show = signal(false);

  // Outputs
  @Output() closed = new EventEmitter<void>();

  // Monaco diff editor
  private monaco: typeof Monaco | null = null;
  private diffEditor: Monaco.editor.IStandaloneDiffEditor | null = null;

  // Comparison mode
  comparisonMode = signal<'resources' | 'history'>('history');

  // Input state for "Compare Two Resources" mode
  leftReference = signal('');
  rightReference = signal('');
  leftJson = signal('');
  rightJson = signal('');

  // Input state for "Compare History" mode
  historyReference = signal('');
  historyVersions = signal<HistoryVersion[]>([]);
  selectedLeftVersion = signal<string>('');
  selectedRightVersion = signal<string>('');
  historyLoading = signal(false);

  // View mode
  viewMode = signal<'side-by-side' | 'inline'>('side-by-side');

  // Loading states
  leftLoading = signal(false);
  rightLoading = signal(false);

  // Theme
  isDarkMode = computed(() => this.themeService.currentTheme() === 'dark');

  // Diff stats
  diffStats = signal<{ additions: number; deletions: number; changes: number } | null>(null);

  async ngAfterViewInit() {
    // Pre-load Monaco
    try {
      this.monaco = await this.monacoLoaderService.loadMonaco();
    } catch (error) {
      this.logger.error('Failed to load Monaco:', error);
    }
  }

  ngOnDestroy() {
    this.destroyDiffEditor();
  }

  /**
   * Open the dialog
   */
  open(options?: { leftResource?: any; rightResource?: any; reference?: string }) {
    this.show.set(true);

    if (options?.leftResource) {
      this.leftJson.set(JSON.stringify(options.leftResource, null, 2));
    }

    if (options?.rightResource) {
      this.rightJson.set(JSON.stringify(options.rightResource, null, 2));
    }

    if (options?.reference) {
      this.historyReference.set(options.reference);
      // Auto-load history when reference is provided
      setTimeout(() => this.fetchHistory(), 150);
    }

    // Initialize diff editor after view is ready
    setTimeout(() => this.initDiffEditor(), 100);
  }

  /**
   * Close the dialog
   */
  closeDialog() {
    this.show.set(false);
    this.destroyDiffEditor();
    this.resetState();
    this.closed.emit();
  }

  /**
   * Reset dialog state
   */
  private resetState() {
    this.leftReference.set('');
    this.rightReference.set('');
    this.leftJson.set('');
    this.rightJson.set('');
    this.historyReference.set('');
    this.historyVersions.set([]);
    this.selectedLeftVersion.set('');
    this.selectedRightVersion.set('');
    this.diffStats.set(null);
  }

  /**
   * Initialize Monaco diff editor
   */
  private async initDiffEditor() {
    if (!this.monaco || !this.diffContainer?.nativeElement) {
      return;
    }

    // Destroy existing editor
    this.destroyDiffEditor();

    const theme = this.isDarkMode() ? 'vs-dark' : 'vs';

    this.diffEditor = this.monaco.editor.createDiffEditor(this.diffContainer.nativeElement, {
      theme,
      automaticLayout: true,
      readOnly: true,
      renderSideBySide: this.viewMode() === 'side-by-side',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 13,
      lineNumbers: 'on',
      folding: true,
      wordWrap: 'on',
      diffWordWrap: 'on',
      ignoreTrimWhitespace: false,
      renderIndicators: true,
      originalEditable: false,
      enableSplitViewResizing: true
    });

    // Set initial models
    this.updateDiffModels();

    this.logger.info('Diff editor initialized');
  }

  /**
   * Destroy diff editor
   */
  private destroyDiffEditor() {
    if (this.diffEditor) {
      this.diffEditor.dispose();
      this.diffEditor = null;
    }
  }

  /**
   * Update diff editor models with current content
   */
  private updateDiffModels() {
    if (!this.monaco || !this.diffEditor) {
      return;
    }

    const originalModel = this.monaco.editor.createModel(this.leftJson(), 'json');
    const modifiedModel = this.monaco.editor.createModel(this.rightJson(), 'json');

    this.diffEditor.setModel({
      original: originalModel,
      modified: modifiedModel
    });

    // Calculate diff stats
    this.calculateDiffStats();
  }

  /**
   * Calculate diff statistics
   */
  private calculateDiffStats() {
    const left = this.leftJson();
    const right = this.rightJson();

    if (!left || !right) {
      this.diffStats.set(null);

      return;
    }

    const leftLines = left.split('\n');
    const rightLines = right.split('\n');

    // Simple diff calculation (line-based)
    let additions = 0;
    let deletions = 0;

    const leftSet = new Set(leftLines);
    const rightSet = new Set(rightLines);

    for (const line of rightLines) {
      if (!leftSet.has(line) && line.trim()) {
        additions++;
      }
    }

    for (const line of leftLines) {
      if (!rightSet.has(line) && line.trim()) {
        deletions++;
      }
    }

    this.diffStats.set({
      additions,
      deletions,
      changes: additions + deletions
    });
  }

  /**
   * Toggle view mode between side-by-side and inline
   */
  toggleViewMode() {
    const newMode = this.viewMode() === 'side-by-side' ? 'inline' : 'side-by-side';
    this.viewMode.set(newMode);

    if (this.diffEditor) {
      this.diffEditor.updateOptions({
        renderSideBySide: newMode === 'side-by-side'
      });
    }
  }

  /**
   * Switch comparison mode
   */
  setComparisonMode(mode: 'resources' | 'history') {
    this.comparisonMode.set(mode);
    this.leftJson.set('');
    this.rightJson.set('');
    this.updateDiffModels();
  }

  /**
   * Normalize a reference by removing leading slash
   * Handles both "Patient/123" and "/Patient/123" formats
   */
  private normalizeReference(reference: string): { resourceType: string; id: string } {
    // Remove leading slash if present
    const normalized = reference.startsWith('/') ? reference.substring(1) : reference;
    const parts = normalized.split('/');

    if (parts.length < 2 || !parts[0] || !parts[1]) {
      throw new Error('Invalid reference format. Use /ResourceType/id');
    }

    return { resourceType: parts[0], id: parts[1] };
  }

  /**
   * Fetch resource by reference
   */
  async fetchResource(side: 'left' | 'right') {
    const reference = side === 'left' ? this.leftReference() : this.rightReference();

    if (!reference.trim()) {
      this.toastService.warning('Please enter a resource reference');

      return;
    }

    const loadingSignal = side === 'left' ? this.leftLoading : this.rightLoading;
    const jsonSignal = side === 'left' ? this.leftJson : this.rightJson;

    loadingSignal.set(true);

    try {
      const { resourceType, id } = this.normalizeReference(reference);

      if (!resourceType || !id) {
        throw new Error('Invalid reference format. Use /ResourceType/id');
      }

      const resource = await this.fhirService.read(resourceType, id).toPromise();
      jsonSignal.set(JSON.stringify(resource, null, 2));
      this.updateDiffModels();
      this.logger.info(`Fetched ${side} resource:`, reference);
    } catch (error: any) {
      this.toastService.error(`Failed to fetch resource: ${error.message}`);
      this.logger.error(`Failed to fetch ${side} resource:`, error);
    } finally {
      loadingSignal.set(false);
    }
  }

  /**
   * Fetch resource history
   */
  async fetchHistory() {
    const reference = this.historyReference().trim();

    if (!reference) {
      this.toastService.warning('Please enter a resource reference');

      return;
    }

    this.historyLoading.set(true);
    this.historyVersions.set([]);

    try {
      const { resourceType, id } = this.normalizeReference(reference);

      // Fetch history bundle
      const bundle = await this.fhirService.history(resourceType, id).toPromise();

      if (!bundle?.entry?.length) {
        this.toastService.info('No history found for this resource');

        return;
      }

      // Extract versions
      const versions: HistoryVersion[] = bundle.entry.map((entry: any, index: number) => ({
        versionId: entry.resource?.meta?.versionId || `v${index + 1}`,
        lastUpdated: entry.resource?.meta?.lastUpdated || 'Unknown',
        resource: entry.resource
      }));

      this.historyVersions.set(versions);

      // Auto-select first two versions if available
      if (versions.length >= 2) {
        this.selectedLeftVersion.set(versions[1].versionId); // Older
        this.selectedRightVersion.set(versions[0].versionId); // Newer
        this.loadHistoryVersions();
      } else if (versions.length === 1) {
        this.selectedRightVersion.set(versions[0].versionId);
      }

      this.logger.info('Fetched history:', versions.length, 'versions');
    } catch (error: any) {
      this.toastService.error(`Failed to fetch history: ${error.message}`);
      this.logger.error('Failed to fetch history:', error);
    } finally {
      this.historyLoading.set(false);
    }
  }

  /**
   * Load selected history versions into diff editor
   */
  loadHistoryVersions() {
    const versions = this.historyVersions();
    const leftVersionId = this.selectedLeftVersion();
    const rightVersionId = this.selectedRightVersion();

    const leftVersion = versions.find(v => v.versionId === leftVersionId);
    const rightVersion = versions.find(v => v.versionId === rightVersionId);

    if (leftVersion) {
      this.leftJson.set(JSON.stringify(leftVersion.resource, null, 2));
    }

    if (rightVersion) {
      this.rightJson.set(JSON.stringify(rightVersion.resource, null, 2));
    }

    this.updateDiffModels();
  }

  /**
   * Handle JSON paste for left side
   */
  onLeftJsonChange(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    this.leftJson.set(textarea.value);
    this.updateDiffModels();
  }

  /**
   * Handle JSON paste for right side
   */
  onRightJsonChange(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    this.rightJson.set(textarea.value);
    this.updateDiffModels();
  }

  /**
   * Swap left and right content
   */
  swapSides() {
    const tempJson = this.leftJson();
    const tempRef = this.leftReference();

    this.leftJson.set(this.rightJson());
    this.leftReference.set(this.rightReference());

    this.rightJson.set(tempJson);
    this.rightReference.set(tempRef);

    this.updateDiffModels();
  }

  /**
   * Clear all content
   */
  clearAll() {
    this.leftJson.set('');
    this.rightJson.set('');
    this.leftReference.set('');
    this.rightReference.set('');
    this.updateDiffModels();
  }

  /**
   * Keyboard shortcuts
   */
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (!this.show()) {
      return;
    }

    // Escape - Close dialog
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeDialog();
    }
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    if (!dateString || dateString === 'Unknown') {
      return 'Unknown';
    }

    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  }
}

/**
 * History version interface
 */
interface HistoryVersion {
  versionId: string;
  lastUpdated: string;
  resource: any;
}

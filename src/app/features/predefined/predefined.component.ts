import { CommonModule } from '@angular/common';
import {Component, OnInit, AfterViewInit, OnDestroy, signal, computed, effect, HostListener, inject, ViewChild} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SmartQueryTemplate, TemplateCategory, CATEGORIES, getCategoryInfo } from '../../core/models/smart-template.model';
import { EditorStateService } from '../../core/services/editor-state.service';
import { FhirService } from '../../core/services/fhir.service';
import { LoggerService } from '../../core/services/logger.service';
import { TemplateService } from '../../core/services/template.service';
import { ConfirmationDialogComponent } from '../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { JsonViewerToolbarComponent } from '../../shared/components/json-viewer-toolbar/json-viewer-toolbar.component';
import { MonacoEditorComponent } from '../../shared/components/monaco-editor/monaco-editor.component';
import { ResultHeaderComponent } from '../../shared/components/result-header/result-header.component';
import { TemplateBrowserComponent } from './components/template-browser.component';
import { TemplateConfigDialogComponent } from './dialogs/template-config-dialog.component';
import { TemplateEditorDialogComponent } from './dialogs/template-editor-dialog.component';

/**
 * Predefined Tab Component
 *
 * Manages smart query templates - parameterized, reusable FHIR queries.
 * Features split-panel layout with template browser on left and results on right.
 */
@Component({
  selector: 'app-predefined',
  standalone: true,
  imports: [CommonModule, FormsModule, MonacoEditorComponent, JsonViewerToolbarComponent, ResultHeaderComponent, TemplateBrowserComponent, ConfirmationDialogComponent, TemplateConfigDialogComponent, TemplateEditorDialogComponent],
  templateUrl: './predefined.component.html',
  styleUrl: './predefined.component.scss'
})
export class PredefinedComponent implements OnInit, AfterViewInit, OnDestroy {

  // ViewChild reference to Monaco Editor (text modus)
  @ViewChild('component') component?: MonacoEditorComponent;

  private templateService = inject(TemplateService);
  private fhirService = inject(FhirService);
  private loggerService = inject(LoggerService);
  private editorStateService = inject(EditorStateService);
  private get logger() {
    return this.loggerService.component('PredefinedComponent');
  }

  // Categories for template
  categories = CATEGORIES;
  getCategoryInfo = getCategoryInfo;

  // Search and filter
  searchQuery = signal('');
  selectedCategory = signal<TemplateCategory | 'all'>('all');

  // Templates
  selectedTemplate = signal<SmartQueryTemplate | null>(null);
  refreshKey = signal(0);

  // Computed filtered templates
  filteredTemplates = computed(() => {
    this.refreshKey(); // Trigger recompute on refresh

    return this.templateService.getFilteredTemplates(
      this.selectedCategory(),
      this.searchQuery()
    );
  });


  // Config dialog state
  showConfigDialog = signal(false);
  parameterValues = signal<Record<string, string>>({});

  // Editor dialog state
  showEditorDialog = signal(false);
  editingTemplate = signal<SmartQueryTemplate | null>(null);

  // Confirmation dialog state
  showConfirmDialog = signal(false);
  confirmDialogConfig = signal({
    title: 'Confirm Action',
    message: 'Are you sure?',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    confirmButtonClass: 'btn-danger',
    icon: 'fa-exclamation-triangle',
    onConfirm: () => { /* empty */ }
  });

  // Split panel state
  leftWidth = signal(40); // percentage
  isResizing = signal(false);
  private startX = 0;
  private startWidth = 0;

  // Query execution
  currentQuery = signal('');
  result = signal<any>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  // JSON viewer settings
  collapsedLevel = signal<number | false>(4);
  showSearch = signal(false);
  searchTerm = signal('');

  // Monaco editor JSON content
  jsonContent = computed(() => {
    const res = this.result();

    return res ? JSON.stringify(res, null, 2) : '';
  });

  constructor() {
    // Register editor when it becomes available (after query results load)
    effect(() => {
      const hasResults = this.result() != null;

      if (hasResults) {
        setTimeout(() => {
          if (this.component?.editor) {
            this.editorStateService.registerEditor(this.component, false, '/app/predefined');
            this.logger.info('Predefined editor registered as read-only');
          } else {
            // Retry after Monaco editor has had time to initialize
            setTimeout(() => {
              if (this.component?.editor) {
                this.editorStateService.registerEditor(this.component, false, '/app/predefined');
                this.logger.info('Predefined editor registered as read-only');
              }
            }, 200);
          }
        }, 100);
      }
    });
  }

  ngOnInit() {
    this.logger.info('Predefined tab initialized');
  }

  ngAfterViewInit() {
    // Editor registration happens in ngOnInit effect
  }

  ngOnDestroy() {
    this.stopResizing();
    this.editorStateService.unregisterEditor('/app/predefined');
  }

  /**
   * Select a template
   */
  selectTemplate(template: SmartQueryTemplate) {
    this.selectedTemplate.set(template);
    this.showConfigDialog.set(true);
  }

  /**
   * Handle template execution from config dialog
   */
  async handleTemplateExecution(event: { query: string; template: SmartQueryTemplate }) {
    this.currentQuery.set(event.query);
    this.showConfigDialog.set(false);

    this.logger.debug('Executing template:', event.template.name);
    await this.executeQuery(event.query);
  }

  /**
   * Close config dialog
   */
  closeConfigDialog() {
    this.showConfigDialog.set(false);
  }

  /**
   * Execute a FHIR query
   */
  async executeQuery(query: string) {
    this.loading.set(true);
    this.error.set(null);

    try {
      this.fhirService.executeQuery(query).subscribe({
        next: (data) => {
          this.result.set(data);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to execute query');
          this.logger.error('Query execution failed:', err);
          this.loading.set(false);
        }
      });
    } catch (err: any) {
      this.error.set(err.message || 'Failed to execute query');
      this.logger.error('Query execution failed:', err);
      this.loading.set(false);
    }
  }

  /**
   * Open new template editor
   */
  openNewTemplate() {
    this.editingTemplate.set(null);
    this.showEditorDialog.set(true);
  }

  /**
   * Edit existing template
   */
  editTemplate(template: SmartQueryTemplate) {
    if (template.isSystem) {
      this.confirmDialogConfig.set({
        title: 'System Template',
        message: 'System templates cannot be edited directly. Would you like to create a custom copy instead?',
        confirmText: 'Create Copy',
        cancelText: 'Cancel',
        confirmButtonClass: 'btn-primary',
        icon: 'fa-info-circle',
        onConfirm: () => {
          // Create a copy with new ID
          const copy: SmartQueryTemplate = {
            ...template,
            id: this.templateService.generateId(),
            name: `${template.name} (Copy)`,
            isSystem: false,
            createdAt: new Date().toISOString(),
            updatedAt: undefined
          };
          this.editingTemplate.set(copy);
          this.showEditorDialog.set(true);
          this.showConfirmDialog.set(false);
        }
      });
      this.showConfirmDialog.set(true);

      return;
    }
    this.editingTemplate.set(template);
    this.showEditorDialog.set(true);
  }

  /**
   * Delete a template
   */
  deleteTemplate(template: SmartQueryTemplate) {
    if (template.isSystem) {
      this.confirmDialogConfig.set({
        title: 'Cannot Delete',
        message: 'System templates cannot be deleted.',
        confirmText: 'OK',
        cancelText: '',
        confirmButtonClass: 'btn-secondary',
        icon: 'fa-ban',
        onConfirm: () => {
          this.showConfirmDialog.set(false);
        }
      });
      this.showConfirmDialog.set(true);

      return;
    }

    this.confirmDialogConfig.set({
      title: 'Delete Template',
      message: `Are you sure you want to delete "${template.name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmButtonClass: 'btn-danger',
      icon: 'fa-trash',
      onConfirm: () => {
        if (this.templateService.deleteTemplate(template.id)) {
          this.logger.info('Template deleted:', template.id);
          this.refreshKey.set(this.refreshKey() + 1);

          if (this.selectedTemplate()?.id === template.id) {
            this.selectedTemplate.set(null);
          }
        }
        this.showConfirmDialog.set(false);
      }
    });
    this.showConfirmDialog.set(true);
  }

  /**
   * Handle confirmation dialog confirm
   */
  handleConfirmDialogConfirm() {
    this.confirmDialogConfig().onConfirm();
  }

  /**
   * Handle confirmation dialog cancel
   */
  handleConfirmDialogCancel() {
    this.showConfirmDialog.set(false);
  }

  /**
   * Save template from editor
   */
  saveTemplate(template: SmartQueryTemplate) {
    this.templateService.saveTemplate(template);
    this.logger.info('Template saved:', template.id);
    this.refreshKey.set(this.refreshKey() + 1);
    this.showEditorDialog.set(false);
  }

  /**
   * Export template to file
   */
  async exportTemplate(template: SmartQueryTemplate) {
    try {
      await this.templateService.exportTemplate(template);
      this.logger.info('Template exported successfully');
    } catch (error: any) {
      this.error.set(error.message || 'Failed to export template');
      this.logger.error('Export failed:', error);
    }
  }

  /**
   * Import template from file
   */
  async importTemplate() {
    try {
      const imported = await this.templateService.importTemplate();

      if (imported) {
        this.logger.info('Template imported successfully:', imported.name);
        this.refreshKey.set(this.refreshKey() + 1);
      }
    } catch (error: any) {
      this.error.set(error.message || 'Failed to import template');
      this.logger.error('Import failed:', error);
    }
  }

  /**
   * Copy query to clipboard
   */
  copyQuery() {
    navigator.clipboard.writeText(this.currentQuery());
    this.logger.info('Query copied to clipboard');
  }

  /**
   * Start resizing panels
   */
  startResizing(event: MouseEvent) {
    event.preventDefault();
    this.isResizing.set(true);
    this.startX = event.clientX;
    this.startWidth = this.leftWidth();

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

    const container = document.getElementById('predefined-container');

    if (container) {
      const containerRect = container.getBoundingClientRect();
      const newWidth = ((event.clientX - containerRect.left) / containerRect.width) * 100;

      if (newWidth >= 20 && newWidth <= 80) {
        this.leftWidth.set(newWidth);
      }
    }
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
   * Handle keyboard shortcuts
   */
  @HostListener('document:keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent) {
    // Ctrl/Cmd + Enter: Execute query
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      if (this.currentQuery() && !this.loading()) {
        event.preventDefault();
        this.executeQuery(this.currentQuery());
      }
    }

    // Ctrl/Cmd + N: New template
    if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
      // Only if no dialogs are open
      if (!this.showConfigDialog() && !this.showEditorDialog() && !this.showConfirmDialog()) {
        event.preventDefault();
        this.openNewTemplate();
      }
    }

    // Ctrl/Cmd + O: Import template
    if ((event.ctrlKey || event.metaKey) && event.key === 'o') {
      // Only if no dialogs are open
      if (!this.showConfigDialog() && !this.showEditorDialog() && !this.showConfirmDialog()) {
        event.preventDefault();
        this.importTemplate();
      }
    }

    // Escape: Close dialogs
    if (event.key === 'Escape') {
      if (this.showConfirmDialog()) {
        this.handleConfirmDialogCancel();
      } else if (this.showConfigDialog()) {
        this.closeConfigDialog();
      } else if (this.showEditorDialog()) {
        // Only close if no unsaved changes (handled by editor dialog itself)
        this.showEditorDialog.set(false);
      }
    }
  }

  /**
   * Expand one level
   */
  expandOneLevel() {
    const level = this.collapsedLevel();

    if (level === false) {
return;
}

    if (level === 1) {
      this.collapsedLevel.set(false);
    } else {
      this.collapsedLevel.set((level as number) - 1);
    }
  }

  /**
   * Collapse one level
   */
  collapseOneLevel() {
    const level = this.collapsedLevel();

    if (level === false) {
      this.collapsedLevel.set(1);
    } else {
      this.collapsedLevel.set((level as number) + 1);
    }
  }
}

import { CommonModule } from '@angular/common';
import {Component, OnInit, OnDestroy, signal, computed, effect, HostListener, inject, ViewChild} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SmartQueryTemplate, TemplateCategory, CATEGORIES, getCategoryInfo } from '../../core/models/smart-template.model';
import { EditorStateService } from '../../core/services/editor-state.service';
import { FhirService } from '../../core/services/fhir.service';
import { LoggerService } from '../../core/services/logger.service';
import { PredefinedStateService } from '../../core/services/predefined-state.service';
import { TemplateService } from '../../core/services/template.service';
import { ConfirmationDialogComponent } from '../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { MonacoEditorComponent } from '../../shared/components/monaco-editor/monaco-editor.component';
import { BundleLink, ResultHeaderComponent } from '../../shared/components/result-header/result-header.component';
import { TemplateBrowserComponent } from './components/template-browser.component';
import { TemplateConfigDialogComponent } from './dialogs/template-config-dialog.component';
import { TemplateEditorDialogComponent } from './dialogs/template-editor-dialog.component';

/**
 * Predefined Tab Component
 *
 * Manages smart query templates - parameterized, reusable FHIR queries.
 *
 * Features:
 * - Template browser with category filtering and search
 * - Parameter configuration dialog for template execution
 * - Template editor dialog for creating/editing templates
 * - CRUD operations for custom templates (system templates read-only)
 * - Import/export functionality for template sharing
 * - Split-panel layout with resizable template browser and results view
 * - Monaco editor integration for JSON result display
 * - Keyboard shortcuts for common operations
 */
@Component({
  selector: 'app-predefined',
  standalone: true,
  imports: [CommonModule, FormsModule, MonacoEditorComponent, ResultHeaderComponent, TemplateBrowserComponent, ConfirmationDialogComponent, TemplateConfigDialogComponent, TemplateEditorDialogComponent],
  templateUrl: './predefined.component.html',
  styleUrl: './predefined.component.scss'
})
export class PredefinedComponent implements OnInit, OnDestroy {

  /** Reference to Monaco editor component for JSON result display */
  @ViewChild('component') component?: MonacoEditorComponent;

  /** Service for managing smart query templates */
  private templateService = inject(TemplateService);

  /** Service for FHIR server communication */
  private fhirService = inject(FhirService);

  /** Service for application logging */
  private loggerService = inject(LoggerService);

  /** Service for managing editor state and file operations */
  private editorStateService = inject(EditorStateService);

  /** Service for persisting state across tab navigation */
  private predefinedStateService = inject(PredefinedStateService);

  /** Component-specific logger instance */
  private get logger() {
    return this.loggerService.component('PredefinedComponent');
  }

  /** Array of available template categories */
  categories = CATEGORIES;

  /** Utility function for retrieving category information */
  getCategoryInfo = getCategoryInfo;

  /** Search query string for filtering templates */
  searchQuery = signal('');

  /** Currently selected category filter for templates */
  selectedCategory = signal<TemplateCategory | 'all'>('all');

  /** Currently selected template for execution or editing */
  selectedTemplate = signal<SmartQueryTemplate | null>(null);

  /** Refresh key to trigger recomputation of filtered templates */
  refreshKey = signal(0);

  /** Computed list of templates filtered by category and search query */
  filteredTemplates = computed(() => {
    this.refreshKey();

    return this.templateService.getFilteredTemplates(
      this.selectedCategory(),
      this.searchQuery()
    );
  });

  /** Whether template configuration dialog is visible */
  showConfigDialog = signal(false);

  /** Parameter values for template execution */
  parameterValues = signal<Record<string, string>>({});

  /** Whether template editor dialog is visible */
  showEditorDialog = signal(false);

  /** Template being edited in editor dialog */
  editingTemplate = signal<SmartQueryTemplate | null>(null);

  /** Whether confirmation dialog is visible */
  showConfirmDialog = signal(false);

  /** Configuration for confirmation dialog */
  confirmDialogConfig = signal({
    title: 'Confirm Action',
    message: 'Are you sure?',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    confirmButtonClass: 'btn-danger',
    icon: 'fa-exclamation-triangle',
    onConfirm: () => { /* empty */ }
  });

  /** Width percentage of left panel in split view */
  leftWidth = signal(40);

  /** Whether panel resize is in progress */
  isResizing = signal(false);

  /** Starting X position for resize operation */
  private startX = 0;

  /** Starting width percentage for resize operation */
  private startWidth = 0;

  /** Current FHIR query string being executed */
  currentQuery = signal('');

  /** Result from last query execution */
  result = signal<any>(null);

  /** Loading state during query execution */
  loading = signal(false);

  /** Error message from query execution */
  error = signal<string | null>(null);

  /** JSON viewer collapse level (false = fully expanded) */
  collapsedLevel = signal<number | false>(4);

  /** Whether JSON search is visible */
  showSearch = signal(false);

  /** Search term for filtering JSON content */
  searchTerm = signal('');

  /** Computed JSON string from query result */
  jsonContent = computed(() => {
    const res = this.result();

    return res ? JSON.stringify(res, null, 2) : '';
  });

  /** Computed pagination links from FHIR Bundle result */
  paginationLinks = computed<BundleLink[]>(() => {
    const res = this.result();

    if (!res?.link || !Array.isArray(res.link)) {
      return [];
    }

    return res.link as BundleLink[];
  });

  /** Computed total count from FHIR Bundle result */
  resultTotal = computed<number | undefined>(() => this.result()?.total);

  /**
   * Creates an instance of PredefinedComponent
   *
   * Sets up reactive effect for:
   * - Registering Monaco editor with EditorStateService when query results are available
   * (with retry mechanism for async Monaco loading)
   */
  constructor() {
    effect(() => {
      const hasResults = this.result() != null;

      if (hasResults) {
        setTimeout(() => {
          if (this.component?.editor) {
            this.editorStateService.registerEditor(this.component, false, '/app/predefined');
            this.logger.info('Predefined editor registered as read-only');
          } else {
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

    // Sync local result with state service (clears results on profile switch)
    effect(() => {
      const serviceResult = this.predefinedStateService.result();
      if (serviceResult === null) {
        this.result.set(null);
      }
    }, {allowSignalWrites: true});
  }

  /**
   * Angular lifecycle hook called on component initialization
   * Logs component initialization for debugging
   */
  ngOnInit() {
    this.logger.info('Predefined tab initialized');

    // Restore state from service (persists across tab navigation)
    if (this.predefinedStateService.hasResult()) {
      this.result.set(this.predefinedStateService.result());
      this.currentQuery.set(this.predefinedStateService.currentQuery());
      this.logger.debug('Restored predefined state from service');
    }
  }

  /**
   * Angular lifecycle hook called on component destruction
   * Cleans up resize handlers and unregisters editor from EditorStateService
   */
  ngOnDestroy() {
    this.stopResizing();
    this.editorStateService.unregisterEditor('/app/predefined');
  }

  /**
   * Selects a template and opens configuration dialog
   *
   * Sets the selected template and displays the parameter configuration dialog
   * where users can provide values for template parameters before execution.
   *
   * @param template - The smart query template to select and configure
   */
  selectTemplate(template: SmartQueryTemplate) {
    this.selectedTemplate.set(template);
    this.showConfigDialog.set(true);
  }

  /**
   * Handles template execution from configuration dialog
   *
   * Receives the parameterized query string from the config dialog,
   * closes the dialog, and executes the query against the FHIR server.
   *
   * @param event - Event containing the generated query string and template
   * @returns Promise that resolves when query execution completes
   */
  async handleTemplateExecution(event: { query: string; template: SmartQueryTemplate }) {
    this.currentQuery.set(event.query);
    this.showConfigDialog.set(false);

    this.logger.debug('Executing template:', event.template.name);
    await this.executeQuery(event.query);
  }

  /**
   * Closes the template configuration dialog
   * Cancels template execution and hides the parameter configuration dialog
   */
  closeConfigDialog() {
    this.showConfigDialog.set(false);
  }

  /**
   * Executes a FHIR query against the configured server
   *
   * Sends the query to the FHIR server via FhirService and updates
   * the result signal with the response. Sets loading state during
   * execution and error state on failure.
   *
   * @param query - FHIR query string to execute
   * @returns Promise that resolves when query completes
   */
  async executeQuery(query: string) {
    this.loading.set(true);
    this.error.set(null);

    try {
      this.fhirService.executeQuery(query).subscribe({
        next: (data) => {
          this.result.set(data);
          this.predefinedStateService.setResult(data, query);
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
   * Navigates to a pagination page by executing the provided URL
   *
   * @param url - Full URL of the page to navigate to
   */
  async navigateToPage(url: string) {
    this.loading.set(true);
    this.error.set(null);
    this.currentQuery.set(url);

    try {
      this.fhirService.executeQuery(url).subscribe({
        next: (data) => {
          this.result.set(data);
          this.predefinedStateService.setResult(data, url);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to navigate to page');
          this.logger.error('Page navigation failed:', err);
          this.loading.set(false);
        }
      });
    } catch (err: any) {
      this.error.set(err.message || 'Failed to navigate to page');
      this.logger.error('Page navigation failed:', err);
      this.loading.set(false);
    }
  }

  /**
   * Opens the template editor dialog for creating a new template
   * Resets the editing template and displays the editor dialog
   */
  openNewTemplate() {
    this.editingTemplate.set(null);
    this.showEditorDialog.set(true);
  }

  /**
   * Opens the template editor dialog for editing an existing template
   *
   * For system templates (read-only), prompts user to create a custom copy.
   * For custom templates, opens the editor directly.
   *
   * @param template - The template to edit
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
   * Deletes a template after user confirmation
   *
   * System templates cannot be deleted and show an informational message.
   * Custom templates show a confirmation dialog before deletion.
   * Clears selection if the deleted template is currently selected.
   *
   * @param template - The template to delete
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
   * Handles confirmation action in confirmation dialog
   * Executes the onConfirm callback configured in confirmDialogConfig
   */
  handleConfirmDialogConfirm() {
    this.confirmDialogConfig().onConfirm();
  }

  /**
   * Handles cancellation in confirmation dialog
   * Closes the confirmation dialog without executing the action
   */
  handleConfirmDialogCancel() {
    this.showConfirmDialog.set(false);
  }

  /**
   * Saves a template to localStorage via TemplateService
   *
   * Persists the template, refreshes the template list to show changes,
   * and closes the editor dialog.
   *
   * @param template - The template to save
   */
  saveTemplate(template: SmartQueryTemplate) {
    this.templateService.saveTemplate(template);
    this.logger.info('Template saved:', template.id);
    this.refreshKey.set(this.refreshKey() + 1);
    this.showEditorDialog.set(false);
  }

  /**
   * Exports a template to a JSON file via Electron file API
   *
   * Prompts user to select save location and writes template to file.
   * Sets error message if export fails.
   *
   * @param template - The template to export
   * @returns Promise that resolves when export completes
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
   * Imports a template from a JSON file via Electron file API
   *
   * Prompts user to select a template file, validates the content,
   * and adds it to the template list. Refreshes the display on success.
   *
   * @returns Promise that resolves when import completes
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
   * Copies the current query string to clipboard
   * Uses the Clipboard API to copy the generated query text
   */
  copyQuery() {
    navigator.clipboard.writeText(this.currentQuery());
    this.logger.info('Query copied to clipboard');
  }

  /**
   * Initiates panel resize operation
   *
   * Records starting position and width for drag calculation.
   * Sets appropriate cursor and disables text selection during resize.
   *
   * @param event - Mouse down event on resize divider
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
   * Handles mouse movement during panel resize
   *
   * Calculates new panel width as percentage of container width.
   * Constrains width between 20% and 80% to prevent unusable layouts.
   * Only processes movement when resize is active.
   *
   * @param event - Mouse move event during drag
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
   * Stops panel resize operation on mouse up
   * Resets resize state and restores normal cursor and text selection
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
   * Handles global keyboard shortcuts for the component
   *
   * Supported shortcuts:
   * - Ctrl/Cmd + Enter: Execute current query (if not loading)
   * - Ctrl/Cmd + N: Create new template (if no dialogs open)
   * - Ctrl/Cmd + O: Import template (if no dialogs open)
   * - Escape: Close open dialogs (in order: confirm → config → editor)
   *
   * @param event - Keyboard event from document
   */
  @HostListener('document:keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      if (this.currentQuery() && !this.loading()) {
        event.preventDefault();
        this.executeQuery(this.currentQuery());
      }
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
      if (!this.showConfigDialog() && !this.showEditorDialog() && !this.showConfirmDialog()) {
        event.preventDefault();
        this.openNewTemplate();
      }
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'o') {
      if (!this.showConfigDialog() && !this.showEditorDialog() && !this.showConfirmDialog()) {
        event.preventDefault();
        this.importTemplate();
      }
    }

    if (event.key === 'Escape') {
      if (this.showConfirmDialog()) {
        this.handleConfirmDialogCancel();
      } else if (this.showConfigDialog()) {
        this.closeConfigDialog();
      } else if (this.showEditorDialog()) {
        this.showEditorDialog.set(false);
      }
    }
  }

  /**
   * Expands JSON viewer by one level
   *
   * Decreases the collapse level by 1, or sets to false (fully expanded)
   * if already at level 1. Has no effect if already fully expanded.
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
   * Collapses JSON viewer by one level
   *
   * Increases the collapse level by 1, or sets to 1 if currently fully expanded.
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

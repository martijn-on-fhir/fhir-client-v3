import { Component, OnInit, OnDestroy, signal, computed, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TemplateService } from '../../core/services/template.service';
import { FhirService } from '../../core/services/fhir.service';
import { LoggerService } from '../../core/services/logger.service';
import { SmartQueryTemplate, TemplateCategory, CATEGORIES, getCategoryInfo } from '../../core/models/smart-template.model';

/**
 * Predefined Tab Component
 *
 * Manages smart query templates - parameterized, reusable FHIR queries.
 * Features split-panel layout with template browser on left and results on right.
 */
@Component({
  selector: 'app-predefined',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './predefined.component.html',
  styleUrl: './predefined.component.scss'
})
export class PredefinedComponent implements OnInit, OnDestroy {
  private templateService = inject(TemplateService);
  private fhirService = inject(FhirService);
  private loggerService = inject(LoggerService);
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

  // Grouped templates by category
  groupedTemplates = computed(() => {
    const templates = this.filteredTemplates();
    const groups = new Map<TemplateCategory, SmartQueryTemplate[]>();

    templates.forEach(template => {
      const existing = groups.get(template.category) || [];
      existing.push(template);
      groups.set(template.category, existing);
    });

    return groups;
  });

  // Config dialog state
  showConfigDialog = signal(false);
  parameterValues = signal<{ [key: string]: string }>({});

  // Editor dialog state
  showEditorDialog = signal(false);
  editingTemplate = signal<SmartQueryTemplate | null>(null);

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

  ngOnInit() {
    this.logger.info('Predefined tab initialized');
  }

  ngOnDestroy() {
    this.stopResizing();
  }

  /**
   * Select a template
   */
  selectTemplate(template: SmartQueryTemplate) {
    this.selectedTemplate.set(template);

    // Initialize parameter values with defaults
    const values: { [key: string]: string } = {};
    template.parameters.forEach(param => {
      values[param.name] = param.default || '';
    });
    this.parameterValues.set(values);

    this.showConfigDialog.set(true);
  }

  /**
   * Execute template with current parameters
   */
  async executeTemplate() {
    const template = this.selectedTemplate();
    if (!template) return;

    const query = this.templateService.renderTemplate(template, this.parameterValues());
    this.currentQuery.set(query);
    this.showConfigDialog.set(false);

    // Increment usage count
    this.templateService.incrementUsageCount(template.id);

    await this.executeQuery(query);
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
          this.logger.info('Query executed successfully');
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
      alert('System templates cannot be edited. Create a custom copy instead.');
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
      alert('Cannot delete system templates.');
      return;
    }

    if (!confirm(`Are you sure you want to delete "${template.name}"?`)) {
      return;
    }

    if (this.templateService.deleteTemplate(template.id)) {
      this.logger.info('Template deleted:', template.id);
      this.refreshKey.set(this.refreshKey() + 1);

      if (this.selectedTemplate()?.id === template.id) {
        this.selectedTemplate.set(null);
      }
    }
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
    if (!this.isResizing()) return;

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
}

import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SmartQueryTemplate, TemplateCategory, TemplateParameter } from '../../../core/models/smart-template.model';
import { LoggerService } from '../../../core/services/logger.service';
import { TemplateService } from '../../../core/services/template.service';
import { TemplateValidationError, extractParametersFromQuery, validateTemplate } from '../../../core/utils/template-validator';
import { MonacoEditorComponent } from '../../../shared/components/monaco-editor/monaco-editor.component';
import { ParameterEditorComponent } from './parameter-editor.component';

/**
 * Template Editor Dialog
 *
 * Full-screen modal for creating/editing smart query templates.
 * Three-panel layout: metadata (left), query editor (middle), parameters (right).
 */
@Component({
  selector: 'app-template-editor-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MonacoEditorComponent, ParameterEditorComponent],
  templateUrl: './template-editor-dialog.component.html',
  styleUrl: './template-editor-dialog.component.scss'
})
export class TemplateEditorDialogComponent {
  @Input() isOpen = false;
  @Input() template: SmartQueryTemplate | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<SmartQueryTemplate>();

  private templateService: TemplateService;
  private loggerService: LoggerService;
  private get logger() {
    return this.loggerService.component('TemplateEditorDialog');
  }

  // Panel widths (percentages)
  leftWidth = signal(25);
  middleWidth = signal(45);
  rightWidth = signal(30);
  activeResizer = signal<number | null>(null);

  // Template metadata
  name = signal('');
  description = signal('');
  category = signal<TemplateCategory>('custom');
  tags = signal('');
  author = signal('User');

  // Query template
  queryTemplate = signal('');

  // Parameters
  parameters = signal<TemplateParameter[]>([]);
  editingParameterIndex = signal<number | null>(null);
  isAddingParameter = signal(false);

  // Validation
  validationErrors = signal<TemplateValidationError[]>([]);
  showValidation = signal(false);

  // Save state
  isSaving = signal(false);

  // Categories
  categories = [
    { value: 'patient-care', label: 'Patient Care' },
    { value: 'testing', label: 'Testing & Development' },
    { value: 'administrative', label: 'Administrative' },
    { value: 'security', label: 'Security & Audit' },
    { value: 'analytics', label: 'Analytics' },
    { value: 'custom', label: 'Custom' }
  ];

  // Computed: has errors
  hasErrors = computed(() =>
    this.validationErrors().some(e => e.type === 'error')
  );

  constructor(templateService: TemplateService, loggerService: LoggerService) {
    this.templateService = templateService;
    this.loggerService = loggerService;

    // Load template data when input changes
    effect(() => {

      if (this.isOpen && this.template) {
        // Load existing template
        this.name.set(this.template.name);
        this.description.set(this.template.description || '');
        this.category.set(this.template.category);
        this.tags.set(this.template.tags?.join(', ') || '');
        this.author.set(this.template.author || 'User');
        this.queryTemplate.set(this.template.queryTemplate);
        this.parameters.set(this.template.parameters || []);
      } else if (this.isOpen) {
        // Reset for new template
        this.resetForm();
      }

      if (this.isOpen) {
        this.validationErrors.set([]);
        this.showValidation.set(false);
        this.editingParameterIndex.set(null);
        this.isAddingParameter.set(false);
      }
    });
  }

  /**
   * Reset form to defaults
   */
  resetForm() {
    this.name.set('');
    this.description.set('');
    this.category.set('custom');
    this.tags.set('');
    this.author.set('User');
    this.queryTemplate.set('/');
    this.parameters.set([]);
  }

  /**
   * Handle query template change
   */
  handleQueryChange(newQuery: string) {
    this.queryTemplate.set(newQuery);
  }

  /**
   * Auto-detect parameters from query
   */
  autoDetectParameters() {
    const detectedParams = extractParametersFromQuery(this.queryTemplate());
    const existingParamNames = new Set(this.parameters().map(p => p.name));

    // Add new parameters that don't exist yet
    const newParams = Array.from(detectedParams)
      .filter(name => !existingParamNames.has(name))
      .map(name => ({
        name,
        label: this.formatLabel(name),
        type: 'string' as const,
        required: false
      }));

    if (newParams.length > 0) {
      this.parameters.update(current => [...current, ...newParams]);
      this.logger.info(`Auto-detected ${newParams.length} new parameters`);
    } else {
      this.logger.info('No new parameters detected');
    }
  }

  /**
   * Format parameter name to label
   */
  private formatLabel(name: string): string {
    return name
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Start adding a new parameter
   */
  startAddParameter() {
    this.isAddingParameter.set(true);
    this.editingParameterIndex.set(null);
  }

  /**
   * Start editing a parameter
   */
  startEditParameter(index: number) {
    this.editingParameterIndex.set(index);
    this.isAddingParameter.set(false);
  }

  /**
   * Handle parameter save
   */
  handleParameterSave(param: TemplateParameter) {
    const editIndex = this.editingParameterIndex();

    if (editIndex !== null) {
      // Update existing parameter
      this.parameters.update(current => {
        const updated = [...current];
        updated[editIndex] = param;

        return updated;
      });
      this.logger.info('Parameter updated:', param.name);
    } else {
      // Add new parameter
      this.parameters.update(current => [...current, param]);
      this.logger.info('Parameter added:', param.name);
    }

    this.isAddingParameter.set(false);
    this.editingParameterIndex.set(null);
  }

  /**
   * Handle parameter cancel
   */
  handleParameterCancel() {
    this.isAddingParameter.set(false);
    this.editingParameterIndex.set(null);
  }

  /**
   * Delete a parameter
   */
  deleteParameter(index: number) {
    const param = this.parameters()[index];

    if (!confirm(`Delete parameter "${param.label}"?`)) {
      return;
    }

    this.parameters.update(current => current.filter((_, i) => i !== index));
    this.logger.info('Parameter deleted:', param.name);
  }

  /**
   * Validate template
   */
  handleValidate() {
    const currentTemplate: Partial<SmartQueryTemplate> = {
      name: this.name(),
      description: this.description(),
      category: this.category(),
      queryTemplate: this.queryTemplate(),
      parameters: this.parameters()
    };

    const errors = validateTemplate(currentTemplate);
    this.validationErrors.set(errors);
    this.showValidation.set(true);

    if (errors.length === 0) {
      this.logger.info('Template validation passed');
    } else {
      this.logger.warn('Template validation found issues:', errors);
    }
  }

  /**
   * Handle save template
   */
  async handleSave() {
    // Validate first
    const currentTemplate: Partial<SmartQueryTemplate> = {
      name: this.name(),
      description: this.description(),
      category: this.category(),
      queryTemplate: this.queryTemplate(),
      parameters: this.parameters()
    };

    const errors = validateTemplate(currentTemplate);

    // Only check for errors (not warnings)
    if (errors.some(e => e.type === 'error')) {
      this.validationErrors.set(errors);
      this.showValidation.set(true);
      alert('Please fix validation errors before saving');

      return;
    }

    this.isSaving.set(true);

    try {
      let templateToSave: SmartQueryTemplate;

      if (this.template?.isSystem) {
        // Editing a system template - create custom copy
        templateToSave = {
          id: this.templateService.generateId(),
          name: this.name().trim(),
          description: this.description().trim(),
          category: this.category(),
          tags: this.tags()
            .split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0),
          author: this.author().trim(),
          version: '1.0',
          parameters: this.parameters(),
          queryTemplate: this.queryTemplate(),
          createdAt: new Date().toISOString(),
          isSystem: false
        };

        this.logger.info('Created custom copy of system template');
      } else if (this.template) {
        // Editing existing custom template
        templateToSave = {
          ...this.template,
          name: this.name().trim(),
          description: this.description().trim(),
          category: this.category(),
          tags: this.tags()
            .split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0),
          author: this.author().trim(),
          parameters: this.parameters(),
          queryTemplate: this.queryTemplate(),
          updatedAt: new Date().toISOString()
        };

        this.logger.info('Updated existing template');
      } else {
        // Creating new template
        templateToSave = {
          id: this.templateService.generateId(),
          name: this.name().trim(),
          description: this.description().trim(),
          category: this.category(),
          tags: this.tags()
            .split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0),
          author: this.author().trim(),
          version: '1.0',
          parameters: this.parameters(),
          queryTemplate: this.queryTemplate(),
          createdAt: new Date().toISOString(),
          isSystem: false
        };

        this.logger.info('Created new template');
      }

      // Save via service
      this.templateService.saveTemplate(templateToSave);

      this.save.emit(templateToSave);
      this.close.emit();
    } catch (error) {
      this.logger.error('Failed to save template:', error);
      alert('Failed to save template');
    } finally {
      this.isSaving.set(false);
    }
  }

  /**
   * Handle close
   */
  handleClose() {

    if (this.hasUnsavedChanges()) {

      if (!confirm('You have unsaved changes. Are you sure you want to close?')) {
        return;
      }
    }

    this.close.emit();
  }

  /**
   * Check for unsaved changes
   */
  private hasUnsavedChanges(): boolean {
    return this.name().trim().length > 0 || this.queryTemplate().trim().length > 1;
  }

  /**
   * Start resizing panels
   */
  startResizing(event: MouseEvent, resizerIndex: number) {
    event.preventDefault();
    this.activeResizer.set(resizerIndex);
  }

  /**
   * Handle mouse move during resize
   */
  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    const activeResizer = this.activeResizer();

    if (activeResizer === null) {
      return;
    }

    const container = document.getElementById('template-editor-container');

    if (!container) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const mouseX = event.clientX - containerRect.left;
    const totalWidth = containerRect.width;
    const percentage = (mouseX / totalWidth) * 100;

    if (activeResizer === 1) {
      // Resize left panel
      if (percentage >= 15 && percentage <= 40) {
        const diff = percentage - this.leftWidth();
        this.leftWidth.set(percentage);
        this.middleWidth.update(w => Math.max(30, w - diff));
      }
    } else if (activeResizer === 2) {
      // Resize middle panel
      if (percentage >= this.leftWidth() + 20 && percentage <= 85) {
        this.middleWidth.set(percentage - this.leftWidth());
        this.rightWidth.set(100 - percentage);
      }
    }
  }

  /**
   * Stop resizing
   */
  @HostListener('document:mouseup')
  onMouseUp() {
    this.activeResizer.set(null);
  }
}

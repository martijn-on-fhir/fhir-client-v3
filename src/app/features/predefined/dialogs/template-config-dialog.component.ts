import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SmartQueryTemplate, TemplateParameter } from '../../../core/models/smart-template.model';
import { LoggerService } from '../../../core/services/logger.service';
import { TemplateService } from '../../../core/services/template.service';
import { ReferenceSelectorDialogComponent } from '../../../shared/components/reference-selector-dialog/reference-selector-dialog.component';

/**
 * Template Configuration Dialog
 *
 * Modal dialog for configuring template parameters before execution.
 * Provides type-appropriate input widgets for each parameter.
 */
@Component({
  selector: 'app-template-config-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ReferenceSelectorDialogComponent],
  templateUrl: './template-config-dialog.component.html',
  styleUrl: './template-config-dialog.component.scss'
})
export class TemplateConfigDialogComponent {
  @Input() isOpen = false;
  @Input() template: SmartQueryTemplate | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() execute = new EventEmitter<{ query: string; template: SmartQueryTemplate }>();

  private templateService: TemplateService;
  private loggerService: LoggerService;
  private get logger() {
    return this.loggerService.component('TemplateConfigDialog');
  }

  // Parameter values
  parameterValues = signal<Record<string, string>>({});
  validationErrors = signal<string[]>([]);

  // Reference selector state
  referenceSelectorOpen = signal(false);
  currentReferenceParam = signal('');
  referenceTypes = signal<string[]>([]);

  // Computed preview query
  previewQuery = computed(() => {
    if (!this.template) {
      return '';
    }

    try {
      return this.templateService.renderTemplate(this.template, this.parameterValues());
    } catch {
      return '';
    }
  });

  constructor(templateService: TemplateService, loggerService: LoggerService) {
    this.templateService = templateService;
    this.loggerService = loggerService;

    // Reset parameter values when template changes
    effect(() => {
      if (this.template) {
        const defaultValues: Record<string, string> = {};

        this.template.parameters.forEach(param => {
          defaultValues[param.name] = param.default || '';
        });

        this.parameterValues.set(defaultValues);
        this.validationErrors.set([]);
      }
    });
  }

  /**
   * Handle parameter value change
   */
  updateParameterValue(paramName: string, value: string) {
    this.parameterValues.update(values => ({
      ...values,
      [paramName]: value
    }));
  }

  /**
   * Handle execute button click
   */
  handleExecute() {

    if (!this.template) {
      return;
    }

    // Validate required fields
    const errors: string[] = [];

    this.template.parameters.forEach(param => {

      if (param.required && !this.parameterValues()[param.name]?.trim()) {
        errors.push(`${param.label} is required`);
      }

      // Validate pattern if provided
      if (param.pattern && this.parameterValues()[param.name]) {
        const regex = new RegExp(param.pattern);

        if (!regex.test(this.parameterValues()[param.name])) {
          errors.push(`${param.label} does not match required pattern`);
        }
      }

      // Validate number min/max
      if (param.type === 'number' && this.parameterValues()[param.name]) {
        const numValue = parseFloat(this.parameterValues()[param.name]);

        if (param.min !== undefined && numValue < param.min) {
          errors.push(`${param.label} must be at least ${param.min}`);
        }

        if (param.max !== undefined && numValue > param.max) {
          errors.push(`${param.label} must be at most ${param.max}`);
        }
      }
    });

    if (errors.length > 0) {
      this.validationErrors.set(errors);

      return;
    }

    try {
      const query = this.templateService.renderTemplate(this.template, this.parameterValues());

      // Increment usage count
      this.templateService.incrementUsageCount(this.template.id);

      this.logger.info('Template executed:', this.template.name);
      this.execute.emit({ query, template: this.template });
      this.handleClose();
    } catch (error) {

      if (error instanceof Error) {
        this.validationErrors.set([error.message]);
      } else {
        this.validationErrors.set(['Failed to render template']);
      }

      this.logger.error('Template execution failed:', error);
    }
  }

  /**
   * Handle close button click
   */
  handleClose() {
    this.close.emit();
  }

  /**
   * Open reference selector for a parameter
   */
  openReferenceSelector(param: TemplateParameter) {
    this.currentReferenceParam.set(param.name);
    this.referenceTypes.set(param.referenceTypes || []);
    this.referenceSelectorOpen.set(true);
  }

  /**
   * Handle reference selection
   */
  handleReferenceSelect(reference: string) {
    this.updateParameterValue(this.currentReferenceParam(), reference);
    this.referenceSelectorOpen.set(false);
    this.currentReferenceParam.set('');
  }

  /**
   * Close reference selector
   */
  closeReferenceSelector() {
    this.referenceSelectorOpen.set(false);
    this.currentReferenceParam.set('');
  }
}

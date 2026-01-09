import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TemplateParameter, ParameterType } from '../../../core/models/smart-template.model';
import { validateParameterName } from '../../../core/utils/template-validator';

/**
 * Parameter Editor Component
 *
 * Form for adding/editing template parameters with type-specific fields.
 */
@Component({
  selector: 'app-parameter-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './parameter-editor.component.html',
  styleUrl: './parameter-editor.component.scss'
})
export class ParameterEditorComponent implements OnChanges {
  @Input() parameter: TemplateParameter | null = null;
  @Input() existingParameters: TemplateParameter[] = [];
  @Input() editIndex?: number;
  @Output() save = new EventEmitter<TemplateParameter>();
  @Output() cancel = new EventEmitter<void>();

  // Form fields
  name = signal('');
  label = signal('');
  type = signal<ParameterType>('string');
  hint = signal('');
  required = signal(false);
  defaultValue = signal('');

  // Type-specific fields
  min = signal('');
  max = signal('');
  pattern = signal('');
  choices = signal<{ label: string; value: string }[]>([]);
  referenceTypes = signal<string[]>([]);

  // Validation
  nameError = signal<string | null>(null);
  validationError = signal<string | null>(null);

  // Parameter types
  parameterTypes = [
    { value: 'string', label: 'String' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'choice', label: 'Choice (Dropdown)' },
    { value: 'reference', label: 'Reference' },
    { value: 'token', label: 'Token' },
    { value: 'summary', label: 'Summary (_summary)' },
    { value: 'sort', label: 'Sort (_sort)' }
  ];

  // Summary options for _summary parameter
  summaryOptions = [
    { label: 'True - Return limited subset', value: 'true' },
    { label: 'Text - Return only text and id', value: 'text' },
    { label: 'Data - Remove narrative elements', value: 'data' },
    { label: 'Count - Return only count', value: 'count' },
    { label: 'False - Return all elements', value: 'false' }
  ];

  // Sort options for _sort parameter
  sortOptions = [
    { label: 'Name (ascending)', value: 'name' },
    { label: 'Name (descending)', value: '-name' },
    { label: 'Date (ascending)', value: 'date' },
    { label: 'Date (descending)', value: '-date' },
    { label: 'Last Updated (ascending)', value: '_lastUpdated' },
    { label: 'Last Updated (descending)', value: '-_lastUpdated' },
    { label: 'Family Name (ascending)', value: 'family' },
    { label: 'Family Name (descending)', value: '-family' },
    { label: 'Given Name (ascending)', value: 'given' },
    { label: 'Given Name (descending)', value: '-given' },
    { label: 'Birthdate (ascending)', value: 'birthdate' },
    { label: 'Birthdate (descending)', value: '-birthdate' }
  ];

  // Common resource types for reference parameters
  commonResourceTypes = [
    'Patient', 'Practitioner', 'Organization', 'Location', 'Observation',
    'Condition', 'Procedure', 'MedicationRequest', 'Encounter'
  ];

  /**
   * Handle input changes
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['parameter']) {
      const param = this.parameter;

      if (param) {
        this.name.set(param.name);
        this.label.set(param.label);
        this.type.set(param.type);
        this.hint.set(param.hint || '');
        this.required.set(param.required || false);
        this.defaultValue.set(param.default || '');
        this.min.set(param.min?.toString() || '');
        this.max.set(param.max?.toString() || '');
        this.pattern.set(param.pattern || '');
        this.choices.set(param.choices || []);
        this.referenceTypes.set(param.referenceTypes || []);
      } else {
        // Reset for new parameter
        this.resetForm();
      }

      this.nameError.set(null);
      this.validationError.set(null);
    }
  }

  /**
   * Reset form to defaults
   */
  resetForm() {
    this.name.set('');
    this.label.set('');
    this.type.set('string');
    this.hint.set('');
    this.required.set(false);
    this.defaultValue.set('');
    this.min.set('');
    this.max.set('');
    this.pattern.set('');
    this.choices.set([]);
    this.referenceTypes.set([]);
  }

  /**
   * Validate parameter name on change
   */
  handleNameChange(newName: string) {
    this.name.set(newName);
    const error = validateParameterName(newName, this.existingParameters, this.editIndex);
    this.nameError.set(error);
  }

  /**
   * Handle save
   */
  handleSave() {
    // Validate
    const nameValidationError = validateParameterName(this.name(), this.existingParameters, this.editIndex);

    if (nameValidationError) {
      this.nameError.set(nameValidationError);

      return;
    }

    if (!this.label().trim()) {
      this.validationError.set('Label is required');

      return;
    }

    // Build parameter object
    const newParameter: TemplateParameter = {
      name: this.name().trim(),
      label: this.label().trim(),
      type: this.type(),
      hint: this.hint().trim() || undefined,
      required: this.required(),
      default: this.defaultValue().trim() || undefined
    };

    // Add type-specific fields
    if (this.type() === 'number') {

      if (this.min()) {
        newParameter.min = parseFloat(this.min());
      }

      if (this.max()) {
        newParameter.max = parseFloat(this.max());
      }
    }

    if (this.type() === 'string' && this.pattern()) {
      newParameter.pattern = this.pattern();
    }

    if (this.type() === 'choice') {

      if (this.choices().length === 0) {
        this.validationError.set('Choice type requires at least one option');

        return;
      }

      newParameter.choices = this.choices();
    }

    if (this.type() === 'summary') {
      newParameter.choices = this.summaryOptions;
    }

    if (this.type() === 'sort') {
      newParameter.choices = this.sortOptions;
    }

    if (this.type() === 'reference' && this.referenceTypes().length > 0) {
      newParameter.referenceTypes = this.referenceTypes();
    }

    this.save.emit(newParameter);
    this.resetForm();
  }

  /**
   * Handle cancel
   */
  handleCancel() {
    this.cancel.emit();
    this.resetForm();
  }

  /**
   * Add choice option
   */
  addChoice() {
    this.choices.update(current => [...current, { label: '', value: '' }]);
  }

  /**
   * Update choice option
   */
  updateChoice(index: number, field: 'label' | 'value', value: string) {
    this.choices.update(current => {
      const updated = [...current];
      updated[index][field] = value;

      return updated;
    });
  }

  /**
   * Remove choice option
   */
  removeChoice(index: number) {
    this.choices.update(current => current.filter((_, i) => i !== index));
  }

  /**
   * Toggle reference type
   */
  toggleReferenceType(resourceType: string) {
    this.referenceTypes.update(current => {

      if (current.includes(resourceType)) {
        return current.filter(t => t !== resourceType);
      } else {
        return [...current, resourceType];
      }
    });
  }
}

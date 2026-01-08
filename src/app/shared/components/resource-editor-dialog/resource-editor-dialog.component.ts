import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, signal, computed, HostListener, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MonacoEditorComponent, AutocompleteConfig } from '../monaco-editor/monaco-editor.component';
import { ReferenceSelectorDialogComponent } from '../reference-selector-dialog/reference-selector-dialog.component';
import { FhirService } from '../../../core/services/fhir.service';
import { LoggerService } from '../../../core/services/logger.service';
import { FHIR_TEMPLATES } from '../../../core/utils/fhir-templates';

/**
 * Resource Editor Dialog Component
 *
 * Full-screen modal for creating/editing FHIR resources based on StructureDefinition.
 * Features:
 * - 3-panel resizable layout (properties, editor, validation)
 * - Context-aware autocomplete from StructureDefinition elements
 * - Template system from FHIR type definitions
 * - Reference Selector for FHIR references
 * - FHIR $validate operation
 * - CREATE (POST) and UPDATE (PUT) operations
 * - Keyboard shortcuts (Alt+Enter, Ctrl+Alt+L, Ctrl+↑/↓)
 */
@Component({
  selector: 'app-resource-editor-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MonacoEditorComponent, ReferenceSelectorDialogComponent],
  templateUrl: './resource-editor-dialog.component.html',
  styleUrl: './resource-editor-dialog.component.scss'
})
export class ResourceEditorDialogComponent implements OnInit, OnDestroy {
  @ViewChild(ReferenceSelectorDialogComponent) referenceSelectorDialog!: ReferenceSelectorDialogComponent;

  private fhirService = inject(FhirService);
  private loggerService = inject(LoggerService);
  private get logger() {
    return this.loggerService.component('ResourceEditorDialog');
  }

  // Dialog state
  show = signal(false);
  structureDefinition = signal<any>(null);
  existingResource = signal<any>(null); // For editing existing resources

  // Outputs
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<any>();

  // Panel widths (percentages)
  leftWidth = signal(25);  // Properties panel
  centerWidth = signal(50); // Editor panel
  rightWidth = computed(() => 100 - this.leftWidth() - this.centerWidth()); // Validation panel

  // Resizing state
  isResizingLeft = signal(false);
  isResizingRight = signal(false);
  private startX = 0;
  private startLeftWidth = 0;
  private startCenterWidth = 0;

  // Editor content
  editorContent = signal('');

  // Properties from StructureDefinition
  requiredProperties = signal<ElementProperty[]>([]);
  optionalProperties = signal<ElementProperty[]>([]);

  // Property accordion state
  requiredExpanded = signal(true);
  optionalExpanded = signal(false);

  // Validation state
  validationResult = signal<any>(null);
  validationLoading = signal(false);
  validationError = signal<string | null>(null);

  // Save state
  saveLoading = signal(false);
  saveError = signal<string | null>(null);

  // Autocomplete state
  autocompleteEnabled = signal(true);

  // Keyboard shortcuts help
  showKeyboardShortcuts = signal(false);

  // Resource type
  resourceType = computed(() => {
    const sd = this.structureDefinition();
    if (!sd) return '';
    return sd.type || sd.id || '';
  });

  // Is editing (vs creating)
  isEditing = computed(() => {
    try {
      const resource = JSON.parse(this.editorContent());
      return !!resource.id;
    } catch {
      return false;
    }
  });

  // Autocomplete configuration
  autocompleteConfig = computed<AutocompleteConfig | undefined>(() => {
    const sd = this.structureDefinition();
    if (!sd || !sd.snapshot?.element) {
      return undefined;
    }

    // Extract property names from first-level elements
    const resourceType = this.resourceType();
    const firstLevelElements = sd.snapshot.element.filter((el: any) => {
      const path = el.path || '';
      const parts = path.split('.');
      return parts.length === 2 && parts[0] === resourceType;
    });

    const propertySuggestions = firstLevelElements.map((el: any) => {
      const path = el.path || '';
      const parts = path.split('.');
      return parts[1];
    });

    return {
      propertySuggestions,
      structureElements: sd.snapshot.element,
      templates: FHIR_TEMPLATES,
      contextPrefix: resourceType,
    };
  });

  ngOnInit() {
    this.logger.info('ResourceEditorDialog initialized');
    if (this.show() && this.structureDefinition()) {
      this.initializeEditor();
    }
  }

  ngOnDestroy() {
    this.stopResizing();
  }

  /**
   * Open the dialog with a StructureDefinition (for creating new resource)
   */
  open(structureDefinition: any, existingResource?: any) {
    this.structureDefinition.set(structureDefinition);
    this.existingResource.set(existingResource || null);
    this.show.set(true);
    this.initializeEditor();
  }

  /**
   * Reset dialog state
   */
  private resetDialog() {
    this.structureDefinition.set(null);
    this.existingResource.set(null);
    this.editorContent.set('');
    this.requiredProperties.set([]);
    this.optionalProperties.set([]);
    this.validationResult.set(null);
    this.validationError.set(null);
    this.saveError.set(null);
    this.leftWidth.set(25);
    this.centerWidth.set(50);
  }

  /**
   * Initialize editor with blueprint or existing resource
   */
  private initializeEditor() {
    const existing = this.existingResource();
    const sd = this.structureDefinition();

    this.logger.info('Initializing editor', {
      hasExisting: !!existing,
      hasSD: !!sd,
      sdType: sd?.type,
      sdId: sd?.id,
      sdUrl: sd?.url
    });

    if (existing) {
      // Editing existing resource
      this.editorContent.set(JSON.stringify(existing, null, 2));
      this.logger.info('Loaded existing resource');
    } else if (sd) {
      // Creating new resource - generate blueprint
      const blueprint = this.generateBlueprint();
      this.editorContent.set(JSON.stringify(blueprint, null, 2));
      this.logger.info('Generated blueprint', blueprint);
    }

    // Extract properties from StructureDefinition
    if (sd) {
      this.logger.info('Calling extractProperties...');
      this.extractProperties();
    } else {
      this.logger.warn('No StructureDefinition available, skipping property extraction');
    }
  }

  /**
   * Generate blueprint resource with resourceType and meta.profile
   */
  private generateBlueprint(): any {
    const resourceType = this.resourceType();
    const sd = this.structureDefinition();
    const profileUrl = sd?.url;

    return {
      resourceType,
      meta: {
        profile: [profileUrl]
      }
    };
  }

  /**
   * Extract required and optional properties from StructureDefinition
   */
  private extractProperties() {
    const sd = this.structureDefinition();

    this.logger.info('Extracting properties from StructureDefinition', {
      hasSD: !!sd,
      hasSnapshot: !!sd?.snapshot,
      hasElements: !!sd?.snapshot?.element,
      elementCount: sd?.snapshot?.element?.length,
      resourceType: this.resourceType(),
      sdKeys: sd ? Object.keys(sd) : [],
      snapshotKeys: sd?.snapshot ? Object.keys(sd.snapshot) : []
    });

    if (!sd?.snapshot?.element) {
      this.logger.warn('No snapshot elements found in StructureDefinition', {
        structureDefinition: sd,
        hasSnapshot: !!sd?.snapshot,
        hasDifferential: !!sd?.differential,
        snapshot: sd?.snapshot
      });
      return;
    }

    const elements = sd.snapshot.element;
    const required: ElementProperty[] = [];
    const optional: ElementProperty[] = [];
    const resourceType = this.resourceType();

    this.logger.info('Processing elements', {
      totalElements: elements.length,
      resourceType
    });

    elements.forEach((element: any) => {
      // Skip root element
      if (element.path === resourceType) {
        this.logger.debug('Skipping root element', element.path);
        return;
      }

      // Only include first-level properties (e.g., Patient.name, not Patient.name.given)
      const path = element.path;
      const parts = path.split('.');

      if (parts.length !== 2) {
        this.logger.debug('Skipping nested element', { path, parts: parts.length });
        return;
      }

      const propertyName = parts[1];
      const isRequired = element.min > 0;
      const isArray = element.max === '*';

      const property: ElementProperty = {
        name: propertyName,
        path: element.path,
        type: this.getElementType(element),
        required: isRequired,
        isArray,
        min: element.min,
        max: element.max,
        short: element.short,
        definition: element.definition,
        element
      };

      if (isRequired) {
        required.push(property);
        this.logger.debug('Added required property', propertyName);
      } else {
        optional.push(property);
        this.logger.debug('Added optional property', propertyName);
      }
    });

    this.logger.info('Property extraction complete', {
      required: required.length,
      optional: optional.length
    });

    this.requiredProperties.set(required);
    this.optionalProperties.set(optional);
  }

  /**
   * Get element type from StructureDefinition element
   */
  private getElementType(element: any): string {
    if (!element.type || element.type.length === 0) {
      return 'unknown';
    }

    if (element.type.length === 1) {
      return element.type[0].code;
    }

    // Multiple types - return comma-separated
    return element.type.map((t: any) => t.code).join(' | ');
  }

  /**
   * Add property to editor
   */
  addProperty(property: ElementProperty) {
    try {
      const resource = JSON.parse(this.editorContent());
      const defaultValue = this.getDefaultValueForType(property);

      // Add property to resource
      resource[property.name] = defaultValue;

      this.editorContent.set(JSON.stringify(resource, null, 2));
      this.logger.info('Property added:', property.name);
    } catch (err) {
      this.logger.error('Failed to add property:', err);
    }
  }

  /**
   * Get default value for element type
   */
  private getDefaultValueForType(property: ElementProperty): any {
    if (property.isArray) {
      return [];
    }

    switch (property.type) {
      case 'string':
      case 'code':
      case 'id':
      case 'markdown':
      case 'uri':
      case 'url':
      case 'canonical':
      case 'oid':
      case 'uuid':
        return '';

      case 'boolean':
        return false;

      case 'integer':
      case 'unsignedInt':
      case 'positiveInt':
        return 0;

      case 'decimal':
        return 0.0;

      case 'date':
        return new Date().toISOString().split('T')[0];

      case 'dateTime':
      case 'instant':
        return new Date().toISOString();

      case 'time':
        return '00:00:00';

      case 'base64Binary':
        return '';

      // Complex types
      case 'CodeableConcept':
        return { coding: [{ system: '', code: '', display: '' }] };

      case 'Coding':
        return { system: '', code: '', display: '' };

      case 'Identifier':
        return { system: '', value: '' };

      case 'Reference':
        return { reference: '', display: '' };

      case 'Period':
        return { start: '', end: '' };

      case 'Quantity':
        return { value: 0, unit: '', system: 'http://unitsofmeasure.org', code: '' };

      case 'Range':
        return { low: { value: 0 }, high: { value: 0 } };

      case 'Ratio':
        return { numerator: { value: 0 }, denominator: { value: 0 } };

      case 'HumanName':
        return { family: '', given: [''] };

      case 'Address':
        return { line: [''], city: '', postalCode: '', country: '' };

      case 'ContactPoint':
        return { system: 'phone', value: '' };

      case 'Attachment':
        return { contentType: '', data: '' };

      default:
        // For BackboneElement and unknown types, return empty object
        return {};
    }
  }

  /**
   * Validate resource using FHIR $validate operation
   */
  async validateResource() {
    this.validationLoading.set(true);
    this.validationError.set(null);
    this.validationResult.set(null);

    try {
      const resource = JSON.parse(this.editorContent());
      const resourceType = resource.resourceType;

      if (!resourceType) {
        throw new Error('Resource must have a resourceType');
      }

      // Call FHIR $validate operation
      this.fhirService.validateResource(resourceType, resource).subscribe({
        next: (operationOutcome) => {
          this.validationResult.set(operationOutcome);
          this.validationLoading.set(false);
          this.logger.info('Validation completed');
        },
        error: (err) => {
          this.validationError.set(err.message || 'Validation failed');
          this.validationLoading.set(false);
          this.logger.error('Validation failed:', err);
        }
      });
    } catch (err: any) {
      this.validationError.set(err.message || 'Invalid JSON');
      this.validationLoading.set(false);
      this.logger.error('Validation error:', err);
    }
  }

  /**
   * Save resource (CREATE or UPDATE)
   */
  async saveResource() {
    this.saveLoading.set(true);
    this.saveError.set(null);

    try {
      const resource = JSON.parse(this.editorContent());
      const resourceType = resource.resourceType;

      if (!resourceType) {
        throw new Error('Resource must have a resourceType');
      }

      if (this.isEditing()) {
        // UPDATE - PUT request
        this.fhirService.updateResource(resourceType, resource.id, resource).subscribe({
          next: (result) => {
            this.saveLoading.set(false);
            this.logger.info('Resource updated:', result);
            this.save.emit(result);
            this.closeDialog();
          },
          error: (err) => {
            this.saveError.set(err.message || 'Failed to update resource');
            this.saveLoading.set(false);
            this.logger.error('Update failed:', err);
          }
        });
      } else {
        // CREATE - POST request
        this.fhirService.createResource(resourceType, resource).subscribe({
          next: (result) => {
            this.saveLoading.set(false);
            this.logger.info('Resource created:', result);
            this.save.emit(result);
            this.closeDialog();
          },
          error: (err) => {
            this.saveError.set(err.message || 'Failed to create resource');
            this.saveLoading.set(false);
            this.logger.error('Create failed:', err);
          }
        });
      }
    } catch (err: any) {
      this.saveError.set(err.message || 'Invalid JSON');
      this.saveLoading.set(false);
      this.logger.error('Save error:', err);
    }
  }

  /**
   * Format JSON in editor
   */
  formatJson() {
    try {
      const resource = JSON.parse(this.editorContent());
      this.editorContent.set(JSON.stringify(resource, null, 2));
      this.logger.info('JSON formatted');
    } catch (err) {
      this.logger.error('Failed to format JSON:', err);
    }
  }

  /**
   * Close dialog
   */
  closeDialog() {
    this.show.set(false);
    this.resetDialog();
    this.close.emit();
  }

  /**
   * Start resizing left panel
   */
  startResizeLeft(event: MouseEvent) {
    event.preventDefault();
    this.isResizingLeft.set(true);
    this.startX = event.clientX;
    this.startLeftWidth = this.leftWidth();
    this.startCenterWidth = this.centerWidth();

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }

  /**
   * Start resizing right panel
   */
  startResizeRight(event: MouseEvent) {
    event.preventDefault();
    this.isResizingRight.set(true);
    this.startX = event.clientX;
    this.startLeftWidth = this.leftWidth();
    this.startCenterWidth = this.centerWidth();

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }

  /**
   * Handle mouse move during resize
   */
  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.isResizingLeft() && !this.isResizingRight()) return;

    const container = document.getElementById('resource-editor-container');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const deltaX = event.clientX - this.startX;
    const deltaPercent = (deltaX / containerRect.width) * 100;

    if (this.isResizingLeft()) {
      const newLeftWidth = this.startLeftWidth + deltaPercent;
      const newCenterWidth = this.startCenterWidth - deltaPercent;

      if (newLeftWidth >= 15 && newLeftWidth <= 40 && newCenterWidth >= 30) {
        this.leftWidth.set(newLeftWidth);
        this.centerWidth.set(newCenterWidth);
      }
    } else if (this.isResizingRight()) {
      const newCenterWidth = this.startCenterWidth + deltaPercent;
      const newRightWidth = 100 - this.leftWidth() - newCenterWidth;

      if (newCenterWidth >= 30 && newRightWidth >= 15 && newRightWidth <= 40) {
        this.centerWidth.set(newCenterWidth);
      }
    }
  }

  /**
   * Stop resizing
   */
  @HostListener('document:mouseup')
  stopResizing() {
    if (this.isResizingLeft() || this.isResizingRight()) {
      this.isResizingLeft.set(false);
      this.isResizingRight.set(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }
  }

  /**
   * Keyboard shortcuts
   */
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (!this.show()) return;

    // Ctrl+Alt+L - Format JSON
    if (event.ctrlKey && event.altKey && event.key === 'l') {
      event.preventDefault();
      this.formatJson();
    }

    // Escape - Close dialog
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeDialog();
    }
  }

  /**
   * Handle Alt+Enter keyboard shortcut from Monaco editor
   */
  handleAltEnter(event: { propertyName: string; lineNumber: number }) {
    const sd = this.structureDefinition();
    if (!sd || !sd.snapshot?.element) {
      this.logger.warn('No structure definition available');
      return;
    }

    const resourceType = this.resourceType();
    const propertyPath = `${resourceType}.${event.propertyName}`;

    // Find the matching element in structure definition
    const element = sd.snapshot.element.find((el: any) => el.path === propertyPath);

    if (!element) {
      this.logger.warn(`Property "${event.propertyName}" not found in structure definition`);
      return;
    }

    // Check if element is a Reference type
    const isReference = element.type?.some((t: any) => t.code === 'Reference');

    if (!isReference) {
      this.logger.info(`Property "${event.propertyName}" is not a Reference type`);
      return;
    }

    // Open reference selector dialog
    this.referenceSelectorDialog.open(event.propertyName);
  }

  /**
   * Handle reference selection from Reference Selector dialog
   */
  handleReferenceSelect(event: { reference: string; display: string }) {
    try {
      const currentContent = this.editorContent();
      const parsedJson = JSON.parse(currentContent);

      // Get property name from dialog
      const propertyName = this.referenceSelectorDialog.propertyName;

      // Create Reference object
      const referenceObject = {
        reference: event.reference,
        display: event.display,
      };

      // Check if current value is an array
      const currentValue = parsedJson[propertyName];

      if (Array.isArray(currentValue)) {
        // Push to existing array
        currentValue.push(referenceObject);
        this.logger.info('Reference pushed to array for property:', propertyName);
      } else {
        // Replace the property value
        parsedJson[propertyName] = referenceObject;
        this.logger.info('Reference inserted for property:', propertyName);
      }

      // Format and update editor
      const formatted = JSON.stringify(parsedJson, null, 2);
      this.editorContent.set(formatted);
    } catch (error) {
      this.logger.error('Failed to insert reference:', error);
    }
  }

  /**
   * Toggle keyboard shortcuts help modal
   */
  toggleKeyboardShortcuts() {
    this.showKeyboardShortcuts.set(!this.showKeyboardShortcuts());
  }

  /**
   * Get issues by severity from OperationOutcome
   */
  getIssuesBySeverity(severity: string): any[] {
    const result = this.validationResult();
    if (!result?.issue) return [];
    return result.issue.filter((issue: any) => issue.severity === severity);
  }
}

/**
 * Element property interface
 */
export interface ElementProperty {
  name: string;
  path: string;
  type: string;
  required: boolean;
  isArray: boolean;
  min: number;
  max: string;
  short?: string;
  definition?: string;
  element: any;
}

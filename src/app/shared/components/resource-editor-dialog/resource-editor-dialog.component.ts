import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, signal, computed, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MonacoEditorComponent } from '../monaco-editor/monaco-editor.component';
import { FhirService } from '../../../core/services/fhir.service';
import { LoggerService } from '../../../core/services/logger.service';

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
  imports: [CommonModule, FormsModule, MonacoEditorComponent],
  templateUrl: './resource-editor-dialog.component.html',
  styleUrl: './resource-editor-dialog.component.scss'
})
export class ResourceEditorDialogComponent implements OnInit, OnDestroy {
  private fhirService = inject(FhirService);
  private loggerService = inject(LoggerService);
  private get logger() {
    return this.loggerService.component('ResourceEditorDialog');
  }

  // Dialog state
  show = signal(false);
  structureDefinition: any = null;
  existingResource: any = null; // For editing existing resources

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

  // Resource type
  resourceType = computed(() => {
    if (!this.structureDefinition) return '';
    return this.structureDefinition.type || this.structureDefinition.id || '';
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

  ngOnInit() {
    this.logger.info('ResourceEditorDialog initialized');
    if (this.show() && this.structureDefinition) {
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
    this.structureDefinition = structureDefinition;
    this.existingResource = existingResource || null;
    this.show.set(true);
    this.initializeEditor();
  }

  /**
   * Reset dialog state
   */
  private resetDialog() {
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
    if (this.existingResource) {
      // Editing existing resource
      this.editorContent.set(JSON.stringify(this.existingResource, null, 2));
    } else if (this.structureDefinition) {
      // Creating new resource - generate blueprint
      const blueprint = this.generateBlueprint();
      this.editorContent.set(JSON.stringify(blueprint, null, 2));
    }

    // Extract properties from StructureDefinition
    if (this.structureDefinition) {
      this.extractProperties();
    }
  }

  /**
   * Generate blueprint resource with resourceType and meta.profile
   */
  private generateBlueprint(): any {
    const resourceType = this.resourceType();
    const profileUrl = this.structureDefinition.url;

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
    if (!this.structureDefinition?.snapshot?.element) {
      return;
    }

    const elements = this.structureDefinition.snapshot.element;
    const required: ElementProperty[] = [];
    const optional: ElementProperty[] = [];

    elements.forEach((element: any) => {
      // Skip root element
      if (element.path === this.resourceType()) {
        return;
      }

      // Only include first-level properties (e.g., Patient.name, not Patient.name.given)
      const path = element.path;
      const parts = path.split('.');
      if (parts.length !== 2) {
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
      } else {
        optional.push(property);
      }
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

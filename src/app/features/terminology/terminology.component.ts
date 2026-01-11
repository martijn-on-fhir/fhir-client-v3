import {CommonModule} from '@angular/common';
import {Component, OnInit, OnDestroy, inject, signal, computed, effect, HostListener, ViewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {EditorStateService} from '../../core/services/editor-state.service';
import {LoggerService} from '../../core/services/logger.service';
import {TerminologyService, LookupParams, ExpandParams, ValidateCodeParams, TranslateParams} from '../../core/services/terminology.service';
import {MonacoEditorComponent} from '../../shared/components/monaco-editor/monaco-editor.component';
import {ResultHeaderComponent} from '../../shared/components/result-header/result-header.component';

/**
 * FHIR Terminology Operations Component
 *
 * Provides interactive interface for FHIR Terminology Operations:
 * - CodeSystem/$lookup - Retrieve concept details from code system
 * - ValueSet/$expand - Expand value set to list of codes
 * - ValueSet/$validate-code - Validate code membership in value set
 * - ConceptMap/$translate - Translate codes between terminology systems
 *
 * Features:
 * - Monaco editor for JSON result display
 * - Split-panel interface with resizable sections
 * - Real-time parameter configuration
 * - Support for multilingual terminology operations
 */

/** Type definition for supported FHIR terminology operations */
type OperationType = 'lookup' | 'expand' | 'validate-code' | 'translate';

@Component({
  selector: 'app-terminology',
  standalone: true,
  imports: [CommonModule, FormsModule, MonacoEditorComponent, ResultHeaderComponent],
  templateUrl: './terminology.component.html',
  styleUrls: ['./terminology.component.scss']
})
export class TerminologyComponent implements OnInit, OnDestroy {

  /** Reference to Monaco editor component for JSON result display */
  @ViewChild('component') component?: MonacoEditorComponent;

  /** Service for FHIR terminology operations */
  private terminologyService = inject(TerminologyService);

  /** Service for application logging */
  private loggerService = inject(LoggerService);

  /** Service for managing editor state and file operations */
  private editorStateService = inject(EditorStateService);

  /** Component-specific logger instance */
  private logger = this.loggerService.component('TerminologyComponent');

  /** Currently selected terminology operation type */
  operation = signal<OperationType>('lookup');

  /** Result from last terminology operation execution */
  result = signal<any>(null);

  /** Error message from failed operations */
  error = signal<string | null>(null);

  /** Loading state from terminology service */
  loading = computed(() => this.terminologyService.loading());

  /** JSON viewer collapse level (false = fully expanded) */
  collapsedLevel = signal<number | false>(4);

  /** Whether JSON search is visible */
  showSearch = signal(false);

  /** Search term for filtering JSON content */
  searchTerm = signal('');

  /** Computed JSON string from operation result */
  jsonContent = computed(() => {
    const res = this.result();

    return res ? JSON.stringify(res, null, 2) : '';
  });

  /** Width percentage of left panel in split view */
  leftWidth = signal(50);

  /** Whether panel resize is in progress */
  isResizing = signal(false);

  /** Starting X position for resize operation */
  private startX = 0;

  /** Starting width percentage for resize operation */
  private startWidth = 0;

  /** Code system URL for $lookup operation */
  lookupSystem = signal('http://snomed.info/sct');

  /** Code value for $lookup operation (default: Diabetes mellitus) */
  lookupCode = signal('73211009');

  /** Code system version for $lookup operation */
  lookupVersion = signal('');

  /** Display language for $lookup operation (default: Dutch medical) */
  lookupLanguage = signal('nl-x-sctlang-31000146-106');

  /** Property to retrieve for $lookup operation */
  lookupProperty = signal('designation');

  /** Value set URL for $expand operation */
  expandUrl = signal('http://terminology.hl7.org/ValueSet/v3-NullFlavor');

  /** Filter text for $expand operation */
  expandFilter = signal('');

  /** Maximum number of codes to return in $expand */
  expandCount = signal(100);

  /** Offset for pagination in $expand */
  expandOffset = signal(0);

  /** Whether to include designations in $expand */
  expandIncludeDesignations = signal(true);

  /** Display language for $expand operation */
  expandDisplayLanguage = signal('nl-x-sctlang-31000146-106');

  /** Value set URL for $validate-code operation */
  validateUrl = signal('http://terminology.hl7.org/ValueSet/v3-NullFlavor');

  /** Code to validate in $validate-code operation */
  validateCode = signal('UNK');

  /** Code system for $validate-code operation */
  validateSystem = signal('http://terminology.hl7.org/CodeSystem/v3-NullFlavor');

  /** Display text for code in $validate-code operation */
  validateDisplay = signal('');

  /** Version for $validate-code operation */
  validateVersion = signal('');

  /** ConceptMap URL for $translate operation */
  translateUrl = signal('');

  /** Code to translate in $translate operation */
  translateCode = signal('');

  /** Source code system for $translate operation */
  translateSystem = signal('');

  /** Source value set URL for $translate operation */
  translateSource = signal('');

  /** Target value set URL for $translate operation */
  translateTarget = signal('');

  /**
   * Creates an instance of TerminologyComponent
   *
   * Sets up reactive effect for Monaco editor registration.
   * The editor is registered as read-only when operation results are available,
   * with retry mechanism for async Monaco loading.
   */
  constructor() {
    effect(() => {
      const hasResults = this.result() != null;

      if (hasResults) {
        setTimeout(() => {
          if (this.component?.editor) {
            this.editorStateService.registerEditor(this.component, false, '/app/terminology');
            this.logger.info('Terminology editor registered as read-only');
          } else {
            setTimeout(() => {
              if (this.component?.editor) {
                this.editorStateService.registerEditor(this.component, false, '/app/terminology');
                this.logger.info('Terminology editor registered as read-only');
              }
            }, 200);
          }
        }, 100);
      }
    });
  }

  /**
   * Angular lifecycle hook called on component initialization
   * Logs component initialization for debugging
   */
  ngOnInit() {
    this.logger.info('Component initialized');
  }

  /**
   * Angular lifecycle hook called on component destruction
   * Unregisters editor from EditorStateService
   */
  ngOnDestroy() {
    this.editorStateService.unregisterEditor('/app/terminology');
  }

  /**
   * Executes the currently selected terminology operation
   *
   * Dispatches to appropriate operation handler based on operation signal:
   * - lookup: CodeSystem/$lookup
   * - expand: ValueSet/$expand
   * - validate-code: ValueSet/$validate-code
   * - translate: ConceptMap/$translate
   *
   * Clears previous results and errors before execution.
   * Updates result signal on success or error signal on failure.
   *
   * @returns Promise that resolves when operation completes
   */
  async executeOperation() {
    this.error.set(null);
    this.result.set(null);

    try {
      let result: any;

      switch (this.operation()) {
        case 'lookup':
          result = await this.executeLookup();
          break;
        case 'expand':
          result = await this.executeExpand();
          break;
        case 'validate-code':
          result = await this.executeValidate();
          break;
        case 'translate':
          result = await this.executeTranslate();
          break;
      }

      this.result.set(result);
    } catch (err: any) {
      this.error.set(err.message || 'Operation failed');
      this.logger.error('Operation error:', err);
    }
  }

  /**
   * Executes CodeSystem/$lookup operation
   *
   * Retrieves concept details from a code system including:
   * - Display text
   * - Designations in specified language
   * - Properties (if requested)
   *
   * Builds parameters from lookup signals and calls terminology service.
   *
   * @returns Promise resolving to FHIR Parameters resource with concept details
   * @private
   */
  private async executeLookup(): Promise<any> {
    const params: LookupParams = {
      system: this.lookupSystem(),
      code: this.lookupCode()
    };

    if (this.lookupVersion()) {
      params.version = this.lookupVersion();
    }

    if (this.lookupLanguage()) {
      params.displayLanguage = this.lookupLanguage();
    }

    if (this.lookupProperty()) {
      params.property = this.lookupProperty();
    }

    return await this.terminologyService.lookup(params);
  }

  /**
   * Executes ValueSet/$expand operation
   *
   * Expands a value set to return the list of codes it contains.
   * Supports:
   * - Text filtering
   * - Pagination (count/offset)
   * - Designation inclusion
   * - Language-specific displays
   *
   * Builds parameters from expand signals and calls terminology service.
   *
   * @returns Promise resolving to FHIR ValueSet with expansion
   * @private
   */
  private async executeExpand(): Promise<any> {
    const params: ExpandParams = {
      url: this.expandUrl()
    };

    if (this.expandFilter()) {
      params.filter = this.expandFilter();
    }

    if (this.expandCount()) {
      params.count = this.expandCount();
    }

    if (this.expandOffset()) {
      params.offset = this.expandOffset();
    }

    if (this.expandIncludeDesignations() !== undefined) {
      params.includeDesignations = this.expandIncludeDesignations();
    }

    if (this.expandDisplayLanguage()) {
      params.displayLanguage = this.expandDisplayLanguage();
    }

    return await this.terminologyService.expand(params);
  }

  /**
   * Executes ValueSet/$validate-code operation
   *
   * Validates whether a code is a member of a value set.
   * Returns a Parameters resource with validation result including:
   * - Boolean result
   * - Display text
   * - Message (if invalid)
   *
   * Builds parameters from validate signals and calls terminology service.
   *
   * @returns Promise resolving to FHIR Parameters resource with validation result
   * @private
   */
  private async executeValidate(): Promise<any> {
    const params: ValidateCodeParams = {
      url: this.validateUrl(),
      code: this.validateCode(),
      system: this.validateSystem()
    };

    if (this.validateDisplay()) {
      params.display = this.validateDisplay();
    }

    if (this.validateVersion()) {
      params.version = this.validateVersion();
    }

    return await this.terminologyService.validateCode(params);
  }

  /**
   * Executes ConceptMap/$translate operation
   *
   * Translates a code from one code system to another using a ConceptMap.
   * Returns a Parameters resource with translation results including:
   * - Match status
   * - Equivalent codes
   * - Equivalence level
   *
   * Builds parameters from translate signals and calls terminology service.
   *
   * @returns Promise resolving to FHIR Parameters resource with translation results
   * @private
   */
  private async executeTranslate(): Promise<any> {
    const params: TranslateParams = {
      url: this.translateUrl(),
      code: this.translateCode(),
      system: this.translateSystem()
    };

    if (this.translateSource()) {
      params.source = this.translateSource();
    }

    if (this.translateTarget()) {
      params.target = this.translateTarget();
    }

    return await this.terminologyService.translate(params);
  }

  /**
   * Changes the selected terminology operation type
   *
   * Updates operation signal and clears previous results and errors.
   * This allows user to switch between different terminology operations.
   *
   * @param op - The operation type to select (lookup, expand, validate-code, translate)
   */
  selectOperation(op: OperationType) {
    this.operation.set(op);
    this.result.set(null);
    this.error.set(null);
  }

  /**
   * Collapses all levels of JSON viewer to show only top level
   * Sets collapsed level to 1 (minimum)
   */
  collapseAll() {
    this.collapsedLevel.set(1);
  }

  /**
   * Expands all levels of JSON viewer to show entire structure
   * Sets collapsed level to false (fully expanded)
   */
  expandAll() {
    this.collapsedLevel.set(false);
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

  /**
   * Initiates panel resize operation
   *
   * Records starting position and width for drag calculation.
   * Sets appropriate cursor and disables text selection during resize.
   *
   * @param event - Mouse down event on resize divider
   */
  startResize(event: MouseEvent) {
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
   * Calculates new panel width based on mouse position delta.
   * Constrains width between 20% and 80% to prevent unusable layouts.
   *
   * @param event - Mouse move event during drag
   */
  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.isResizing()) {
      return;
    }

    const containerWidth = document.querySelector('.results-panel')?.clientWidth || 1000;
    const deltaX = event.clientX - this.startX;
    const deltaPercent = (deltaX / containerWidth) * 100;
    const newWidth = Math.min(Math.max(this.startWidth + deltaPercent, 20), 80);

    this.leftWidth.set(newWidth);
  }

  /**
   * Stops panel resize operation on mouse up
   *
   * Resets resize state and restores normal cursor and text selection.
   */
  @HostListener('document:mouseup')
  stopResize() {
    if (this.isResizing()) {
      this.isResizing.set(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }
  }

  /**
   * Extracts a parameter value from FHIR Parameters resource
   *
   * Searches for a parameter by name and returns its value.
   * Handles multiple value types: valueString, valueBoolean, valueCode,
   * valueInteger, or part (for complex parameters).
   *
   * @param parameters - FHIR Parameters resource
   * @param name - Name of parameter to find
   * @returns Parameter value or null if not found
   */
  getParameterValue(parameters: any, name: string): any {
    if (!parameters?.parameter) {
      return null;
    }
    const param = parameters.parameter.find((p: any) => p.name === name);

    if (!param) {
      return null;
    }

    return param.valueString || param.valueBoolean || param.valueCode || param.valueInteger || param.part;
  }

  /**
   * Extracts all parameters with a specific name from FHIR Parameters resource
   *
   * Returns an array of all parameters matching the given name.
   * Useful for parameters that can appear multiple times (e.g., designations).
   *
   * @param parameters - FHIR Parameters resource
   * @param name - Name of parameters to find
   * @returns Array of matching parameters (empty if none found)
   */
  getAllParameters(parameters: any, name: string): any[] {
    if (!parameters?.parameter) {
      return [];
    }

    return parameters.parameter.filter((p: any) => p.name === name);
  }
}

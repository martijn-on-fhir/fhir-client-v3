import {CommonModule} from '@angular/common';
import {Component, OnInit, AfterViewInit, OnDestroy, inject, signal, computed, effect, HostListener, ViewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {EditorStateService} from '../../core/services/editor-state.service';
import {LoggerService} from '../../core/services/logger.service';
import {TerminologyService, LookupParams, ExpandParams, ValidateCodeParams, TranslateParams} from '../../core/services/terminology.service';
import {JsonViewerToolbarComponent} from '../../shared/components/json-viewer-toolbar/json-viewer-toolbar.component';
import {MonacoEditorComponent} from '../../shared/components/monaco-editor/monaco-editor.component';
import {ResultHeaderComponent} from '../../shared/components/result-header/result-header.component';

/**
 * Terminology Tab Component
 *
 * Provides FHIR Terminology Operations:
 * - CodeSystem/$lookup - Get code details
 * - ValueSet/$expand - Expand value set to codes
 * - ValueSet/$validate-code - Validate code membership
 * - ConceptMap/$translate - Translate codes between systems
 */

type OperationType = 'lookup' | 'expand' | 'validate-code' | 'translate';

@Component({
  selector: 'app-terminology',
  standalone: true,
  imports: [CommonModule, FormsModule, MonacoEditorComponent, JsonViewerToolbarComponent, ResultHeaderComponent],
  templateUrl: './terminology.component.html',
  styleUrls: ['./terminology.component.scss']
})
export class TerminologyComponent implements OnInit, AfterViewInit, OnDestroy {

  // ViewChild reference to Monaco Editor (text modus)
  @ViewChild('component') component?: MonacoEditorComponent;

  private terminologyService = inject(TerminologyService);
  private loggerService = inject(LoggerService);
  private editorStateService = inject(EditorStateService);
  private logger = this.loggerService.component('TerminologyComponent');

  // Operation selection
  operation = signal<OperationType>('lookup');

  // Results
  result = signal<any>(null);
  error = signal<string | null>(null);
  loading = computed(() => this.terminologyService.loading());

  // JSON viewer settings
  collapsedLevel = signal<number | false>(4);
  showSearch = signal(false);
  searchTerm = signal('');

  // Monaco editor JSON content
  jsonContent = computed(() => {
    const res = this.result();

    return res ? JSON.stringify(res, null, 2) : '';
  });

  // Split panel (JSON left, formatted right)
  leftWidth = signal(50); // percentage
  isResizing = signal(false);
  private startX = 0;
  private startWidth = 0;

  // Lookup parameters
  lookupSystem = signal('http://snomed.info/sct');
  lookupCode = signal('73211009'); // Diabetes mellitus
  lookupVersion = signal('');
  lookupLanguage = signal('nl-x-sctlang-31000146-106'); // Dutch medical
  lookupProperty = signal('designation');

  // Expand parameters
  expandUrl = signal('http://terminology.hl7.org/ValueSet/v3-NullFlavor');
  expandFilter = signal('');
  expandCount = signal(100);
  expandOffset = signal(0);
  expandIncludeDesignations = signal(true);
  expandDisplayLanguage = signal('nl-x-sctlang-31000146-106');

  // Validate parameters
  validateUrl = signal('http://terminology.hl7.org/ValueSet/v3-NullFlavor');
  validateCode = signal('UNK');
  validateSystem = signal('http://terminology.hl7.org/CodeSystem/v3-NullFlavor');
  validateDisplay = signal('');
  validateVersion = signal('');

  // Translate parameters
  translateUrl = signal('');
  translateCode = signal('');
  translateSystem = signal('');
  translateSource = signal('');
  translateTarget = signal('');

  constructor() {
    // Register editor when it becomes available (after operation results load)
    effect(() => {
      const hasResults = this.result() != null;

      if (hasResults) {
        setTimeout(() => {
          if (this.component?.editor) {
            this.editorStateService.registerEditor(this.component, false, '/app/terminology');
            this.logger.info('Terminology editor registered as read-only');
          } else {
            // Retry after Monaco editor has had time to initialize
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

  ngOnInit() {
    this.logger.info('Component initialized');
  }

  ngAfterViewInit() {
    // Editor registration happens in ngOnInit effect
  }

  ngOnDestroy() {
    this.editorStateService.unregisterEditor('/app/terminology');
  }

  /**
   * Execute selected terminology operation
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
   * Execute lookup operation
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
   * Execute expand operation
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
   * Execute validate-code operation
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
   * Execute translate operation
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
   * Change operation type
   */
  selectOperation(op: OperationType) {
    this.operation.set(op);
    this.result.set(null);
    this.error.set(null);
  }

  /**
   * Collapse JSON viewer
   */
  collapseAll() {
    this.collapsedLevel.set(1);
  }

  /**
   * Expand JSON viewer
   */
  expandAll() {
    this.collapsedLevel.set(false);
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

  /**
   * Start resizing split panel
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
   * Handle mouse move during resize
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
   * Stop resizing
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
   * Get parameter value from FHIR Parameters resource
   */
  getParameterValue(parameters: any, name: string): any {
    if (!parameters?.parameter) {
      return null;
    }
    const param = parameters.parameter.find((p: any) => p.name === name);

    if (!param) {
      return null;
    }

    // Check for different value types
    return param.valueString || param.valueBoolean || param.valueCode || param.valueInteger || param.part;
  }

  /**
   * Get all parameters with a specific name from FHIR Parameters resource
   */
  getAllParameters(parameters: any, name: string): any[] {
    if (!parameters?.parameter) {
      return [];
    }

    return parameters.parameter.filter((p: any) => p.name === name);
  }
}

import {CommonModule} from '@angular/common';
import {Component, OnInit, OnDestroy, AfterViewInit, ViewChild, signal, computed, effect, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {firstValueFrom} from 'rxjs';
import {EditorStateService} from '../../core/services/editor-state.service';
import {FhirService} from '../../core/services/fhir.service';
import {LoggerService} from '../../core/services/logger.service';
import {ThemeService} from '../../core/services/theme.service';
import {
  validateFhirResource,
  validateAgainstServer,
  ValidationResult,
  getSeverityIcon
} from '../../core/utils/fhir-validator';
import {MonacoEditorComponent} from '../../shared/components/monaco-editor/monaco-editor.component';
import {ResultHeaderComponent} from '../../shared/components/result-header/result-header.component';

/**
 * FHIR Validator Component
 *
 * Provides comprehensive validation of FHIR resources including:
 * - Client-side validation against FHIR R4/STU3 specifications
 * - Server-side validation against CapabilityStatement
 * - Support for single resources, arrays, and Bundles
 * - Monaco editor integration for JSON editing
 * - Split-panel interface with resizable validation results
 */
@Component({
  selector: 'app-validator',
  standalone: true,
  imports: [CommonModule, FormsModule, MonacoEditorComponent, ResultHeaderComponent],
  templateUrl: './validator.component.html',
  styleUrl: './validator.component.scss'
})
export class ValidatorComponent implements OnInit, AfterViewInit, OnDestroy {

  /** Reference to Monaco editor component for JSON input */
  @ViewChild('component') component?: MonacoEditorComponent;

  /** Service for FHIR server communication */
  private fhirService = inject(FhirService);

  /** Service for application logging */
  private loggerService = inject(LoggerService);

  /** Component-specific logger instance */
  private logger = this.loggerService.component('ValidatorComponent');

  /** Service for managing editor state and file operations */
  private editorStateService = inject(EditorStateService);

  /** JSON input content from Monaco editor */
  jsonInput = signal<string>('');

  /** Parsed JSON data object */
  parsedData = signal<any>(null);

  /** Current validation result with issues */
  validationResult = signal<ValidationResult | null>(null);

  /** Error message for display to user */
  error = signal<string | null>(null);

  /** Loading state during validation operations */
  loading = signal<boolean>(false);

  /** Selected validation profile (server-capability, fhir-r4-base, fhir-stu3-base) */
  selectedProfile = signal<string>('server-capability');

  /** Server CapabilityStatement metadata for server validation */
  serverMetadata = signal<any>(null);

  /** Width percentage of left panel in split view */
  leftWidth = signal<number>(50);

  /** Whether panel resize is in progress */
  isResizing = signal<boolean>(false);

  /** Computed array of error-level validation issues */
  errors = computed(() => {
    const result = this.validationResult();

    return result ? result.issues.filter(i => i.severity === 'error') : [];
  });

  /** Computed array of warning-level validation issues */
  warnings = computed(() => {
    const result = this.validationResult();

    return result ? result.issues.filter(i => i.severity === 'warning') : [];
  });

  /** Computed array of information-level validation issues */
  information = computed(() => {
    const result = this.validationResult();

    return result ? result.issues.filter(i => i.severity === 'information') : [];
  });

  /** Mouse move event handler for panel resizing */
  private mouseMoveHandler?: (e: MouseEvent) => void;

  /** Mouse up event handler for panel resizing */
  private mouseUpHandler?: () => void;

  /** Cleanup function for file operations */
  private fileOpenCleanup?: () => void;

  /** Utility function reference for severity icon mapping */
  getSeverityIcon = getSeverityIcon;

  /**
   * Creates an instance of ValidatorComponent
   *
   * Sets up reactive effects for:
   * - Auto-parsing JSON input when it changes
   * - Loading server metadata when server validation profile is selected
   *
   * @param themeService - Service for managing application theme (light/dark mode)
   */
  constructor(public themeService: ThemeService) {
    effect(() => {
      const input = this.jsonInput();

      try {
        if (input.trim()) {
          const parsed = JSON.parse(input);
          this.parsedData.set(parsed);
          this.error.set(null);
        } else {
          this.parsedData.set(null);
        }
      } catch {
        this.parsedData.set(null);
      }
    }, {allowSignalWrites: true});

    effect(async () => {
      if (this.selectedProfile() === 'server-capability') {
        await this.loadServerMetadata();
      }
    }, {allowSignalWrites: true});
  }

  /**
   * Loads server metadata (CapabilityStatement) from cache or FHIR server
   *
   * Attempts to load metadata in the following order:
   * 1. From electron-store cache
   * 2. From FHIR server via FhirService
   *
   * Handles both Observable and direct value returns from the APIs.
   * Updates serverMetadata signal on success or sets error message on failure.
   *
   * @private
   */
  private async loadServerMetadata() {
    try {
      let storedMetadata = await window.electronAPI?.metadata?.get();

      if (storedMetadata && typeof storedMetadata === 'object' && 'subscribe' in storedMetadata) {
        storedMetadata = await firstValueFrom(storedMetadata as any);
      }

      if (!storedMetadata) {
        const result = await this.fhirService.getMetadata();

        if (result && typeof result === 'object' && 'subscribe' in result) {
          storedMetadata = await firstValueFrom(result as any);
        } else {
          storedMetadata = result;
        }
      }

      if (storedMetadata) {
        this.serverMetadata.set(storedMetadata);
        this.error.set(null);
      } else {
        this.error.set('No server metadata available. Please connect to a FHIR server first.');
      }
    } catch (err) {
      this.logger.error('Failed to load server metadata:', err);
      this.error.set('Failed to load server metadata');
    }
  }

  /**
   * Angular lifecycle hook called on component initialization
   * Logs component initialization for debugging
   */
  ngOnInit() {
    this.logger.info('Validator tab initialized');
  }

  /**
   * Angular lifecycle hook called after view initialization
   * Registers Monaco editor with EditorStateService for file operations
   */
  ngAfterViewInit() {
    this.registerEditorWithRetry();
  }

  /**
   * Registers Monaco editor with retry mechanism for async loading
   *
   * Monaco editor loads asynchronously, so this method:
   * 1. Attempts to register after 100ms delay
   * 2. Retries after 200ms if first attempt fails
   *
   * Registers editor as editable for file load/save operations.
   *
   * @private
   */
  private registerEditorWithRetry() {
    setTimeout(() => {
      if (this.component?.editor) {
        this.editorStateService.registerEditor(this.component, true, '/app/validator');
        this.logger.info('Validator editor registered as editable');
      } else {
        setTimeout(() => {
          if (this.component?.editor) {
            this.editorStateService.registerEditor(this.component, true, '/app/validator');
            this.logger.info('Validator editor registered as editable (retry)');
          }
        }, 200);
      }
    }, 100);
  }

  /**
   * Angular lifecycle hook called on component destruction
   * Cleans up event listeners and unregisters editor from EditorStateService
   */
  ngOnDestroy() {
    this.cleanup();
    this.editorStateService.unregisterEditor('/app/validator');
  }

  /**
   * Handles file open operation via Electron file API
   *
   * Opens a file dialog and loads the selected file content into the editor.
   * Updates jsonInput signal with file content on success, or sets error message on failure.
   *
   * @returns Promise that resolves when file operation completes
   */
  async handleOpenFile() {
    if (!window.electronAPI?.file?.openFile) {
      this.error.set('File API not available');

      return;
    }

    const result = await window.electronAPI.file.openFile();

    if (result) {
      if ('error' in result) {
        this.error.set(result.error);
      } else {
        this.jsonInput.set(result.content);
        this.error.set(null);
      }
    }
  }

  /**
   * Validates FHIR resource(s) based on selected validation profile
   *
   * Supports validation of:
   * - Single FHIR resources
   * - Arrays of resources (batch validation)
   * - Bundle resources (validates all entries)
   *
   * Validation modes:
   * - Server validation: Validates against server CapabilityStatement + FHIR spec
   * - R4 Base: Validates against FHIR R4 specification
   * - STU3 Base: Validates against FHIR STU3 specification
   *
   * Updates validationResult signal with combined results, including:
   * - Overall validation status (isValid)
   * - Array of all validation issues with location paths
   * - Resource type information
   *
   * Sets loading state during validation and error state on failure.
   */
  handleValidate() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const data = this.parsedData();

      if (!data) {
        throw new Error('Invalid JSON input. Please check your JSON syntax.');
      }

      const isServerValidation = this.selectedProfile() === 'server-capability';
      const fhirVersion = this.selectedProfile() === 'fhir-stu3-base' ? 'STU3' : 'R4';

      if (Array.isArray(data)) {
        const results = data.map((resource, index) => {
          let result;

          if (isServerValidation) {
            const serverResult = validateAgainstServer(resource, this.serverMetadata());
            const baseResult = validateFhirResource(resource, fhirVersion);
            result = {
              ...serverResult,
              issues: [...serverResult.issues, ...baseResult.issues],
              isValid: serverResult.isValid && baseResult.isValid,
            };
          } else {
            result = validateFhirResource(resource, fhirVersion);
          }

          return {index, result, resource};
        });

        const allIssues = results.flatMap((r, idx) =>
          r.result.issues.map(issue => ({
            ...issue,
            location: [`Resource[${idx}] (${r.result.resourceType || 'unknown'})`, ...issue.location],
          }))
        );

        this.validationResult.set({
          isValid: results.every(r => r.result.isValid),
          issues: allIssues,
          resourceType: `Batch (${results.length} resources)`,
        });
      } else if (data.resourceType === 'Bundle') {
        const entries = data.entry || [];
        const results = entries.map((entry: any, index: number) => {
          const resource = entry.resource;

          if (!resource) {
            return null;
          }

          let result;

          if (isServerValidation) {
            const serverResult = validateAgainstServer(resource, this.serverMetadata());
            const baseResult = validateFhirResource(resource, fhirVersion);
            result = {
              ...serverResult,
              issues: [...serverResult.issues, ...baseResult.issues],
              isValid: serverResult.isValid && baseResult.isValid,
            };
          } else {
            result = validateFhirResource(resource, fhirVersion);
          }

          return {index, result, resource};
        }).filter(Boolean);

        const allIssues = results.flatMap((r: any) =>
          r.result.issues.map((issue: any) => ({
            ...issue,
            location: [`Bundle.entry[${r.index}] (${r.result.resourceType || 'unknown'})`, ...issue.location],
          }))
        );

        this.validationResult.set({
          isValid: results.every((r: any) => r.result.isValid),
          issues: allIssues,
          resourceType: `Bundle (${results.length} entries)`,
        });
      } else {
        if (isServerValidation) {
          const serverResult = validateAgainstServer(data, this.serverMetadata());
          const baseResult = validateFhirResource(data, fhirVersion);
          this.validationResult.set({
            ...serverResult,
            issues: [...serverResult.issues, ...baseResult.issues],
            isValid: serverResult.isValid && baseResult.isValid,
          });
        } else {
          this.validationResult.set(validateFhirResource(data, fhirVersion));
        }
      }
    } catch (err: any) {
      this.logger.error('Validation error:', err);
      this.error.set(err.message || 'Failed to validate resource');
      this.validationResult.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Clears all validation state and resets the component
   *
   * Resets:
   * - JSON input editor content
   * - Parsed data
   * - Validation results
   * - Error messages
   */
  handleClear() {
    this.jsonInput.set('');
    this.parsedData.set(null);
    this.validationResult.set(null);
    this.error.set(null);
  }

  /**
   * Clears only the validation result without affecting input
   * Useful for clearing results while keeping the input JSON
   */
  clearResult() {
    this.validationResult.set(null);
  }

  /**
   * Initiates panel resize operation
   *
   * Sets up mouse event listeners for tracking drag movement.
   * Prevents default browser behavior and sets appropriate cursor.
   *
   * @param event - Mouse down event on the resize divider
   */
  startResizing(event: MouseEvent) {
    event.preventDefault();
    this.isResizing.set(true);

    this.mouseMoveHandler = (e: MouseEvent) => this.resize(e);
    this.mouseUpHandler = () => this.stopResizing();

    document.addEventListener('mousemove', this.mouseMoveHandler);
    document.addEventListener('mouseup', this.mouseUpHandler);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  /**
   * Handles panel resize during drag operation
   *
   * Calculates new panel width as percentage of container width.
   * Constrains width between 20% and 80% to prevent unusable layouts.
   *
   * @param e - Mouse move event during drag
   * @private
   */
  private resize(e: MouseEvent) {
    if (!this.isResizing()) {
      return;
    }

    const container = document.getElementById('validator-container');

    if (!container) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

    if (newWidth >= 20 && newWidth <= 80) {
      this.leftWidth.set(newWidth);
    }
  }

  /**
   * Stops panel resize operation
   * Cleans up event listeners and resets resize state
   *
   * @private
   */
  private stopResizing() {
    this.isResizing.set(false);
    this.cleanup();
  }

  /**
   * Cleans up event listeners and resets document styles
   *
   * Removes:
   * - Mouse move and mouse up event listeners
   * - Custom cursor styles
   * - User-select prevention
   *
   * @private
   */
  private cleanup() {
    if (this.mouseMoveHandler) {
      document.removeEventListener('mousemove', this.mouseMoveHandler);
    }

    if (this.mouseUpHandler) {
      document.removeEventListener('mouseup', this.mouseUpHandler);
    }
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
}

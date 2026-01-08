import { Component, OnInit, OnDestroy, signal, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ThemeService } from '../../core/services/theme.service';
import { FhirService } from '../../core/services/fhir.service';
import { LoggerService } from '../../core/services/logger.service';
import { MonacoEditorComponent } from '../../shared/components/monaco-editor/monaco-editor.component';
import {
  validateFhirResource,
  validateAgainstServer,
  ValidationResult,
  getSeverityColor,
  getSeverityIcon
} from '../../core/utils/fhir-validator';

@Component({
  selector: 'app-validator',
  standalone: true,
  imports: [CommonModule, FormsModule, MonacoEditorComponent],
  templateUrl: './validator.component.html',
  styleUrl: './validator.component.scss'
})
export class ValidatorComponent implements OnInit, OnDestroy {
  private fhirService = inject(FhirService);
  private loggerService = inject(LoggerService);
  private logger = this.loggerService.component('ValidatorComponent');

  // Signals for state management
  jsonInput = signal<string>('');
  parsedData = signal<any>(null);
  validationResult = signal<ValidationResult | null>(null);
  error = signal<string | null>(null);
  loading = signal<boolean>(false);
  selectedProfile = signal<string>('server-capability');
  serverMetadata = signal<any>(null);
  leftWidth = signal<number>(50);
  isResizing = signal<boolean>(false);

  // Computed signals
  errors = computed(() => {
    const result = this.validationResult();
    return result ? result.issues.filter(i => i.severity === 'error') : [];
  });

  warnings = computed(() => {
    const result = this.validationResult();
    return result ? result.issues.filter(i => i.severity === 'warning') : [];
  });

  information = computed(() => {
    const result = this.validationResult();
    return result ? result.issues.filter(i => i.severity === 'information') : [];
  });

  // Event handlers
  private mouseMoveHandler?: (e: MouseEvent) => void;
  private mouseUpHandler?: () => void;
  private fileOpenCleanup?: () => void;

  // Export utility functions for template
  getSeverityColor = getSeverityColor;
  getSeverityIcon = getSeverityIcon;

  constructor(public themeService: ThemeService) {
    // Auto-parse JSON when input changes
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
    }, { allowSignalWrites: true });

    // Load server metadata when server validation is selected
    effect(async () => {
      if (this.selectedProfile() === 'server-capability') {
        await this.loadServerMetadata();
      }
    }, { allowSignalWrites: true });
  }

  /**
   * Load server metadata from cache or FHIR server
   */
  private async loadServerMetadata() {
    try {
      // Try to load from electron-store first
      let storedMetadata = await window.electronAPI?.metadata?.get();

      // Check if it's an Observable and unwrap it
      if (storedMetadata && typeof storedMetadata === 'object' && 'subscribe' in storedMetadata) {
        storedMetadata = await firstValueFrom(storedMetadata as any);
      }

      // If not in storage, fetch from server
      if (!storedMetadata) {
        const result = await this.fhirService.getMetadata();

        // Check if result is Observable
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

  ngOnInit() {
    // Listen for file open events
    if (window.electronAPI?.onOpenFile) {
      this.fileOpenCleanup = window.electronAPI.onOpenFile(async () => {
        await this.handleOpenFile();
      });
    }
  }

  ngOnDestroy() {
    this.cleanup();
    if (this.fileOpenCleanup) {
      this.fileOpenCleanup();
    }
  }

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

      // Handle array of resources
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
          return { index, result, resource };
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
      }
      // Handle Bundle
      else if (data.resourceType === 'Bundle') {
        const entries = data.entry || [];
        const results = entries
          .map((entry: any, index: number) => {
            const resource = entry.resource;
            if (!resource) return null;

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
            return { index, result, resource };
          })
          .filter(Boolean);

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
      }
      // Handle single resource
      else {
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

  handleClear() {
    this.jsonInput.set('');
    this.parsedData.set(null);
    this.validationResult.set(null);
    this.error.set(null);
  }

  clearResult() {
    this.validationResult.set(null);
  }

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

  private resize(e: MouseEvent) {
    if (!this.isResizing()) return;

    const container = document.getElementById('validator-container');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

    if (newWidth >= 20 && newWidth <= 80) {
      this.leftWidth.set(newWidth);
    }
  }

  private stopResizing() {
    this.isResizing.set(false);
    this.cleanup();
  }

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

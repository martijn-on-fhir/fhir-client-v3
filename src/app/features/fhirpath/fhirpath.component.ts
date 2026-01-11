import { CommonModule } from '@angular/common';
import {Component, OnInit, OnDestroy, signal, effect, inject, ViewChild} from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as fhirpath from 'fhirpath';
import { LoggerService } from '../../core/services/logger.service';
import { ThemeService } from '../../core/services/theme.service';
import {JsonViewerToolbarComponent} from '../../shared/components/json-viewer-toolbar/json-viewer-toolbar.component'
import {MonacoEditorComponent} from '../../shared/components/monaco-editor/monaco-editor.component'
import {ResultHeaderComponent} from '../../shared/components/result-header/result-header.component';

@Component({
  selector: 'app-fhirpath',
  standalone: true,
  imports: [CommonModule, FormsModule, MonacoEditorComponent, JsonViewerToolbarComponent, ResultHeaderComponent],
  templateUrl: './fhirpath.component.html',
  styleUrl: './fhirpath.component.scss'
})
export class FhirpathComponent implements OnInit, OnDestroy {

  // ViewChild reference to Monaco Editor (text modus)
  @ViewChild('component') component?: MonacoEditorComponent;

  // Signals for state management
  expression = signal<string>('');
  jsonInput = signal<string>('');
  parsedData = signal<any>(null);
  result = signal<any>(null);
  error = signal<string | null>(null);
  loading = signal<boolean>(false);
  leftWidth = signal<number>(50);
  isResizing = signal<boolean>(false);

  // Event handlers
  private mouseMoveHandler?: (e: MouseEvent) => void;
  private mouseUpHandler?: () => void;
  private fileOpenCleanup?: () => void;

  private loggerService = inject(LoggerService);
  private logger = this.loggerService.component('FhirpathComponent');

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
        // Don't show error while typing, only on execute
      }
    }, { allowSignalWrites: true });
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

  handleExecute() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const data = this.parsedData();

      if (!data) {
        throw new Error('Invalid JSON input. Please check your JSON syntax.');
      }

      // Evaluate FHIRPath expression
      const evaluationResult = fhirpath.evaluate(data, this.expression());
      this.result.set(evaluationResult);
    } catch (err: any) {
      this.logger.error('FHIRPath evaluation error:', err);
      this.error.set(err.message || 'Failed to evaluate FHIRPath expression');
      this.result.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.handleExecute();
    }
  }

  formatJson() {
    try {
      const data = this.parsedData();

      if (data) {
        this.jsonInput.set(JSON.stringify(data, null, 2));
      }
    } catch {
      // Ignore
    }
  }

  formatResult(): string {
    const res = this.result();

    if (res === null || res === undefined) {
      return '';
    }

    try {
      return JSON.stringify(res, null, 2);
    } catch {
      return String(res);
    }
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
    if (!this.isResizing()) {
return;
}

    const container = document.getElementById('fhirpath-container');

    if (!container) {
return;
}

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

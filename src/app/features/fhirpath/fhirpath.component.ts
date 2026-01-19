import { CommonModule } from '@angular/common';
import {Component, OnInit, OnDestroy, AfterViewInit, signal, effect, inject, ViewChild, ElementRef} from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as fhirpath from 'fhirpath';
import { EditorStateService } from '../../core/services/editor-state.service';
import { FhirpathAutocompleteService, FhirPathSuggestion } from '../../core/services/fhirpath-autocomplete.service';
import { FhirpathStateService } from '../../core/services/fhirpath-state.service';
import { LoggerService } from '../../core/services/logger.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import {MonacoEditorComponent} from '../../shared/components/monaco-editor/monaco-editor.component'
import {ResultHeaderComponent} from '../../shared/components/result-header/result-header.component';

/**
 * FHIRPath Component
 *
 * Provides interactive FHIRPath expression evaluation interface.
 *
 * Features:
 * - Monaco editor for JSON input with syntax highlighting
 * - FHIRPath expression input with Enter key execution
 * - Real-time JSON parsing and validation
 * - FHIRPath evaluation using fhirpath.js library
 * - JSON result display with formatting
 * - Split-panel layout with resizable editor and result sections
 * - File loading via Electron file API
 * - Auto-formatting for JSON input
 * - Theme-aware editor styling
 */
@Component({
  selector: 'app-fhirpath',
  standalone: true,
  imports: [CommonModule, FormsModule, MonacoEditorComponent, ResultHeaderComponent],
  templateUrl: './fhirpath.component.html',
  styleUrl: './fhirpath.component.scss'
})
export class FhirpathComponent implements OnInit, OnDestroy, AfterViewInit {

  /** Reference to Monaco editor component for JSON input */
  @ViewChild('component') component?: MonacoEditorComponent;

  /** Reference to expression input element for autocomplete */
  @ViewChild('expressionInput') expressionInput?: ElementRef<HTMLInputElement>;

  /** Service for managing editor state across tabs */
  private editorStateService = inject(EditorStateService);

  /** Service for FHIRPath expression autocomplete */
  private autocompleteService = inject(FhirpathAutocompleteService);

  /** Service for toast notifications */
  private toastService = inject(ToastService);

  /** Service for persisting state across tab navigation */
  private fhirpathStateService = inject(FhirpathStateService);

  /** FHIRPath expression to evaluate */
  expression = signal<string>('');

  /** JSON input content from Monaco editor */
  jsonInput = signal<string>('');

  /** Parsed JSON data object from jsonInput */
  parsedData = signal<any>(null);

  /** Result from FHIRPath expression evaluation */
  result = signal<any>(null);

  /** Loading state during FHIRPath evaluation */
  loading = signal<boolean>(false);

  /** Width percentage of left panel in split view */
  leftWidth = signal<number>(50);

  /** Whether panel resize is in progress */
  isResizing = signal<boolean>(false);

  /** Autocomplete suggestions for FHIRPath expression */
  autocompleteSuggestions = signal<FhirPathSuggestion[]>([]);

  /** Whether to show autocomplete dropdown */
  showAutocomplete = signal<boolean>(false);

  /** Currently selected autocomplete suggestion index */
  autocompleteSelectedIndex = signal<number>(-1);

  /** Mouse move event handler for panel resizing */
  private mouseMoveHandler?: (e: MouseEvent) => void;

  /** Mouse up event handler for panel resizing */
  private mouseUpHandler?: () => void;

  /** Cleanup function for Electron file open event listener */
  private fileOpenCleanup?: () => void;

  /** Service for application logging */
  private loggerService = inject(LoggerService);

  /** Component-specific logger instance */
  private logger = this.loggerService.component('FhirpathComponent');

  /**
   * Creates an instance of FhirpathComponent
   *
   * Sets up reactive effect for:
   * - Auto-parsing JSON input when it changes
   * - Validates JSON syntax but doesn't show errors until execution
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
        } else {
          this.parsedData.set(null);
        }
      } catch {
        this.parsedData.set(null);
      }
    }, { allowSignalWrites: true });

    // Save state to service whenever content changes (persists across tab navigation)
    effect(() => {
      const input = this.jsonInput();
      const expr = this.expression();
      const res = this.result();

      if (input || expr) {
        this.fhirpathStateService.setState(input, expr, res);
      }
    }, { allowSignalWrites: true });
  }

  /**
   * Angular lifecycle hook called on component initialization
   *
   * Sets up event listener for file open events from Electron main process.
   * When a file open is triggered, delegates to handleOpenFile method.
   * Restores state from service if available.
   */
  ngOnInit() {
    // Restore state from service (persists across tab navigation)
    if (this.fhirpathStateService.hasContent()) {
      this.jsonInput.set(this.fhirpathStateService.jsonInput());
      this.expression.set(this.fhirpathStateService.expression());
      this.result.set(this.fhirpathStateService.result());
      this.logger.debug('Restored FHIRPath state from service');
    }

    if (window.electronAPI?.onOpenFile) {
      this.fileOpenCleanup = window.electronAPI.onOpenFile(async () => {
        await this.handleOpenFile();
      });
    }
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
   */
  private registerEditorWithRetry() {
    setTimeout(() => {
      if (this.component?.editor) {
        this.editorStateService.registerEditor(this.component, true, '/app/fhirpath');
        this.logger.info('FHIRPath editor registered as editable');
      } else {
        setTimeout(() => {
          if (this.component?.editor) {
            this.editorStateService.registerEditor(this.component, true, '/app/fhirpath');
            this.logger.info('FHIRPath editor registered as editable (retry)');
          }
        }, 200);
      }
    }, 100);
  }

  /**
   * Angular lifecycle hook called on component destruction
   *
   * Cleans up event listeners and unregisters Electron file open handler.
   */
  ngOnDestroy() {
    this.cleanup();
    this.editorStateService.unregisterEditor('/app/fhirpath');

    if (this.fileOpenCleanup) {
      this.fileOpenCleanup();
    }
  }

  /**
   * Handles file open operation via Electron file API
   *
   * Opens a file dialog and loads the selected file content into the JSON input editor.
   * Updates jsonInput signal with file content on success, or shows toast on failure.
   *
   * @returns Promise that resolves when file operation completes
   */
  async handleOpenFile() {
    if (!window.electronAPI?.file?.openFile) {
      this.toastService.error('File API not available', 'File Error');

      return;
    }

    const result = await window.electronAPI.file.openFile();

    if (result) {
      if ('error' in result) {
        this.toastService.error(result.error, 'File Error');
      } else {
        this.jsonInput.set(result.content);
      }
    }
  }

  /**
   * Executes FHIRPath expression evaluation against parsed JSON data
   *
   * Validates that JSON is parsed successfully, then evaluates the FHIRPath
   * expression using the fhirpath.js library. Updates result signal with
   * evaluation output or shows toast on failure.
   *
   * Sets loading state during evaluation.
   */
  handleExecute() {
    this.loading.set(true);

    try {
      const data = this.parsedData();

      if (!data) {
        throw new Error('Invalid JSON input. Please check your JSON syntax.');
      }

      const evaluationResult = fhirpath.evaluate(data, this.expression());
      this.result.set(evaluationResult);
    } catch (err: any) {
      this.logger.error('FHIRPath evaluation error:', err);
      this.toastService.error(err.message || 'Failed to evaluate FHIRPath expression', 'FHIRPath Error');
      this.result.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Handles keyboard input in the FHIRPath expression field
   *
   * Supports autocomplete navigation and executes expression on Enter.
   *
   * @param event - Keyboard event from the expression input field
   */
  handleKeyDown(event: KeyboardEvent) {
    const suggestions = this.autocompleteSuggestions();
    const currentIndex = this.autocompleteSelectedIndex();
    const hasVisibleSuggestions = this.showAutocomplete() && suggestions.length > 0;

    switch (event.key) {
      case 'ArrowDown':
        if (hasVisibleSuggestions) {
          event.preventDefault();
          this.autocompleteSelectedIndex.set(
            Math.min(currentIndex + 1, suggestions.length - 1)
          );
        }
        break;

      case 'ArrowUp':
        if (hasVisibleSuggestions) {
          event.preventDefault();
          this.autocompleteSelectedIndex.set(Math.max(currentIndex - 1, -1));
        }
        break;

      case 'Tab':
        if (hasVisibleSuggestions) {
          event.preventDefault();
          const idx = currentIndex >= 0 ? currentIndex : 0;
          this.selectSuggestion(suggestions[idx]);
        }
        break;

      case 'Enter':
        if (hasVisibleSuggestions && currentIndex >= 0) {
          event.preventDefault();
          this.selectSuggestion(suggestions[currentIndex]);
        } else if (!event.shiftKey) {
          event.preventDefault();
          this.showAutocomplete.set(false);
          this.handleExecute();
        }
        break;

      case 'Escape':
        if (hasVisibleSuggestions) {
          this.showAutocomplete.set(false);
          this.autocompleteSelectedIndex.set(-1);
        }
        break;
    }
  }

  /**
   * Handles input changes in the expression field
   * Updates autocomplete suggestions based on current input
   */
  onExpressionInput() {
    this.updateAutocompleteSuggestions();
  }

  /**
   * Handles blur from expression input
   * Delays hiding autocomplete to allow click on suggestion
   */
  onExpressionBlur() {
    setTimeout(() => {
      this.showAutocomplete.set(false);
    }, 150);
  }

  /**
   * Updates autocomplete suggestions based on current expression and cursor position
   */
  private updateAutocompleteSuggestions() {
    const input = this.expressionInput?.nativeElement;
    const cursorPosition = input?.selectionStart ?? this.expression().length;
    const data = this.parsedData();

    const parsed = this.autocompleteService.parseExpression(this.expression(), cursorPosition);
    const suggestions = this.autocompleteService.getSuggestions(parsed, data);

    this.autocompleteSuggestions.set(suggestions);
    this.autocompleteSelectedIndex.set(-1);
    this.showAutocomplete.set(suggestions.length > 0);
  }

  /**
   * Selects an autocomplete suggestion and applies it to the expression
   *
   * @param suggestion - The suggestion to apply
   */
  selectSuggestion(suggestion: FhirPathSuggestion) {
    const input = this.expressionInput?.nativeElement;
    const cursorPosition = input?.selectionStart ?? this.expression().length;

    const result = this.autocompleteService.applySuggestion(
      this.expression(),
      cursorPosition,
      suggestion
    );

    this.expression.set(result.newExpression);
    this.showAutocomplete.set(false);
    this.autocompleteSelectedIndex.set(-1);

    // Set cursor position and trigger new suggestions
    setTimeout(() => {
      if (input) {
        input.focus();
        input.setSelectionRange(result.newCursorPosition, result.newCursorPosition);
        this.updateAutocompleteSuggestions();
      }
    }, 0);
  }

  /**
   * Gets the Font Awesome icon class for a suggestion category
   *
   * @param category - The suggestion category
   * @returns Font Awesome icon class
   */
  getCategoryIcon(category: string): string {
    switch (category) {
      case 'property':
        return 'fa-cube';
      case 'function':
        return 'fa-code';
      case 'type':
        return 'fa-file-medical';
      default:
        return 'fa-circle';
    }
  }

  /**
   * Gets the CSS color class for a suggestion category
   *
   * @param category - The suggestion category
   * @returns Bootstrap text color class
   */
  getCategoryClass(category: string): string {
    switch (category) {
      case 'property':
        return 'text-primary';
      case 'function':
        return 'text-success';
      case 'type':
        return 'text-info';
      default:
        return 'text-muted';
    }
  }

  /**
   * Formats the FHIRPath evaluation result as JSON string
   *
   * Converts the result to a formatted JSON string with 2-space indentation.
   * Falls back to string conversion if the result cannot be JSON-stringified.
   * Returns empty string if result is null or undefined.
   *
   * @returns Formatted JSON string or string representation of result
   */
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

  /**
   * Stops panel resize operation
   *
   * Resets resize state and delegates to cleanup method to remove event listeners
   * and restore normal cursor and text selection.
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

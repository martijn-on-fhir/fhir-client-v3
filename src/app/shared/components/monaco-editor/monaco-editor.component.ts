import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
  AfterViewInit,
  ElementRef,
  ViewChild,
  computed,
  inject,
  OnDestroy,
  effect
} from '@angular/core';
import loader from '@monaco-editor/loader';
// eslint-disable-next-line @typescript-eslint/naming-convention
import type * as Monaco from 'monaco-editor';
import { AutocompleteService } from '../../../core/services/autocomplete.service';
import { LoggerService } from '../../../core/services/logger.service';
import { ThemeService } from '../../../core/services/theme.service';

/**
 * Autocomplete configuration for Monaco Editor
 */
export interface AutocompleteConfig {
  propertySuggestions: string[];
  structureElements: any[];
  templates: Record<string, any>;
  contextPrefix?: string;
}

/**
 * JSON Viewer Component with Monaco Editor
 *
 * Full-featured Monaco Editor for JSON display and editing
 * Supports light and dark themes with proper syntax highlighting
 */
@Component({
  selector: 'app-monaco-editor',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="monaco-editor-container" [class.theme-light]="isDarkMode() === false" [class.theme-dark]="isDarkMode()">
      <div #editorContainer class="editor-container"></div>
    </div>
  `,
  styles: [`
    .monaco-editor-container {
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    .editor-container {
      width: 100%;
      height: 100%;
    }

    /* Dark theme container */
    .monaco-editor-container.theme-dark {
      background-color: #1e1e1e;
    }

    /* Light theme container */
    .monaco-editor-container.theme-light {
      background-color: #ffffff;
    }
  `]
})
export class MonacoEditorComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('editorContainer', { static: false }) editorContainer!: ElementRef;

  @Input() value: string = '';
  @Input() language: string = 'json';
  @Input() readOnly: boolean = true;
  @Input() theme: string = 'vs-dark';
  @Input() autocompleteConfig?: AutocompleteConfig;

  @Output() valueChange = new EventEmitter<string>();
  @Output() altEnterPressed = new EventEmitter<{ propertyName: string; lineNumber: number }>();

  private themeService = inject(ThemeService);
  private autocompleteService = inject(AutocompleteService);
  private loggerService = inject(LoggerService);
  private logger = this.loggerService.component('MonacoEditorComponent');
  public editor: Monaco.editor.IStandaloneCodeEditor | null = null;
  private monaco: typeof Monaco | null = null;
  private initInterval: any = null;
  private completionProvider: Monaco.IDisposable | null = null;

  isDarkMode = computed(() => this.themeService.currentTheme() === 'dark');

  constructor() {
    // React to theme changes
    effect(() => {
      const theme = this.isDarkMode() ? 'vs-dark' : 'vs';

      if (this.editor && this.monaco) {
        this.monaco.editor.setTheme(theme);
       // this.editor.trigger('editor', 'editor.action.formatDocument' , '')
      }
    });
  }

  async ngOnInit() {
    // Configure Monaco to load from CDN
    loader.config({
      paths: {
        vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs'
      }
    });

    try {
      this.monaco = await loader.init();
    } catch (error) {
      this.logger.error('Monaco failed to load:', error);
    }
  }

  ngAfterViewInit() {
    // Wait for Monaco to load, then initialize editor
    if (this.monaco) {
      this.initMonaco();
    } else {
      // Monaco not loaded yet, wait for it (max 10 seconds)
      let attempts = 0;
      this.initInterval = setInterval(() => {
        attempts++;

        if (this.monaco) {
          clearInterval(this.initInterval);
          this.initInterval = null;
          this.initMonaco();
        } else if (attempts > 100) { // 10 seconds
          clearInterval(this.initInterval);
          this.initInterval = null;
          this.logger.error('Monaco failed to load after 10 seconds');
        }
      }, 100);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['value'] && !changes['value'].firstChange && this.editor) {
      const currentValue = this.editor.getValue();

      if (currentValue !== this.value) {
        this.editor.setValue(this.value);
      }
    }

    if (changes['readOnly'] && !changes['readOnly'].firstChange && this.editor) {
      this.editor.updateOptions({ readOnly: this.readOnly });
    }

    if (changes['autocompleteConfig'] && !changes['autocompleteConfig'].firstChange && this.monaco) {
      this.registerAutocompleteProvider();
    }
  }

  ngOnDestroy() {
    // Clear init interval if still running
    if (this.initInterval) {
      clearInterval(this.initInterval);
      this.initInterval = null;
    }

    // Dispose completion provider
    if (this.completionProvider) {
      this.completionProvider.dispose();
      this.completionProvider = null;
    }

    // Dispose editor
    if (this.editor) {
      this.editor.dispose();
      this.editor = null;
    }
  }

  private async initMonaco() {
    if (!this.editorContainer || !this.monaco) {
      return;
    }

    const currentTheme = this.isDarkMode() ? 'vs-dark' : 'vs';

    this.editor = this.monaco.editor.create(this.editorContainer.nativeElement, {
      value: this.value,
      language: this.language,
      theme: currentTheme,
      readOnly: this.readOnly,
      minimap: { enabled: false },
      fontSize: 14,
      automaticLayout: true,
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      lineNumbers: 'on',
      glyphMargin: false,
      folding: true,
      lineDecorationsWidth: 0,
      lineNumbersMinChars: 3,
      renderLineHighlight: 'none',
      scrollbar: {
        vertical: 'visible',
        horizontal: 'visible',
        useShadows: false,
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10
      },
      // Enable all features since we're loading from CDN with workers
      colorDecorators: true,
      links: true,
      formatOnPaste: true,
      formatOnType: true
    });

    // Listen for content changes
    this.editor.onDidChangeModelContent(() => {
      if (this.editor) {
        const newValue = this.editor.getValue();
        this.valueChange.emit(newValue);
      }
    });

    // Register autocomplete provider if config provided
    this.registerAutocompleteProvider();

    // Register keyboard shortcuts
    this.registerKeyboardShortcuts();
  }

  /**
   * Registers autocomplete provider for JSON editing
   */
  private registerAutocompleteProvider() {
    if (!this.monaco || !this.autocompleteConfig) {
      return;
    }

    const { propertySuggestions, structureElements, templates, contextPrefix = 'Patient' } = this.autocompleteConfig;

    // Dispose previous provider if exists
    if (this.completionProvider) {
      this.completionProvider.dispose();
      this.completionProvider = null;
    }

    // Register autocomplete provider for JSON
    this.completionProvider = this.monaco.languages.registerCompletionItemProvider('json', {
      triggerCharacters: ['"'],
      provideCompletionItems: (model, position) => {
        const lineContent = model.getLineContent(position.lineNumber);
        const textBeforeCursor = lineContent.substring(0, position.column - 1);

        // First, check if we're typing a property VALUE (enum autocomplete)
        const propertyNameForValue = this.autocompleteService.getPropertyNameForValue(model, position);

        if (propertyNameForValue) {
          // Find the element for this property in structure definition
          const element = structureElements.find((el: any) => {
            const path = el.path || '';

            return path.endsWith(`.${propertyNameForValue}`);
          });

          // Get enum values if available
          const enumValues = this.autocompleteService.getEnumValuesFromElement(element);

          if (enumValues && enumValues.length > 0) {
            const word = model.getWordUntilPosition(position);
            const textAfterCursor = lineContent.substring(position.column - 1);
            const hasClosingQuote = textAfterCursor.startsWith('"');

            // Create suggestions for enum values
            const suggestions = enumValues.map((enumValue, index) => {
              const insertText = enumValue;
              const endColumn = hasClosingQuote ? word.endColumn + 1 : word.endColumn;
              const range = new this.monaco!.Range(position.lineNumber, word.startColumn, position.lineNumber, endColumn);

              return {
                label: enumValue,
                kind: this.monaco!.languages.CompletionItemKind.EnumMember,
                insertText: insertText,
                detail: `${propertyNameForValue} enum value`,
                sortText: `b_${index.toString().padStart(3, '0')}`,
                range: range as any,
              };
            });

            return {
              suggestions: suggestions,
            };
          }
        }

        // Check if we're inside quotes for a property name
        const match = textBeforeCursor.match(/"([^"]*)$/);

        if (match) {
          // Determine context - are we in a nested type?
          const contextType = this.autocompleteService.getTypeContext(model, position, structureElements);

          // Determine which properties to suggest based on context
          let suggestionsToUse = propertySuggestions;
          let currentContextPrefix = contextPrefix;

          if (contextType) {
            // We're in a nested context - use template properties
            const template = templates[contextType] || templates[contextType.toLowerCase()];

            if (template && typeof template === 'object') {
              // Extract property names from template
              suggestionsToUse = Object.keys(template);
              currentContextPrefix = contextType;
            }
          }

          // Word info for replacement
          const word = model.getWordUntilPosition(position);

          // Check if there's a closing quote after the cursor
          const textAfterCursor = lineContent.substring(position.column - 1);
          const hasClosingQuote = textAfterCursor.startsWith('"');

          // Generate property name suggestions
          const suggestions = suggestionsToUse.map((propertyName, index) => {
            // Find the element in structure definition
            const element = structureElements.find((el: any) => {
              const path = el.path || '';

              return path === `${currentContextPrefix}.${propertyName}`;
            });

            const { defaultValue, typeDetail } = this.autocompleteService.getDefaultValue(
              propertyName,
              element,
              contextType,
              currentContextPrefix,
              templates
            );

            return this.autocompleteService.createCompletionItem(
              propertyName,
              defaultValue,
              typeDetail,
              currentContextPrefix,
              index,
              model,
              position,
              word,
              this.monaco!,
              hasClosingQuote
            );
          });

          return {
            suggestions: suggestions,
          };
        } else {
          // Return empty suggestions but mark as incomplete to suppress defaults
          return {
            suggestions: [],
            incomplete: false,
          };
        }
      },
    });
  }

  /**
   * Registers keyboard shortcuts for Monaco editor
   */
  private registerKeyboardShortcuts() {
    if (!this.editor || !this.monaco) {
      return;
    }

    this.editor.onKeyDown((e) => {
      // Alt + Enter: Open Reference Selector
      if (e.altKey && !e.ctrlKey && e.keyCode === this.monaco!.KeyCode.Enter) {
        e.preventDefault();
        this.handleAltEnter();

        return;
      }

      // Ctrl + Alt + L: Format JSON (already handled via button, but add keyboard support)
      if (e.ctrlKey && e.altKey && e.keyCode === this.monaco!.KeyCode.KeyL) {
        e.preventDefault();
        this.formatJson();

        return;
      }

      // Ctrl + Arrow Down: Navigate to next empty value
      if (e.ctrlKey && !e.altKey && e.keyCode === this.monaco!.KeyCode.DownArrow) {
        e.preventDefault();
        this.navigateToNextEmptyValue();

        return;
      }

      // Ctrl + Arrow Up: Navigate to previous empty value
      if (e.ctrlKey && !e.altKey && e.keyCode === this.monaco!.KeyCode.UpArrow) {
        e.preventDefault();
        this.navigateToPreviousEmptyValue();

        return;
      }

      // Enter key: Smart comma insertion
      if (!e.ctrlKey && !e.altKey && e.keyCode === this.monaco!.KeyCode.Enter) {
        const position = this.editor!.getPosition();

        if (position) {
          this.handleSmartEnter(position);
        }
      }

      // Comma key: Auto-format after insertion
      if (!e.ctrlKey && !e.altKey && e.keyCode === this.monaco!.KeyCode.Comma) {
        setTimeout(() => this.handleCommaKey(), 100);
      }
    });
  }

  /**
   * Handle Alt+Enter key press - detect property name and emit event
   */
  private handleAltEnter() {
    if (!this.editor || !this.monaco) {
      return;
    }

    const position = this.editor.getPosition();

    if (!position) {
      return;
    }

    const model = this.editor.getModel();

    if (!model) {
      return;
    }

    // Get the line content at cursor position
    const lineContent = model.getLineContent(position.lineNumber);

    // Extract property name from the line (e.g., "subject": ... -> "subject")
    const propertyMatch = lineContent.match(/"([^"]+)"\s*:/);

    if (!propertyMatch) {
      this.logger.warn('No property found at cursor position');

      return;
    }

    const propertyName = propertyMatch[1];

    // Emit event with property name
    this.altEnterPressed.emit({
      propertyName,
      lineNumber: position.lineNumber
    });
  }

  /**
   * Format JSON content
   */
  private formatJson() {
    if (!this.editor) {
      return;
    }

    try {
      const currentContent = this.editor.getValue();
      const parsed = JSON.parse(currentContent);
      const formatted = JSON.stringify(parsed, null, 2);

      // Save cursor position
      const position = this.editor.getPosition();

      // Update the editor with formatted content
      this.editor.setValue(formatted);

      // Restore cursor position (approximately)
      if (position) {
        this.editor.setPosition(position);
      }
      this.editor.focus();
    } catch (error) {
      this.logger.warn('Cannot format JSON:', error);
    }
  }

  /**
   * Navigate to the next empty value in the document
   * Searches for "", [], {}, or null
   */
  private navigateToNextEmptyValue() {
    if (!this.editor || !this.monaco) {
      return;
    }

    const model = this.editor.getModel();

    if (!model) {
      return;
    }

    try {
      const currentContent = this.editor.getValue();
      const position = this.editor.getPosition();

      if (!position) {
return;
}

      // Get current offset in the document
      const currentOffset = model.getOffsetAt(position);

      // Search for next occurrence of empty values after current position
      const patterns = ['""', '[]', '{}', 'null'];
      let nextIndex = -1;
      let cursorOffset = 1; // Default: position between quotes or brackets

      for (const pattern of patterns) {
        const index = currentContent.indexOf(pattern, currentOffset);

        if (index !== -1 && (nextIndex === -1 || index < nextIndex)) {
          nextIndex = index;
          // For null, position at the start
          cursorOffset = pattern === 'null' ? 0 : 1;
        }
      }

      if (nextIndex !== -1) {
        // Position cursor inside the empty value
        const targetPosition = model.getPositionAt(nextIndex + cursorOffset);
        this.editor.setPosition(targetPosition);
        this.editor.revealPositionInCenter(targetPosition);
        this.editor.focus();
        this.logger.debug('Navigated to next empty value at offset:', nextIndex);
      } else {
        this.logger.debug('No more empty values found');
      }
    } catch (error) {
      this.logger.error('Error navigating to next empty value:', error);
    }
  }

  /**
   * Navigate to the previous empty value in the document
   * Searches for "", [], {}, or null
   */
  private navigateToPreviousEmptyValue() {
    if (!this.editor || !this.monaco) {
      return;
    }

    const model = this.editor.getModel();

    if (!model) {
      return;
    }

    try {
      const currentContent = this.editor.getValue();
      const position = this.editor.getPosition();

      if (!position) {
return;
}

      // Get current offset in the document
      const currentOffset = model.getOffsetAt(position);

      // Search for previous occurrence of empty values before current position
      const textBeforeCursor = currentContent.substring(0, currentOffset - 1);
      const patterns = ['""', '[]', '{}', 'null'];
      let prevIndex = -1;
      let cursorOffset = 1; // Default: position between quotes or brackets

      for (const pattern of patterns) {
        const index = textBeforeCursor.lastIndexOf(pattern);

        if (index !== -1 && index > prevIndex) {
          prevIndex = index;
          // For null, position at the start
          cursorOffset = pattern === 'null' ? 0 : 1;
        }
      }

      if (prevIndex !== -1) {
        // Position cursor inside the empty value
        const targetPosition = model.getPositionAt(prevIndex + cursorOffset);
        this.editor.setPosition(targetPosition);
        this.editor.revealPositionInCenter(targetPosition);
        this.editor.focus();
        this.logger.debug('Navigated to previous empty value at offset:', prevIndex);
      } else {
        this.logger.debug('No previous empty values found');
      }
    } catch (error) {
      this.logger.error('Error navigating to previous empty value:', error);
    }
  }

  /**
   * Handle smart Enter key behavior
   * Automatically adds commas when needed after closing brackets
   */
  private handleSmartEnter(position: Monaco.Position) {
    if (!this.editor || !this.monaco) {
      return;
    }

    const model = this.editor.getModel();

    if (!model) {
      return;
    }

    try {
      const lineContent = model.getLineContent(position.lineNumber);
      const textBefore = lineContent.substring(0, position.column - 1).trim();
      const textAfter = lineContent.substring(position.column - 1).trim();

      // Check if cursor is between brackets (e.g., [█] or {█})
      if ((textBefore.endsWith('[') && textAfter.startsWith(']')) ||
          (textBefore.endsWith('{') && textAfter.startsWith('}'))) {

        // After Enter is pressed, check if comma is needed
        setTimeout(() => {
          if (!this.editor || !this.monaco) {
return;
}

          const model = this.editor.getModel();

          if (!model) {
return;
}

          const currentPos = this.editor.getPosition();

          if (!currentPos) {
return;
}

          // Check the next line (where the closing bracket moved to)
          if (currentPos.lineNumber + 1 <= model.getLineCount()) {
            const nextLineContent = model.getLineContent(currentPos.lineNumber + 1).trim();

            // Check if there's a line after the closing bracket with content
            if (currentPos.lineNumber + 2 <= model.getLineCount()) {
              const lineAfterBracket = model.getLineContent(currentPos.lineNumber + 2).trim();

              const needsComma = lineAfterBracket.length > 0 &&
                                !lineAfterBracket.startsWith(',') &&
                                !lineAfterBracket.startsWith('}') &&
                                !lineAfterBracket.startsWith(']');

              if (needsComma && (nextLineContent === ']' || nextLineContent === '}')) {
                // Add comma after the closing bracket
                const closingBracketLine = currentPos.lineNumber + 1;
                const closingBracketColumn = model.getLineContent(closingBracketLine).indexOf(nextLineContent) + 2;

                this.editor.executeEdits('auto-comma', [
                  {
                    range: new this.monaco.Range(
                      closingBracketLine,
                      closingBracketColumn,
                      closingBracketLine,
                      closingBracketColumn
                    ),
                    text: ',',
                  },
                ]);
              }
            }
          }
        }, 10);
      }
    } catch (error) {
      this.logger.error('Error in smart Enter handler:', error);
    }
  }

  /**
   * Handle comma key press with auto-formatting
   * Attempts to format JSON after comma insertion
   */
  private handleCommaKey() {
    if (!this.editor) {
      return;
    }

    try {
      const currentContent = this.editor.getValue();
      const parsed = JSON.parse(currentContent);
      const formatted = JSON.stringify(parsed, null, 2);

      // Save cursor position
      const position = this.editor.getPosition();

      // Update the editor with formatted content
      this.editor.setValue(formatted);

      // Restore cursor position (approximately)
      if (position) {
        this.editor.setPosition(position);
      }
      this.editor.focus();
    } catch {
      // JSON is incomplete, skip formatting
    }
  }
}

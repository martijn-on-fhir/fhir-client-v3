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
  @Input() readOnly: boolean = false;
  @Input() theme: string = 'vs-dark';
  @Input() autocompleteConfig?: AutocompleteConfig;

  @Output() valueChange = new EventEmitter<string>();
  @Output() altEnterPressed = new EventEmitter<{ propertyName: string; lineNumber: number }>();
  @Output() linkClicked = new EventEmitter<string>();
  @Output() codingClicked = new EventEmitter<{ system: string; code: string; display?: string }>();

  private themeService = inject(ThemeService);
  private autocompleteService = inject(AutocompleteService);
  private loggerService = inject(LoggerService);
  private logger = this.loggerService.component('MonacoEditorComponent');
  public editor: Monaco.editor.IStandaloneCodeEditor | null = null;
  public monaco: typeof Monaco | null = null;
  private initInterval: any = null;
  private completionProvider: Monaco.IDisposable | null = null;
  private linkOpener: Monaco.IDisposable | null = null;
  private isInitializing = true;
  private pendingValue: string | null = null;

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
    // Configure Monaco to load from local assets
    loader.config({
      paths: {
        vs: 'assets/monaco/vs'
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
    if (changes['value'] && !changes['value'].firstChange) {
      if (this.editor) {
        const currentValue = this.editor.getValue();

        if (currentValue !== this.value) {
          this.editor.setValue(this.value);
        }
      } else {
        // Editor not ready yet, store pending value to apply after initialization
        this.pendingValue = this.value;
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

    // Dispose link opener
    if (this.linkOpener) {
      this.linkOpener.dispose();
      this.linkOpener = null;
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

    // Use pending value if available (set via ngOnChanges before editor was ready)
    const initialValue = this.pendingValue !== null ? this.pendingValue : this.value;
    this.pendingValue = null;

    this.editor = this.monaco.editor.create(this.editorContainer.nativeElement, {
      value: initialValue,
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

    // Listen for content changes (skip during initialization to prevent overwriting restored state)
    this.editor.onDidChangeModelContent(() => {
      if (this.editor && !this.isInitializing) {
        const newValue = this.editor.getValue();
        this.valueChange.emit(newValue);
      }
    });

    // Mark initialization complete after a short delay to allow initial value to settle
    setTimeout(() => {
      this.isInitializing = false;
    }, 100);

    // Register autocomplete provider if config provided
    this.registerAutocompleteProvider();

    // Register keyboard shortcuts
    this.registerKeyboardShortcuts();

    // Register custom link opener
    this.registerLinkOpener();
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
   * Known code system URL prefixes for terminology lookup
   */
  private readonly codeSystemPrefixes = [
    'http://snomed.info/sct',
    'http://loinc.org',
    'http://unitsofmeasure.org',
    'http://hl7.org/fhir/sid/',
    'urn:oid:',
    'urn:iso:std:iso:',
    'http://terminology.hl7.org/CodeSystem/',
    'http://hl7.org/fhir/CodeSystem/'
  ];

  /**
   * Registers a custom link opener to intercept Ctrl+click on URLs
   */
  private registerLinkOpener() {

    if (!this.monaco) {
      return;
    }

    // Dispose previous link opener if exists
    if (this.linkOpener) {
      this.linkOpener.dispose();
      this.linkOpener = null;
    }

    this.linkOpener = this.monaco.editor.registerLinkOpener({
      open: (resource: Monaco.Uri) => {
        const url = decodeURIComponent(resource.toString());
        this.logger.debug('Link clicked:', url);

        // Check if this is a code system URL
        if (this.isCodeSystemUrl(url)) {
          const codingContext = this.extractCodingContext(url);

          if (codingContext) {
            this.logger.debug('Coding context found:', codingContext);
            this.codingClicked.emit(codingContext);

            return true;
          }
        }

        // Emit the URL for external handling
        this.linkClicked.emit(url);

        // Return true to indicate we handled the link (prevents default browser open)
        return true;
      }
    });
  }

  /**
   * Check if URL is a known code system URL
   */
  private isCodeSystemUrl(url: string): boolean {
    return this.codeSystemPrefixes.some(prefix => url.startsWith(prefix));
  }

  /**
   * Extract coding context (system, code, display) from the JSON content
   * when a code system URL is clicked
   */
  private extractCodingContext(systemUrl: string): { system: string; code: string; display?: string } | null {
    if (!this.editor) {
      return null;
    }

    const model = this.editor.getModel();

    if (!model) {
      return null;
    }

    const content = model.getValue();

    try {
      // Parse the JSON and find all codings
      const json = JSON.parse(content);
      const codings = this.findCodingsRecursive(json);

      // Find matching coding(s) with this system
      const matching = codings.filter(c => c.system === systemUrl);

      if (matching.length === 0) {
        this.logger.debug('No coding found with system:', systemUrl);

        return null;
      }

      // If multiple codings with same system, try to find which one was clicked
      // by looking at cursor position
      if (matching.length > 1) {
        const position = this.editor.getPosition();

        if (position) {
          const offset = model.getOffsetAt(position);
          const codingAtCursor = this.findCodingAtOffset(content, systemUrl, offset);

          if (codingAtCursor) {
            return codingAtCursor;
          }
        }
      }

      // Return the first match
      return matching[0];
    } catch (error) {
      this.logger.warn('Failed to parse JSON for coding extraction:', error);

      // Try line-based extraction as fallback
      return this.extractCodingFromLines(systemUrl);
    }
  }

  /**
   * Recursively find all coding objects in JSON
   */
  private findCodingsRecursive(obj: any, results: { system: string; code: string; display?: string }[] = []): { system: string; code: string; display?: string }[] {
    if (!obj || typeof obj !== 'object') {
      return results;
    }

    // Check if this object looks like a coding (has system and code)
    if (typeof obj.system === 'string' && typeof obj.code === 'string') {
      results.push({
        system: obj.system,
        code: obj.code,
        display: obj.display
      });
    }

    // Recurse into arrays and objects
    if (Array.isArray(obj)) {
      obj.forEach(item => this.findCodingsRecursive(item, results));
    } else {
      Object.values(obj).forEach(value => this.findCodingsRecursive(value, results));
    }

    return results;
  }

  /**
   * Find the coding object at a specific offset in the content
   */
  private findCodingAtOffset(content: string, systemUrl: string, cursorOffset: number): { system: string; code: string; display?: string } | null {
    // Find all occurrences of the system URL in the content
    const systemPattern = `"system"\\s*:\\s*"${systemUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`;
    const regex = new RegExp(systemPattern, 'g');
    let match;
    let closestMatch: { start: number; end: number } | null = null;
    let closestDistance = Infinity;

    while ((match = regex.exec(content)) !== null) {
      const distance = Math.abs(match.index - cursorOffset);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestMatch = { start: match.index, end: match.index + match[0].length };
      }
    }

    if (!closestMatch) {
      return null;
    }

    // Find the object boundaries around this system property
    // Look backwards for { and forwards for }
    let braceCount = 0;
    let objectStart = closestMatch.start;

    for (let i = closestMatch.start; i >= 0; i--) {
      if (content[i] === '}') {
        braceCount++;
      }

      if (content[i] === '{') {
        if (braceCount === 0) {
          objectStart = i;
          break;
        }
        braceCount--;
      }
    }

    braceCount = 0;
    let objectEnd = closestMatch.end;

    for (let i = closestMatch.end; i < content.length; i++) {
      if (content[i] === '{') {
        braceCount++;
      }

      if (content[i] === '}') {
        if (braceCount === 0) {
          objectEnd = i + 1;
          break;
        }
        braceCount--;
      }
    }

    // Extract and parse the object
    const objectStr = content.substring(objectStart, objectEnd);

    try {
      const obj = JSON.parse(objectStr);

      if (obj.system === systemUrl && obj.code) {
        return {
          system: obj.system,
          code: obj.code,
          display: obj.display
        };
      }
    } catch {
      // Parsing failed, continue
    }

    return null;
  }

  /**
   * Fallback: Extract coding from lines near the system URL
   */
  private extractCodingFromLines(systemUrl: string): { system: string; code: string; display?: string } | null {
    if (!this.editor) {
      return null;
    }

    const model = this.editor.getModel();

    if (!model) {
      return null;
    }

    const content = model.getValue();
    const lines = content.split('\n');

    // Find the line containing this system URL
    let systemLineIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`"${systemUrl}"`)) {
        systemLineIndex = i;
        break;
      }
    }

    if (systemLineIndex === -1) {
      return null;
    }

    // Look for code and display in nearby lines (within 5 lines)
    let code: string | undefined;
    let display: string | undefined;

    for (let i = Math.max(0, systemLineIndex - 5); i < Math.min(lines.length, systemLineIndex + 6); i++) {
      const line = lines[i];
      const codeMatch = line.match(/"code"\s*:\s*"([^"]+)"/);
      const displayMatch = line.match(/"display"\s*:\s*"([^"]+)"/);

      if (codeMatch) {
        code = codeMatch[1];
      }

      if (displayMatch) {
        display = displayMatch[1];
      }
    }

    if (code) {
      return {
        system: systemUrl,
        code,
        display
      };
    }

    return null;
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

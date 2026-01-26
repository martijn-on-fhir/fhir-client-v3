import {CommonModule} from '@angular/common';
import {Component, Input, Output, EventEmitter} from '@angular/core';
import {FormsModule} from '@angular/forms';

/**
 * JSON Viewer Toolbar Component
 *
 * Reusable toolbar for JSON viewer with search, expand/collapse controls.
 * Provides Monaco editor integration for find, format, and fold operations.
 * Supports 7 fold levels (1-7) with level 2 being maximally collapsed and level 7 fully expanded.
 */
@Component({
  selector: 'app-json-viewer-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './json-viewer-toolbar.component.html',
  styleUrls: ['./json-viewer-toolbar.component.scss']
})
export class JsonViewerToolbarComponent {

  /**
   * Monaco editor instance to control.
   * Must be passed from parent component using ViewChild reference.
   */
  @Input() editor!: any;

  /**
   * Whether the editor is in read-only mode.
   * When true, editing operations are disabled.
   * @default true
   */
  @Input() readOnly = true;

  /**
   * Whether to show the edit button.
   * Should be true for single FHIR resources, false for Bundles.
   * @default false
   */
  @Input() showEditButton = false;

  /**
   * Emitted when the edit button is clicked.
   */
  @Output() editClicked = new EventEmitter<void>();

  /**
   * Whether to show the delete button.
   * Should be true for single FHIR resources, false for Bundles.
   * @default false
   */
  @Input() showDeleteButton = false;

  /**
   * Emitted when the delete button is clicked.
   */
  @Output() deleteClicked = new EventEmitter<void>();

  /**
   * Whether to show the compare button.
   * Should be true for single FHIR resources, false for Bundles.
   * @default false
   */
  @Input() showCompareButton = false;

  /**
   * Emitted when the compare button is clicked.
   */
  @Output() compareClicked = new EventEmitter<void>();

  /**
   * Whether to show the generate narrative button.
   * @default false
   */
  @Input() generateNarrative = false;

  /**
   * Emitted when the generate narrative button is clicked.
   */
  @Output() generateNarrativeClicked = new EventEmitter<void>();

  /**
   * Current fold level of the editor (1-7).
   * Level 2 = maximally collapsed, Level 7 = fully expanded.
   * @default 7
   */
  currentLevel = 7

  /**
   * Logger instance for debugging operations.
   * @default console
   */
  private readonly logger: Console = console;

  /**
   * Collapse all JSON nodes to level 2 (maximally collapsed).
   * Sets currentLevel to 2 and folds all content except top-level properties.
   */
  collapseAll(): void {

    if (this.editor) {

      this.currentLevel = 2;
      this.editor.getAction(`editor.foldLevel2`)?.run();
    }
  }

  /**
   * Collapse one level deeper.
   * Decrements currentLevel by 1 (minimum level 2).
   * Folds more content to show less detail.
   */
  collapse(): void {

    if (this.editor && this.currentLevel > 2) {

      this.currentLevel = this.currentLevel - 1;
      this.foldToLevel(this.currentLevel);
    }
  }

  /**
   * Expand one level further.
   * Increments currentLevel by 1 (maximum level 7).
   * Unfolds content to show more detail.
   */
  expand(): void {

    if (this.editor && this.currentLevel < 7) {

      this.currentLevel = this.currentLevel + 1;
      this.foldToLevel(this.currentLevel);
    }
  }

  /**
   * Expand all JSON nodes to level 7 (fully expanded).
   * Shows all content without any folding.
   * Sets currentLevel to 7.
   */
  expandAll(): void {

    if (this.editor) {
      this.editor.getAction('editor.unfoldAll')?.run();
      this.currentLevel = 7;
    }
  }

  /**
   * Format the JSON document.
   * Applies Monaco's formatDocument action to properly indent and structure the JSON.
   * Only available when editor is not in read-only mode.
   */
  format(): void {

    if (this.editor) {
      this.editor.getAction('editor.action.formatDocument').run();
    }
  }

  /**
   * Open the find/search dialog in the editor.
   * Triggers Monaco's built-in find widget for searching within the JSON content.
   */
  search() {

    if (this.editor) {
      this.editor.getAction('actions.find').run();
    }
  }

  /**
   * Fold the JSON content to a specific level.
   * Uses Monaco's fold actions to collapse nested structures.
   *
   * @param level - Target fold level (2-7)
   * Level 2: Maximally collapsed (only top-level visible)
   * Level 7: Fully expanded (all content visible)
   * Intermediate levels: Progressive detail visibility
   *
   * Implementation note: Uses setTimeout to ensure proper fold sequence
   * when transitioning between levels. First unfolds all, then folds to target level.
   */
  foldToLevel(level: number): void {

    if (!this.editor) {
      return;
    }

    if (level <= 2) {

      this.currentLevel = 2;
      this.editor.getAction('editor.unfoldAll')?.run();

      setTimeout(() => {
        this.editor.getAction('editor.foldLevel2')?.run();
      }, 10);

    } else if (level >= 7) {

      this.currentLevel = 7;
      this.editor.getAction('editor.unfoldAll')?.run();

    } else {

      this.editor.getAction('editor.unfoldAll')?.run();

      setTimeout(() => {
        this.editor.getAction(`editor.foldLevel${level}`)?.run();
      }, 10);
    }
  }

  /**
   * Save the current content to a file.
   * Retrieves content from Monaco editor and triggers Electron save file dialog.
   * Supports JSON (formatted) and XML/other formats (as-is).
   */
  async save(): Promise<void> {
    if (!this.editor) {
      this.logger.warn('No editor available for save operation');

      return;
    }

    try {
      // Get content from Monaco editor
      const content = this.editor.getValue();

      if (!content || content.trim() === '') {
        this.logger.warn('No content to save');

        return;
      }

      // Type guard for window.electronAPI
      if (!window.electronAPI?.file?.saveFile) {
        this.logger.error('File API not available');
        alert('File save functionality is not available');

        return;
      }

      // Get the editor's language to determine format
      const model = this.editor.getModel();
      const language = model?.getLanguageId() || 'json';

      let finalContent = content;
      let defaultFilename = 'export.txt';

      // Format based on language
      if (language === 'json') {
        try {
          // Format JSON with pretty-print
          finalContent = JSON.stringify(JSON.parse(content), null, 2);
          defaultFilename = 'export.json';
        } catch {
          // If JSON parse fails, save as-is
          this.logger.warn('Could not parse JSON, saving as-is');
        }
      } else if (language === 'xml') {
        defaultFilename = 'export.xml';
      }

      // Trigger Electron save file dialog
      await window.electronAPI.file.saveFile(finalContent, defaultFilename);

    } catch (error) {
      this.logger.error('Failed to save file:', error);
      alert('Failed to save file.');
    }
  }

  /**
   * Load content from a file.
   * Opens Electron file dialog and loads content into Monaco editor.
   * Supports both JSON and XML formats based on editor language.
   * Only available for editable editors (readOnly = false).
   */
  async load(): Promise<void> {
    if (this.readOnly) {
      this.logger.warn('Cannot load into read-only editor');
      alert('This editor is read-only. Switch to Validator or Pluriform tab to load files.');

      return;
    }

    // Retry mechanism for async Monaco editor loading
    if (!this.editor) {
      this.logger.warn('Editor not yet available, waiting...');

      // Wait a bit and retry
      await new Promise(resolve => setTimeout(resolve, 300));

      if (!this.editor) {
        this.logger.error('No editor available after retry');
        alert('Editor is not yet loaded. Please wait a moment and try again.');

        return;
      }
    }

    try {
      // Type guard for window.electronAPI
      if (!window.electronAPI?.file?.openFile) {
        this.logger.error('File API not available');
        alert('File open functionality is not available');

        return;
      }

      // Trigger Electron open file dialog
      const result = await window.electronAPI.file.openFile();

      if (result && !('error' in result)) {
        // Get the editor's language to determine validation type
        const model = this.editor.getModel();
        const language = model?.getLanguageId() || 'json';

        // Validate content based on language
        if (language === 'json') {
          // Validate JSON
          JSON.parse(result.content);
        } else if (language === 'xml') {
          // Basic XML validation - check if it looks like XML
          if (!result.content.trim().startsWith('<')) {
            throw new Error('File does not appear to contain valid XML');
          }
        }

        // Set content in Monaco editor
        this.editor.setValue(result.content);

        this.logger.info('File loaded successfully');
      }

    } catch (error) {
      this.logger.error('Failed to load file:', error);
      const model = this.editor?.getModel();
      const language = model?.getLanguageId() || 'json';
      const expectedFormat = language === 'xml' ? 'XML' : 'JSON';
      alert(`Failed to load file. Please check that the file contains valid ${expectedFormat}.`);
    }
  }
}

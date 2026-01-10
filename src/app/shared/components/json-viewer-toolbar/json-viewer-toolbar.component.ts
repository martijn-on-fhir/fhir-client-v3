import {CommonModule} from '@angular/common';
import {Component, Input} from '@angular/core';
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
   * Save the current JSON content.
   * Placeholder method for future save functionality.
   * Currently logs save action to console.
   */
  save(): void {
    this.logger.info('save')
  }

  /**
   * Load JSON content from external source.
   * Placeholder method for future load functionality.
   * Currently logs load action to console.
   */
  load(): void {
    this.logger.info('load')
  }
}

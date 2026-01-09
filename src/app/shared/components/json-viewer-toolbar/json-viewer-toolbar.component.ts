import {CommonModule} from '@angular/common';
import {Component, Input, Output, EventEmitter, WritableSignal} from '@angular/core';
import {FormsModule} from '@angular/forms';

/**
 * JSON Viewer Toolbar Component
 * Editor heeft zoom levels van 1 tot 7. dit wordt bepaald door de editor
 *
 * Reusable toolbar for JSON viewer with search, expand/collapse controls
 */
@Component({
  selector: 'app-json-viewer-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './json-viewer-toolbar.component.html',
  styleUrls: ['./json-viewer-toolbar.component.scss']
})
export class JsonViewerToolbarComponent {
  
  @Input() editor!: any;

  currentLevel = 7

  collapseAll(): void {

    if (this.editor) {

      this.currentLevel = 2;
      this.editor.getAction(`editor.foldLevel2`)?.run();
    }
  }

  collapse(): void {

    if (this.editor && this.currentLevel > 2) {

      this.currentLevel = this.currentLevel - 1;
      this.foldToLevel(this.currentLevel);
    }
  }

  expand(): void {

    if (this.editor && this.currentLevel < 7) {

      this.currentLevel = this.currentLevel + 1;
      this.foldToLevel(this.currentLevel);
    }
  }

  expandAll(): void {

    if (this.editor) {
      this.editor.getAction('editor.unfoldAll')?.run();
      this.currentLevel = 7;
    }
  }

  format(): void {

    if (this.editor) {
      this.editor.getAction('editor.action.formatDocument').run();
    }
  }

  /**
   * Toggle search visibility
   */
  search() {

    if (this.editor) {
      this.editor.getAction('actions.find').run();
    }
  }

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
}

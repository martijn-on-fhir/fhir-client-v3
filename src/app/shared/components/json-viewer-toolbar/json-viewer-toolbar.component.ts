import { Component, Input, Output, EventEmitter, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * JSON Viewer Toolbar Component
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
  // Inputs
  @Input() collapsedLevel!: WritableSignal<number | false>;
  @Input() showSearch!: WritableSignal<boolean>;
  @Input() searchTerm!: WritableSignal<string>;

  // Outputs
  @Output() expandOneLevel = new EventEmitter<void>();
  @Output() collapseOneLevel = new EventEmitter<void>();
  @Output() expandAll = new EventEmitter<void>();
  @Output() collapseAll = new EventEmitter<void>();

  /**
   * Toggle search visibility
   */
  toggleSearch() {
    this.showSearch.set(!this.showSearch());
  }

  /**
   * Clear search term and hide search input
   */
  clearSearch() {
    this.searchTerm.set('');
    this.showSearch.set(false);
  }

  /**
   * Check if collapse one level is disabled
   */
  isCollapseDisabled(): boolean {
    const level = this.collapsedLevel();
    return typeof level === 'number' && level >= 10;
  }

  /**
   * Check if expand one level is disabled
   */
  isExpandDisabled(): boolean {
    return this.collapsedLevel() === false;
  }
}

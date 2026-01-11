import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, signal, inject, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LoggerService } from '../../core/services/logger.service';
import { ThemeService } from '../../core/services/theme.service';
import { MonacoEditorComponent } from '../../shared/components/monaco-editor/monaco-editor.component';
import {ResultHeaderComponent} from '../../shared/components/result-header/result-header.component';

/**
 * Pluriform Tab Component
 *
 * Provides a dual-editor interface for data transformation and comparison.
 *
 * Features:
 * - Dual Monaco editors with split-panel layout
 * - Resizable editor panels (20-80% width range)
 * - File loading via Electron file API
 * - Data transformation between left and right editors
 * - Theme-aware editor styling
 *
 * Note: Transformation logic is currently a placeholder for future implementation.
 */
@Component({
  selector: 'app-pluriform',
  standalone: true,
  imports: [CommonModule, FormsModule, MonacoEditorComponent, ResultHeaderComponent],
  templateUrl: './pluriform.component.html',
  styleUrl: './pluriform.component.scss'
})
export class PluriformComponent implements OnInit, OnDestroy {

  /** Reference to left Monaco editor component */
  @ViewChild('leftEditor') leftEditor?: MonacoEditorComponent;

  /** Reference to right Monaco editor component */
  @ViewChild('rightEditor') rightEditor?: MonacoEditorComponent;

  /** Error message from file operations or transformation */
  error = signal<string | null>(null);

  /** Loading state during transformation operations */
  loading = signal<boolean>(false);

  /** Width percentage of left panel in split view */
  leftWidth = signal<number>(50);

  /** Whether panel resize is in progress */
  isResizing = signal<boolean>(false);

  /** Content displayed in left Monaco editor */
  leftContent = signal<string>('');

  /** Content displayed in right Monaco editor (transformation result) */
  rightContent = signal<string>('');

  /** Mouse move event handler for panel resizing */
  private mouseMoveHandler?: (e: MouseEvent) => void;

  /** Mouse up event handler for panel resizing */
  private mouseUpHandler?: () => void;

  /** Cleanup function for Electron file open event listener */
  private fileOpenCleanup?: () => void;

  /** Service for application logging */
  private loggerService = inject(LoggerService);

  /** Component-specific logger instance */
  private logger = this.loggerService.component('PluriformComponent');

  /**
   * Creates an instance of PluriformComponent
   *
   * @param themeService - Service for managing application theme (light/dark mode)
   */
  constructor(public themeService: ThemeService) {}

  /**
   * Angular lifecycle hook called on component initialization
   *
   * Sets up event listener for file open events from Electron main process.
   * When a file open is triggered, delegates to handleOpenFile method.
   */
  ngOnInit() {
    if (window.electronAPI?.onOpenFile) {
      this.fileOpenCleanup = window.electronAPI.onOpenFile(async () => {
        await this.handleOpenFile();
      });
    }
  }

  /**
   * Angular lifecycle hook called on component destruction
   *
   * Cleans up event listeners and unregisters Electron file open handler.
   */
  ngOnDestroy() {
    this.cleanup();

    if (this.fileOpenCleanup) {
      this.fileOpenCleanup();
    }
  }

  /**
   * Handles file open operation via Electron file API
   *
   * Opens a file dialog and loads the selected file content into the left editor.
   * Updates leftContent signal with file content on success, or sets error message on failure.
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
        this.leftContent.set(result.content);
        this.error.set(null);
      }
    }
  }

  /**
   * Executes transformation from left editor content to right editor
   *
   * Placeholder implementation that currently copies left content to right editor.
   * Sets loading state during operation and error state on failure.
   *
   * @returns Promise that resolves when transformation completes
   */
  async transform() {
    this.loading.set(true);
    this.error.set(null);

    try {
      this.rightContent.set(this.leftContent());
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      this.loading.set(false);
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

    const container = document.getElementById('pluriform-results-container');

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

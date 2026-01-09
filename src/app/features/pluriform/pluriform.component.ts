import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, signal, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
// eslint-disable-next-line @typescript-eslint/naming-convention
import Prism from 'prismjs';
import { LoggerService } from '../../core/services/logger.service';
import { ThemeService } from '../../core/services/theme.service';
import 'prismjs/components/prism-markup';

@Component({
  selector: 'app-pluriform',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pluriform.component.html',
  styleUrl: './pluriform.component.scss'
})
export class PluriformComponent implements OnInit, OnDestroy {
  error = signal<string | null>(null);
  loading = signal<boolean>(false);
  leftWidth = signal<number>(50); // percentage
  isResizing = signal<boolean>(false);
  leftContent = signal<string>('Open an XML file to get started.');
  rightContent = signal<string>('');
  highlightedCode = signal<string>('');

  private mouseMoveHandler?: (e: MouseEvent) => void;
  private mouseUpHandler?: () => void;
  private fileOpenCleanup?: () => void;
  private loggerService = inject(LoggerService);
  private logger = this.loggerService.component('PluriformComponent');

  constructor(public themeService: ThemeService) {
    // Update highlighted code whenever left content changes
    effect(() => {
      const code = this.leftContent();
      this.highlightedCode.set(this.highlightCode(code));
    });
  }

  ngOnInit() {
    // Listen for file open events from Electron
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

  /**
   * Highlight code using PrismJS
   */
  private highlightCode(code: string): string {
    try {
      return Prism.highlight(code, Prism.languages['markup'], 'markup');
    } catch (error) {
      this.logger.error('Error highlighting code:', error);

      return code;
    }
  }

  /**
   * Handle file open from Electron
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
   * Execute transformation (placeholder for future implementation)
   */
  async transform() {
    this.loading.set(true);
    this.error.set(null);

    try {
      // TODO: Implement transformation logic
      // For now, just copy left content to right
      this.rightContent.set(this.leftContent());
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Start resizing panels
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
   * Handle panel resize
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
   * Stop resizing panels
   */
  private stopResizing() {
    this.isResizing.set(false);
    this.cleanup();
  }

  /**
   * Cleanup event listeners
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

  /**
   * Handle left content changes from textarea
   */
  onLeftContentChange(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    this.leftContent.set(target.value);
  }

  /**
   * Get editor background color based on theme
   */
  getEditorBgColor(): string {
    return this.themeService.currentTheme() === 'dark' ? '#2d2d30' : '#ffffff';
  }

  /**
   * Get editor text color based on theme
   */
  getEditorTextColor(): string {
    return this.themeService.currentTheme() === 'dark' ? '#d4d4d4' : '#000000';
  }
}

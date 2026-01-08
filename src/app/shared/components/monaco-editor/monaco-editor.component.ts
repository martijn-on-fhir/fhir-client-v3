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
import { CommonModule } from '@angular/common';
import loader from '@monaco-editor/loader';
import type * as Monaco from 'monaco-editor';
import { ThemeService } from '../../../core/services/theme.service';

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

  @Output() valueChange = new EventEmitter<string>();

  private themeService = inject(ThemeService);
  private editor: Monaco.editor.IStandaloneCodeEditor | null = null;
  private monaco: typeof Monaco | null = null;

  isDarkMode = computed(() => this.themeService.currentTheme() === 'dark');

  constructor() {
    // React to theme changes
    effect(() => {
      const theme = this.isDarkMode() ? 'vs-dark' : 'vs';
      if (this.editor && this.monaco) {
        this.monaco.editor.setTheme(theme);
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
      console.error('Monaco failed to load:', error);
    }
  }

  ngAfterViewInit() {
    // Wait for Monaco to load, then initialize editor
    if (this.monaco) {
      this.initMonaco();
    } else {
      // Monaco not loaded yet, wait for it
      const interval = setInterval(() => {
        if (this.monaco) {
          clearInterval(interval);
          this.initMonaco();
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
  }

  ngOnDestroy() {
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
  }
}

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
import * as monaco from 'monaco-editor';
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
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;

  isDarkMode = computed(() => this.themeService.currentTheme() === 'dark');

  constructor() {
    // React to theme changes
    effect(() => {
      const theme = this.isDarkMode() ? 'vs-dark' : 'vs';
      if (this.editor) {
        monaco.editor.setTheme(theme);
      }
    });
  }

  ngOnInit() {
    // TODO: Enable Monaco workers for advanced features (color decorators, format on type, etc.)
    // Current Issues:
    // 1. CSP: Workers need 'worker-src blob: data:' and 'script-src unsafe-eval'
    // 2. Module Workers: Monaco uses importScripts() which fails with module workers
    // 3. Asset Serving: Workers need proper bundling in angular.json or CDN loading
    //
    // Possible Solutions:
    // - Configure Monaco worker assets in angular.json
    // - Use @monaco-editor/react wrapper like v2 (C:\projects\fhir-client-v2\src\components\resource-editor\ResourceEditorDialog.tsx)
    // - Properly configure getWorkerUrl to serve worker files
    //
    // For now: Stub worker prevents postMessage errors while keeping editor functional for read-only JSON
    (self as any).MonacoEnvironment = {
      getWorker: function () {
        // Return a stub worker object instead of null
        return {
          postMessage: () => {},
          terminate: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
          onerror: null,
          onmessage: null,
          onmessageerror: null
        };
      }
    };
  }

  ngAfterViewInit() {
    this.initMonaco();
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

  private initMonaco() {
    if (!this.editorContainer) {
      return;
    }

    const currentTheme = this.isDarkMode() ? 'vs-dark' : 'vs';

    this.editor = monaco.editor.create(this.editorContainer.nativeElement, {
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
      // Disable all features that require workers
      colorDecorators: false,
      links: false,
      formatOnPaste: false,
      formatOnType: false
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

import { Injectable } from '@angular/core';
import loader from '@monaco-editor/loader';
// eslint-disable-next-line @typescript-eslint/naming-convention
import type * as Monaco from 'monaco-editor';

/**
 * Singleton service for loading Monaco editor.
 *
 * Ensures Monaco is only initialized once across all editor component instances,
 * preventing duplicate loading and reducing memory usage.
 */
@Injectable({ providedIn: 'root' })
export class MonacoLoaderService {
  private monacoPromise: Promise<typeof Monaco> | null = null;
  private monacoInstance: typeof Monaco | null = null;

  /**
   * Load Monaco editor. Returns cached instance if already loaded.
   */
  loadMonaco(): Promise<typeof Monaco> {
    if (this.monacoInstance) {
      return Promise.resolve(this.monacoInstance);
    }

    if (!this.monacoPromise) {
      loader.config({
        paths: {
          vs: 'assets/monaco/vs'
        }
      });

      this.monacoPromise = loader.init().then(monaco => {
        this.monacoInstance = monaco;
        return monaco;
      });
    }

    return this.monacoPromise;
  }

  /**
   * Get Monaco instance if already loaded, null otherwise.
   */
  getMonaco(): typeof Monaco | null {
    return this.monacoInstance;
  }

  /**
   * Check if Monaco is loaded.
   */
  isLoaded(): boolean {
    return this.monacoInstance !== null;
  }
}

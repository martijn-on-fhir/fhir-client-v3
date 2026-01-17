import { Injectable, signal, computed } from '@angular/core';

/**
 * Predefined State Service
 *
 * Persists predefined query component state across tab navigation.
 * Stores query results and current query in memory.
 */
@Injectable({
  providedIn: 'root'
})
export class PredefinedStateService {

  // Query result state
  private resultSignal = signal<any>(null);

  // Current query being executed
  private currentQuerySignal = signal<string>('');

  /**
   * Read-only computed for query result
   */
  readonly result = computed(() => this.resultSignal());

  /**
   * Read-only computed for current query
   */
  readonly currentQuery = computed(() => this.currentQuerySignal());

  /**
   * Store query result
   */
  setResult(result: any, query?: string) {
    this.resultSignal.set(result);

    if (query !== undefined) {
      this.currentQuerySignal.set(query);
    }
  }

  /**
   * Clear query result
   */
  clearResult() {
    this.resultSignal.set(null);
    this.currentQuerySignal.set('');
  }

  /**
   * Check if there's a stored result
   */
  hasResult(): boolean {
    return this.resultSignal() !== null;
  }
}

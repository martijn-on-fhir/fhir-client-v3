import { Injectable, signal, computed } from '@angular/core';

/**
 * Query State Service
 *
 * Persists query component state across tab navigation.
 * Stores query results and other transient state in memory
 * so it survives component destruction during routing.
 */
@Injectable({
  providedIn: 'root'
})
export class QueryStateService {

  // Query result state
  private resultSignal = signal<any>(null);
  private resultTimestampSignal = signal<Date | null>(null);
  private executionTimeSignal = signal<number | null>(null);
  private responseSizeSignal = signal<number | null>(null);

  // Query mode state
  private queryModeSignal = signal<'text' | 'visual'>('text');

  // Pagination state
  private currentPageSignal = signal<number>(1);

  /**
   * Read-only computed for query result
   */
  readonly result = computed(() => this.resultSignal());

  /**
   * Read-only computed for result timestamp
   */
  readonly resultTimestamp = computed(() => this.resultTimestampSignal());

  /**
   * Read-only computed for execution time
   */
  readonly executionTime = computed(() => this.executionTimeSignal());

  /**
   * Read-only computed for response size in bytes
   */
  readonly responseSize = computed(() => this.responseSizeSignal());

  /**
   * Read-only computed for query mode
   */
  readonly queryMode = computed(() => this.queryModeSignal());

  /**
   * Read-only computed for current page
   */
  readonly currentPage = computed(() => this.currentPageSignal());

  /**
   * Store query result with metadata
   */
  setResult(result: any, executionTime?: number, responseSize?: number) {
    this.resultSignal.set(result);
    this.resultTimestampSignal.set(new Date());

    if (executionTime !== undefined) {
      this.executionTimeSignal.set(executionTime);
    }

    if (responseSize !== undefined) {
      this.responseSizeSignal.set(responseSize);
    }
  }

  /**
   * Clear query result
   */
  clearResult() {
    this.resultSignal.set(null);
    this.resultTimestampSignal.set(null);
    this.executionTimeSignal.set(null);
    this.responseSizeSignal.set(null);
  }

  /**
   * Set query mode (text or visual)
   */
  setQueryMode(mode: 'text' | 'visual') {
    this.queryModeSignal.set(mode);
  }

  /**
   * Set current page for pagination
   */
  setCurrentPage(page: number) {
    this.currentPageSignal.set(page);
  }

  /**
   * Check if there's a stored result
   */
  hasResult(): boolean {
    return this.resultSignal() !== null;
  }
}

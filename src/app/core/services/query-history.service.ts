import { Injectable, signal, computed } from '@angular/core';

/**
 * Query execution metrics
 */
export interface QueryMetrics {
  executionTime: number;    // Total execution time in ms
  responseSize?: number;    // Response size in bytes
}

/**
 * Query History Entry
 */
export interface QueryHistoryEntry {
  query: string;
  timestamp: number;
  mode?: 'text' | 'visual';
  metrics?: QueryMetrics;
}

/**
 * Query History Service
 *
 * Manages query execution history with navigation support.
 * Persists history to localStorage for cross-session availability.
 */
@Injectable({
  providedIn: 'root'
})
export class QueryHistoryService {
  private readonly STORAGE_KEY = 'fhir_query_history';
  private readonly MAX_HISTORY_SIZE = 50;

  // History state
  private queries = signal<QueryHistoryEntry[]>([]);
  private currentIndex = signal<number>(-1);

  // Computed navigation state
  canNavigateBack = computed(() => this.currentIndex() > 0);
  canNavigateForward = computed(() => {
    const index = this.currentIndex();
    const length = this.queries().length;
    return index >= 0 && index < length - 1;
  });

  constructor() {
    this.loadHistory();
  }

  /**
   * Add a query to history
   */
  addQuery(query: string, mode: 'text' | 'visual' = 'text', metrics?: QueryMetrics): void {
    if (!query || !query.trim()) {
      return;
    }

    const trimmedQuery = query.trim();
    const currentQueries = this.queries();

    // Don't add duplicate if it's the same as the current query
    const currentQuery = this.getCurrentQuery();
    if (currentQuery === trimmedQuery) {
      return;
    }

    // Create new entry
    const entry: QueryHistoryEntry = {
      query: trimmedQuery,
      timestamp: Date.now(),
      mode,
      metrics
    };

    // If we're in the middle of history, remove everything after current position
    const newIndex = this.currentIndex() + 1;
    const newQueries = currentQueries.slice(0, newIndex);

    // Add new query
    newQueries.push(entry);

    // Enforce max size
    if (newQueries.length > this.MAX_HISTORY_SIZE) {
      newQueries.shift(); // Remove oldest
    }

    // Update state
    this.queries.set(newQueries);
    this.currentIndex.set(newQueries.length - 1);

    // Persist
    this.saveHistory();
  }

  /**
   * Navigate to previous query
   */
  navigateBack(): string | null {
    if (!this.canNavigateBack()) {
      return null;
    }

    this.currentIndex.update(i => i - 1);
    return this.getCurrentQuery();
  }

  /**
   * Navigate to next query
   */
  navigateForward(): string | null {
    if (!this.canNavigateForward()) {
      return null;
    }

    this.currentIndex.update(i => i + 1);
    return this.getCurrentQuery();
  }

  /**
   * Get current query
   */
  getCurrentQuery(): string | null {
    const index = this.currentIndex();
    const queries = this.queries();

    if (index >= 0 && index < queries.length) {
      return queries[index].query;
    }

    return null;
  }

  /**
   * Get current query entry
   */
  getCurrentEntry(): QueryHistoryEntry | null {
    const index = this.currentIndex();
    const queries = this.queries();

    if (index >= 0 && index < queries.length) {
      return queries[index];
    }

    return null;
  }

  /**
   * Get all history
   */
  getHistory(): QueryHistoryEntry[] {
    return this.queries();
  }

  /**
   * Get history count
   */
  getHistoryCount(): number {
    return this.queries().length;
  }

  /**
   * Clear all history
   */
  clearHistory(): void {
    this.queries.set([]);
    this.currentIndex.set(-1);
    this.saveHistory();
  }

  /**
   * Load history from localStorage
   */
  private loadHistory(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);

        if (Array.isArray(data.queries)) {
          this.queries.set(data.queries);
          this.currentIndex.set(data.currentIndex ?? data.queries.length - 1);
        }
      }
    } catch (error) {
      console.error('Failed to load query history:', error);
      this.queries.set([]);
      this.currentIndex.set(-1);
    }
  }

  /**
   * Save history to localStorage
   */
  private saveHistory(): void {
    try {
      const data = {
        queries: this.queries(),
        currentIndex: this.currentIndex()
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save query history:', error);
    }
  }
}

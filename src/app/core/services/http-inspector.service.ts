import { Injectable, signal, computed } from '@angular/core';

/**
 * HTTP Request/Response inspection data
 */
export interface HttpInspection {
  id: string;
  timestamp: Date;

  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
  };

  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body?: any;
  } | null;

  timing: {
    startTime: number;
    endTime: number;
    duration: number;
  };

  size: {
    requestSize: number;
    responseSize: number;
  };

  error?: boolean;
}

/**
 * HTTP Inspector Service
 *
 * Captures and stores HTTP request/response details for debugging.
 * Used by the HTTP Inspector interceptor and dialog.
 */
@Injectable({
  providedIn: 'root'
})
export class HttpInspectorService {
  private readonly MAX_HISTORY = 50;

  private historySignal = signal<HttpInspection[]>([]);
  private currentSignal = signal<HttpInspection | null>(null);

  /**
   * Read-only access to request history
   */
  readonly history = computed(() => this.historySignal());

  /**
   * Read-only access to current/latest request
   */
  readonly current = computed(() => this.currentSignal());

  /**
   * Record a new HTTP request/response
   */
  record(inspection: HttpInspection): void {
    this.currentSignal.set(inspection);
    this.historySignal.update(history => {
      const updated = [inspection, ...history];
      if (updated.length > this.MAX_HISTORY) {
        updated.pop();
      }
      return updated;
    });
  }

  /**
   * Get the most recent inspection
   */
  getCurrent(): HttpInspection | null {
    return this.currentSignal();
  }

  /**
   * Clear all history
   */
  clearHistory(): void {
    this.historySignal.set([]);
    this.currentSignal.set(null);
  }

  /**
   * Generate a unique ID for each request
   */
  generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

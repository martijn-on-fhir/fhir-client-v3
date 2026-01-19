import { Injectable, signal, computed } from '@angular/core';

/**
 * FHIRPath State Service
 *
 * Persists FHIRPath component state across tab navigation.
 * Stores JSON input content, expression, and evaluation results in memory.
 */
@Injectable({
  providedIn: 'root'
})
export class FhirpathStateService {

  // JSON input content
  private jsonInputSignal = signal<string>('');

  // FHIRPath expression
  private expressionSignal = signal<string>('');

  // Evaluation result
  private resultSignal = signal<any>(null);

  /**
   * Read-only computed for JSON input
   */
  readonly jsonInput = computed(() => this.jsonInputSignal());

  /**
   * Read-only computed for expression
   */
  readonly expression = computed(() => this.expressionSignal());

  /**
   * Read-only computed for result
   */
  readonly result = computed(() => this.resultSignal());

  /**
   * Store all state at once
   */
  setState(jsonInput: string, expression: string, result: any) {
    this.jsonInputSignal.set(jsonInput);
    this.expressionSignal.set(expression);
    this.resultSignal.set(result);
  }

  /**
   * Clear all state
   */
  clearState() {
    this.jsonInputSignal.set('');
    this.expressionSignal.set('');
    this.resultSignal.set(null);
  }

  /**
   * Check if there's stored content
   */
  hasContent(): boolean {
    return this.jsonInputSignal().length > 0 || this.expressionSignal().length > 0;
  }
}

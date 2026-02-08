import { Injectable, signal, computed } from '@angular/core';

/**
 * Validator State Service
 *
 * Persists validator component state across tab navigation.
 * Stores JSON input content and validation results in memory.
 */
@Injectable({
  providedIn: 'root'
})
export class ValidatorStateService {

  // JSON input content
  private jsonInputSignal = signal<string>('');

  // Validation result
  private validationResultSignal = signal<any>(null);

  // Selected profile
  private selectedProfileSignal = signal<string>('auto-detect');

  /**
   * Read-only computed for JSON input
   */
  readonly jsonInput = computed(() => this.jsonInputSignal());

  /**
   * Read-only computed for validation result
   */
  readonly validationResult = computed(() => this.validationResultSignal());

  /**
   * Read-only computed for selected profile
   */
  readonly selectedProfile = computed(() => this.selectedProfileSignal());

  /**
   * Store JSON input content
   */
  setJsonInput(content: string) {
    this.jsonInputSignal.set(content);
  }

  /**
   * Store validation result
   */
  setValidationResult(result: any) {
    this.validationResultSignal.set(result);
  }

  /**
   * Store selected profile
   */
  setSelectedProfile(profile: string) {
    this.selectedProfileSignal.set(profile);
  }

  /**
   * Store all state at once
   */
  setState(jsonInput: string, validationResult: any, selectedProfile: string) {
    this.jsonInputSignal.set(jsonInput);
    this.validationResultSignal.set(validationResult);
    this.selectedProfileSignal.set(selectedProfile);
  }

  /**
   * Clear all state
   */
  clearState() {
    this.jsonInputSignal.set('');
    this.validationResultSignal.set(null);
    this.selectedProfileSignal.set('auto-detect');
  }

  /**
   * Check if there's stored content
   */
  hasContent(): boolean {
    return this.jsonInputSignal().length > 0;
  }
}

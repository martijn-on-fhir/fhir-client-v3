import { Injectable, signal, computed } from '@angular/core';

/**
 * Operation type for terminology operations
 */
type OperationType = 'lookup' | 'expand' | 'validate-code' | 'translate';

/**
 * Terminology State Service
 *
 * Persists terminology component state across tab navigation.
 * Stores operation results and parameters in memory.
 */
@Injectable({
  providedIn: 'root'
})
export class TerminologyStateService {

  // Operation result state
  private resultSignal = signal<any>(null);

  // Current operation type
  private operationSignal = signal<OperationType>('lookup');

  // Lookup parameters
  private lookupSystemSignal = signal<string>('http://snomed.info/sct');
  private lookupCodeSignal = signal<string>('73211009');

  /**
   * Read-only computed for operation result
   */
  readonly result = computed(() => this.resultSignal());

  /**
   * Read-only computed for operation type
   */
  readonly operation = computed(() => this.operationSignal());

  /**
   * Read-only computed for lookup system
   */
  readonly lookupSystem = computed(() => this.lookupSystemSignal());

  /**
   * Read-only computed for lookup code
   */
  readonly lookupCode = computed(() => this.lookupCodeSignal());

  /**
   * Store operation result
   */
  setResult(result: any) {
    this.resultSignal.set(result);
  }

  /**
   * Store operation type
   */
  setOperation(operation: OperationType) {
    this.operationSignal.set(operation);
  }

  /**
   * Store lookup parameters
   */
  setLookupParams(system: string, code: string) {
    this.lookupSystemSignal.set(system);
    this.lookupCodeSignal.set(code);
  }

  /**
   * Clear operation result
   */
  clearResult() {
    this.resultSignal.set(null);
  }

  /**
   * Check if there's a stored result
   */
  hasResult(): boolean {
    return this.resultSignal() !== null;
  }
}

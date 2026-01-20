import { Injectable, signal, computed } from '@angular/core';

/**
 * Pluriform State Service
 *
 * Persists Pluriform component state across tab navigation.
 * Stores left editor (XML input) and right editor (JSON output) content in memory.
 */
@Injectable({
  providedIn: 'root'
})
export class PluriformStateService {

  // Left editor content (XML input)
  private leftContentSignal = signal<string>('');

  // Right editor content (JSON output)
  private rightContentSignal = signal<string>('');

  /**
   * Read-only computed for left editor content
   */
  readonly leftContent = computed(() => this.leftContentSignal());

  /**
   * Read-only computed for right editor content
   */
  readonly rightContent = computed(() => this.rightContentSignal());

  /**
   * Store all state at once
   */
  setState(leftContent: string, rightContent: string) {
    this.leftContentSignal.set(leftContent);
    this.rightContentSignal.set(rightContent);
  }

  /**
   * Clear all state
   */
  clearState() {
    this.leftContentSignal.set('');
    this.rightContentSignal.set('');
  }

  /**
   * Check if there's stored content
   */
  hasContent(): boolean {
    return this.leftContentSignal().length > 0 || this.rightContentSignal().length > 0;
  }
}

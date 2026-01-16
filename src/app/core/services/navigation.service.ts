import { Injectable, signal, computed } from '@angular/core';

/**
 * Navigation Service
 *
 * Facilitates communication between components for navigation events
 * Used to trigger actions like opening query tab with a specific resource
 */
@Injectable({
  providedIn: 'root'
})
export class NavigationService {

  // Signal for query navigation events
  private queryNavigationEventSignal = signal<{ resource: string; mode: 'text' | 'visual' } | null>(null);

  // Signal for edit resource events (opens resource editor dialog)
  private editResourceEventSignal = signal<{ resource: any } | null>(null);

  /**
   * Read-only computed signal for query navigation events
   */
  readonly queryNavigationEvent = computed(() => this.queryNavigationEventSignal());

  /**
   * Read-only computed signal for edit resource events
   */
  readonly editResourceEvent = computed(() => this.editResourceEventSignal());

  /**
   * Navigate to query tab with a specific resource
   */
  navigateToQuery(resource: string, mode: 'text' | 'visual' = 'text') {
    this.queryNavigationEventSignal.set({ resource, mode });
  }

  /**
   * Clear the navigation event after it's been handled
   */
  clearQueryNavigationEvent() {
    this.queryNavigationEventSignal.set(null);
  }

  /**
   * Open resource editor dialog with given resource
   */
  openResourceEditor(resource: any) {
    this.editResourceEventSignal.set({ resource });
  }

  /**
   * Clear the edit resource event after it's been handled
   */
  clearEditResourceEvent() {
    this.editResourceEventSignal.set(null);
  }
}

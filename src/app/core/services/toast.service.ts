import { Injectable, signal, computed } from '@angular/core';
import { Toast, ToastConfig, ToastType } from '../models/toast.model';

/**
 * Global toast notification service
 *
 * Manages a queue of toast notifications that can be displayed globally throughout the application.
 * Uses Angular Signals for reactive state management.
 *
 * @example
 * ```typescript
 * export class MyComponent {
 *   private toastService = inject(ToastService);
 *
 *   saveData() {
 *     this.toastService.success('Data saved successfully');
 *     this.toastService.error('Failed to save', 'Error');
 *     this.toastService.warning('Action cannot be undone', 'Warning', 7000);
 *     this.toastService.info('Processing...');
 *   }
 * }
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class ToastService {
  /** Private signal for managing toast array */
  private toasts = signal<Toast[]>([]);

  /** Public readonly computed signal exposing active toasts */
  readonly activeToasts = computed(() => this.toasts());

  /**
   * Show a toast notification
   *
   * @param config - Toast configuration
   * @param type - Toast type (success, error, warning, info)
   */
  show(config: ToastConfig, type: ToastType): void {
    const toast: Toast = {
      id: crypto.randomUUID(),
      type,
      message: config.message,
      title: config.title,
      duration: config.duration ?? 5000,
      dismissible: config.dismissible ?? true,
      timestamp: Date.now()
    };

    // Add toast to array (newest at end)
    this.toasts.update(current => [...current, toast]);

    // Schedule auto-dismiss if duration > 0
    if (toast.duration > 0) {
      setTimeout(() => this.dismiss(toast.id), toast.duration);
    }
  }

  /**
   * Show a success toast
   *
   * @param message - Toast message
   * @param title - Optional title
   * @param duration - Optional duration in milliseconds (default: 5000)
   */
  success(message: string, title?: string, duration?: number): void {
    this.show({ message, title, duration }, 'success');
  }

  /**
   * Show an error toast
   *
   * @param message - Toast message
   * @param title - Optional title
   * @param duration - Optional duration in milliseconds (default: 5000)
   */
  error(message: string, title?: string, duration?: number): void {
    this.show({ message, title, duration }, 'error');
  }

  /**
   * Show a warning toast
   *
   * @param message - Toast message
   * @param title - Optional title
   * @param duration - Optional duration in milliseconds (default: 5000)
   */
  warning(message: string, title?: string, duration?: number): void {
    this.show({ message, title, duration }, 'warning');
  }

  /**
   * Show an info toast
   *
   * @param message - Toast message
   * @param title - Optional title
   * @param duration - Optional duration in milliseconds (default: 5000)
   */
  info(message: string, title?: string, duration?: number): void {
    this.show({ message, title, duration }, 'info');
  }

  /**
   * Dismiss a specific toast by ID
   *
   * @param id - Toast ID to dismiss
   */
  dismiss(id: string): void {
    this.toasts.update(current => current.filter(toast => toast.id !== id));
  }

  /**
   * Dismiss all active toasts
   */
  dismissAll(): void {
    this.toasts.set([]);
  }
}

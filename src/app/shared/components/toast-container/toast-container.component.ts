import { CommonModule } from '@angular/common';
import { Component, inject, ViewEncapsulation } from '@angular/core';
import { ToastType } from '../../../core/models/toast.model';
import { ToastService } from '../../../core/services/toast.service';

/**
 * Toast container component that displays global toast notifications
 *
 * This component is displayed globally in the main layout and shows all active toasts
 * in the top-right corner of the screen.
 */
@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast-container.component.html',
  styleUrls: ['./toast-container.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class ToastContainerComponent {
  private toastService = inject(ToastService);

  /** Expose toasts signal to template */
  toasts = this.toastService.activeToasts;

  /**
   * Get Font Awesome icon class based on toast type
   *
   * @param type - Toast type
   * @returns Font Awesome icon class
   */
  getIconClass(type: ToastType): string {
    const icons: Record<ToastType, string> = {
      success: 'fa-circle-check',
      error: 'fa-circle-xmark',
      warning: 'fa-triangle-exclamation',
      info: 'fa-circle-info'
    };

    return `fas ${icons[type]}`;
  }

  /**
   * Dismiss a toast notification
   *
   * @param id - Toast ID to dismiss
   */
  dismiss(id: string): void {
    this.toastService.dismiss(id);
  }
}

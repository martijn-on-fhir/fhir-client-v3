import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, inject, signal, computed, effect, untracked, HostListener, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FhirSubscription, SubscriptionStatus } from '../../core/models/subscription.model';
import { EditorStateService } from '../../core/services/editor-state.service';
import { LoggerService } from '../../core/services/logger.service';
import { SubscriptionService } from '../../core/services/subscription.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmationDialogComponent } from '../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { MonacoEditorComponent } from '../../shared/components/monaco-editor/monaco-editor.component';
import { ResultHeaderComponent } from '../../shared/components/result-header/result-header.component';
import { SubscriptionEditorDialogComponent } from './dialogs/subscription-editor-dialog.component';

/**
 * FHIR Subscriptions Management Component
 *
 * Provides interface for managing FHIR STU3 Subscriptions:
 * - List all subscriptions from server
 * - Create new subscriptions
 * - Edit existing subscriptions
 * - Delete subscriptions
 * - Monitor subscription status
 *
 * Features:
 * - Split-panel interface with subscription list and JSON details
 * - Filter by status
 * - Search by reason/criteria
 * - Real-time status refresh
 */
@Component({
  selector: 'app-subscriptions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MonacoEditorComponent,
    ResultHeaderComponent,
    ConfirmationDialogComponent,
    SubscriptionEditorDialogComponent
  ],
  templateUrl: './subscriptions.component.html',
  styleUrls: ['./subscriptions.component.scss']
})
export class SubscriptionsComponent implements OnInit, OnDestroy {
  @ViewChild('jsonEditor') jsonEditor?: MonacoEditorComponent;

  subscriptionService = inject(SubscriptionService);
  private loggerService = inject(LoggerService);
  private editorStateService = inject(EditorStateService);
  private toastService = inject(ToastService);
  private logger = this.loggerService.component('SubscriptionsComponent');

  /** Currently selected subscription */
  selectedSubscription = signal<FhirSubscription | null>(null);

  /** Filter by subscription status */
  filterStatus = signal<SubscriptionStatus | 'all'>('all');

  /** Search query for filtering */
  searchQuery = signal('');

  /** Width percentage of left panel */
  leftWidth = signal(40);

  /** Whether panel resize is in progress */
  isResizing = signal(false);

  /** Starting X position for resize */
  private startX = 0;

  /** Starting width for resize */
  private startWidth = 0;

  /** Show editor dialog */
  showEditorDialog = signal(false);

  /** Subscription being edited (null for new) */
  editingSubscription = signal<FhirSubscription | null>(null);

  /** Show confirmation dialog */
  showConfirmDialog = signal(false);

  /** Subscription to delete */
  deletingSubscription = signal<FhirSubscription | null>(null);

  /** Refreshing status for a specific subscription */
  refreshingId = signal<string | null>(null);

  /** Computed filtered subscriptions */
  filteredSubscriptions = computed(() => {
    let subs = this.subscriptionService.subscriptions();
    const status = this.filterStatus();
    const search = this.searchQuery().toLowerCase();

    if (status !== 'all') {
      subs = subs.filter(s => s.status === status);
    }

    if (search) {
      subs = subs.filter(s =>
        s.reason?.toLowerCase().includes(search) ||
        s.criteria?.toLowerCase().includes(search) ||
        s.id?.toLowerCase().includes(search)
      );
    }

    return subs;
  });

  /** JSON content for Monaco editor */
  jsonContent = computed(() => {
    const sub = this.selectedSubscription();

    return sub ? JSON.stringify(sub, null, 2) : '';
  });

  /** Loading state from service */
  loading = computed(() => this.subscriptionService.loading());

  /** Error from service */
  error = computed(() => this.subscriptionService.error());

  constructor() {
    // Auto-select first subscription when loaded
    effect(() => {
      const subs = this.subscriptionService.subscriptions();
      const selected = untracked(() => this.selectedSubscription());

      if (subs.length > 0 && !selected) {
        this.selectedSubscription.set(subs[0]);
      }
    });

    // Register editor when subscription is selected
    effect(() => {
      const sub = this.selectedSubscription();

      if (sub) {
        setTimeout(() => {
          if (this.jsonEditor?.editor) {
            this.editorStateService.registerEditor(this.jsonEditor, false, '/app/subscriptions');
          }
        }, 100);
      }
    });
  }

  ngOnInit() {
    this.logger.info('Subscriptions component initialized');
    this.subscriptionService.loadSubscriptions();
  }

  ngOnDestroy() {
    this.editorStateService.unregisterEditor('/app/subscriptions');
  }

  /**
   * Select a subscription to view details
   */
  selectSubscription(sub: FhirSubscription) {
    this.selectedSubscription.set(sub);
  }

  /**
   * Open dialog to create new subscription
   */
  openNewSubscription() {
    this.editingSubscription.set(null);
    this.showEditorDialog.set(true);
  }

  /**
   * Open dialog to edit existing subscription
   */
  openEditSubscription(sub: FhirSubscription) {
    this.editingSubscription.set(sub);
    this.showEditorDialog.set(true);
  }

  /**
   * Close editor dialog
   */
  closeEditorDialog() {
    this.showEditorDialog.set(false);
    this.editingSubscription.set(null);
  }

  /**
   * Handle save from editor dialog
   */
  handleSaveSubscription(formData: any) {
    const editing = this.editingSubscription();

    if (editing?.id) {
      // Update existing
      this.subscriptionService.updateSubscription(editing.id, formData).subscribe({
        next: () => {
          this.toastService.success('Subscription updated successfully');
          this.closeEditorDialog();
        },
        error: (err) => {
          this.toastService.error(err.message || 'Failed to update subscription');
        }
      });
    } else {
      // Create new
      this.subscriptionService.createSubscription(formData).subscribe({
        next: () => {
          this.toastService.success('Subscription created successfully');
          this.closeEditorDialog();
        },
        error: (err) => {
          this.toastService.error(err.message || 'Failed to create subscription');
        }
      });
    }
  }

  /**
   * Open confirmation dialog for deletion
   */
  confirmDelete(sub: FhirSubscription) {
    this.deletingSubscription.set(sub);
    this.showConfirmDialog.set(true);
  }

  /**
   * Handle confirmed deletion
   */
  handleConfirmDelete() {
    const sub = this.deletingSubscription();

    if (!sub?.id) {
return;
}

    this.subscriptionService.deleteSubscription(sub.id).subscribe({
      next: () => {
        this.toastService.success('Subscription deleted');

        if (this.selectedSubscription()?.id === sub.id) {
          this.selectedSubscription.set(null);
        }
        this.showConfirmDialog.set(false);
        this.deletingSubscription.set(null);
      },
      error: (err) => {
        this.toastService.error(err.message || 'Failed to delete subscription');
        this.showConfirmDialog.set(false);
      }
    });
  }

  /**
   * Close confirmation dialog
   */
  closeConfirmDialog() {
    this.showConfirmDialog.set(false);
    this.deletingSubscription.set(null);
  }

  /**
   * Refresh subscription status from server
   */
  refreshStatus(sub: FhirSubscription) {
    if (!sub.id) {
return;
}

    this.refreshingId.set(sub.id);

    this.subscriptionService.refreshStatus(sub.id).subscribe({
      next: (updated) => {
        if (this.selectedSubscription()?.id === sub.id) {
          this.selectedSubscription.set(updated);
        }
        this.refreshingId.set(null);
        this.toastService.info('Status refreshed');
      },
      error: (err) => {
        this.refreshingId.set(null);
        this.toastService.error(err.message || 'Failed to refresh status');
      }
    });
  }

  /**
   * Reload all subscriptions from server
   */
  reloadSubscriptions() {
    this.subscriptionService.loadSubscriptions();
  }

  /**
   * Get status badge class
   */
  getStatusClass(status: SubscriptionStatus): string {
    switch (status) {
      case 'active': return 'status-active';
      case 'requested': return 'status-requested';
      case 'error': return 'status-error';
      case 'off': return 'status-off';
      default: return '';
    }
  }

  /**
   * Get status icon
   */
  getStatusIcon(status: SubscriptionStatus): string {
    switch (status) {
      case 'active': return 'fa-check-circle';
      case 'requested': return 'fa-clock';
      case 'error': return 'fa-exclamation-circle';
      case 'off': return 'fa-power-off';
      default: return 'fa-question-circle';
    }
  }

  // Resize handlers
  startResize(event: MouseEvent) {
    event.preventDefault();
    this.isResizing.set(true);
    this.startX = event.clientX;
    this.startWidth = this.leftWidth();
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.isResizing()) {
return;
}

    const container = document.querySelector('.split-container');

    if (!container) {
return;
}

    const containerWidth = container.clientWidth;
    const deltaX = event.clientX - this.startX;
    const deltaPercent = (deltaX / containerWidth) * 100;
    const newWidth = Math.min(Math.max(this.startWidth + deltaPercent, 25), 75);

    this.leftWidth.set(newWidth);
  }

  @HostListener('document:mouseup')
  stopResize() {
    if (this.isResizing()) {
      this.isResizing.set(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }
  }
}

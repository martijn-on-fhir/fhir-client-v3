import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  FhirSubscription,
  SubscriptionFormData,
  DEFAULT_SUBSCRIPTION_FORM,
  ChannelType
} from '../../../core/models/subscription.model';
import { LoggerService } from '../../../core/services/logger.service';
import { SubscriptionService } from '../../../core/services/subscription.service';

/**
 * Subscription Editor Dialog Component
 *
 * Modal dialog for creating and editing FHIR Subscriptions.
 */
@Component({
  selector: 'app-subscription-editor-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './subscription-editor-dialog.component.html',
  styleUrls: ['./subscription-editor-dialog.component.scss']
})
export class SubscriptionEditorDialogComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() subscription: FhirSubscription | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<SubscriptionFormData>();

  private loggerService = inject(LoggerService);
  private subscriptionService = inject(SubscriptionService);
  private logger = this.loggerService.component('SubscriptionEditorDialog');

  /** Form data */
  formData = signal<SubscriptionFormData>({ ...DEFAULT_SUBSCRIPTION_FORM });

  /** Saving state */
  saving = signal(false);

  /** Channel types for dropdown */
  channelTypes: ChannelType[] = ['rest-hook', 'websocket', 'email', 'sms', 'message'];

  /** Payload options */
  payloadOptions = [
    { value: 'application/fhir+json', label: 'JSON (application/fhir+json)' },
    { value: 'application/fhir+xml', label: 'XML (application/fhir+xml)' },
    { value: '', label: 'Empty (no payload)' }
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      if (this.subscription) {
        // Edit mode - populate form with subscription data
        this.formData.set(this.subscriptionService.subscriptionToFormData(this.subscription));
        this.logger.debug('Editing subscription:', this.subscription.id);
      } else {
        // Create mode - reset form
        this.formData.set({ ...DEFAULT_SUBSCRIPTION_FORM });
        this.logger.debug('Creating new subscription');
      }
    }
  }

  /**
   * Update a single form field
   */
  updateField(field: keyof SubscriptionFormData, value: any) {
    this.formData.update(current => ({
      ...current,
      [field]: value
    }));
  }

  /**
   * Check if form is valid
   */
  isValid(): boolean {
    const form = this.formData();

    return !!(
      form.reason.trim() &&
      form.criteria.trim() &&
      form.channelType &&
      (form.channelType !== 'rest-hook' || form.endpoint.trim())
    );
  }

  /**
   * Handle form submission
   */
  handleSave() {
    if (!this.isValid()) {
return;
}

    this.saving.set(true);
    this.save.emit(this.formData());
    this.saving.set(false);
  }

  /**
   * Handle close
   */
  handleClose() {
    this.close.emit();
  }

  /**
   * Check if editing existing subscription
   */
  get isEditing(): boolean {
    return !!this.subscription?.id;
  }
}

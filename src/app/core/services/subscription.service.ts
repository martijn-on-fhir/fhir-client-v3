import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import {
  FhirSubscription,
  SubscriptionBundle,
  SubscriptionFormData
} from '../models/subscription.model';
import { FhirService } from './fhir.service';
import { LoggerService } from './logger.service';

/**
 * Subscription Service
 *
 * Manages FHIR STU3 Subscriptions for real-time notifications.
 * Uses Angular Signals for reactive state management.
 */
@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private fhirService = inject(FhirService);
  private loggerService = inject(LoggerService);
  private logger = this.loggerService.component('SubscriptionService');

  /** List of subscriptions loaded from server */
  readonly subscriptions = signal<FhirSubscription[]>([]);

  /** Loading state */
  readonly loading = signal(false);

  /** Error message */
  readonly error = signal<string | null>(null);

  /**
   * Load all subscriptions from the FHIR server
   */
  loadSubscriptions(): void {
    this.loading.set(true);
    this.error.set(null);

    this.fhirService.executeQuery<SubscriptionBundle>('/Subscription').subscribe({
      next: (bundle) => {
        const subs = bundle.entry?.map(e => e.resource) || [];
        this.subscriptions.set(subs);
        this.logger.info(`Loaded ${subs.length} subscriptions`);
        this.loading.set(false);
      },
      error: (err) => {
        this.logger.error('Failed to load subscriptions:', err);
        this.error.set(err.message || 'Failed to load subscriptions');
        this.subscriptions.set([]);
        this.loading.set(false);
      }
    });
  }

  /**
   * Get a single subscription by ID
   */
  getSubscription(id: string): Observable<FhirSubscription> {
    return this.fhirService.read('Subscription', id);
  }

  /**
   * Create a new subscription on the FHIR server
   */
  createSubscription(formData: SubscriptionFormData): Observable<FhirSubscription> {
    const subscription = this.formDataToSubscription(formData);

    this.logger.info('Creating subscription:', subscription.reason);

    return this.fhirService.create(subscription).pipe(
      tap((created) => {
        this.logger.info('Subscription created:', created.id);
        // Reload subscriptions to get updated list
        this.loadSubscriptions();
      })
    );
  }

  /**
   * Update an existing subscription
   */
  updateSubscription(id: string, formData: SubscriptionFormData): Observable<FhirSubscription> {
    const subscription = this.formDataToSubscription(formData, id);

    this.logger.info('Updating subscription:', id);

    return this.fhirService.update(subscription).pipe(
      tap((updated) => {
        this.logger.info('Subscription updated:', updated.id);
        // Reload subscriptions to get updated list
        this.loadSubscriptions();
      })
    );
  }

  /**
   * Delete a subscription from the FHIR server
   */
  deleteSubscription(id: string): Observable<any> {
    this.logger.info('Deleting subscription:', id);

    return this.fhirService.delete('Subscription', id).pipe(
      tap(() => {
        this.logger.info('Subscription deleted:', id);
        // Remove from local list
        this.subscriptions.update(subs => subs.filter(s => s.id !== id));
      })
    );
  }

  /**
   * Refresh a single subscription's status from the server
   */
  refreshStatus(id: string): Observable<FhirSubscription> {
    this.logger.debug('Refreshing subscription status:', id);

    return this.getSubscription(id).pipe(
      tap((updated) => {
        // Update the subscription in the local list
        this.subscriptions.update(subs =>
          subs.map(s => s.id === id ? updated : s)
        );
      })
    );
  }

  /**
   * Convert form data to FHIR Subscription resource
   */
  private formDataToSubscription(formData: SubscriptionFormData, id?: string): FhirSubscription {
    const headers = formData.headers
      .split('\n')
      .map(h => h.trim())
      .filter(h => h.length > 0);

    const subscription: FhirSubscription = {
      resourceType: 'Subscription',
      status: 'requested',
      reason: formData.reason,
      criteria: formData.criteria,
      channel: {
        type: formData.channelType,
        endpoint: formData.endpoint || undefined,
        payload: formData.payload || undefined,
        header: headers.length > 0 ? headers : undefined
      }
    };

    if (id) {
      subscription.id = id;
    }

    if (formData.endDate) {
      subscription.end = new Date(formData.endDate).toISOString();
    }

    return subscription;
  }

  /**
   * Convert FHIR Subscription resource to form data
   */
  subscriptionToFormData(subscription: FhirSubscription): SubscriptionFormData {
    return {
      reason: subscription.reason || '',
      criteria: subscription.criteria || '',
      channelType: subscription.channel?.type || 'rest-hook',
      endpoint: subscription.channel?.endpoint || '',
      payload: subscription.channel?.payload || 'application/fhir+json',
      headers: subscription.channel?.header?.join('\n') || '',
      endDate: subscription.end ? subscription.end.split('T')[0] : ''
    };
  }
}

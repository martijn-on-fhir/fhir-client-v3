/**
 * FHIR Subscription Model (STU3/R4)
 *
 * Defines TypeScript interfaces for FHIR Subscription resources
 * used to manage real-time notifications from a FHIR server.
 */

export type SubscriptionStatus = 'requested' | 'active' | 'error' | 'off';
export type ChannelType = 'rest-hook' | 'websocket' | 'email' | 'sms' | 'message';

/**
 * Subscription channel configuration
 */
export interface SubscriptionChannel {
  /** The type of channel to use for notifications */
  type: ChannelType;
  /** The endpoint URL for rest-hook channels */
  endpoint?: string;
  /** MIME type of the payload (e.g., 'application/fhir+json') */
  payload?: string;
  /** Additional headers to include in notifications */
  header?: string[];
}

/**
 * FHIR Subscription resource (STU3/R4)
 */
export interface FhirSubscription {
  resourceType: 'Subscription';
  /** Server-assigned ID */
  id?: string;
  /** Current status of the subscription */
  status: SubscriptionStatus;
  /** Description of why this subscription was created */
  reason: string;
  /** FHIR search criteria that triggers notifications */
  criteria: string;
  /** Channel configuration for delivering notifications */
  channel: SubscriptionChannel;
  /** When the subscription should expire */
  end?: string;
  /** Contact details for the subscription owner */
  contact?: { system: string; value: string }[];
  /** Error message if status is 'error' */
  error?: string;
}

/**
 * FHIR Bundle containing Subscription resources
 */
export interface SubscriptionBundle {
  resourceType: 'Bundle';
  type: 'searchset';
  total?: number;
  entry?: {
    fullUrl?: string;
    resource: FhirSubscription;
  }[];
}

/**
 * Form data for creating/editing subscriptions
 */
export interface SubscriptionFormData {
  reason: string;
  criteria: string;
  channelType: ChannelType;
  endpoint: string;
  payload: string;
  headers: string;
  endDate: string;
}

/**
 * Default values for new subscription form
 */
export const DEFAULT_SUBSCRIPTION_FORM: SubscriptionFormData = {
  reason: '',
  criteria: '',
  channelType: 'rest-hook',
  endpoint: '',
  payload: 'application/fhir+json',
  headers: '',
  endDate: ''
};

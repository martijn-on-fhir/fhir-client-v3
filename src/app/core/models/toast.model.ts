/**
 * Toast notification type
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Toast notification interface
 */
export interface Toast {
  /** Unique identifier */
  id: string;
  /** Toast type determines icon and color */
  type: ToastType;
  /** Main message text */
  message: string;
  /** Optional title */
  title?: string;
  /** Auto-dismiss duration in milliseconds (0 = no auto-dismiss) */
  duration: number;
  /** Whether the toast can be manually dismissed */
  dismissible: boolean;
  /** Creation timestamp */
  timestamp: number;
}

/**
 * Configuration for creating a new toast
 */
export interface ToastConfig {
  /** Main message text */
  message: string;
  /** Optional title */
  title?: string;
  /** Auto-dismiss duration in milliseconds (default: 5000) */
  duration?: number;
  /** Whether the toast can be manually dismissed (default: true) */
  dismissible?: boolean;
}

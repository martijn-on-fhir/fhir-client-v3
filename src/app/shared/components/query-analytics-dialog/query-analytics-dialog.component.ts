/**
 * Query Analytics Dialog Component
 *
 * Displays query performance analytics in a modal dialog
 */

import { CommonModule } from '@angular/common';
import { Component, inject, signal, HostListener } from '@angular/core';
import {
  QueryAnalytics,
  OptimizationSuggestion,
  DEFAULT_SLOW_THRESHOLD
} from '../../../core/models/query-analytics.model';
import { QueryAnalyticsService } from '../../../core/services/query-analytics.service';

@Component({
  selector: 'app-query-analytics-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './query-analytics-dialog.component.html',
  styleUrl: './query-analytics-dialog.component.scss'
})
export class QueryAnalyticsDialogComponent {
  private analyticsService = inject(QueryAnalyticsService);

  /** Dialog visibility state */
  show = signal(false);

  /** Analytics data */
  analytics = signal<QueryAnalytics | null>(null);

  /** Loading state */
  loading = signal(true);

  /** Slow threshold in ms */
  slowThreshold = DEFAULT_SLOW_THRESHOLD;

  /**
   * Open the dialog and load analytics
   */
  open(): void {
    this.show.set(true);
    this.loadAnalytics();
  }

  /**
   * Close the dialog
   */
  close(): void {
    this.show.set(false);
  }

  /**
   * Load analytics data
   */
  loadAnalytics(): void {
    this.loading.set(true);
    const data = this.analyticsService.getAnalytics(this.slowThreshold);
    this.analytics.set(data);
    this.loading.set(false);
  }

  /**
   * Format milliseconds to human readable
   */
  formatTime(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }

    return `${(ms / 1000).toFixed(1)}s`;
  }

  /**
   * Format bytes to human readable
   */
  formatSize(bytes: number): string {
    if (bytes === 0) {
      return '0 B';
    }

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Format timestamp to relative time
   */
  formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) {
      return 'just now';
    }

    if (minutes < 60) {
      return `${minutes} min ago`;
    }

    if (hours < 24) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }

    return `${days} day${days > 1 ? 's' : ''} ago`;
  }

  /**
   * Get status class for resource type performance
   */
  getStatusClass(status: 'fast' | 'normal' | 'slow'): string {
    switch (status) {
      case 'fast':
        return 'text-success';
      case 'slow':
        return 'text-danger';
      default:
        return 'text-body';
    }
  }

  /**
   * Get status icon for resource type
   */
  getStatusIcon(status: 'fast' | 'normal' | 'slow'): string {
    switch (status) {
      case 'fast':
        return 'fa-check-circle text-success';
      case 'slow':
        return 'fa-exclamation-triangle text-warning';
      default:
        return 'fa-circle text-muted';
    }
  }

  /**
   * Get suggestion icon based on type
   */
  getSuggestionIcon(type: OptimizationSuggestion['type']): string {
    switch (type) {
      case 'include':
        return 'fa-project-diagram';
      case 'count':
        return 'fa-list-ol';
      case 'summary':
        return 'fa-compress-alt';
      case 'elements':
        return 'fa-filter';
      default:
        return 'fa-lightbulb';
    }
  }

  /**
   * Truncate long query strings
   */
  truncateQuery(query: string, maxLength: number = 60): string {
    if (query.length <= maxLength) {
      return query;
    }

    return query.substring(0, maxLength) + '...';
  }

  /**
   * Check if we have data
   */
  hasData(): boolean {
    const data = this.analytics();

    return data !== null && data.summary.totalQueries > 0;
  }

  /**
   * Keyboard shortcuts
   */
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.show()) {
      return;
    }

    // Escape - Close dialog
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }
}

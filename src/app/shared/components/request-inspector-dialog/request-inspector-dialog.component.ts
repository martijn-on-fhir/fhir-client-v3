import { CommonModule } from '@angular/common';
import { Component, signal, inject, HostListener } from '@angular/core';
import { HttpInspectorService, HttpInspection } from '../../../core/services/http-inspector.service';

/**
 * Request Inspector Dialog Component
 *
 * Displays HTTP request/response details for debugging:
 * - Request headers sent
 * - Response headers received
 * - Status code and timing
 * - Response size
 */
@Component({
  selector: 'app-request-inspector-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './request-inspector-dialog.component.html',
  styleUrls: ['./request-inspector-dialog.component.scss']
})
export class RequestInspectorDialogComponent {
  private inspectorService = inject(HttpInspectorService);

  isOpen = signal(false);
  activeTab = signal<'request' | 'response' | 'timing'>('request');
  inspection = signal<HttpInspection | null>(null);

  /**
   * Open dialog with current inspection data
   */
  open() {
    const current = this.inspectorService.getCurrent();
    this.inspection.set(current);
    this.activeTab.set('request');
    this.isOpen.set(true);
  }

  /**
   * Close dialog
   */
  close() {
    this.isOpen.set(false);
  }

  /**
   * Handle keyboard events
   */
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (!this.isOpen()) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }

  /**
   * Switch active tab
   */
  setTab(tab: 'request' | 'response' | 'timing') {
    this.activeTab.set(tab);
  }

  /**
   * Get status badge class based on HTTP status code
   */
  getStatusBadgeClass(): string {
    const status = this.inspection()?.response?.status;

    if (!status) {
return 'bg-secondary';
}

    if (status >= 200 && status < 300) {
return 'bg-success';
}

    if (status >= 300 && status < 400) {
return 'bg-info';
}

    if (status >= 400 && status < 500) {
return 'bg-warning text-dark';
}

    return 'bg-danger';
  }

  /**
   * Get timing badge class based on duration
   */
  getTimingBadgeClass(): string {
    const duration = this.inspection()?.timing?.duration;

    if (!duration) {
return 'bg-secondary';
}

    if (duration < 500) {
return 'bg-success';
}

    if (duration < 2000) {
return 'bg-warning text-dark';
}

    return 'bg-danger';
  }

  /**
   * Format bytes to human readable size
   */
  formatSize(bytes: number | undefined): string {
    if (!bytes) {
return '0 B';
}

    if (bytes < 1024) {
return `${bytes} B`;
}

    if (bytes < 1024 * 1024) {
return `${(bytes / 1024).toFixed(1)} KB`;
}

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  /**
   * Get request headers as array for display
   */
  getRequestHeaders(): { key: string; value: string }[] {
    const headers = this.inspection()?.request?.headers;

    if (!headers) {
return [];
}

    return Object.entries(headers).map(([key, value]) => ({ key, value }));
  }

  /**
   * Get response headers as array for display
   */
  getResponseHeaders(): { key: string; value: string }[] {
    const headers = this.inspection()?.response?.headers;

    if (!headers) {
return [];
}

    return Object.entries(headers).map(([key, value]) => ({ key, value }));
  }

  /**
   * Format timestamp for display
   */
  formatTimestamp(): string {
    const timestamp = this.inspection()?.timestamp;

    if (!timestamp) {
return '';
}

    return new Date(timestamp).toLocaleTimeString();
  }

  /**
   * Get URL path without base
   */
  getUrlPath(): string {
    const url = this.inspection()?.request?.url;

    if (!url) {
return '';
}

    try {
      const parsed = new URL(url);

      return parsed.pathname + parsed.search;
    } catch {
      return url;
    }
  }

  /**
   * Get URL origin
   */
  getUrlOrigin(): string {
    const url = this.inspection()?.request?.url;

    if (!url) {
return '';
}

    try {
      const parsed = new URL(url);

      return parsed.origin;
    } catch {
      return '';
    }
  }
}

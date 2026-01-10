import { CommonModule } from '@angular/common';
import { Component, signal, inject, HostListener } from '@angular/core';
import { FhirService } from '../../../core/services/fhir.service';
import { LoggerService } from '../../../core/services/logger.service';

/**
 * Server Info Dialog Component
 *
 * Displays server information and connection details from FHIR CapabilityStatement
 */
@Component({
  selector: 'app-server-info-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './server-info-dialog.component.html',
  styleUrls: ['./server-info-dialog.component.scss']
})
export class ServerInfoDialogComponent {
  private fhirService = inject(FhirService);
  private loggerService = inject(LoggerService);
  private get logger() {
    return this.loggerService.component('ServerInfoDialog');
  }

  isOpen = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);
  metadata = signal<any>(null);

  /**
   * Open dialog and fetch server metadata
   */
  open() {
    this.isOpen.set(true);
    this.loadServerInfo();
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

    // Escape - Close dialog
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }

  /**
   * Load server metadata (CapabilityStatement)
   */
  private async loadServerInfo() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await this.fhirService.getMetadata().toPromise();
      this.metadata.set(result);
      this.logger.info('Server metadata loaded', result);
    } catch (err: any) {
      const message = err.message || 'Failed to load server information';
      this.error.set(message);
      this.logger.error('Failed to load server metadata:', err);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Get server name from metadata
   */
  getServerName(): string {
    const meta = this.metadata();

    return meta?.software?.name || meta?.name || 'Unknown';
  }

  /**
   * Get server version from metadata (removes commit hash after +)
   */
  getServerVersion(): string {
    const meta = this.metadata();
    const version = meta?.software?.version || meta?.version || 'Unknown';

    // Remove everything after the + sign (commit hash)
    return version.split('+')[0];
  }

  /**
   * Get FHIR version from metadata
   */
  getFhirVersion(): string {
    const meta = this.metadata();

    return meta?.fhirVersion || 'Unknown';
  }

  /**
   * Get server description
   */
  getServerDescription(): string {
    const meta = this.metadata();

    return meta?.implementation?.description || meta?.description || 'No description available';
  }

  /**
   * Get server URL (actual FHIR server base URL)
   */
  getServerUrl(): string {
    return this.fhirService.getServerUrl();
  }

  /**
   * Get publisher information
   */
  getPublisher(): string {
    const meta = this.metadata();

    return meta?.publisher || 'Unknown';
  }

  /**
   * Get server status
   */
  getStatus(): string {
    const meta = this.metadata();

    return meta?.status || 'Unknown';
  }

  /**
   * Get release date formatted as yyyy-mm-dd
   */
  getReleaseDate(): string {
    const meta = this.metadata();
    const dateStr = meta?.software?.releaseDate || meta?.date;

    if (!dateStr) {
      return 'Unknown';
    }

    try {
      const date = new Date(dateStr);

      if (isNaN(date.getTime())) {
        return dateStr; // Return original if invalid
      }

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      return `${year}-${month}-${day}`;
    } catch {
      return dateStr; // Return original if parsing fails
    }
  }

  /**
   * Get copyright/license information
   */
  getCopyright(): string | null {
    const meta = this.metadata();

    return meta?.copyright || null;
  }

  /**
   * Check if license information is available
   */
  hasLicense(): boolean {
    return !!this.getCopyright();
  }
}

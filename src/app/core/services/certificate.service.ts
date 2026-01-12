import { Injectable, signal, computed } from '@angular/core';
import {
  CertificateEntryUI,
  CertificateValidationResult,
  CertificateImportResult,
  ConnectionTestResult,
  CertificateMetadata
} from '../models/certificate.model';

/**
 * Certificate Service
 *
 * Manages client certificates for mTLS connections.
 * Wraps the Electron IPC API for certificate operations.
 */
@Injectable({
  providedIn: 'root'
})
export class CertificateService {
  // Cached certificates list
  private _certificates = signal<CertificateEntryUI[]>([]);

  /** All certificates (reactive) */
  readonly certificates = this._certificates.asReadonly();

  /** Number of certificates */
  readonly certificateCount = computed(() => this._certificates().length);

  /** Number of enabled certificates */
  readonly enabledCount = computed(() =>
    this._certificates().filter(c => c.enabled).length
  );

  /** Certificates that are expired */
  readonly expiredCertificates = computed(() =>
    this._certificates().filter(c => c.validTo && c.validTo < Date.now())
  );

  /** Certificates expiring within 30 days */
  readonly expiringCertificates = computed(() => {
    const thirtyDaysFromNow = Date.now() + 30 * 24 * 60 * 60 * 1000;
    return this._certificates().filter(
      c => c.validTo && c.validTo > Date.now() && c.validTo < thirtyDaysFromNow
    );
  });

  /**
   * Check if Electron certificate API is available
   */
  isAvailable(): boolean {
    return !!window.electronAPI?.certificates;
  }

  /**
   * Load all certificates from storage
   */
  async loadCertificates(): Promise<CertificateEntryUI[]> {
    if (!this.isAvailable()) {
      console.warn('[CertificateService] Certificate API not available');
      return [];
    }

    try {
      const result = await window.electronAPI!.certificates!.getAll();

      if (result.success && result.certificates) {
        this._certificates.set(result.certificates);
        return result.certificates;
      } else {
        console.error('[CertificateService] Failed to load certificates:', result.error);
        return [];
      }
    } catch (error) {
      console.error('[CertificateService] Error loading certificates:', error);
      return [];
    }
  }

  /**
   * Save a new certificate
   */
  async saveCertificate(entry: {
    name: string;
    domain: string;
    clientCertificate: string;
    privateKey: string;
    caCertificate?: string;
    passphrase?: string;
    metadata?: CertificateMetadata;
  }): Promise<{ success: boolean; error?: string }> {
    if (!this.isAvailable()) {
      return { success: false, error: 'Certificate API not available' };
    }

    try {
      const result = await window.electronAPI!.certificates!.save(entry);

      if (result.success) {
        // Reload certificates to update the list
        await this.loadCertificates();
      }

      return result;
    } catch (error) {
      console.error('[CertificateService] Error saving certificate:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Update an existing certificate
   */
  async updateCertificate(
    id: string,
    updates: {
      name?: string;
      domain?: string;
      enabled?: boolean;
      clientCertificate?: string;
      privateKey?: string;
      caCertificate?: string;
      passphrase?: string;
      metadata?: CertificateMetadata;
    }
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isAvailable()) {
      return { success: false, error: 'Certificate API not available' };
    }

    try {
      const result = await window.electronAPI!.certificates!.update(id, updates);

      if (result.success) {
        await this.loadCertificates();
      }

      return result;
    } catch (error) {
      console.error('[CertificateService] Error updating certificate:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Toggle certificate enabled state
   */
  async toggleEnabled(id: string): Promise<{ success: boolean; error?: string }> {
    const cert = this._certificates().find(c => c.id === id);
    if (!cert) {
      return { success: false, error: 'Certificate not found' };
    }

    return this.updateCertificate(id, { enabled: !cert.enabled });
  }

  /**
   * Delete a certificate
   */
  async deleteCertificate(id: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isAvailable()) {
      return { success: false, error: 'Certificate API not available' };
    }

    try {
      const result = await window.electronAPI!.certificates!.delete(id);

      if (result.success) {
        await this.loadCertificates();
      }

      return result;
    } catch (error) {
      console.error('[CertificateService] Error deleting certificate:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Import certificate from file
   * Opens a file dialog and returns the parsed data
   */
  async importFromFile(
    type: 'pfx' | 'certificate' | 'key' | 'all' = 'all'
  ): Promise<CertificateImportResult> {
    if (!this.isAvailable()) {
      return { success: false, error: 'Certificate API not available' };
    }

    try {
      return await window.electronAPI!.certificates!.import(type);
    } catch (error) {
      console.error('[CertificateService] Error importing certificate:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Parse a PFX file with passphrase
   */
  async parsePfxFile(
    filePath: string,
    passphrase: string
  ): Promise<CertificateImportResult> {
    if (!this.isAvailable()) {
      return { success: false, error: 'Certificate API not available' };
    }

    try {
      return await window.electronAPI!.certificates!.parsePfx(filePath, passphrase);
    } catch (error) {
      console.error('[CertificateService] Error parsing PFX:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Validate certificate data without saving
   */
  async validateCertificate(data: {
    clientCertificate: string;
    privateKey?: string;
    passphrase?: string;
  }): Promise<CertificateValidationResult> {
    if (!this.isAvailable()) {
      return { success: false, valid: false, error: 'Certificate API not available' };
    }

    try {
      return await window.electronAPI!.certificates!.validate(data);
    } catch (error) {
      console.error('[CertificateService] Error validating certificate:', error);
      return { success: false, valid: false, error: String(error) };
    }
  }

  /**
   * Test mTLS connection using a stored certificate
   */
  async testConnection(id: string, testUrl: string): Promise<ConnectionTestResult> {
    if (!this.isAvailable()) {
      return { success: false, error: 'Certificate API not available' };
    }

    try {
      return await window.electronAPI!.certificates!.testConnection(id, testUrl);
    } catch (error) {
      console.error('[CertificateService] Error testing connection:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Test mTLS connection with certificate data (before saving)
   */
  async testConnectionWithData(params: {
    testUrl: string;
    clientCertificate: string;
    privateKey: string;
    caCertificate?: string;
    passphrase?: string;
  }): Promise<ConnectionTestResult> {
    if (!this.isAvailable()) {
      return { success: false, error: 'Certificate API not available' };
    }

    try {
      return await window.electronAPI!.certificates!.testConnectionWithData(params);
    } catch (error) {
      console.error('[CertificateService] Error testing connection:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get a certificate by ID from the cached list
   */
  getCertificateById(id: string): CertificateEntryUI | undefined {
    return this._certificates().find(c => c.id === id);
  }

  /**
   * Check if a domain has a configured certificate
   */
  hasCertificateForDomain(hostname: string): boolean {
    return this._certificates().some(
      cert => cert.enabled && this.domainMatches(cert.domain, hostname)
    );
  }

  /**
   * Format expiry date for display
   */
  formatExpiryDate(timestamp: number | undefined): string {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp).toLocaleDateString();
  }

  /**
   * Get certificate status for display
   */
  getCertificateStatus(cert: CertificateEntryUI): {
    status: 'valid' | 'expired' | 'expiring' | 'disabled';
    label: string;
  } {
    if (!cert.enabled) {
      return { status: 'disabled', label: 'Disabled' };
    }

    if (cert.validTo) {
      const now = Date.now();
      if (cert.validTo < now) {
        return { status: 'expired', label: 'Expired' };
      }

      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      if (cert.validTo < now + thirtyDays) {
        return { status: 'expiring', label: 'Expiring soon' };
      }
    }

    return { status: 'valid', label: 'Valid' };
  }

  /**
   * Check if a domain pattern matches a hostname
   */
  private domainMatches(pattern: string, hostname: string): boolean {
    if (pattern === hostname) {
      return true;
    }

    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(2);
      const regex = new RegExp(`^[^.]+\\.${this.escapeRegex(suffix)}$`, 'i');
      return regex.test(hostname);
    }

    return false;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

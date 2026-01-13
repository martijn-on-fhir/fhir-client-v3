import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CertificateEntryUI,
  CertificateMetadata,
  CertificateFormData
} from '../../../core/models/certificate.model';
import { CertificateService } from '../../../core/services/certificate.service';
import { ToastService } from '../../../core/services/toast.service';

/**
 * Certificate Manager Dialog Component
 *
 * Manages client certificates for mTLS connections.
 * Allows adding, editing, deleting certificates and testing connections.
 */
@Component({
  selector: 'app-certificate-manager-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './certificate-manager-dialog.component.html',
  styleUrls: ['./certificate-manager-dialog.component.scss']
})
export class CertificateManagerDialogComponent implements OnInit {
  private certificateService = inject(CertificateService);
  private toastService = inject(ToastService);

  // Dialog state
  isOpen = signal(false);
  activeView = signal<'list' | 'add' | 'edit'>('list');
  selectedCertificate = signal<CertificateEntryUI | null>(null);

  // Data
  readonly certificates = this.certificateService.certificates;
  readonly certificateCount = this.certificateService.certificateCount;

  // Form state
  formData = signal<CertificateFormData>({
    name: '',
    domain: '',
    importMethod: 'separate'
  });

  // Import state
  importedCertificate = signal<string | null>(null);
  importedPrivateKey = signal<string | null>(null);
  importedCaCertificate = signal<string | null>(null);
  pendingPfxPath = signal<string | null>(null);

  // Validation state
  validationResult = signal<{
    valid: boolean;
    metadata?: CertificateMetadata;
    error?: string;
    isExpired?: boolean;
  } | null>(null);

  // Test connection state
  testUrl = signal('');
  isTesting = signal(false);

  // Loading/error state
  loading = signal(false);
  error = signal<string | null>(null);

  ngOnInit() {
    this.loadCertificates();
  }

  /**
   * Load certificates from storage
   */
  async loadCertificates() {
    this.loading.set(true);

    try {
      await this.certificateService.loadCertificates();
    } catch (err) {
      console.error('Failed to load certificates:', err);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Open the dialog
   */
  open() {
    this.isOpen.set(true);
    this.loadCertificates();
    this.activeView.set('list');
    this.resetForm();
  }

  /**
   * Close the dialog
   */
  close() {
    this.isOpen.set(false);
    this.resetForm();
  }

  /**
   * Navigate to add certificate view
   */
  showAddView() {
    this.activeView.set('add');
    this.resetForm();
  }

  /**
   * Navigate to edit certificate view
   */
  showEditView(cert: CertificateEntryUI) {
    this.selectedCertificate.set(cert);
    this.formData.set({
      name: cert.name,
      domain: cert.domain,
      importMethod: 'separate'
    });
    this.activeView.set('edit');
  }

  /**
   * Navigate back to list view
   */
  showListView() {
    this.activeView.set('list');
    this.resetForm();
  }

  /**
   * Reset form state
   */
  resetForm() {
    this.formData.set({
      name: '',
      domain: '',
      importMethod: 'separate'
    });
    this.importedCertificate.set(null);
    this.importedPrivateKey.set(null);
    this.importedCaCertificate.set(null);
    this.pendingPfxPath.set(null);
    this.validationResult.set(null);
    this.testUrl.set('');
    this.error.set(null);
    this.selectedCertificate.set(null);
  }

  // =========================================================================
  // Import Methods
  // =========================================================================

  /**
   * Import PFX/P12 file
   */
  async importPfx() {
    this.error.set(null);
    this.loading.set(true);

    try {
      const result = await this.certificateService.importFromFile('pfx');

      if (result.canceled) {
        return;
      }

      if (!result.success) {
        this.error.set(result.error || 'Failed to import file');

        return;
      }

      if (result.needsPassphrase && result.filePath) {
        // PFX needs passphrase - store path and prompt user
        this.pendingPfxPath.set(result.filePath);

        return;
      }

      // PFX parsed successfully
      if (result.data) {
        this.importedCertificate.set(result.data.clientCertificate || null);
        this.importedPrivateKey.set(result.data.privateKey || null);
        this.importedCaCertificate.set(result.data.caCertificate || null);

        if (result.data.metadata) {
          this.validationResult.set({
            valid: true,
            metadata: result.data.metadata
          });

          // Show success toast
          const message = `CN: ${result.data.metadata.commonName || 'N/A'} | Expires: ${this.formatExpiryDate(result.data.metadata.validTo)}`;
          this.toastService.success(message, 'PFX file imported successfully');

          // Auto-fill name from CN if empty
          const form = this.formData();

          if (!form.name && result.data.metadata.commonName) {
            this.formData.set({
              ...form,
              name: result.data.metadata.commonName
            });
          }
        }
      }
    } catch (err) {
      this.error.set(String(err));
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Parse PFX with passphrase
   */
  async parsePfxWithPassphrase(passphrase: string) {
    const pfxPath = this.pendingPfxPath();

    if (!pfxPath) {
return;
}

    this.error.set(null);
    this.loading.set(true);

    try {
      const result = await this.certificateService.parsePfxFile(pfxPath, passphrase);

      if (!result.success) {
        this.error.set(result.error || 'Failed to parse PFX file');

        return;
      }

      if (result.data) {
        this.importedCertificate.set(result.data.clientCertificate || null);
        this.importedPrivateKey.set(result.data.privateKey || null);
        this.importedCaCertificate.set(result.data.caCertificate || null);
        this.pendingPfxPath.set(null);

        // Store passphrase in form
        const form = this.formData();
        this.formData.set({ ...form, passphrase });

        if (result.data.metadata) {
          this.validationResult.set({
            valid: true,
            metadata: result.data.metadata
          });

          // Show success toast
          const message = `CN: ${result.data.metadata.commonName || 'N/A'} | Expires: ${this.formatExpiryDate(result.data.metadata.validTo)}`;
          this.toastService.success(message, 'PFX file unlocked successfully');

          if (!form.name && result.data.metadata.commonName) {
            this.formData.set({
              ...this.formData(),
              name: result.data.metadata.commonName
            });
          }
        }
      }
    } catch (err) {
      this.error.set(String(err));
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Import certificate file (PEM/CRT/DER)
   */
  async importCertificate() {
    this.error.set(null);
    this.loading.set(true);

    try {
      const result = await this.certificateService.importFromFile('certificate');

      if (result.canceled) {
return;
}

      if (!result.success) {
        this.error.set(result.error || 'Failed to import certificate');

        return;
      }

      if (result.data?.pem) {
        this.importedCertificate.set(result.data.pem);

        if (result.data.metadata) {
          // Validate with key if already imported
          if (this.importedPrivateKey()) {
            await this.validateImportedCertificate();
          } else {
            this.validationResult.set({
              valid: true,
              metadata: result.data.metadata
            });
            this.toastService.success('Certificate imported successfully');
          }

          const form = this.formData();

          if (!form.name && result.data.metadata.commonName) {
            this.formData.set({
              ...form,
              name: result.data.metadata.commonName
            });
          }
        }
      }
    } catch (err) {
      this.error.set(String(err));
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Import private key file
   */
  async importPrivateKey() {
    this.error.set(null);
    this.loading.set(true);

    try {
      const result = await this.certificateService.importFromFile('key');

      if (result.canceled) {
return;
}

      if (!result.success) {
        this.error.set(result.error || 'Failed to import private key');

        return;
      }

      if (result.data?.pem) {
        this.importedPrivateKey.set(result.data.pem);

        // Validate cert/key pair if certificate already imported
        if (this.importedCertificate()) {
          await this.validateImportedCertificate();
        } else {
          this.toastService.success('Private key imported successfully');
        }
      }
    } catch (err) {
      this.error.set(String(err));
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Import CA certificate file
   */
  async importCaCertificate() {
    this.error.set(null);
    this.loading.set(true);

    try {
      const result = await this.certificateService.importFromFile('certificate');

      if (result.canceled) {
return;
}

      if (!result.success) {
        this.error.set(result.error || 'Failed to import CA certificate');

        return;
      }

      if (result.data?.pem) {
        this.importedCaCertificate.set(result.data.pem);
        this.toastService.success('CA certificate imported successfully');
      }
    } catch (err) {
      this.error.set(String(err));
    } finally {
      this.loading.set(false);
    }
  }

  // =========================================================================
  // Validation
  // =========================================================================

  /**
   * Validate imported certificate and key
   */
  async validateImportedCertificate() {
    const cert = this.importedCertificate();
    const key = this.importedPrivateKey();
    const form = this.formData();

    if (!cert) {
      this.toastService.warning('No certificate imported');

      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await this.certificateService.validateCertificate({
        clientCertificate: cert,
        privateKey: key || undefined,
        passphrase: form.passphrase
      });

      if (result.success && result.valid) {
        this.validationResult.set({
          valid: result.valid,
          metadata: result.metadata,
          error: result.error,
          isExpired: result.isExpired
        });

        // Show success toast with certificate details
        const metadata = result.metadata;
        const message = metadata
          ? `CN: ${metadata.commonName || 'N/A'} | Expires: ${this.formatExpiryDate(metadata.validTo)}`
          : 'Certificate and key pair validated successfully';

        if (result.isExpired) {
          this.toastService.warning(message, 'Certificate is expired');
        } else {
          this.toastService.success(message, 'Certificate is valid');
        }
      } else {
        this.validationResult.set({
          valid: false,
          error: result.error
        });
        this.toastService.error(result.error || 'Validation failed', 'Certificate validation failed');
      }
    } catch (err) {
      this.toastService.error(String(err), 'Validation error');
    } finally {
      this.loading.set(false);
    }
  }

  // =========================================================================
  // Test Connection
  // =========================================================================

  /**
   * Test mTLS connection with current certificate data
   */
  async testConnectionWithData() {
    const url = this.testUrl();

    if (!url) {
      this.toastService.warning('Please enter a test URL');

      return;
    }

    const cert = this.importedCertificate();
    const key = this.importedPrivateKey();

    if (!cert || !key) {
      this.toastService.warning('Certificate and private key required for connection test');

      return;
    }

    this.isTesting.set(true);
    this.error.set(null);

    try {
      const form = this.formData();
      const result = await this.certificateService.testConnectionWithData({
        testUrl: url,
        clientCertificate: cert,
        privateKey: key,
        caCertificate: this.importedCaCertificate() || undefined,
        passphrase: form.passphrase
      });

      if (result.success) {
        this.toastService.success(
          `Status: ${result.status} ${result.statusText}${result.headers?.server ? ` | Server: ${result.headers.server}` : ''}`,
          'Connection successful'
        );
      } else {
        this.toastService.error(
          result.error || 'Unknown error',
          'Connection failed'
        );
      }
    } catch (err) {
      this.toastService.error(String(err), 'Connection failed');
    } finally {
      this.isTesting.set(false);
    }
  }

  /**
   * Test connection with stored certificate
   */
  async testConnectionWithCertificate(certId: string) {
    const url = this.testUrl();

    if (!url) {
      this.toastService.warning('Please enter a test URL');

      return;
    }

    this.isTesting.set(true);
    this.error.set(null);

    try {
      const result = await this.certificateService.testConnection(certId, url);

      if (result.success) {
        this.toastService.success(
          `Status: ${result.status} ${result.statusText}${result.headers?.server ? ` | Server: ${result.headers.server}` : ''}`,
          'Connection successful'
        );
      } else {
        this.toastService.error(
          result.error || 'Unknown error',
          'Connection failed'
        );
      }
    } catch (err) {
      this.toastService.error(String(err), 'Connection failed');
    } finally {
      this.isTesting.set(false);
    }
  }

  // =========================================================================
  // CRUD Operations
  // =========================================================================

  /**
   * Save certificate
   */
  async saveCertificate() {
    const form = this.formData();
    const cert = this.importedCertificate();
    const key = this.importedPrivateKey();
    const validation = this.validationResult();

    if (!form.name || !form.domain) {
      this.error.set('Name and domain are required');

      return;
    }

    if (!cert || !key) {
      this.error.set('Certificate and private key are required');

      return;
    }

    if (validation && !validation.valid) {
      this.error.set('Certificate validation failed');

      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await this.certificateService.saveCertificate({
        name: form.name,
        domain: form.domain,
        clientCertificate: cert,
        privateKey: key,
        caCertificate: this.importedCaCertificate() || undefined,
        passphrase: form.passphrase,
        metadata: validation?.metadata
      });

      if (result.success) {
        this.showListView();
      } else {
        this.error.set(result.error || 'Failed to save certificate');
      }
    } catch (err) {
      this.error.set(String(err));
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Update certificate
   */
  async updateCertificate() {
    const selected = this.selectedCertificate();

    if (!selected) {
return;
}

    const form = this.formData();

    if (!form.name || !form.domain) {
      this.error.set('Name and domain are required');

      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const updates: any = {
        name: form.name,
        domain: form.domain
      };

      // Include new certificate data if imported
      const cert = this.importedCertificate();
      const key = this.importedPrivateKey();

      if (cert && key) {
        updates.clientCertificate = cert;
        updates.privateKey = key;
        updates.caCertificate = this.importedCaCertificate();
        updates.passphrase = form.passphrase;

        const validation = this.validationResult();

        if (validation?.metadata) {
          updates.metadata = validation.metadata;
        }
      }

      const result = await this.certificateService.updateCertificate(selected.id, updates);

      if (result.success) {
        this.showListView();
      } else {
        this.error.set(result.error || 'Failed to update certificate');
      }
    } catch (err) {
      this.error.set(String(err));
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Toggle certificate enabled state
   */
  async toggleEnabled(cert: CertificateEntryUI) {
    this.loading.set(true);

    try {
      await this.certificateService.toggleEnabled(cert.id);
    } catch (err) {
      this.error.set(String(err));
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Delete certificate
   */
  async deleteCertificate(cert: CertificateEntryUI) {
    if (!confirm(`Are you sure you want to delete "${cert.name}"?`)) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await this.certificateService.deleteCertificate(cert.id);

      if (!result.success) {
        this.error.set(result.error || 'Failed to delete certificate');
      }
    } catch (err) {
      this.error.set(String(err));
    } finally {
      this.loading.set(false);
    }
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  /**
   * Get certificate status display
   */
  getCertificateStatus(cert: CertificateEntryUI) {
    return this.certificateService.getCertificateStatus(cert);
  }

  /**
   * Format expiry date
   */
  formatExpiryDate(timestamp: number | undefined): string {
    return this.certificateService.formatExpiryDate(timestamp);
  }

  /**
   * Format date for display
   */
  formatDate(timestamp: number | undefined): string {
    if (!timestamp) {
return 'Unknown';
}

    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Update form field
   */
  updateFormField(field: keyof CertificateFormData, value: any) {
    this.formData.update(form => ({ ...form, [field]: value }));
  }

  /**
   * Check if form is valid for saving
   */
  canSave(): boolean {
    const form = this.formData();
    const hasRequired = !!form.name && !!form.domain;
    const hasCertData = !!this.importedCertificate() && !!this.importedPrivateKey();
    const validation = this.validationResult();
    const isValid = !validation || validation.valid;

    return hasRequired && hasCertData && isValid && !this.loading();
  }

  /**
   * Check if form can be updated (edit mode)
   */
  canUpdate(): boolean {
    const form = this.formData();
    const hasRequired = !!form.name && !!form.domain;

    // If new cert data imported, validate it
    if (this.importedCertificate() && this.importedPrivateKey()) {
      const validation = this.validationResult();

      return hasRequired && (!validation || validation.valid) && !this.loading();
    }

    // Just updating name/domain
    return hasRequired && !this.loading();
  }
}

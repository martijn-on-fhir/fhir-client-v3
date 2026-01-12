/**
 * Certificate Models for mTLS Certificate Management
 */

/**
 * Supported certificate import formats
 */
export type CertificateFormat = 'pem' | 'crt' | 'cer' | 'der' | 'key' | 'pfx' | 'p12';

/**
 * Certificate entry stored in the certificate manager
 * Note: Sensitive fields (privateKey, passphrase) are only stored in Electron main process
 */
export interface CertificateEntry {
  /** Unique identifier (UUID) */
  id: string;

  /** User-friendly display name */
  name: string;

  /** Domain pattern to match (supports wildcards like *.example.com) */
  domain: string;

  /** Whether the certificate is active */
  enabled: boolean;

  /** PEM-encoded client certificate */
  clientCertificate: string;

  /** PEM-encoded private key (only in main process) */
  privateKey: string;

  /** Optional PEM-encoded CA certificate chain */
  caCertificate?: string;

  /** Optional passphrase for encrypted private keys */
  passphrase?: string;

  // Certificate metadata (extracted from cert)
  /** Certificate Common Name (CN) */
  commonName?: string;

  /** Certificate Issuer */
  issuer?: string;

  /** Valid from timestamp (ms) */
  validFrom?: number;

  /** Valid until timestamp (ms) */
  validTo?: number;

  /** Certificate serial number */
  serialNumber?: string;

  /** When the entry was created (ms) */
  createdAt: number;

  /** When the entry was last updated (ms) */
  updatedAt: number;
}

/**
 * Sanitized certificate entry for UI display
 * Does not contain sensitive data like privateKey or passphrase
 */
export interface CertificateEntryUI {
  id: string;
  name: string;
  domain: string;
  enabled: boolean;
  commonName?: string;
  issuer?: string;
  validFrom?: number;
  validTo?: number;
  serialNumber?: string;
  createdAt: number;
  updatedAt: number;

  /** Indicates if a private key is stored */
  hasPrivateKey: boolean;

  /** Indicates if a passphrase is stored */
  hasPassphrase: boolean;

  /** Indicates if a CA certificate is stored */
  hasCaCertificate: boolean;
}

/**
 * Certificate metadata extracted from a certificate
 */
export interface CertificateMetadata {
  commonName?: string;
  organization?: string;
  organizationalUnit?: string;
  country?: string;
  issuer?: string;
  issuerOrganization?: string;
  validFrom?: number;
  validTo?: number;
  serialNumber?: string;
  signatureAlgorithm?: string;
  version?: number;
}

/**
 * Result of certificate validation
 */
export interface CertificateValidationResult {
  /** Whether validation was successful */
  success: boolean;

  /** Whether the certificate is structurally valid and key pair matches */
  valid: boolean;

  /** Error message if validation failed */
  error?: string;

  /** Certificate metadata if parsing succeeded */
  metadata?: CertificateMetadata;

  /** Whether the certificate is expired */
  isExpired?: boolean;

  /** Whether the certificate is not yet valid */
  isNotYetValid?: boolean;

  /** Warning messages (e.g., expiring soon) */
  warnings?: string[];
}

/**
 * Result of importing a certificate file
 */
export interface CertificateImportResult {
  success: boolean;
  canceled?: boolean;
  error?: string;

  /** Path to the imported file */
  filePath?: string;

  /** Type of file imported */
  fileType?: string;

  /** Whether a passphrase is needed (for PFX files) */
  needsPassphrase?: boolean;

  /** Parsed certificate data */
  data?: {
    type: string;
    pem?: string;
    clientCertificate?: string;
    privateKey?: string;
    caCertificate?: string;
    metadata?: CertificateMetadata;
  };
}

/**
 * Result of mTLS connection test
 */
export interface ConnectionTestResult {
  success: boolean;
  error?: string;
  code?: string;

  /** HTTP status code */
  status?: number;

  /** HTTP status text */
  statusText?: string;

  /** Response headers of interest */
  headers?: {
    server?: string;
    contentType?: string;
  };
}

/**
 * Form data for adding/editing a certificate
 */
export interface CertificateFormData {
  name: string;
  domain: string;
  importMethod: 'separate' | 'pfx';

  // For separate files method
  clientCertificate?: string;
  privateKey?: string;

  // For PFX method
  pfxFilePath?: string;

  // Common
  caCertificate?: string;
  passphrase?: string;

  // Parsed metadata (for display)
  metadata?: CertificateMetadata;
}

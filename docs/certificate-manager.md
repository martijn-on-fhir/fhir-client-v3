# Certificate Manager & mTLS Support

This document describes the Certificate Manager feature for managing client certificates and automatic mTLS (mutual TLS) routing in FHIR Client MX.

## Overview

The Certificate Manager allows users to:
- Import and manage client certificates (PFX/P12, PEM, CRT, KEY, DER formats)
- Associate certificates with domain patterns (including wildcards)
- Test mTLS connections before use
- Automatically route FHIR requests through mTLS when certificates are configured

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Angular App                               │
├─────────────────────────────────────────────────────────────────┤
│  FhirService ──► MtlsService ──► CertificateService             │
│       │              │                   │                       │
│       ▼              ▼                   ▼                       │
│  HttpClient    electronAPI.mtls    electronAPI.certificates      │
└───────────────────────┬─────────────────┬───────────────────────┘
                        │     IPC         │
┌───────────────────────▼─────────────────▼───────────────────────┐
│                     Electron Main Process                        │
├─────────────────────────────────────────────────────────────────┤
│  mtls-handler.js ◄──► certificate-store.js                      │
│        │                     │                                   │
│        ▼                     ▼                                   │
│  https.Agent          electron-store (encrypted)                 │
└─────────────────────────────────────────────────────────────────┘
```

## Features

### Certificate Management

Access via **Menu → Certificate Manager**

- **Add Certificate**: Import certificates from files
- **Edit Certificate**: Modify name, domain, enable/disable
- **Delete Certificate**: Remove certificates from store
- **Validate**: Check certificate validity before saving
- **Test Connection**: Verify mTLS works with a test URL

### Supported Formats

| Format | Extension | Description |
|--------|-----------|-------------|
| PFX/P12 | `.pfx`, `.p12` | Combined certificate + private key (may require passphrase) |
| PEM | `.pem` | Base64 encoded certificate or key |
| CRT | `.crt`, `.cer` | Certificate file |
| KEY | `.key` | Private key file |
| DER | `.der` | Binary encoded certificate |

### Domain Matching

Certificates are matched to domains using pattern matching:

- Exact match: `api.example.com`
- Wildcard: `*.example.com` (matches `api.example.com`, `fhir.example.com`)
- Subdomain wildcard: `*.api.example.com`

### Automatic mTLS Routing

When a certificate is configured and enabled for a domain, all FHIR requests to that domain automatically use mTLS:

```typescript
// This request will use mTLS if a certificate is configured for the domain
this.fhirService.executeQuery('/Patient?name=John').subscribe(result => {
  console.log(result);
});
```

Supported operations:
- `executeQuery()` - GET requests
- `create()` / `createResource()` - POST requests
- `update()` / `updateResource()` - PUT requests
- `validateResource()` - POST to $validate endpoint
- `getMetadata()` - Server capability statement
- `search()` / `read()` - Resource queries

## File Structure

```
electron/
├── certificates/
│   ├── certificate-store.js    # Encrypted storage (electron-store)
│   ├── certificate-handler.js  # IPC handlers for CRUD operations
│   └── certificate-utils.js    # Parsing/validation with node-forge
├── mtls/
│   └── mtls-handler.js         # mTLS request proxy handler
├── main.js                     # Handler registration
└── preload.js                  # API exposure to renderer

src/app/
├── core/
│   ├── models/
│   │   └── certificate.model.ts    # TypeScript interfaces
│   └── services/
│       ├── certificate.service.ts  # Certificate management service
│       ├── mtls.service.ts         # mTLS routing service
│       └── fhir.service.ts         # FHIR service with mTLS integration
└── shared/components/
    └── certificate-manager-dialog/
        ├── certificate-manager-dialog.component.ts
        ├── certificate-manager-dialog.component.html
        └── certificate-manager-dialog.component.scss

src/types/
└── electron.d.ts               # Type definitions for Electron API
```

## Security Considerations

1. **Encrypted Storage**: Certificates are stored encrypted using electron-store
2. **Main Process Only**: Private keys never leave the Electron main process
3. **No UI Exposure**: Private keys are stripped from certificate data sent to renderer
4. **Passphrase Support**: Encrypted private keys can use passphrases

## API Reference

### CertificateService

```typescript
// Get all certificates (without private keys)
getAllCertificates(): Observable<CertificateEntryUI[]>

// Save a new certificate
saveCertificate(entry: CertificateSaveRequest): Promise<CertificateEntryUI>

// Update an existing certificate
updateCertificate(id: string, updates: Partial<CertificateEntry>): Promise<CertificateEntryUI>

// Delete a certificate
deleteCertificate(id: string): Promise<void>

// Import certificate from file
importFromFile(type: 'pfx' | 'certificate' | 'key' | 'all'): Promise<ImportResult>

// Validate certificate data
validateCertificate(data: CertificateValidateRequest): Promise<ValidationResult>

// Test mTLS connection
testConnection(id: string, testUrl: string): Promise<TestConnectionResult>
```

### MtlsService

```typescript
// Check if mTLS is available (running in Electron)
isAvailable(): boolean

// Check if domain has a configured certificate
hasCertificateForDomain(hostname: string): Promise<boolean>

// Make HTTP request through mTLS proxy
request<T>(options: MtlsRequestOptions): Promise<MtlsResponse<T>>

// Convenience methods
get<T>(url: string, headers?: Record<string, string>): Promise<MtlsResponse<T>>
post<T>(url: string, data: any, headers?: Record<string, string>): Promise<MtlsResponse<T>>
put<T>(url: string, data: any, headers?: Record<string, string>): Promise<MtlsResponse<T>>
delete<T>(url: string, headers?: Record<string, string>): Promise<MtlsResponse<T>>
```

## Dependencies

- `node-forge` - Certificate parsing and validation
- `uuid` - Unique ID generation for certificates
- `electron-store` - Encrypted persistent storage
- `axios` - HTTP client for mTLS requests in main process

## Troubleshooting

### Certificate not being used

1. Verify the certificate is **enabled** in Certificate Manager
2. Check the domain pattern matches your FHIR server URL
3. Use "Test Connection" to verify the certificate works

### Import errors

- **PFX requires passphrase**: Enter the correct passphrase when prompted
- **Invalid certificate**: Ensure the certificate file is not corrupted
- **Key mismatch**: The private key must match the certificate

### Connection test fails

- Verify the test URL is correct and accessible
- Check if the server requires a specific CA certificate
- Review the error message for SSL/TLS details

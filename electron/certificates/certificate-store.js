const { v4: uuidv4 } = require('uuid');

/**
 * Secure Certificate Storage using electron-store with encryption
 *
 * Manages client certificates for mTLS connections with encrypted persistence.
 * Private keys and passphrases are stored encrypted and never exposed to renderer.
 */

// Lazy-load electron-store to ensure it's loaded in proper Electron context
let certificateStore = null;

function getStore() {
  if (!certificateStore) {
    const Store = require('electron-store').default || require('electron-store');
    certificateStore = new Store({
      name: 'fhir-certificates',
      encryptionKey: 'fhir-client-v3-certs-key-change-in-production'
    });
  }
  return certificateStore;
}

/**
 * Save a new certificate entry
 * @param {Object} entry - Certificate entry
 * @param {string} entry.name - User-friendly name
 * @param {string} entry.domain - Domain pattern (supports wildcards like *.example.com)
 * @param {string} entry.clientCertificate - PEM-encoded client certificate
 * @param {string} entry.privateKey - PEM-encoded private key
 * @param {string} [entry.caCertificate] - Optional PEM-encoded CA certificate
 * @param {string} [entry.passphrase] - Optional passphrase for encrypted keys
 * @param {Object} [entry.metadata] - Certificate metadata (CN, issuer, dates, etc.)
 * @returns {Object} Saved certificate entry with generated ID
 */
function saveCertificate(entry) {
  const certificates = getStore().get('certificates', []);

  const newEntry = {
    id: uuidv4(),
    name: entry.name,
    domain: entry.domain,
    enabled: true,
    clientCertificate: entry.clientCertificate,
    privateKey: entry.privateKey,
    caCertificate: entry.caCertificate || null,
    passphrase: entry.passphrase || null,
    commonName: entry.metadata?.commonName || null,
    issuer: entry.metadata?.issuer || null,
    validFrom: entry.metadata?.validFrom || null,
    validTo: entry.metadata?.validTo || null,
    serialNumber: entry.metadata?.serialNumber || null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  certificates.push(newEntry);
  getStore().set('certificates', certificates);

  console.log(`[CertificateStore] Certificate saved: ${newEntry.name} (${newEntry.id})`);

  // Return entry without sensitive data for UI
  return sanitizeForUI(newEntry);
}

/**
 * Get a certificate by ID (full data including private key)
 * @param {string} id - Certificate ID
 * @returns {Object|null} Certificate entry or null if not found
 */
function getCertificate(id) {
  const certificates = getStore().get('certificates', []);
  return certificates.find(cert => cert.id === id) || null;
}

/**
 * Get all certificates (sanitized for UI, without private keys)
 * @returns {Array} Array of certificate entries without sensitive data
 */
function getAllCertificates() {
  const certificates = getStore().get('certificates', []);
  return certificates.map(sanitizeForUI);
}

/**
 * Get certificate for a specific domain
 * Supports wildcard matching (*.example.com matches api.example.com)
 * @param {string} hostname - Hostname to match
 * @returns {Object|null} Matching certificate or null
 */
function getCertificateForDomain(hostname) {
  const certificates = getStore().get('certificates', []);

  // Find enabled certificate matching the domain
  const match = certificates.find(cert => {
    if (!cert.enabled) return false;
    return domainMatches(cert.domain, hostname);
  });

  return match || null;
}

/**
 * Update an existing certificate
 * @param {string} id - Certificate ID
 * @param {Object} updates - Fields to update
 * @returns {Object|null} Updated certificate (sanitized) or null if not found
 */
function updateCertificate(id, updates) {
  const certificates = getStore().get('certificates', []);
  const index = certificates.findIndex(cert => cert.id === id);

  if (index === -1) {
    console.log(`[CertificateStore] Certificate not found for update: ${id}`);
    return null;
  }

  // Only allow updating specific fields
  const allowedUpdates = ['name', 'domain', 'enabled', 'clientCertificate', 'privateKey', 'caCertificate', 'passphrase'];
  const filteredUpdates = {};

  for (const key of allowedUpdates) {
    if (updates[key] !== undefined) {
      filteredUpdates[key] = updates[key];
    }
  }

  // If certificate data changed, update metadata too
  if (updates.metadata) {
    filteredUpdates.commonName = updates.metadata.commonName;
    filteredUpdates.issuer = updates.metadata.issuer;
    filteredUpdates.validFrom = updates.metadata.validFrom;
    filteredUpdates.validTo = updates.metadata.validTo;
    filteredUpdates.serialNumber = updates.metadata.serialNumber;
  }

  certificates[index] = {
    ...certificates[index],
    ...filteredUpdates,
    updatedAt: Date.now()
  };

  getStore().set('certificates', certificates);
  console.log(`[CertificateStore] Certificate updated: ${id}`);

  return sanitizeForUI(certificates[index]);
}

/**
 * Delete a certificate
 * @param {string} id - Certificate ID
 * @returns {boolean} True if deleted, false if not found
 */
function deleteCertificate(id) {
  const certificates = getStore().get('certificates', []);
  const index = certificates.findIndex(cert => cert.id === id);

  if (index === -1) {
    console.log(`[CertificateStore] Certificate not found for deletion: ${id}`);
    return false;
  }

  certificates.splice(index, 1);
  getStore().set('certificates', certificates);

  console.log(`[CertificateStore] Certificate deleted: ${id}`);
  return true;
}

/**
 * Clear all certificates
 */
function clearAllCertificates() {
  getStore().delete('certificates');
  console.log('[CertificateStore] All certificates cleared');
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Remove sensitive data from certificate entry for UI display
 * @param {Object} entry - Certificate entry
 * @returns {Object} Sanitized entry without private key and passphrase
 */
function sanitizeForUI(entry) {
  const { privateKey, passphrase, clientCertificate, caCertificate, ...safeEntry } = entry;
  return {
    ...safeEntry,
    hasPrivateKey: !!privateKey,
    hasPassphrase: !!passphrase,
    hasCaCertificate: !!caCertificate
  };
}

/**
 * Check if a domain pattern matches a hostname
 * Supports wildcard patterns like *.example.com
 * @param {string} pattern - Domain pattern
 * @param {string} hostname - Hostname to match
 * @returns {boolean} True if pattern matches hostname
 */
function domainMatches(pattern, hostname) {
  // Exact match
  if (pattern === hostname) {
    return true;
  }

  // Wildcard match (*.example.com)
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(2); // Remove *.
    // Match hostname that ends with suffix and has exactly one more label
    // e.g., *.example.com matches api.example.com but not deep.api.example.com
    const regex = new RegExp(`^[^.]+\\.${escapeRegex(suffix)}$`, 'i');
    return regex.test(hostname);
  }

  return false;
}

/**
 * Escape special regex characters in a string
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  saveCertificate,
  getCertificate,
  getAllCertificates,
  getCertificateForDomain,
  updateCertificate,
  deleteCertificate,
  clearAllCertificates
};

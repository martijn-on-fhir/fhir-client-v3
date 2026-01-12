const forge = require('node-forge');
const fs = require('fs').promises;
const path = require('path');

/**
 * Certificate Utilities
 *
 * Provides parsing, validation, and conversion utilities for various certificate formats.
 * Supports: PEM, CRT, KEY, PFX/P12, DER
 */

/**
 * Parse a PEM-encoded certificate and extract metadata
 * @param {string} pemData - PEM-encoded certificate string
 * @returns {Object} Certificate metadata
 * @throws {Error} If certificate cannot be parsed
 */
function parsePemCertificate(pemData) {
  try {
    const cert = forge.pki.certificateFromPem(pemData);
    return extractCertificateMetadata(cert);
  } catch (error) {
    throw new Error(`Failed to parse PEM certificate: ${error.message}`);
  }
}

/**
 * Parse a DER-encoded certificate and convert to PEM
 * @param {Buffer} derData - DER-encoded certificate buffer
 * @returns {Object} Object with pem string and metadata
 * @throws {Error} If certificate cannot be parsed
 */
function parseDerCertificate(derData) {
  try {
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(derData));
    const cert = forge.pki.certificateFromAsn1(asn1);
    const pem = forge.pki.certificateToPem(cert);

    return {
      pem,
      metadata: extractCertificateMetadata(cert)
    };
  } catch (error) {
    throw new Error(`Failed to parse DER certificate: ${error.message}`);
  }
}

/**
 * Parse a PFX/P12 file and extract certificate and private key
 * @param {Buffer} pfxData - PFX/P12 file buffer
 * @param {string} passphrase - Password for the PFX file
 * @returns {Object} Object with clientCertificate, privateKey, caCertificate (optional), and metadata
 * @throws {Error} If PFX cannot be parsed
 */
function parsePfx(pfxData, passphrase = '') {
  try {
    // Convert buffer to forge binary string
    const pfxBinary = forge.util.createBuffer(pfxData).getBytes();
    const p12Asn1 = forge.asn1.fromDer(pfxBinary);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, passphrase);

    // Extract certificate
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag];

    if (!certBag || certBag.length === 0) {
      throw new Error('No certificate found in PFX file');
    }

    // Get the main certificate (usually the first one)
    const mainCert = certBag[0].cert;
    const clientCertificate = forge.pki.certificateToPem(mainCert);

    // Extract CA certificates if present (additional certs in the chain)
    let caCertificate = null;
    if (certBag.length > 1) {
      const caCerts = certBag.slice(1).map(bag => forge.pki.certificateToPem(bag.cert));
      caCertificate = caCerts.join('\n');
    }

    // Extract private key
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    let privateKey = null;

    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
    if (keyBag && keyBag.length > 0) {
      privateKey = forge.pki.privateKeyToPem(keyBag[0].key);
    } else {
      // Try unencrypted key bag
      const unencryptedKeyBags = p12.getBags({ bagType: forge.pki.oids.keyBag });
      const unencryptedKeyBag = unencryptedKeyBags[forge.pki.oids.keyBag];
      if (unencryptedKeyBag && unencryptedKeyBag.length > 0) {
        privateKey = forge.pki.privateKeyToPem(unencryptedKeyBag[0].key);
      }
    }

    if (!privateKey) {
      throw new Error('No private key found in PFX file');
    }

    return {
      clientCertificate,
      privateKey,
      caCertificate,
      metadata: extractCertificateMetadata(mainCert)
    };
  } catch (error) {
    if (error.message.includes('Invalid password') || error.message.includes('PKCS#12')) {
      throw new Error('Invalid passphrase or corrupted PFX file');
    }
    throw new Error(`Failed to parse PFX: ${error.message}`);
  }
}

/**
 * Parse a private key (PEM format)
 * @param {string} keyPem - PEM-encoded private key
 * @param {string} [passphrase] - Optional passphrase for encrypted keys
 * @returns {Object} Parsed private key object from forge
 * @throws {Error} If key cannot be parsed
 */
function parsePrivateKey(keyPem, passphrase = null) {
  try {
    // Check if key is encrypted
    if (keyPem.includes('ENCRYPTED')) {
      if (!passphrase) {
        throw new Error('Private key is encrypted but no passphrase provided');
      }
      return forge.pki.decryptRsaPrivateKey(keyPem, passphrase);
    }
    return forge.pki.privateKeyFromPem(keyPem);
  } catch (error) {
    throw new Error(`Failed to parse private key: ${error.message}`);
  }
}

/**
 * Validate that a certificate and private key are a matching pair
 * @param {string} certPem - PEM-encoded certificate
 * @param {string} keyPem - PEM-encoded private key
 * @param {string} [passphrase] - Optional passphrase for encrypted keys
 * @returns {boolean} True if the pair matches
 * @throws {Error} If validation fails
 */
function validateCertificateKeyPair(certPem, keyPem, passphrase = null) {
  try {
    const cert = forge.pki.certificateFromPem(certPem);
    const key = parsePrivateKey(keyPem, passphrase);

    if (!key) {
      throw new Error('Could not parse private key');
    }

    // Get public key from certificate
    const certPublicKey = cert.publicKey;

    // Derive public key from private key
    const derivedPublicKey = forge.pki.setRsaPublicKey(key.n, key.e);

    // Compare modulus (n) values - they should match for RSA keys
    const certModulus = certPublicKey.n.toString(16);
    const keyModulus = derivedPublicKey.n.toString(16);

    return certModulus === keyModulus;
  } catch (error) {
    throw new Error(`Certificate/key validation failed: ${error.message}`);
  }
}

/**
 * Validate a certificate (check structure and dates)
 * @param {string} certPem - PEM-encoded certificate
 * @returns {Object} Validation result with valid flag and any errors
 */
function validateCertificate(certPem) {
  try {
    const cert = forge.pki.certificateFromPem(certPem);
    const now = new Date();
    const metadata = extractCertificateMetadata(cert);

    const errors = [];

    // Check if certificate is not yet valid
    if (cert.validity.notBefore > now) {
      errors.push(`Certificate not valid until ${cert.validity.notBefore.toISOString()}`);
    }

    // Check if certificate has expired
    if (cert.validity.notAfter < now) {
      errors.push(`Certificate expired on ${cert.validity.notAfter.toISOString()}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      metadata,
      isExpired: cert.validity.notAfter < now,
      isNotYetValid: cert.validity.notBefore > now
    };
  } catch (error) {
    return {
      valid: false,
      errors: [`Failed to parse certificate: ${error.message}`],
      metadata: null
    };
  }
}

/**
 * Read and parse a certificate file based on its extension
 * @param {string} filePath - Path to the certificate file
 * @param {string} [passphrase] - Optional passphrase for PFX/encrypted files
 * @returns {Promise<Object>} Parsed certificate data
 */
async function readCertificateFile(filePath, passphrase = null) {
  const ext = path.extname(filePath).toLowerCase();
  const data = await fs.readFile(filePath);

  switch (ext) {
    case '.pem':
    case '.crt':
    case '.cer': {
      // Check if it's text (PEM) or binary (DER)
      const content = data.toString('utf8');
      if (content.includes('-----BEGIN')) {
        // PEM format
        return {
          type: 'pem',
          pem: content,
          metadata: parsePemCertificate(content)
        };
      } else {
        // DER format
        const result = parseDerCertificate(data);
        return {
          type: 'der',
          ...result
        };
      }
    }

    case '.der': {
      const result = parseDerCertificate(data);
      return {
        type: 'der',
        ...result
      };
    }

    case '.key': {
      const content = data.toString('utf8');
      // Validate it's a key
      parsePrivateKey(content, passphrase);
      return {
        type: 'key',
        pem: content
      };
    }

    case '.pfx':
    case '.p12': {
      const result = parsePfx(data, passphrase || '');
      return {
        type: 'pfx',
        ...result
      };
    }

    default:
      throw new Error(`Unsupported certificate format: ${ext}`);
  }
}

/**
 * Get supported file extensions for certificate import
 * @returns {Object} Object with filters for file dialog
 */
function getSupportedExtensions() {
  return {
    all: [
      { name: 'All Certificate Files', extensions: ['pem', 'crt', 'cer', 'der', 'key', 'pfx', 'p12'] },
      { name: 'PEM Files', extensions: ['pem', 'crt', 'cer'] },
      { name: 'DER Files', extensions: ['der'] },
      { name: 'Private Key Files', extensions: ['key', 'pem'] },
      { name: 'PKCS#12 Files', extensions: ['pfx', 'p12'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    certificate: [
      { name: 'Certificate Files', extensions: ['pem', 'crt', 'cer', 'der'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    key: [
      { name: 'Private Key Files', extensions: ['key', 'pem'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    pfx: [
      { name: 'PKCS#12 Files', extensions: ['pfx', 'p12'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract metadata from a forge certificate object
 * @param {Object} cert - Forge certificate object
 * @returns {Object} Certificate metadata
 */
function extractCertificateMetadata(cert) {
  const getField = (obj, field) => {
    const f = obj.getField(field);
    return f ? f.value : null;
  };

  return {
    commonName: getField(cert.subject, 'CN'),
    organization: getField(cert.subject, 'O'),
    organizationalUnit: getField(cert.subject, 'OU'),
    country: getField(cert.subject, 'C'),
    issuer: getField(cert.issuer, 'CN') || getField(cert.issuer, 'O'),
    issuerOrganization: getField(cert.issuer, 'O'),
    validFrom: cert.validity.notBefore.getTime(),
    validTo: cert.validity.notAfter.getTime(),
    serialNumber: cert.serialNumber,
    signatureAlgorithm: forge.pki.oids[cert.signatureOid] || cert.signatureOid,
    version: cert.version + 1 // X.509 versions are 0-indexed
  };
}

module.exports = {
  parsePemCertificate,
  parseDerCertificate,
  parsePfx,
  parsePrivateKey,
  validateCertificateKeyPair,
  validateCertificate,
  readCertificateFile,
  getSupportedExtensions,
  extractCertificateMetadata
};

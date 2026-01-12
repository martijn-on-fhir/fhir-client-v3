const { ipcMain, dialog } = require('electron');
const https = require('https');
const axios = require('axios');

let certificateStore;
let certificateUtils;

try {
  certificateStore = require('./certificate-store');
  certificateUtils = require('./certificate-utils');
} catch (error) {
  console.error('[CertificateHandler] Failed to load dependencies:', error);
}

/**
 * Certificate IPC Handlers
 *
 * Registers IPC handlers for certificate management operations.
 * All certificate data is stored encrypted in the main process.
 */

function registerCertificateHandlers() {
  console.log('[CertificateHandler] Registering certificate IPC handlers');

  if (!certificateStore || !certificateUtils) {
    console.error('[CertificateHandler] Dependencies not loaded, skipping handler registration');
    return;
  }

  // ==========================================================================
  // Certificate CRUD Operations
  // ==========================================================================

  /**
   * Get all certificates (sanitized for UI)
   */
  ipcMain.handle('certificate:getAll', async () => {
    try {
      const certificates = certificateStore.getAllCertificates();
      return { success: true, certificates };
    } catch (error) {
      console.error('[CertificateHandler] Error getting certificates:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Save a new certificate
   */
  ipcMain.handle('certificate:save', async (event, entry) => {
    try {
      // Validate certificate/key pair before saving
      if (entry.clientCertificate && entry.privateKey) {
        const isValid = certificateUtils.validateCertificateKeyPair(
          entry.clientCertificate,
          entry.privateKey,
          entry.passphrase
        );

        if (!isValid) {
          return { success: false, error: 'Certificate and private key do not match' };
        }
      }

      const savedCert = certificateStore.saveCertificate(entry);
      return { success: true, certificate: savedCert };
    } catch (error) {
      console.error('[CertificateHandler] Error saving certificate:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Update an existing certificate
   */
  ipcMain.handle('certificate:update', async (event, id, updates) => {
    try {
      // If updating cert/key, validate the pair
      if (updates.clientCertificate && updates.privateKey) {
        const isValid = certificateUtils.validateCertificateKeyPair(
          updates.clientCertificate,
          updates.privateKey,
          updates.passphrase
        );

        if (!isValid) {
          return { success: false, error: 'Certificate and private key do not match' };
        }
      }

      const updatedCert = certificateStore.updateCertificate(id, updates);
      if (!updatedCert) {
        return { success: false, error: 'Certificate not found' };
      }

      return { success: true, certificate: updatedCert };
    } catch (error) {
      console.error('[CertificateHandler] Error updating certificate:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Delete a certificate
   */
  ipcMain.handle('certificate:delete', async (event, id) => {
    try {
      const deleted = certificateStore.deleteCertificate(id);
      return { success: deleted, error: deleted ? null : 'Certificate not found' };
    } catch (error) {
      console.error('[CertificateHandler] Error deleting certificate:', error);
      return { success: false, error: error.message };
    }
  });

  // ==========================================================================
  // Certificate Import and Validation
  // ==========================================================================

  /**
   * Import certificate from file (opens file dialog)
   * @param {string} type - 'pfx', 'certificate', 'key', or 'all'
   */
  ipcMain.handle('certificate:import', async (event, type = 'all') => {
    try {
      const extensions = certificateUtils.getSupportedExtensions();
      const filters = extensions[type] || extensions.all;

      const result = await dialog.showOpenDialog({
        title: 'Import Certificate',
        filters,
        properties: ['openFile']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const filePath = result.filePaths[0];

      // For PFX files, we might need a passphrase - return that we need it
      const ext = filePath.toLowerCase();
      if (ext.endsWith('.pfx') || ext.endsWith('.p12')) {
        return {
          success: true,
          needsPassphrase: true,
          filePath,
          fileType: 'pfx'
        };
      }

      // Read and parse the file
      const parsed = await certificateUtils.readCertificateFile(filePath);

      return {
        success: true,
        filePath,
        fileType: parsed.type,
        data: parsed
      };
    } catch (error) {
      console.error('[CertificateHandler] Error importing certificate:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Parse a PFX file with passphrase
   */
  ipcMain.handle('certificate:parsePfx', async (event, filePath, passphrase) => {
    try {
      const parsed = await certificateUtils.readCertificateFile(filePath, passphrase);
      return {
        success: true,
        data: parsed
      };
    } catch (error) {
      console.error('[CertificateHandler] Error parsing PFX:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Validate certificate data without saving
   */
  ipcMain.handle('certificate:validate', async (event, data) => {
    try {
      const { clientCertificate, privateKey, passphrase } = data;

      // Validate the certificate itself
      const certValidation = certificateUtils.validateCertificate(clientCertificate);

      if (!certValidation.valid && certValidation.errors.length > 0) {
        // Certificate structure is invalid
        if (!certValidation.metadata) {
          return {
            success: false,
            valid: false,
            error: certValidation.errors[0]
          };
        }
      }

      // Validate cert/key pair if key provided
      if (privateKey) {
        try {
          const pairValid = certificateUtils.validateCertificateKeyPair(
            clientCertificate,
            privateKey,
            passphrase
          );

          if (!pairValid) {
            return {
              success: true,
              valid: false,
              error: 'Certificate and private key do not match',
              metadata: certValidation.metadata
            };
          }
        } catch (keyError) {
          return {
            success: true,
            valid: false,
            error: keyError.message,
            metadata: certValidation.metadata
          };
        }
      }

      return {
        success: true,
        valid: true,
        metadata: certValidation.metadata,
        isExpired: certValidation.isExpired,
        isNotYetValid: certValidation.isNotYetValid,
        warnings: certValidation.errors // Expiry warnings
      };
    } catch (error) {
      console.error('[CertificateHandler] Error validating certificate:', error);
      return { success: false, valid: false, error: error.message };
    }
  });

  // ==========================================================================
  // Connection Testing
  // ==========================================================================

  /**
   * Test mTLS connection using a stored certificate
   */
  ipcMain.handle('certificate:testConnection', async (event, { id, testUrl }) => {
    try {
      // Get the full certificate (including private key)
      const cert = certificateStore.getCertificate(id);

      if (!cert) {
        return { success: false, error: 'Certificate not found' };
      }

      if (!cert.enabled) {
        return { success: false, error: 'Certificate is disabled' };
      }

      // Create HTTPS agent with client certificate
      const agentOptions = {
        cert: cert.clientCertificate,
        key: cert.privateKey,
        rejectUnauthorized: true // Verify server certificate
      };

      if (cert.caCertificate) {
        agentOptions.ca = cert.caCertificate;
      }

      if (cert.passphrase) {
        agentOptions.passphrase = cert.passphrase;
      }

      const httpsAgent = new https.Agent(agentOptions);

      // Make HEAD request to test connection
      const response = await axios.head(testUrl, {
        httpsAgent,
        timeout: 10000, // 10 second timeout
        validateStatus: () => true // Accept any status code
      });

      return {
        success: true,
        status: response.status,
        statusText: response.statusText,
        headers: {
          server: response.headers['server'],
          contentType: response.headers['content-type']
        }
      };
    } catch (error) {
      console.error('[CertificateHandler] Connection test failed:', error);

      // Parse common errors
      let errorMessage = error.message;

      if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Connection refused - server may be down';
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        errorMessage = 'Connection timeout';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'Host not found - check the URL';
      } else if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
        errorMessage = 'Server certificate verification failed';
      } else if (error.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
        errorMessage = 'Server certificate hostname mismatch';
      } else if (error.message.includes('SSL')) {
        errorMessage = `SSL/TLS error: ${error.message}`;
      }

      return {
        success: false,
        error: errorMessage,
        code: error.code
      };
    }
  });

  /**
   * Test connection with certificate data (before saving)
   */
  ipcMain.handle('certificate:testConnectionWithData', async (event, { testUrl, clientCertificate, privateKey, caCertificate, passphrase }) => {
    try {
      const agentOptions = {
        cert: clientCertificate,
        key: privateKey,
        rejectUnauthorized: true
      };

      if (caCertificate) {
        agentOptions.ca = caCertificate;
      }

      if (passphrase) {
        agentOptions.passphrase = passphrase;
      }

      const httpsAgent = new https.Agent(agentOptions);

      const response = await axios.head(testUrl, {
        httpsAgent,
        timeout: 10000,
        validateStatus: () => true
      });

      return {
        success: true,
        status: response.status,
        statusText: response.statusText,
        headers: {
          server: response.headers['server'],
          contentType: response.headers['content-type']
        }
      };
    } catch (error) {
      console.error('[CertificateHandler] Connection test with data failed:', error);

      let errorMessage = error.message;

      if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Connection refused - server may be down';
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        errorMessage = 'Connection timeout';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'Host not found - check the URL';
      }

      return {
        success: false,
        error: errorMessage,
        code: error.code
      };
    }
  });

  console.log('[CertificateHandler] Certificate handlers registered');
}

module.exports = { registerCertificateHandlers };

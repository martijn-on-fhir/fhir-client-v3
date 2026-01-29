const { ipcMain } = require('electron');
const https = require('https');
const http = require('http');
const axios = require('axios');
const log = require('electron-log/main');

let certificateStore;

try {
  certificateStore = require('../certificates/certificate-store');
} catch (error) {
  log.error('[MtlsHandler] Failed to load certificate store:', error);
}

/**
 * mTLS Request Handler
 *
 * Proxies HTTP/HTTPS requests through Electron with client certificate authentication.
 * Automatically selects the appropriate certificate based on the request domain.
 */

function registerMtlsHandlers() {

  log.info('[MtlsHandler] Registering mTLS IPC handlers');

  if (!certificateStore) {
    log.error('[MtlsHandler] Certificate store not loaded, skipping handler registration');
    return;
  }

  /**
   * Check if a domain has a configured certificate
   */
  ipcMain.handle('mtls:hasCertificate', async (event, hostname) => {

    try {
      const cert = certificateStore.getCertificateForDomain(hostname);
      log.info(`[MtlsHandler] hasCertificate check for "${hostname}": found=${!!cert}, enabled=${cert?.enabled ?? false}${cert ? `, name="${cert.name}", domain="${cert.domain}"` : ''}`);
      return { hasCertificate: !!cert, enabled: cert?.enabled ?? false };
    } catch (error) {
      log.error('[MtlsHandler] Error checking certificate:', error);
      return { hasCertificate: false, enabled: false };
    }
  });

  /**
   * Make an HTTP request with mTLS client certificate
   */
  ipcMain.handle('mtls:request', async (event, options) => {

    const { url, method = 'GET', headers = {}, data, timeout = 30000 } = options;

    try {
      // Parse URL to get hostname
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname;

      // Find matching certificate for domain
      const cert = certificateStore.getCertificateForDomain(hostname);

      if (!cert) {
        return {
          success: false,
          error: `No certificate configured for domain: ${hostname}`
        };
      }

      if (!cert.enabled) {
        return {
          success: false,
          error: `Certificate for domain ${hostname} is disabled`
        };
      }

      const headerKeys = Object.keys(headers);
      const hasAuth = headerKeys.some(k => k.toLowerCase() === 'authorization');
      log.info(`[MtlsHandler] Making mTLS ${method} request to ${url}`);
      log.info(`[MtlsHandler]   Certificate: "${cert.name}" (domain: "${cert.domain}")`);
      log.info(`[MtlsHandler]   Headers: [${headerKeys.join(', ')}], hasAuth=${hasAuth}, hasCa=${!!cert.caCertificate}, hasPassphrase=${!!cert.passphrase}`);

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

      // Make the request
      const response = await axios({
        url,
        method,
        headers: {
          ...headers,
          // Ensure FHIR content type if not specified
          'Accept': headers['Accept'] || 'application/fhir+json',
          'Content-Type': headers['Content-Type'] || 'application/fhir+json'
        },
        data,
        httpsAgent,
        timeout,
        validateStatus: () => true // Don't throw on any status code
      });

      log.info(`[MtlsHandler]   Response: ${response.status} ${response.statusText}`);

      return {
        success: true,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data
      };
    } catch (error) {
      log.error('[MtlsHandler] Request failed:', error);

      // Parse common errors
      let errorMessage = error.message;
      let errorCode = error.code;

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
      } else if (error.message?.includes('SSL') || error.message?.includes('TLS')) {
        errorMessage = `SSL/TLS error: ${error.message}`;
      } else if (error.response) {
        // Server responded with error status
        return {
          success: true, // Request completed, just got error status
          status: error.response.status,
          statusText: error.response.statusText,
          headers: error.response.headers,
          data: error.response.data
        };
      }

      return {
        success: false,
        error: errorMessage,
        code: errorCode
      };
    }
  });

  /**
   * Get certificate info for a domain (for debugging/display)
   */
  ipcMain.handle('mtls:getCertificateInfo', async (event, hostname) => {

    try {
      const cert = certificateStore.getCertificateForDomain(hostname);

      if (!cert) {
        return { found: false };
      }

      // Return sanitized info (no private key)
      return {
        found: true,
        certificate: {
          id: cert.id,
          name: cert.name,
          domain: cert.domain,
          enabled: cert.enabled,
          commonName: cert.commonName,
          issuer: cert.issuer,
          validFrom: cert.validFrom,
          validTo: cert.validTo
        }
      };
    } catch (error) {
      log.error('[MtlsHandler] Error getting certificate info:', error);
      return { found: false, error: error.message };
    }
  });

  log.info('[MtlsHandler] mTLS handlers registered');
}

module.exports = { registerMtlsHandlers };

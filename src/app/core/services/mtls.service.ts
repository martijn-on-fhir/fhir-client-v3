import { Injectable } from '@angular/core';

/**
 * mTLS Service
 *
 * Provides mTLS (mutual TLS) request capabilities through Electron.
 * Automatically uses client certificates when configured for the target domain.
 */
@Injectable({
  providedIn: 'root'
})
export class MtlsService {
  // Cache for domain certificate checks
  private certificateCache = new Map<string, { hasCertificate: boolean; enabled: boolean; timestamp: number }>();
  private cacheTimeout = 30000; // 30 seconds

  /**
   * Check if mTLS API is available (running in Electron)
   */
  isAvailable(): boolean {
    return !!window.electronAPI?.mtls;
  }

  /**
   * Check if a hostname has a configured certificate
   * Results are cached for 30 seconds
   */
  async hasCertificateForDomain(hostname: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    // Check cache
    const cached = this.certificateCache.get(hostname);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.hasCertificate && cached.enabled;
    }

    try {
      const result = await window.electronAPI!.mtls!.hasCertificate(hostname);

      // Update cache
      this.certificateCache.set(hostname, {
        hasCertificate: result.hasCertificate,
        enabled: result.enabled,
        timestamp: Date.now()
      });

      return result.hasCertificate && result.enabled;
    } catch (error) {
      console.error('[MtlsService] Error checking certificate:', error);
      return false;
    }
  }

  /**
   * Clear the certificate cache (call after adding/removing certificates)
   */
  clearCache(): void {
    this.certificateCache.clear();
  }

  /**
   * Make an HTTP request through mTLS proxy
   */
  async request<T = any>(options: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    data?: any;
    timeout?: number;
  }): Promise<MtlsResponse<T>> {

    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'mTLS API not available'
      };
    }

    try {

      const result = await window.electronAPI!.mtls!.request(options);

      if (result.success) {
        return {
          success: true,
          status: result.status,
          statusText: result.statusText,
          headers: result.headers,
          data: result.data as T
        };

      } else {
        return {
          success: false,
          error: result.error,
          code: result.code
        };
      }
    } catch (error) {
      console.error('[MtlsService] Request failed:', error);
      return {
        success: false,
        error: String(error)
      };
    }
  }

  /**
   * GET request through mTLS proxy
   */
  async get<T = any>(url: string, headers?: Record<string, string>): Promise<MtlsResponse<T>> {
    return this.request<T>({ url, method: 'GET', headers });
  }

  /**
   * POST request through mTLS proxy
   */
  async post<T = any>(url: string, data: any, headers?: Record<string, string>): Promise<MtlsResponse<T>> {
    return this.request<T>({ url, method: 'POST', data, headers });
  }

  /**
   * PUT request through mTLS proxy
   */
  async put<T = any>(url: string, data: any, headers?: Record<string, string>): Promise<MtlsResponse<T>> {
    return this.request<T>({ url, method: 'PUT', data, headers });
  }

  /**
   * DELETE request through mTLS proxy
   */
  async delete<T = any>(url: string, headers?: Record<string, string>): Promise<MtlsResponse<T>> {
    return this.request<T>({ url, method: 'DELETE', headers });
  }

  /**
   * Get certificate info for a domain
   */
  async getCertificateInfo(hostname: string): Promise<CertificateInfo | null> {

    if (!this.isAvailable()) {
      return null;
    }

    try {
      const result = await window.electronAPI!.mtls!.getCertificateInfo(hostname);

      if (result.found && result.certificate) {
        return result.certificate;
      }
      return null;
    } catch (error) {
      console.error('[MtlsService] Error getting certificate info:', error);
      return null;
    }
  }
}

/**
 * Response from mTLS request
 */
export interface MtlsResponse<T = any> {
  success: boolean;
  status?: number;
  statusText?: string;
  headers?: Record<string, any>;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Certificate info for a domain
 */
export interface CertificateInfo {
  id: string;
  name: string;
  domain: string;
  enabled: boolean;
  commonName?: string;
  issuer?: string;
  validFrom?: number;
  validTo?: number;
}

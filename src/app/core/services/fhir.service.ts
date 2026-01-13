import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { getEnvironmentConfig } from '../config/environments';
import { LoggerService } from './logger.service';
import { MtlsService } from './mtls.service';

/**
 * FHIR Service - Central service for all FHIR operations
 *
 * Uses RxJS Observables for async operations (cleaner than React promises!)
 * Dependency Injection makes this service available everywhere
 *
 * Note: Authentication is handled automatically by the HTTP interceptor.
 * The FHIR server URL is determined from the authenticated environment.
 */
@Injectable({
  providedIn: 'root' // Singleton service
})
export class FhirService {
  private http = inject(HttpClient);
  private loggerService = inject(LoggerService);
  private mtlsService = inject(MtlsService);
  private get logger() {
    return this.loggerService.component('FhirService');
  }

  /**
   * Get the FHIR server base URL from the current environment
   * This will be set automatically after login
   */
  private getFhirServerUrl(): string {
    // Check if we have stored token with environment info
    const storedTokenStr = localStorage.getItem('fhir_token');
    if (storedTokenStr) {
      try {
        const storedToken = JSON.parse(storedTokenStr);
        if (storedToken.fhir_server) {
          return storedToken.fhir_server;
        }
        if (storedToken.environment) {
          const config = getEnvironmentConfig(storedToken.environment);
          if (config) {
            return config.fhirServer;
          }
        }
      } catch (error) {
        this.logger.error('Failed to parse stored token:', error);
      }
    }

    // Fallback to Adapcare development FHIR server
    return 'https://fhir-adapcare.dev.carebeat-connector.nl';
  }

  /**
   * Get the current base URL
   */
  private get baseUrl(): string {
    return this.getFhirServerUrl();
  }

  /**
   * Get the FHIR server base URL (public accessor)
   */
  getServerUrl(): string {
    return this.getFhirServerUrl();
  }

  /**
   * Execute a FHIR query
   * Automatically routes through mTLS when a certificate is configured for the domain
   *
   * @example
   * ```typescript
   * this.fhirService.executeQuery('/Patient?name=John')
   *   .pipe(
   *     catchError(err => this.handleError(err))
   *   )
   *   .subscribe(result => console.log(result));
   * ```
   */
  executeQuery<T = any>(query: string): Observable<T> {
    const url = query.startsWith('http') ? query : `${this.baseUrl}${query}`;

    // Check if mTLS is needed for this URL
    return from(this.checkMtlsRequired(url)).pipe(
      switchMap(useMtls => {
        if (useMtls) {
          this.logger.debug('Using mTLS for request:', url);
          return this.executeMtlsRequest<T>(url, 'GET');
        }
        return this.http.get<T>(url);
      }),
      catchError(error => {
        this.logger.error('Query failed:', error);
        return throwError(() => new Error(error.message || 'FHIR query failed'));
      })
    );
  }

  /**
   * Check if mTLS is required for a URL
   */
  private async checkMtlsRequired(url: string): Promise<boolean> {
    try {
      const hostname = new URL(url).hostname;
      return await this.mtlsService.hasCertificateForDomain(hostname);
    } catch {
      return false;
    }
  }

  /**
   * Execute request through mTLS proxy
   */
  private executeMtlsRequest<T>(url: string, method: string, data?: any): Observable<T> {
    return from(this.mtlsService.request<T>({
      url,
      method,
      data,
      headers: {
        'Accept': 'application/fhir+json',
        'Content-Type': 'application/fhir+json'
      }
    })).pipe(
      switchMap(response => {
        if (response.success && response.data !== undefined) {
          return from([response.data]);
        }
        return throwError(() => new Error(response.error || 'mTLS request failed'));
      })
    );
  }

  /**
   * Get server metadata (CapabilityStatement)
   */
  getMetadata(): Observable<any> {
    return this.executeQuery('/metadata');
  }

  /**
   * Get StructureDefinition by URL
   */
  getStructureDefinition(url: string): Observable<any> {
    const encodedUrl = encodeURIComponent(url);

    // Try multiple strategies (just like React version)
    // Use _summary=false to ensure we get the full snapshot
    return this.executeQuery(`/administration/StructureDefinition?url=${encodedUrl}&_summary=false`).pipe(
      map(response => {
        if (response.entry && response.entry.length > 0) {
          return response.entry[0].resource;
        }
        throw new Error('StructureDefinition not found');
      }),
      catchError(() => {
        // Fallback: try direct read by ID
        const urlParts = url.split('/');
        const potentialId = urlParts[urlParts.length - 1];
        return this.executeQuery(`/administration/StructureDefinition/${potentialId}`);
      })
    );
  }

  /**
   * Search for resources
   */
  search(resourceType: string, params: Record<string, string>): Observable<any> {
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');

    return this.executeQuery(`/${resourceType}?${queryString}`);
  }

  /**
   * Read a specific resource by ID
   */
  read(resourceType: string, id: string): Observable<any> {
    return this.executeQuery(`/${resourceType}/${id}`);
  }

  /**
   * Create a new resource
   * Automatically routes through mTLS when a certificate is configured for the domain
   */
  create(resource: any): Observable<any> {
    const url = `${this.baseUrl}/${resource.resourceType}`;
    return from(this.checkMtlsRequired(url)).pipe(
      switchMap(useMtls => {
        if (useMtls) {
          this.logger.debug('Using mTLS for create:', url);
          return this.executeMtlsRequest(url, 'POST', resource);
        }
        return this.http.post(url, resource);
      }),
      catchError(error => {
        this.logger.error('Create failed:', error);
        return throwError(() => new Error(error.message || 'Failed to create resource'));
      })
    );
  }

  /**
   * Update an existing resource
   * Automatically routes through mTLS when a certificate is configured for the domain
   */
  update(resource: any): Observable<any> {
    const url = `${this.baseUrl}/${resource.resourceType}/${resource.id}`;
    return from(this.checkMtlsRequired(url)).pipe(
      switchMap(useMtls => {
        if (useMtls) {
          this.logger.debug('Using mTLS for update:', url);
          return this.executeMtlsRequest(url, 'PUT', resource);
        }
        return this.http.put(url, resource);
      }),
      catchError(error => {
        this.logger.error('Update failed:', error);
        return throwError(() => new Error(error.message || 'Failed to update resource'));
      })
    );
  }

  /**
   * Create a new resource (explicit method for ResourceEditorDialog)
   * Automatically routes through mTLS when a certificate is configured for the domain
   */
  createResource(resourceType: string, resource: any): Observable<any> {
    const url = `${this.baseUrl}/${resourceType}`;
    return from(this.checkMtlsRequired(url)).pipe(
      switchMap(useMtls => {
        if (useMtls) {
          this.logger.debug('Using mTLS for createResource:', url);
          return this.executeMtlsRequest(url, 'POST', resource);
        }
        return this.http.post(url, resource);
      }),
      catchError(error => {
        this.logger.error('Create failed:', error);
        return throwError(() => new Error(error.message || 'Failed to create resource'));
      })
    );
  }

  /**
   * Update an existing resource (explicit method for ResourceEditorDialog)
   * Automatically routes through mTLS when a certificate is configured for the domain
   */
  updateResource(resourceType: string, id: string, resource: any): Observable<any> {
    const url = `${this.baseUrl}/${resourceType}/${id}`;
    return from(this.checkMtlsRequired(url)).pipe(
      switchMap(useMtls => {
        if (useMtls) {
          this.logger.debug('Using mTLS for updateResource:', url);
          return this.executeMtlsRequest(url, 'PUT', resource);
        }
        return this.http.put(url, resource);
      }),
      catchError(error => {
        this.logger.error('Update failed:', error);
        return throwError(() => new Error(error.message || 'Failed to update resource'));
      })
    );
  }

  /**
   * Validate a resource using FHIR $validate operation
   * Automatically routes through mTLS when a certificate is configured for the domain
   *
   * @example
   * ```typescript
   * this.fhirService.validateResource('Patient', patientResource)
   *   .subscribe(operationOutcome => console.log(operationOutcome));
   * ```
   */
  validateResource(resourceType: string, resource: any): Observable<any> {
    const url = `${this.baseUrl}/${resourceType}/$validate`;
    return from(this.checkMtlsRequired(url)).pipe(
      switchMap(useMtls => {
        if (useMtls) {
          this.logger.debug('Using mTLS for validateResource:', url);
          return this.executeMtlsRequest(url, 'POST', resource);
        }
        return this.http.post(url, resource);
      }),
      catchError(error => {
        this.logger.error('Validation failed:', error);
        // Even if validation fails, the server might return an OperationOutcome
        // If so, we want to return it, not throw
        if (error.error && error.error.resourceType === 'OperationOutcome') {
          return from([error.error]);
        }
        return throwError(() => new Error(error.message || 'Validation failed'));
      })
    );
  }
}

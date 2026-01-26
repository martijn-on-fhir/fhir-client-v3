import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { getEnvironmentConfig } from '../config/environments';
import { LoggerService } from './logger.service';
import { MtlsService } from './mtls.service';
import { ServerProfileService } from './server-profile.service';

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
  private profileService = inject(ServerProfileService);
  private get logger() {
    return this.loggerService.component('FhirService');
  }

  /**
   * Get the FHIR server base URL from the active server profile
   * Falls back to legacy token storage for backwards compatibility
   */
  private getFhirServerUrl(): string {
    // First, check for active server profile
    const activeProfile = this.profileService.activeProfile();
    if (activeProfile?.fhirServerUrl) {
      return activeProfile.fhirServerUrl;
    }

    // Fallback: Check legacy stored token with environment info
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

    // Fallback to default FHIR server
    /**
     * @todo must be removed after login and server accounts are fixed
     */
    return 'https://fhir-adapcare.dev.carebeat-connector.nl';
  }

  /**
   * Get auth headers from the active server profile
   */
  private async getProfileAuthHeaders(): Promise<Record<string, string>> {
    return this.profileService.getActiveAuthHeaders();
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
   * Generate a cURL command for a FHIR query
   * @param query The query string (e.g., '/Patient/123')
   * @param method HTTP method (default: GET)
   * @param body Optional request body for POST/PUT
   * @param redactAuth Whether to redact auth tokens (default: true)
   * @returns Promise<string> The cURL command
   */
  async generateCurl(
    query: string,
    method: string = 'GET',
    body?: any,
    redactAuth: boolean = true
  ): Promise<string> {
    const url = query.startsWith('http') ? query : `${this.baseUrl}${query}`;
    const authHeaders = await this.getProfileAuthHeaders();

    const parts: string[] = ['curl'];

    // Add method if not GET
    if (method !== 'GET') {
      parts.push(`-X ${method}`);
    }

    // Add headers
    parts.push("-H 'Accept: application/fhir+json'");

    if (body) {
      parts.push("-H 'Content-Type: application/fhir+json'");
    }

    // Add auth headers (redacted or full)
    for (const [key, value] of Object.entries(authHeaders)) {
      if (redactAuth && key.toLowerCase() === 'authorization') {
        // Redact the token but show the auth type
        const authType = value.split(' ')[0] || 'Bearer';
        parts.push(`-H '${key}: ${authType} [REDACTED]'`);
      } else {
        parts.push(`-H '${key}: ${value}'`);
      }
    }

    // Add body for POST/PUT
    if (body) {
      const jsonBody = typeof body === 'string' ? body : JSON.stringify(body);
      // Escape single quotes in JSON
      const escapedBody = jsonBody.replace(/'/g, "'\\''");
      parts.push(`-d '${escapedBody}'`);
    }

    // Add URL (quoted to handle special characters)
    parts.push(`'${url}'`);

    return parts.join(' \\\n  ');
  }

  /**
   * Execute a FHIR query
   * Automatically routes through mTLS when a certificate is configured for the domain
   * Uses auth headers from the active server profile
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

    // Check if mTLS is needed for this URL and get auth headers
    return from(Promise.all([
      this.checkMtlsRequired(url),
      this.getProfileAuthHeaders()
    ])).pipe(
      switchMap(([useMtls, authHeaders]) => {
        if (useMtls) {
          this.logger.debug('Using mTLS for request:', url);
          return this.executeMtlsRequest<T>(url, 'GET');
        }

        // Apply profile auth headers if available
        const options = Object.keys(authHeaders).length > 0
          ? { headers: new HttpHeaders(authHeaders) }
          : {};

        return this.http.get<T>(url, options);
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
   * Get the history of a specific resource
   * Returns a Bundle containing all versions of the resource
   */
  history(resourceType: string, id: string): Observable<any> {
    return this.executeQuery(`/${resourceType}/${id}/_history`);
  }

  /**
   * Validate a resource on the server using $validate operation
   * @param resource The FHIR resource to validate
   * @param profileUrl Optional profile URL to validate against
   * @returns Observable of OperationOutcome
   */
  validateOnServer(resource: any, profileUrl?: string): Observable<any> {
    const resourceType = resource.resourceType;

    if (!resourceType) {
      return throwError(() => new Error('Resource must have a resourceType'));
    }

    let url = `${this.baseUrl}/${resourceType}/$validate`;

    if (profileUrl) {
      url += `?profile=${encodeURIComponent(profileUrl)}`;
    }

    return from(Promise.all([
      this.checkMtlsRequired(url),
      this.getProfileAuthHeaders()
    ])).pipe(
      switchMap(([useMtls, authHeaders]) => {
        if (useMtls) {
          this.logger.debug('Using mTLS for $validate:', url);

          return this.executeMtlsRequest(url, 'POST', resource);
        }

        const headers = new HttpHeaders({
          ...authHeaders,
          'Content-Type': 'application/fhir+json',
          'Accept': 'application/fhir+json'
        });

        return this.http.post(url, resource, { headers });
      }),
      catchError(error => {
        this.logger.error('Validation failed:', error);

        // If the server returns an OperationOutcome in the error, extract it
        if (error.error?.resourceType === 'OperationOutcome') {
          return from([error.error]);
        }

        return throwError(() => new Error(error.message || 'Server validation failed'));
      })
    );
  }

  /**
   * Get available StructureDefinitions (profiles) from the server
   * @param resourceType Optional filter by resource type
   * @returns Observable of Bundle containing StructureDefinitions
   */
  getProfiles(resourceType?: string): Observable<any> {
    let query = '/administration/StructureDefinition?_count=200&_summary=true';

    if (resourceType) {
      query += `&type=${resourceType}`;
    }

    return this.executeQuery(query);
  }

  /**
   * Create a new resource
   * Automatically routes through mTLS when a certificate is configured for the domain
   */
  create(resource: any): Observable<any> {
    const url = `${this.baseUrl}/${resource.resourceType}`;
    return from(Promise.all([
      this.checkMtlsRequired(url),
      this.getProfileAuthHeaders()
    ])).pipe(
      switchMap(([useMtls, authHeaders]) => {
        if (useMtls) {
          this.logger.debug('Using mTLS for create:', url);
          return this.executeMtlsRequest(url, 'POST', resource);
        }
        const options = Object.keys(authHeaders).length > 0
          ? { headers: new HttpHeaders(authHeaders) }
          : {};
        return this.http.post(url, resource, options);
      }),
      catchError(error => {
        this.logger.error('Create failed:', error);
        const errorMessage = this.extractFhirErrorMessage(error);
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  /**
   * Update an existing resource
   * Automatically routes through mTLS when a certificate is configured for the domain
   */
  update(resource: any): Observable<any> {
    const url = `${this.baseUrl}/${resource.resourceType}/${resource.id}`;
    return from(Promise.all([
      this.checkMtlsRequired(url),
      this.getProfileAuthHeaders()
    ])).pipe(
      switchMap(([useMtls, authHeaders]) => {
        if (useMtls) {
          this.logger.debug('Using mTLS for update:', url);
          return this.executeMtlsRequest(url, 'PUT', resource);
        }
        const options = Object.keys(authHeaders).length > 0
          ? { headers: new HttpHeaders(authHeaders) }
          : {};
        return this.http.put(url, resource, options);
      }),
      catchError(error => {
        this.logger.error('Update failed:', error);
        const errorMessage = this.extractFhirErrorMessage(error);
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  /**
   * Create a new resource (explicit method for ResourceEditorDialog)
   * Automatically routes through mTLS when a certificate is configured for the domain
   */
  createResource(resourceType: string, resource: any): Observable<any> {
    const url = `${this.baseUrl}/${resourceType}`;
    return from(Promise.all([
      this.checkMtlsRequired(url),
      this.getProfileAuthHeaders()
    ])).pipe(
      switchMap(([useMtls, authHeaders]) => {
        if (useMtls) {
          this.logger.debug('Using mTLS for createResource:', url);
          return this.executeMtlsRequest(url, 'POST', resource);
        }
        const options = Object.keys(authHeaders).length > 0
          ? { headers: new HttpHeaders(authHeaders) }
          : {};
        return this.http.post(url, resource, options);
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
    return from(Promise.all([
      this.checkMtlsRequired(url),
      this.getProfileAuthHeaders()
    ])).pipe(
      switchMap(([useMtls, authHeaders]) => {
        if (useMtls) {
          this.logger.debug('Using mTLS for updateResource:', url);
          return this.executeMtlsRequest(url, 'PUT', resource);
        }
        const options = Object.keys(authHeaders).length > 0
          ? { headers: new HttpHeaders(authHeaders) }
          : {};
        return this.http.put(url, resource, options);
      }),
      catchError(error => {
        this.logger.error('Update failed:', error);
        return throwError(() => new Error(error.message || 'Failed to update resource'));
      })
    );
  }

  /**
   * Delete a resource
   * Automatically routes through mTLS when a certificate is configured for the domain
   */
  delete(resourceType: string, id: string): Observable<any> {
    const url = `${this.baseUrl}/${resourceType}/${id}`;
    return from(Promise.all([
      this.checkMtlsRequired(url),
      this.getProfileAuthHeaders()
    ])).pipe(
      switchMap(([useMtls, authHeaders]) => {
        if (useMtls) {
          this.logger.debug('Using mTLS for delete:', url);
          return this.executeMtlsRequest(url, 'DELETE');
        }
        const options = Object.keys(authHeaders).length > 0
          ? { headers: new HttpHeaders(authHeaders) }
          : {};
        return this.http.delete(url, options);
      }),
      catchError(error => {
        this.logger.error('Delete failed:', error);
        return throwError(() => new Error(error.message || 'Failed to delete resource'));
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
    return from(Promise.all([
      this.checkMtlsRequired(url),
      this.getProfileAuthHeaders()
    ])).pipe(
      switchMap(([useMtls, authHeaders]) => {
        if (useMtls) {
          this.logger.debug('Using mTLS for validateResource:', url);
          return this.executeMtlsRequest(url, 'POST', resource);
        }
        const options = Object.keys(authHeaders).length > 0
          ? { headers: new HttpHeaders(authHeaders) }
          : {};
        return this.http.post(url, resource, options);
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

  /**
   * Extract a meaningful error message from FHIR server responses
   * Handles OperationOutcome resources and HTTP error responses
   */
  private extractFhirErrorMessage(error: any): string {
    // Check for OperationOutcome in error.error (Angular HttpClient format)
    if (error.error?.resourceType === 'OperationOutcome') {
      const outcome = error.error;
      const issues = outcome.issue || [];
      if (issues.length > 0) {
        // Get the first error/fatal issue, or first issue
        const errorIssue = issues.find((i: any) => i.severity === 'error' || i.severity === 'fatal') || issues[0];
        const diagnostics = errorIssue.diagnostics || errorIssue.details?.text || '';
        const location = errorIssue.location?.join(', ') || '';
        return diagnostics + (location ? ` (at ${location})` : '') || `Server rejected request: ${errorIssue.code || 'validation error'}`;
      }
    }

    // Check for error message in response body
    if (error.error?.message) {
      return error.error.message;
    }

    // Check for status text
    if (error.status && error.statusText) {
      return `Server error ${error.status}: ${error.statusText}`;
    }

    // Fallback to generic message
    return error.message || 'Failed to complete request';
  }
}

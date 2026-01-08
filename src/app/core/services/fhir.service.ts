import { Injectable, inject, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { getEnvironmentConfig } from '../config/environments';
import { LoggerService } from './logger.service';

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
          return config.fhirServer;
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
   * Execute a FHIR query
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

    return this.http.get<T>(url).pipe(
      catchError(error => {
        this.logger.error('Query failed:', error);
        return throwError(() => new Error(error.message || 'FHIR query failed'));
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
   */
  create(resource: any): Observable<any> {
    const url = `${this.baseUrl}/${resource.resourceType}`;
    return this.http.post(url, resource);
  }

  /**
   * Update an existing resource
   */
  update(resource: any): Observable<any> {
    const url = `${this.baseUrl}/${resource.resourceType}/${resource.id}`;
    return this.http.put(url, resource);
  }

  /**
   * Create a new resource (explicit method for ResourceEditorDialog)
   */
  createResource(resourceType: string, resource: any): Observable<any> {
    const url = `${this.baseUrl}/${resourceType}`;
    return this.http.post(url, resource).pipe(
      catchError(error => {
        this.logger.error('Create failed:', error);
        return throwError(() => new Error(error.message || 'Failed to create resource'));
      })
    );
  }

  /**
   * Update an existing resource (explicit method for ResourceEditorDialog)
   */
  updateResource(resourceType: string, id: string, resource: any): Observable<any> {
    const url = `${this.baseUrl}/${resourceType}/${id}`;
    return this.http.put(url, resource).pipe(
      catchError(error => {
        this.logger.error('Update failed:', error);
        return throwError(() => new Error(error.message || 'Failed to update resource'));
      })
    );
  }

  /**
   * Validate a resource using FHIR $validate operation
   *
   * @example
   * ```typescript
   * this.fhirService.validateResource('Patient', patientResource)
   *   .subscribe(operationOutcome => console.log(operationOutcome));
   * ```
   */
  validateResource(resourceType: string, resource: any): Observable<any> {
    const url = `${this.baseUrl}/${resourceType}/$validate`;
    return this.http.post(url, resource).pipe(
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

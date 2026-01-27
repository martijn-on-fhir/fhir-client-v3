import { HttpInterceptorFn, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError, from } from 'rxjs';
import { tap, catchError, switchMap } from 'rxjs/operators';
import { HttpInspectorService, HttpInspection } from '../services/http-inspector.service';
import { ServerProfileService } from '../services/server-profile.service';

/**
 * Extract headers from HttpRequest or HttpResponse
 */
const extractHeaders = (headers: { keys(): string[]; get(name: string): string | null }): Record<string, string> => {

  const result: Record<string, string> = {};
  const keys = headers.keys();

  for (const key of keys) {
    const value = headers.get(key);

    if (value) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * HTTP Inspector Interceptor
 *
 * Captures request/response details for debugging purposes.
 * Records timing, headers, status codes, and body sizes.
 */
export const httpInspectorInterceptor: HttpInterceptorFn = (req, next) => {
  const inspectorService = inject(HttpInspectorService);
  const profileService = inject(ServerProfileService);
  const startTime = performance.now();
  const requestId = inspectorService.generateId();

  // Get auth headers asynchronously (same source as auth interceptor)
  return from(profileService.getActiveAuthHeaders()).pipe(
    switchMap(authHeaders => {
      // Build complete request headers
      const requestHeaders: Record<string, string> = {
        ...extractHeaders(req.headers),
        ...authHeaders,
        'Content-Type': req.headers.get('Content-Type') || 'application/fhir+json',
        'Accept': 'application/fhir+json'
      };

      // Calculate request size
      let requestSize = 0;

      if (req.body) {
        try {
          requestSize = new Blob([JSON.stringify(req.body)]).size;
        } catch {
          requestSize = 0;
        }
      }

      // Create request snapshot with complete headers
      const requestSnapshot = {
        method: req.method,
        url: req.url,
        headers: requestHeaders,
        body: req.body
      };

      return next(req).pipe(
    tap(event => {
      if (event instanceof HttpResponse) {
        const endTime = performance.now();

        // Capture response headers
        const responseHeaders = extractHeaders(event.headers);

        // Calculate response size
        let responseSize = 0;
        if (event.body) {
          try {
            responseSize = new Blob([JSON.stringify(event.body)]).size;
          } catch {
            responseSize = 0;
          }
        }

        const inspection: HttpInspection = {
          id: requestId,
          timestamp: new Date(),
          request: requestSnapshot,
          response: {
            status: event.status,
            statusText: event.statusText,
            headers: responseHeaders,
            body: event.body
          },
          timing: {
            startTime,
            endTime,
            duration: Math.round(endTime - startTime)
          },
          size: {
            requestSize,
            responseSize
          }
        };

        inspectorService.record(inspection);
      }
    }),
    catchError((error: HttpErrorResponse) => {
      const endTime = performance.now();

      // Capture error response headers
      const responseHeaders = error.headers ? extractHeaders(error.headers) : {};

      // Calculate error response size
      let responseSize = 0;
      if (error.error) {
        try {
          responseSize = new Blob([JSON.stringify(error.error)]).size;
        } catch {
          responseSize = 0;
        }
      }

      const inspection: HttpInspection = {
        id: requestId,
        timestamp: new Date(),
        request: requestSnapshot,
        response: {
          status: error.status,
          statusText: error.statusText,
          headers: responseHeaders,
          body: error.error
        },
        timing: {
          startTime,
          endTime,
          duration: Math.round(endTime - startTime)
        },
        size: {
          requestSize,
          responseSize
        },
        error: true
      };

      inspectorService.record(inspection);

      return throwError(() => error);
    })
      );
    })
  );
};

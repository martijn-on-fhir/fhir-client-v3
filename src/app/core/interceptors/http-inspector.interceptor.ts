import { HttpInterceptorFn, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { HttpInspectorService, HttpInspection } from '../services/http-inspector.service';

/**
 * HTTP Inspector Interceptor
 *
 * Captures request/response details for debugging purposes.
 * Records timing, headers, status codes, and body sizes.
 */
export const httpInspectorInterceptor: HttpInterceptorFn = (req, next) => {
  const inspectorService = inject(HttpInspectorService);
  const startTime = performance.now();
  const requestId = inspectorService.generateId();

  // Capture request headers
  const requestHeaders: Record<string, string> = {};
  req.headers.keys().forEach(key => {
    const value = req.headers.get(key);
    if (value) {
      requestHeaders[key] = value;
    }
  });

  // Calculate request size
  let requestSize = 0;
  if (req.body) {
    try {
      requestSize = new Blob([JSON.stringify(req.body)]).size;
    } catch {
      requestSize = 0;
    }
  }

  // Create request snapshot
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
        const responseHeaders: Record<string, string> = {};
        event.headers.keys().forEach(key => {
          const value = event.headers.get(key);
          if (value) {
            responseHeaders[key] = value;
          }
        });

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
      const responseHeaders: Record<string, string> = {};
      if (error.headers) {
        error.headers.keys().forEach(key => {
          const value = error.headers.get(key);
          if (value) {
            responseHeaders[key] = value;
          }
        });
      }

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
};

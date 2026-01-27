import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap, catchError, throwError } from 'rxjs';
import { LoggerService } from '../services/logger.service';
import { ServerProfileService } from '../services/server-profile.service';

/**
 * Authentication HTTP Interceptor
 *
 * Automatically adds authentication headers to all FHIR requests
 * Based on the active server profile's auth configuration
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const profileService = inject(ServerProfileService);
  const loggerService = inject(LoggerService);
  const logger = loggerService.component('AuthInterceptor');

  // Skip auth for token endpoint requests
  if (req.url.includes('/protocol/openid-connect/token') ||
      req.url.includes('/oauth/token') ||
      req.url.includes('/oauth2/token')) {
    return next(req);
  }

  // Get active profile
  const activeId = profileService.activeProfileId();

  // Skip auth if no active profile
  if (!activeId) {
    return next(req);
  }

  // Get auth headers for the active profile
  return from(profileService.getActiveAuthHeaders()).pipe(
    switchMap(authHeaders => {
      // Get existing Accept header from request (if any)
      const existingAccept = req.headers.get('Accept');
      const acceptHeader = existingAccept || 'application/fhir+json';

      logger.debug(`Interceptor: existing Accept header = ${existingAccept}, using = ${acceptHeader}`);

      // If no auth headers needed, proceed without modification
      if (Object.keys(authHeaders).length === 0) {
        // Still add FHIR content type headers (preserve existing Accept header if set)
        const fhirReq = req.clone({
          setHeaders: {
            'Content-Type': req.headers.get('Content-Type') || 'application/fhir+json',
            'Accept': acceptHeader
          }
        });
        return next(fhirReq);
      }

      // Clone request and add auth headers (preserve existing Accept header if set)
      const authReq = req.clone({
        setHeaders: {
          ...authHeaders,
          'Content-Type': req.headers.get('Content-Type') || 'application/fhir+json',
          'Accept': acceptHeader
        }
      });

      return next(authReq);
    }),
    catchError(error => {
      logger.error('Request failed:', error);
      return throwError(() => error);
    })
  );
};

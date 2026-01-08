import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap, catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Authentication HTTP Interceptor
 *
 * Automatically adds Bearer token to all HTTP requests
 * Validates and refreshes token before each request
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // Skip auth for login requests (token endpoint)
  if (req.url.includes('/protocol/openid-connect/token')) {
    return next(req);
  }

  // Skip auth if not authenticated
  if (!authService.isAuthenticated()) {
    return next(req);
  }

  // Validate and refresh token if needed, then add to request
  return from(authService.validateAndRefreshToken()).pipe(
    switchMap(token => {
      if (!token) {
        console.warn('[AuthInterceptor] No valid token available');
        return next(req);
      }

      // Clone request and add Authorization header
      const authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
          'Content-Type': req.headers.get('Content-Type') || 'application/fhir+json',
          Accept: 'application/fhir+json'
        }
      });

      return next(authReq);
    }),
    catchError(error => {
      console.error('[AuthInterceptor] Request failed:', error);
      return throwError(() => error);
    })
  );
};

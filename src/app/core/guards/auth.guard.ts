import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { ServerProfileService } from '../services/server-profile.service';

/**
 * Authentication Guard
 *
 * Protects routes that require authentication
 * Redirects to login if user is not authenticated
 * Uses ServerProfileService to check for active profile with valid session
 */
export const authGuard: CanActivateFn = async (route, state) => {
  const profileService = inject(ServerProfileService);
  const router = inject(Router);

  const activeId = profileService.activeProfileId();
  const isAuthenticated = activeId !== null && profileService.hasValidSession(activeId);

  if (!isAuthenticated) {
    router.navigate(['/login'], {
      queryParams: { returnUrl: state.url }
    });
    return false;
  }

  return true;
};

/**
 * Login Guard
 *
 * Prevents authenticated users from accessing login page
 * Redirects to home if already authenticated
 */
export const loginGuard: CanActivateFn = async () => {
  const profileService = inject(ServerProfileService);
  const router = inject(Router);

  const activeId = profileService.activeProfileId();
  const isAuthenticated = activeId !== null && profileService.hasValidSession(activeId);

  if (isAuthenticated) {
    router.navigate(['/app/query']);
    return false;
  }

  return true;
};

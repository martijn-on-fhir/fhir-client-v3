import { Routes } from '@angular/router';
import { authGuard, loginGuard } from './core/guards/auth.guard';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';

/**
 * Application Routes
 *
 * Login routes are separate from main app.
 * Main app routes are wrapped in MainLayoutComponent and protected by authGuard.
 * Feature routes are lazy-loaded for optimal bundle size.
 */
export const routes: Routes = [
  // Default route - redirect to login
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },

  // Authentication Routes (NOT protected, NO layout)
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component')
      .then(m => m.LoginComponent),
    canActivate: [loginGuard] // Redirect to app if already authenticated
  },
  {
    path: 'auth/2fa-setup',
    loadComponent: () => import('./features/auth/two-factor-setup/two-factor-setup.component')
      .then(m => m.TwoFactorSetupComponent)
  },

  // Main Application (wrapped in layout, protected by auth guard)
  {
    path: 'app',
    component: MainLayoutComponent,
    canActivate: [authGuard], // Protect entire app
    children: [
      // Default app route
      {
        path: '',
        redirectTo: 'profiles',
        pathMatch: 'full'
      },

      // Profiles Tab
      {
        path: 'profiles',
        loadComponent: () => import('./features/profiles/profiles.component')
          .then(m => m.ProfilesComponent)
      },

      // FHIR Query Tab
      {
        path: 'query',
        loadComponent: () => import('./features/query/query.component')
          .then(m => m.QueryComponent)
      },

      // Validator Tab
      {
        path: 'validator',
        loadComponent: () => import('./features/validator/validator.component')
          .then(m => m.ValidatorComponent)
      },

      // Terminology Tab
      {
        path: 'terminology',
        loadComponent: () => import('./features/terminology/terminology.component')
          .then(m => m.TerminologyComponent)
      },

      // FHIRPath Tab
      {
        path: 'fhirpath',
        loadComponent: () => import('./features/fhirpath/fhirpath.component')
          .then(m => m.FhirpathComponent)
      },

      // Predefined Templates Tab
      {
        path: 'predefined',
        loadComponent: () => import('./features/predefined/predefined.component')
          .then(m => m.PredefinedComponent)
      },

      // Log Viewer Tab
      {
        path: 'logs',
        loadComponent: () => import('./features/logs/logs.component')
          .then(m => m.LogsComponent)
      },

      // Nictiz Tab
      {
        path: 'nictiz',
        loadComponent: () => import('./features/nictiz/nictiz.component')
          .then(m => m.NictizComponent)
      },

      // Pluriform Tab
      {
        path: 'pluriform',
        loadComponent: () => import('./features/pluriform/pluriform.component')
          .then(m => m.PluriformComponent)
      },

      // Resource Info Tab
      {
        path: 'resource-info',
        loadComponent: () => import('./features/resource-info/resource-info.component')
          .then(m => m.ResourceInfoComponent)
      },

      // Subscriptions Tab
      {
        path: 'subscriptions',
        loadComponent: () => import('./features/subscriptions/subscriptions.component')
          .then(m => m.SubscriptionsComponent)
      },

      // Narratives Tab
      {
        path: 'narratives',
        loadComponent: () => import('./features/narratives/narratives.component')
          .then(m => m.NarrativesComponent)
      }
    ]
  },

  // Wildcard - catch all for unknown routes
  {
    path: '**',
    redirectTo: '/login'
  }
];

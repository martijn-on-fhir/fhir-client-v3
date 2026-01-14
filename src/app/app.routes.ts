import { Routes } from '@angular/router';
import { authGuard, loginGuard } from './core/guards/auth.guard';
import { LoginComponent } from './features/auth/login/login.component';
import { TwoFactorSetupComponent } from './features/auth/two-factor-setup/two-factor-setup.component';
import { FhirpathComponent } from './features/fhirpath/fhirpath.component';
import { LogsComponent } from './features/logs/logs.component';
import { NictizComponent } from './features/nictiz/nictiz.component';
import { PluriformComponent } from './features/pluriform/pluriform.component';
import { PredefinedComponent } from './features/predefined/predefined.component';
import { ProfilesComponent } from './features/profiles/profiles.component';
import { QueryComponent } from './features/query/query.component';
import { ResourceInfoComponent } from './features/resource-info/resource-info.component';
import { SubscriptionsComponent } from './features/subscriptions/subscriptions.component';
import { TerminologyComponent } from './features/terminology/terminology.component';
import { ValidatorComponent } from './features/validator/validator.component';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';

/**
 * Application Routes
 *
 * Login routes are separate from main app.
 * Main app routes are wrapped in MainLayoutComponent and protected by authGuard.
 * This prevents loading header, sidebar, tabs until user is authenticated.
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
    component: LoginComponent,
    canActivate: [loginGuard] // Redirect to app if already authenticated
  },
  {
    path: 'auth/2fa-setup',
    component: TwoFactorSetupComponent
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

      // Profiles Tab (DONE ✅)
      {
        path: 'profiles',
        component: ProfilesComponent
      },

      // FHIR Query Tab (DONE ✅)
      {
        path: 'query',
        component: QueryComponent
      },

      // Validator Tab (DONE ✅)
      {
        path: 'validator',
        component: ValidatorComponent
      },

      // Terminology Tab (DONE ✅)
      {
        path: 'terminology',
        component: TerminologyComponent
      },

      // FHIRPath Tab (DONE ✅)
      {
        path: 'fhirpath',
        component: FhirpathComponent
      },

      // Predefined Templates Tab (DONE ✅)
      {
        path: 'predefined',
        component: PredefinedComponent
      },

      // Log Viewer Tab (DONE ✅)
      {
        path: 'logs',
        component: LogsComponent
      },

      // Nictiz Tab (DONE ✅)
      {
        path: 'nictiz',
        component: NictizComponent
      },

      // Pluriform Tab (DONE ✅)
      {
        path: 'pluriform',
        component: PluriformComponent
      },

      // Resource Info Tab (DONE ✅)
      {
        path: 'resource-info',
        component: ResourceInfoComponent
      },

      // Subscriptions Tab (DONE ✅)
      {
        path: 'subscriptions',
        component: SubscriptionsComponent
      }
    ]
  },

  // Wildcard - catch all for unknown routes
  {
    path: '**',
    redirectTo: '/login'
  }
];

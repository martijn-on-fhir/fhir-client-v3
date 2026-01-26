import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { loadEnvironments } from './core/config/environments';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { httpInspectorInterceptor } from './core/interceptors/http-inspector.interceptor';

/**
 * Initialize app by loading environment configuration from Electron
 */
const initializeApp = (): () => Promise<void> => () => loadEnvironments()

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor, httpInspectorInterceptor])
    ),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      multi: true
    }
  ]
};

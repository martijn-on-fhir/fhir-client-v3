import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => {
    // Use electron-log if available, fallback to console.error
    const log = (window as any).electronAPI?.log;
    if (log) {
      log.error('[Bootstrap] Application failed to start:', err);
    } else {
      console.error('[Bootstrap] Application failed to start:', err);
    }
  });

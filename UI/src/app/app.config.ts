import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import {
  provideClientHydration,
  withEventReplay,
  withNoIncrementalHydration
} from '@angular/platform-browser';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { apiLoggerInterceptor } from './services/api-logger.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    // Binds route params (:scholarId) straight onto components' input()s.
    provideRouter(routes, withComponentInputBinding()),
    provideClientHydration(withEventReplay(), withNoIncrementalHydration()),
    provideHttpClient(withFetch(), withInterceptors([apiLoggerInterceptor])),
  ],
};

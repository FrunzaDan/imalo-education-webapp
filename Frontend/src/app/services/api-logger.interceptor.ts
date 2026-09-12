import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpResponse,
} from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { catchError, tap, throwError } from 'rxjs';
import { ApiLoggerService } from './api-logger.service';

// Learning-project aid: every API call the Angular app makes is mirrored to
// the browser console so it's easy to see exactly what's being sent/received
// while poking around the app. Not something you'd want in a real production
// app — toggled off from the About page, and skipped entirely during SSR.
export const apiLoggerInterceptor: HttpInterceptorFn = (req, next) => {
  if (
    !isPlatformBrowser(inject(PLATFORM_ID)) ||
    !inject(ApiLoggerService).enabled()
  ) {
    return next(req);
  }

  const startedAt = performance.now();
  console.log(
    `%c→ ${req.method} ${req.urlWithParams}`,
    'color:#0a84ff;font-weight:bold',
    { body: req.body },
  );

  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse) {
        const durationMs = Math.round(performance.now() - startedAt);
        console.log(
          `%c← ${req.method} ${req.urlWithParams} ${event.status} (${durationMs}ms)`,
          'color:#30d158;font-weight:bold',
          { body: event.body },
        );
      }
    }),
    catchError((error: unknown) => {
      const durationMs = Math.round(performance.now() - startedAt);
      if (error instanceof HttpErrorResponse) {
        console.log(
          `%c✖ ${req.method} ${req.urlWithParams} ${error.status} (${durationMs}ms)`,
          'color:#ff453a;font-weight:bold',
          { error: error.error },
        );
      }
      return throwError(() => error);
    }),
  );
};

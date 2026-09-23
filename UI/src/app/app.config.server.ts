import { provideServerRendering, withRoutes } from '@angular/ssr';
import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
// Private (ɵ-prefixed) token, but it's the only DI hook @angular/common/http
// exposes for this — see the comment below.
import { ɵHTTP_FETCH_MAX_RESPONSE_SIZE as HTTP_FETCH_MAX_RESPONSE_SIZE } from '@angular/common/http';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // FetchBackend buffers a fetch's whole response body in memory during
    // SSR (to support the transfer-state cache) and aborts past this cap —
    // 1MB by default, server-side only. GET /attendance across every
    // scholar's multi-year history (AttendanceComponent, ChartsComponent)
    // now regularly exceeds that, which broke SSR for both pages once the
    // test-data seeder started generating July 2024-September 2026 attendance.
    // No public (non-ɵ) API raises this limit as of Angular 22.
    { provide: HTTP_FETCH_MAX_RESPONSE_SIZE, useValue: 10 * 1024 * 1024 },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);

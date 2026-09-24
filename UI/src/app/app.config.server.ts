import { provideServerRendering, withRoutes } from '@angular/ssr';
import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { ɵHTTP_FETCH_MAX_RESPONSE_SIZE as HTTP_FETCH_MAX_RESPONSE_SIZE } from '@angular/common/http';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    { provide: HTTP_FETCH_MAX_RESPONSE_SIZE, useValue: 10 * 1024 * 1024 },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);

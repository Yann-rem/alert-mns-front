import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
  withXsrfConfiguration,
} from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { sessionExpiredInterceptor } from './core/auth/session-expired.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withFetch(),
      // Noms explicites pour documenter le contrat avec Spring Security :
      // CookieCsrfTokenRepository.withHttpOnlyFalse() écrit le cookie XSRF-TOKEN,
      // et Spring attend l'en-tête X-XSRF-TOKEN (ce sont aussi les défauts d'Angular).
      withXsrfConfiguration({
        cookieName: 'XSRF-TOKEN',
        headerName: 'X-XSRF-TOKEN',
      }),
      withInterceptors([sessionExpiredInterceptor]),
    ),
  ],
};

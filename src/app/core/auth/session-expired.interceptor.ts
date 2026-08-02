import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';
import { loginUrlTree } from './return-url';

/**
 * Endpoints où un 401 ne signifie PAS « session expirée » :
 *
 * - `login` : identifiants incorrects — le formulaire affiche le message lui-même ;
 * - `magic-link/*` : endpoints publics d'activation ;
 * - `me` : consulté par {@link authGuard}, qui gère déjà la redirection et
 *   éviterait ainsi une double navigation concurrente.
 */
const IGNORED = ['/api/auth/login', '/api/auth/magic-link/', '/api/auth/me'];

/**
 * Redirige vers la connexion lorsqu'une session expire en cours d'utilisation.
 *
 * <p>L'écran quitté est mémorisé au passage : une session qui expire ne doit pas
 * coûter à l'utilisateur le chemin qu'il avait parcouru pour y arriver.</p>
 *
 * <p>L'erreur est tout de même propagée : l'appelant reste libre d'afficher son
 * propre message ou d'annuler un traitement en cours.</p>
 */
export const sessionExpiredInterceptor: HttpInterceptorFn = (request, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);

  return next(request).pipe(
    catchError((error: unknown) => {
      const isSessionExpired =
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !IGNORED.some((url) => request.url.startsWith(url));

      if (isSessionExpired) {
        auth.clearSession();
        void router.navigateByUrl(loginUrlTree(router, router.url));
      }

      return throwError(() => error);
    }),
  );
};

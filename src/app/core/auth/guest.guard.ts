import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AuthService } from './auth.service';
import { DEFAULT_LANDING_URL, RETURN_URL_PARAM, safeReturnUrl } from './return-url';

/**
 * Réserve une route aux visiteurs non connectés — l'exact miroir de
 * {@link authGuard}.
 *
 * <p>Comme lui, il ne peut pas se fier au seul état applicatif : celui-ci est
 * vide après un rechargement de page alors que le cookie de session, lui,
 * survit. Une session ouverte doit donc être détectée côté serveur, sans quoi
 * il suffirait de saisir l'URL pour retrouver le formulaire de connexion.</p>
 *
 * <p>Pour se connecter sous un autre compte, il faut se déconnecter d'abord :
 * c'est délibéré, une session à la fois.</p>
 */
export const guestGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Un lien profond ouvert alors qu'une session existe déjà doit aboutir,
  // et non retomber sur l'accueil.
  const destination =
    safeReturnUrl(route.queryParamMap.get(RETURN_URL_PARAM)) ?? DEFAULT_LANDING_URL;

  return auth.ensureCurrentUser().pipe(
    map(() => router.parseUrl(destination)),
    // 401 attendu : c'est le cas nominal d'un visiteur anonyme, pas une erreur.
    catchError(() => of(true as const)),
  );
};

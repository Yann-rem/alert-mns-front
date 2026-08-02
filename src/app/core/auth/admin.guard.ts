import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AuthService } from './auth.service';
import { DEFAULT_LANDING_URL, loginUrlTree } from './return-url';

/**
 * Réserve une route au rôle ADMIN.
 *
 * <p>Ce garde est <b>autonome</b> : il résout lui-même la session avant de lire
 * le rôle. Il ne faut surtout pas le composer avec {@link authGuard} en comptant
 * sur l'ordre du tableau {@code canActivate} — Angular souscrit à tous les
 * gardes d'une même route simultanément ({@code prioritizedGuardValue} repose
 * sur {@code combineLatest}). L'ordre départage les résultats, il ne séquence
 * pas l'exécution : un garde placé en second lirait un état encore vide.</p>
 *
 * <p>Il ne protège rien — le backend reste seul juge et répond 403. Il évite un
 * écran incohérent : afficher un tableau de bord d'administration, ses onglets
 * et son bouton d'invitation à quelqu'un qui n'obtiendra jamais les données.</p>
 */
export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.ensureCurrentUser().pipe(
    map(() => (auth.isAdmin() ? true : router.parseUrl(DEFAULT_LANDING_URL))),
    // Pas de session du tout : c'est un problème d'authentification, pas de rôle.
    catchError(() => of(loginUrlTree(router, state.url))),
  );
};

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AuthService } from './auth.service';
import { DEFAULT_LANDING_URL, loginUrlTree } from './return-url';

/**
 * Réserve une route aux rôles autorisés à diffuser une alerte (ADMIN et MANAGER).
 *
 * <p>Autonome, comme {@link adminGuard} et pour la même raison : les gardes d'un
 * même tableau {@code canActivate} sont exécutés en parallèle, jamais en
 * séquence. Le composer avec {@link authGuard} ferait lire un état encore
 * vide — et déclencherait deux appels à `/me`.</p>
 *
 * <p>Il ne protège rien : le backend reste seul juge et répond 403. Il évite
 * d'offrir un formulaire de diffusion à quelqu'un dont l'envoi sera refusé.</p>
 */
export const broadcastGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.ensureCurrentUser().pipe(
    map(() => (auth.canBroadcast() ? true : router.parseUrl(DEFAULT_LANDING_URL))),
    // Pas de session du tout : c'est un problème d'authentification, pas de rôle.
    catchError(() => of(loginUrlTree(router, state.url))),
  );
};

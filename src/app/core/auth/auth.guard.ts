import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AuthService } from './auth.service';

/**
 * Protège les routes nécessitant une session ouverte.
 *
 * <p>La session vit dans un cookie httpOnly : après un rechargement de page,
 * l'état applicatif est vide alors que la session peut être parfaitement
 * valide. Le garde ne peut donc pas se contenter de l'état local — il
 * interroge le serveur, seul détenteur de la vérité.</p>
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Déjà résolu pendant cette session applicative : pas d'aller-retour inutile.
  if (auth.isAuthenticated()) {
    return of(true);
  }

  return auth.loadCurrentUser().pipe(
    map(() => true as const),
    catchError(() => of(router.createUrlTree(['/connexion']))),
  );
};

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AuthService } from './auth.service';
import { loginUrlTree } from './return-url';

/**
 * Protège les routes nécessitant une session ouverte.
 *
 * <p>La session vit dans un cookie httpOnly : après un rechargement de page,
 * l'état applicatif est vide alors que la session peut être parfaitement
 * valide. Le garde ne peut donc pas se contenter de l'état local — il
 * interroge le serveur, seul détenteur de la vérité.</p>
 *
 * <p>La destination refusée est mémorisée dans l'URL de connexion : un lien
 * profond reçu par e-mail doit rester exploitable après authentification.</p>
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.ensureCurrentUser().pipe(
    map(() => true as const),
    catchError(() => of(loginUrlTree(router, state.url))),
  );
};

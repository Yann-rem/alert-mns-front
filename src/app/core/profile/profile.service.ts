import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';

import { AuthService } from '../auth/auth.service';

/** Limites imposées par les value objects `FirstName` / `LastName` côté backend. */
export const NAME_MAX_LENGTH = 100;

/** Limite du value object `AbsenceMessage`. */
export const ABSENCE_MESSAGE_MAX_LENGTH = 500;

/**
 * Profil de l'utilisateur courant.
 *
 * <p>Les deux routes sont ouvertes en libre-service : le backend autorise
 * `#id == principal.userId or hasRole('ADMIN')`. Aucun identifiant n'est donc à
 * choisir — c'est toujours celui de la session.</p>
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  /**
   * Met à jour prénom et nom.
   *
   * <p>L'avatar n'est pas transmis, donc remis à vide par le backend. C'est sans conséquence
   * aujourd'hui : rien ne permet d'en définir un, et `/api/auth/me` ne l'expose pas — le client
   * serait de toute façon incapable de le préserver.</p>
   */
  updateIdentity(firstName: string, lastName: string): Observable<void> {
    const base = this.userUrl();
    if (!base) {
      return throwError(() => new Error('Aucune session ouverte.'));
    }
    return this.http.put<void>(`${base}/profile`, { firstName, lastName });
  }

  /**
   * Met à jour le message d'absence.
   *
   * <p>Le contenu est toujours obligatoire, y compris pour désactiver : le backend n'offre pas de
   * suppression. Éteindre l'interrupteur est la façon de ne plus l'utiliser.</p>
   */
  updateAbsenceMessage(content: string, active: boolean): Observable<void> {
    const base = this.userUrl();
    if (!base) {
      return throwError(() => new Error('Aucune session ouverte.'));
    }
    return this.http.put<void>(`${base}/absence-message`, { content, active });
  }

  private userUrl(): string | null {
    const userId = this.auth.user()?.userId;
    return userId ? `/api/users/${userId}` : null;
  }
}

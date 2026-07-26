import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

/** Utilisateur connecté, tel que renvoyé par `GET /api/auth/me`. */
export interface CurrentUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
}

/** Contexte porté par un lien magique valide (`GET /api/auth/magic-link/validate`). */
export interface MagicLinkContext {
  email: string;
  firstName: string;
  lastName: string;
}

/** Longueur minimale imposée par le domaine (VO `RawPassword` côté backend). */
export const PASSWORD_MIN_LENGTH = 12;

/**
 * Authentification par session (cookie `JSESSIONID` httpOnly posé par Spring
 * Security). Aucun jeton n'est stocké côté client : la session vit dans le
 * cookie, et l'état applicatif se limite à l'utilisateur courant.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly currentUser = signal<CurrentUser | null>(null);

  /** Utilisateur connecté, ou `null` si la session n'est pas (encore) établie. */
  readonly user = this.currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  /**
   * Ouvre une session. Le backend répond 200 sans corps et pose le cookie de
   * session ; il faut ensuite appeler {@link loadCurrentUser} pour connaître
   * l'identité.
   */
  login(email: string, password: string): Observable<void> {
    return this.http.post<void>('/api/auth/login', { email, password });
  }

  /** Récupère l'utilisateur de la session courante et le met en cache. */
  loadCurrentUser(): Observable<CurrentUser> {
    return this.http
      .get<CurrentUser>('/api/auth/me')
      .pipe(tap((user) => this.currentUser.set(user)));
  }

  /**
   * Vérifie un lien magique et renvoie l'identité qu'il désigne.
   * Le backend répond `410 Gone` si le lien est inconnu, expiré ou déjà consommé.
   */
  validateMagicLink(token: string): Observable<MagicLinkContext> {
    return this.http.get<MagicLinkContext>('/api/auth/magic-link/validate', {
      params: { token },
    });
  }

  /**
   * Consomme le lien magique en définissant le mot de passe. N'ouvre PAS de
   * session : l'utilisateur doit ensuite se connecter normalement.
   */
  redeemMagicLink(token: string, password: string): Observable<void> {
    return this.http.post<void>('/api/auth/magic-link/redeem', { token, password });
  }

  /** Ferme la session côté serveur et vide l'état local. */
  logout(): Observable<void> {
    return this.http.post<void>('/api/auth/logout', {}).pipe(tap(() => this.currentUser.set(null)));
  }

  /**
   * Oublie l'utilisateur courant sans appeler le serveur. Utilisé quand la
   * session s'avère déjà invalide côté backend (401), auquel cas un appel à
   * `/logout` n'aurait plus de sens.
   */
  clearSession(): void {
    this.currentUser.set(null);
  }
}

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

  /** Ferme la session côté serveur et vide l'état local. */
  logout(): Observable<void> {
    return this.http
      .post<void>('/api/auth/logout', {})
      .pipe(tap(() => this.currentUser.set(null)));
  }
}

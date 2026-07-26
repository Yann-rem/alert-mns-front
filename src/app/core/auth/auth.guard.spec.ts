import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';

import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

const USER = {
  userId: 'u-1',
  email: 'yannick.remy@mns.fr',
  firstName: 'Yannick',
  lastName: 'Remy',
};

describe('authGuard', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  /** Exécute le garde dans un contexte d'injection et normalise le résultat. */
  function run(): Promise<boolean | UrlTree> {
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    return firstValueFrom(result as Observable<boolean | UrlTree>);
  }

  it('autorise sans requête quand l’utilisateur est déjà chargé', async () => {
    const auth = TestBed.inject(AuthService);
    auth.loadCurrentUser().subscribe();
    http.expectOne('/api/auth/me').flush(USER);

    const promise = run();
    http.expectNone('/api/auth/me');

    expect(await promise).toBe(true);
    http.verify();
  });

  it('interroge /me après rechargement de page et autorise si la session est valide', async () => {
    const promise = run();
    http.expectOne('/api/auth/me').flush(USER);

    expect(await promise).toBe(true);
    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(true);
    http.verify();
  });

  it('redirige vers /connexion quand la session est absente (401)', async () => {
    const promise = run();
    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    const result = await promise;
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/connexion');
    http.verify();
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  convertToParamMap,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';

import { AuthService } from './auth.service';
import { guestGuard } from './guest.guard';

const USER = {
  userId: 'u-1',
  email: 'yannick.remy@mns.fr',
  firstName: 'Yannick',
  lastName: 'Remy',
};

describe('guestGuard', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  function run(queryParams: Record<string, string> = {}): Promise<boolean | UrlTree> {
    const route = { queryParamMap: convertToParamMap(queryParams) } as ActivatedRouteSnapshot;
    const result = TestBed.runInInjectionContext(() =>
      guestGuard(route, {} as RouterStateSnapshot),
    );
    return firstValueFrom(result as Observable<boolean | UrlTree>);
  }

  function serialize(result: boolean | UrlTree): string {
    return TestBed.inject(Router).serializeUrl(result as UrlTree);
  }

  it('redirige sans requête quand l’utilisateur est déjà chargé', async () => {
    const auth = TestBed.inject(AuthService);
    auth.loadCurrentUser().subscribe();
    http.expectOne('/api/auth/me').flush(USER);

    const promise = run();
    http.expectNone('/api/auth/me');

    expect(serialize(await promise)).toBe('/messages');
    http.verify();
  });

  it('redirige après rechargement de page si le cookie de session est encore valide', async () => {
    const promise = run();
    http.expectOne('/api/auth/me').flush(USER);

    const result = await promise;
    expect(result).toBeInstanceOf(UrlTree);
    expect(serialize(result)).toBe('/messages');
    http.verify();
  });

  it('laisse passer le visiteur anonyme (401)', async () => {
    const promise = run();
    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(await promise).toBe(true);
    http.verify();
  });

  it('honore la destination mémorisée plutôt que l’accueil', async () => {
    const promise = run({ returnUrl: '/administration' });
    http.expectOne('/api/auth/me').flush(USER);

    expect(serialize(await promise)).toBe('/administration');
    http.verify();
  });

  it('ignore une destination externe et retombe sur l’accueil', async () => {
    const promise = run({ returnUrl: 'https://faux-alerte.example/connexion' });
    http.expectOne('/api/auth/me').flush(USER);

    expect(serialize(await promise)).toBe('/messages');
    http.verify();
  });
});

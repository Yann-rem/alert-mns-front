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

import { adminGuard } from './admin.guard';
import { AuthService } from './auth.service';

function meResponse(role: string) {
  return {
    userId: 'u-1',
    email: 'a@mns.fr',
    firstName: 'A',
    lastName: 'B',
    organisationId: 'org-1',
    role,
    memberStatus: 'ACTIVE',
    absenceMessage: null,
  };
}

describe('adminGuard', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  function run(requestedUrl = '/administration'): Promise<boolean | UrlTree> {
    const result = TestBed.runInInjectionContext(() =>
      adminGuard({} as ActivatedRouteSnapshot, { url: requestedUrl } as RouterStateSnapshot),
    );
    return firstValueFrom(result as Observable<boolean | UrlTree>);
  }

  function serialize(result: boolean | UrlTree): string {
    return TestBed.inject(Router).serializeUrl(result as UrlTree);
  }

  /** Le cas réel : l'URL est saisie à la main, donc rien n'est encore en mémoire. */
  it('interroge /me quand la session n’est pas encore chargée, puis laisse passer l’ADMIN', async () => {
    const promise = run();
    http.expectOne('/api/auth/me').flush(meResponse('ADMIN'));

    expect(await promise).toBe(true);
    http.verify();
  });

  it('laisse passer un ADMIN déjà chargé sans requête supplémentaire', async () => {
    TestBed.inject(AuthService).loadCurrentUser().subscribe();
    http.expectOne('/api/auth/me').flush(meResponse('ADMIN'));

    const promise = run();
    http.expectNone('/api/auth/me');

    expect(await promise).toBe(true);
    http.verify();
  });

  it('renvoie un MANAGER vers l’accueil applicatif', async () => {
    const promise = run();
    http.expectOne('/api/auth/me').flush(meResponse('MANAGER'));

    const result = await promise;
    expect(result).toBeInstanceOf(UrlTree);
    expect(serialize(result)).toBe('/messages');
    http.verify();
  });

  it('renvoie un simple MEMBER vers l’accueil applicatif', async () => {
    const promise = run();
    http.expectOne('/api/auth/me').flush(meResponse('MEMBER'));

    expect(serialize(await promise)).toBe('/messages');
    http.verify();
  });

  it('sans session : renvoie à la connexion en mémorisant la destination', async () => {
    const promise = run('/administration');
    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(serialize(await promise)).toBe('/connexion?returnUrl=%2Fadministration');
    http.verify();
  });
});

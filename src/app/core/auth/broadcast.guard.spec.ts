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

import { broadcastGuard } from './broadcast.guard';

function meResponse(role: string) {
  return {
    userId: 'u-1',
    email: 'a@mns.fr',
    firstName: 'A',
    lastName: 'B',
    memberId: 'm-1',
    organisationId: 'org-1',
    role,
    memberStatus: 'ACTIVE',
    absenceMessage: null,
  };
}

describe('broadcastGuard', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  function run(requestedUrl = '/diffuser'): Promise<boolean | UrlTree> {
    const result = TestBed.runInInjectionContext(() =>
      broadcastGuard({} as ActivatedRouteSnapshot, { url: requestedUrl } as RouterStateSnapshot),
    );
    return firstValueFrom(result as Observable<boolean | UrlTree>);
  }

  function serialize(result: boolean | UrlTree): string {
    return TestBed.inject(Router).serializeUrl(result as UrlTree);
  }

  /** Le cas réel : l'URL est saisie ou suivie sans que la session soit en mémoire. */
  it('interroge /me puis laisse passer un ADMIN', async () => {
    const promise = run();
    http.expectOne('/api/auth/me').flush(meResponse('ADMIN'));

    expect(await promise).toBe(true);
    http.verify();
  });

  it('laisse passer un MANAGER — diffuser n’est pas réservé aux ADMIN', async () => {
    const promise = run();
    http.expectOne('/api/auth/me').flush(meResponse('MANAGER'));

    expect(await promise).toBe(true);
    http.verify();
  });

  it('renvoie un simple MEMBER vers l’accueil applicatif', async () => {
    const promise = run();
    http.expectOne('/api/auth/me').flush(meResponse('MEMBER'));

    const result = await promise;
    expect(result).toBeInstanceOf(UrlTree);
    expect(serialize(result)).toBe('/messages');
    http.verify();
  });

  it('sans session : renvoie à la connexion en mémorisant la destination', async () => {
    const promise = run('/diffuser');
    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(serialize(await promise)).toBe('/connexion?returnUrl=%2Fdiffuser');
    http.verify();
  });
});

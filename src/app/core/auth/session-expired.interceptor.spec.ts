import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from './auth.service';
import { sessionExpiredInterceptor } from './session-expired.interceptor';

describe('sessionExpiredInterceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([sessionExpiredInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true as never);
  });

  afterEach(() => http.verify());

  /** L'intercepteur navigue par arbre d'URL : on le resérialise pour l'asserter. */
  function navigatedTo(): string {
    return TestBed.inject(Router).serializeUrl(navigate.mock.calls[0][0] as UrlTree);
  }

  it('401 sur une ressource protégée : vide la session et redirige', async () => {
    const auth = TestBed.inject(AuthService);
    auth.loadCurrentUser().subscribe();
    http.expectOne('/api/auth/me').flush({
      userId: 'u-1',
      email: 'a@mns.fr',
      firstName: 'A',
      lastName: 'B',
    });
    expect(auth.isAuthenticated()).toBe(true);

    const failure = new Promise<number>((resolve) =>
      client.get('/api/conversations').subscribe({ error: (e) => resolve(e.status) }),
    );
    http.expectOne('/api/conversations').flush(null, { status: 401, statusText: 'Unauthorized' });

    // L'erreur reste propagée à l'appelant
    expect(await failure).toBe(401);
    expect(navigatedTo()).toBe('/connexion');
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('mémorise l’écran quitté quand la session expire en cours de route', async () => {
    // Le routeur de test n'a aucune route : on simule l'écran courant.
    vi.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue('/administration');

    const failure = new Promise<number>((resolve) =>
      client.get('/api/conversations').subscribe({ error: (e) => resolve(e.status) }),
    );
    http.expectOne('/api/conversations').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(await failure).toBe(401);
    expect(navigatedTo()).toBe('/connexion?returnUrl=%2Fadministration');
  });

  it('401 sur /login : ne redirige pas (identifiants incorrects)', async () => {
    const failure = new Promise<number>((resolve) =>
      client.post('/api/auth/login', {}).subscribe({ error: (e) => resolve(e.status) }),
    );
    http.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(await failure).toBe(401);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('401 sur /me : laissé au garde de route', async () => {
    const failure = new Promise<number>((resolve) =>
      client.get('/api/auth/me').subscribe({ error: (e) => resolve(e.status) }),
    );
    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(await failure).toBe(401);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('autre erreur (500) : aucune redirection', async () => {
    const failure = new Promise<number>((resolve) =>
      client.get('/api/conversations').subscribe({ error: (e) => resolve(e.status) }),
    );
    http.expectOne('/api/conversations').flush(null, { status: 500, statusText: 'Server Error' });

    expect(await failure).toBe(500);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('réponse valide : passe sans effet', async () => {
    const value = new Promise((resolve) => client.get('/api/ping').subscribe(resolve));
    http.expectOne('/api/ping').flush({ ok: true });

    expect(await value).toEqual({ ok: true });
    expect(navigate).not.toHaveBeenCalled();
  });
});

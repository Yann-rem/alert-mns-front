import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthService, type CurrentUser } from './auth.service';

const USER: CurrentUser = {
  userId: 'u-1',
  email: 'yannick.remy@mns.fr',
  firstName: 'Yannick',
  lastName: 'Remy',
  memberId: 'm-1',
  organisationId: 'org-1',
  role: 'ADMIN',
  memberStatus: 'ACTIVE',
  absenceMessage: null,
};

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('démarre sans utilisateur connecté', () => {
    expect(service.user()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('login : poste les identifiants sur /api/auth/login', () => {
    service.login('a@mns.fr', 'secret').subscribe();
    const req = http.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'a@mns.fr', password: 'secret' });
    req.flush(null);
  });

  it('loadCurrentUser : met l’utilisateur en cache', () => {
    service.loadCurrentUser().subscribe();
    http.expectOne('/api/auth/me').flush(USER);

    expect(service.user()).toEqual(USER);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('logout : vide l’état local', () => {
    service.loadCurrentUser().subscribe();
    http.expectOne('/api/auth/me').flush(USER);

    service.logout().subscribe();
    http.expectOne('/api/auth/logout').flush(null);

    expect(service.user()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../auth/auth.service';
import { AdminService } from './admin.service';

const ORG = 'org-1';

describe('AdminService', () => {
  let service: AdminService;
  let http: HttpTestingController;

  /** Amorce la session : l'orgId provient de /me, comme en conditions réelles. */
  function signIn(organisationId: string | null) {
    const auth = TestBed.inject(AuthService);
    auth.loadCurrentUser().subscribe();
    http.expectOne('/api/auth/me').flush({
      userId: 'u-1',
      email: 'admin@mns.fr',
      firstName: 'Yannick',
      lastName: 'Remy',
      organisationId,
      role: 'ADMIN',
      memberStatus: 'ACTIVE',
      absenceMessage: null,
    });
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('préfixe les routes par l’organisation courante', () => {
    signIn(ORG);
    service.listMembers().subscribe();

    const request = http.expectOne((r) => r.url === `/api/organisations/${ORG}/members`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);
    request.flush({ items: [], total: 0, page: 0, size: 50 });
  });

  it('n’envoie que les filtres réellement renseignés', () => {
    signIn(ORG);
    service.listMembers({ status: 'ACTIVE', q: '  sofia  ', role: undefined }).subscribe();

    const request = http.expectOne((r) => r.url === `/api/organisations/${ORG}/members`);
    expect(request.request.params.get('status')).toBe('ACTIVE');
    expect(request.request.params.get('q')).toBe('sofia');
    expect(request.request.params.has('role')).toBe(false);
    request.flush({ items: [], total: 0, page: 0, size: 50 });
  });

  it('liste les invitations en attente', () => {
    signIn(ORG);
    service.listPendingInvitations().subscribe();

    http.expectOne(`/api/organisations/${ORG}/invitations`).flush([]);
  });

  it('poste une invitation', () => {
    signIn(ORG);
    const payload = {
      email: 'karim@mns.fr',
      firstName: 'Karim',
      lastName: 'Belkacem',
      role: 'MEMBER' as const,
    };
    service.invite(payload).subscribe();

    const request = http.expectOne(`/api/organisations/${ORG}/members`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush(null);
  });

  it('échoue proprement sans organisation, sans appel réseau', async () => {
    signIn(null);

    const error = await new Promise<Error>((resolve) =>
      service.listMembers().subscribe({ error: resolve }),
    );
    expect(error.message).toContain('Aucune organisation');
    http.expectNone((r) => r.url.includes('/members'));
  });
});

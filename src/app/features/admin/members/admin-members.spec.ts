import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../../../core/auth/auth.service';
import { AdminMembers } from './admin-members';

const ORG = 'org-1';
const MEMBERS_URL = `/api/organisations/${ORG}/members`;

const MEMBER = {
  memberId: 'm-1',
  userId: 'u-2',
  firstName: 'Sofia',
  lastName: 'Nkolo',
  email: 'sofia.nkolo@mns.fr',
  role: 'MEMBER',
  memberStatus: 'ACTIVE',
  accountStatus: 'ACTIVE',
  anonymized: false,
  joinedAt: '2026-07-01T10:00:00Z',
};

describe('AdminMembers', () => {
  let http: HttpTestingController;

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [AdminMembers],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);

    // Session établie : l'orgId vient de /me.
    TestBed.inject(AuthService).loadCurrentUser().subscribe();
    http.expectOne('/api/auth/me').flush({
      userId: 'u-1',
      email: 'admin@mns.fr',
      firstName: 'Yannick',
      lastName: 'Remy',
      organisationId: ORG,
      role: 'ADMIN',
      memberStatus: 'ACTIVE',
      absenceMessage: null,
    });

    const fixture = TestBed.createComponent(AdminMembers);
    await fixture.whenStable();
    return fixture;
  }

  function text(fixture: Awaited<ReturnType<typeof setup>>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('charge les membres au démarrage et les affiche', async () => {
    const fixture = await setup();
    http
      .expectOne((r) => r.url === MEMBERS_URL)
      .flush({ items: [MEMBER], total: 1, page: 0, size: 50 });
    await fixture.whenStable();

    expect(text(fixture)).toContain('Sofia Nkolo');
    expect(text(fixture)).toContain('sofia.nkolo@mns.fr');
    http.verify();
  });

  it('l’onglet Suspendus filtre par statut', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url === MEMBERS_URL).flush({ items: [], total: 0, page: 0, size: 50 });
    await fixture.whenStable();

    const suspendus = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((b) => b.textContent?.includes('Suspendus'))!;
    suspendus.click();
    await fixture.whenStable();

    const request = http.expectOne((r) => r.url === MEMBERS_URL);
    expect(request.request.params.get('status')).toBe('SUSPENDED');
    request.flush({ items: [], total: 0, page: 0, size: 50 });
    http.verify();
  });

  it('l’onglet En attente interroge les invitations, pas les membres', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url === MEMBERS_URL).flush({ items: [], total: 0, page: 0, size: 50 });
    await fixture.whenStable();

    const pending = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((b) => b.textContent?.includes('En attente'))!;
    pending.click();
    await fixture.whenStable();

    http.expectNone((r) => r.url === MEMBERS_URL);
    http.expectOne(`/api/organisations/${ORG}/invitations`).flush([
      {
        invitationId: 'i-1',
        email: 'karim@mns.fr',
        firstName: 'Karim',
        lastName: 'Belkacem',
        role: 'MEMBER',
        createdAt: '2026-07-20T10:00:00Z',
        expiresAt: '2026-07-27T10:00:00Z',
        expired: false,
      },
    ]);
    await fixture.whenStable();

    expect(text(fixture)).toContain('Karim Belkacem');
    http.verify();
  });

  it('403 : affiche un message de droits insuffisants', async () => {
    const fixture = await setup();
    http
      .expectOne((r) => r.url === MEMBERS_URL)
      .flush(null, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();

    expect(text(fixture)).toContain('droits');
    http.verify();
  });

  it('liste vide : message explicite plutôt qu’un tableau nu', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url === MEMBERS_URL).flush({ items: [], total: 0, page: 0, size: 50 });
    await fixture.whenStable();

    expect(text(fixture)).toContain('Aucun membre');
    http.verify();
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthService } from '../../../core/auth/auth.service';
import { AdminGroups } from './admin-groups';

const ORG = 'org-1';
const GROUPS_URL = `/api/organisations/${ORG}/groups`;
const MEMBERS_URL = `/api/organisations/${ORG}/members`;

const GENERAL = {
  groupId: 'g-1',
  name: 'Général',
  kind: 'GENERAL',
  createdAt: '2026-03-01T09:00:00Z',
};
const CDA = {
  groupId: 'g-2',
  name: 'CDA 2025-2026',
  kind: 'STANDARD',
  createdAt: '2026-07-01T09:00:00Z',
};

function member(overrides: Record<string, unknown> = {}) {
  return {
    memberId: 'm-1',
    userId: 'u-1',
    firstName: 'Sofia',
    lastName: 'Nkolo',
    email: 'sofia@mns.fr',
    role: 'MEMBER',
    memberStatus: 'ACTIVE',
    accountStatus: 'ACTIVE',
    anonymized: false,
    joinedAt: '2026-07-01T10:00:00Z',
    ...overrides,
  };
}

describe('AdminGroups', () => {
  let http: HttpTestingController;

  async function setup(): Promise<ComponentFixture<AdminGroups>> {
    await TestBed.configureTestingModule({
      imports: [AdminGroups],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);

    TestBed.inject(AuthService).loadCurrentUser().subscribe();
    http.expectOne('/api/auth/me').flush({
      userId: 'u-admin',
      email: 'admin@mns.fr',
      firstName: 'Yannick',
      lastName: 'Remy',
      memberId: 'm-admin',
      organisationId: ORG,
      role: 'ADMIN',
      memberStatus: 'ACTIVE',
      absenceMessage: null,
    });

    const fixture = TestBed.createComponent(AdminGroups);
    await fixture.whenStable();
    http
      .expectOne((r) => r.url === GROUPS_URL)
      .flush({ items: [GENERAL, CDA], total: 2, page: 0, size: 50 });
    await fixture.whenStable();
    return fixture;
  }

  function root(fixture: ComponentFixture<AdminGroups>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function button(fixture: ComponentFixture<AdminGroups>, label: string): HTMLButtonElement {
    return Array.from(root(fixture).querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes(label),
    )!;
  }

  /** Ouvre la boîte de gestion d'un groupe et sert ses deux lectures. */
  async function openManage(
    fixture: ComponentFixture<AdminGroups>,
    label: string,
    inGroup: unknown[],
    all: unknown[],
  ): Promise<void> {
    Array.from(root(fixture).querySelectorAll('button'))
      .find((candidate) => candidate.getAttribute('aria-label')?.includes(label))!
      .click();
    await fixture.whenStable();

    http
      .expectOne((r) => r.url === MEMBERS_URL && r.params.get('groupId') !== null)
      .flush({ items: inGroup, total: inGroup.length, page: 0, size: 500 });
    http
      .expectOne((r) => r.url === MEMBERS_URL && r.params.get('groupId') === null)
      .flush({ items: all, total: all.length, page: 0, size: 500 });
    await fixture.whenStable();
  }

  it('liste les groupes et distingue le groupe général', async () => {
    const fixture = await setup();

    expect(root(fixture).textContent).toContain('CDA 2025-2026');
    expect(root(fixture).textContent).toContain('Tout nouveau membre y est rattaché');
    expect(root(fixture).textContent).toContain('2 groupe(s)');
    http.verify();
  });

  it('crée un groupe puis recharge la liste', async () => {
    const fixture = await setup();

    button(fixture, 'Créer un groupe').click();
    await fixture.whenStable();

    const input = root(fixture).querySelector<HTMLInputElement>('#group-name')!;
    input.value = '  Promo 2027  ';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    root(fixture).querySelectorAll('form')[0].dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const request = http.expectOne(GROUPS_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ name: 'Promo 2027' });
    request.flush({ id: 'g-3' });
    await fixture.whenStable();

    http.expectOne((r) => r.url === GROUPS_URL).flush({ items: [], total: 0, page: 0, size: 50 });
    await fixture.whenStable();

    expect(root(fixture).textContent).toContain('Groupe « Promo 2027 » créé.');
    http.verify();
  });

  it('409 à la création : signale le doublon de nom', async () => {
    const fixture = await setup();

    button(fixture, 'Créer un groupe').click();
    await fixture.whenStable();
    const input = root(fixture).querySelector<HTMLInputElement>('#group-name')!;
    input.value = 'Général';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    root(fixture).querySelectorAll('form')[0].dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    http.expectOne(GROUPS_URL).flush(null, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();

    expect(root(fixture).textContent).toContain('porte déjà ce nom');
    http.verify();
  });

  it('la composition ne propose que les membres absents du groupe', async () => {
    const fixture = await setup();
    const sofia = member();
    const leo = member({ memberId: 'm-2', userId: 'u-2', firstName: 'Léo', lastName: 'Marchand' });

    await openManage(fixture, 'CDA 2025-2026', [sofia], [sofia, leo]);

    const options = Array.from(
      root(fixture).querySelectorAll<HTMLOptionElement>('#manage-group-add option'),
    ).map((option) => option.textContent?.trim());
    expect(options).toEqual(['Choisir un membre…', 'Léo Marchand']);
    http.verify();
  });

  it('ajoute un membre au groupe puis recharge la composition', async () => {
    const fixture = await setup();
    const leo = member({ memberId: 'm-2', userId: 'u-2', firstName: 'Léo', lastName: 'Marchand' });

    await openManage(fixture, 'CDA 2025-2026', [], [leo]);

    const select = root(fixture).querySelector<HTMLSelectElement>('#manage-group-add')!;
    select.value = 'm-2';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    button(fixture, 'Ajouter').click();
    await fixture.whenStable();

    const request = http.expectOne(`${GROUPS_URL}/g-2/members/m-2`);
    expect(request.request.method).toBe('PUT');
    request.flush(null);
    await fixture.whenStable();

    // La boîte reste ouverte et se recharge : on enchaîne souvent plusieurs ajouts.
    http
      .expectOne((r) => r.url === MEMBERS_URL && r.params.get('groupId') !== null)
      .flush({ items: [leo], total: 1, page: 0, size: 500 });
    http
      .expectOne((r) => r.url === MEMBERS_URL && r.params.get('groupId') === null)
      .flush({ items: [leo], total: 1, page: 0, size: 500 });
    await fixture.whenStable();

    expect(root(fixture).textContent).toContain('Membre ajouté au groupe.');
    http
      .expectOne((r) => r.url === GROUPS_URL)
      .flush({ items: [GENERAL, CDA], total: 2, page: 0, size: 50 });
    http.verify();
  });

  it('retire un membre du groupe', async () => {
    const fixture = await setup();
    const sofia = member();

    await openManage(fixture, 'CDA 2025-2026', [sofia], [sofia]);

    button(fixture, 'Retirer').click();
    await fixture.whenStable();

    const request = http.expectOne(`${GROUPS_URL}/g-2/members/m-1`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
    await fixture.whenStable();

    http
      .expectOne((r) => r.url === MEMBERS_URL && r.params.get('groupId') !== null)
      .flush({ items: [], total: 0, page: 0, size: 500 });
    http
      .expectOne((r) => r.url === MEMBERS_URL && r.params.get('groupId') === null)
      .flush({ items: [sofia], total: 1, page: 0, size: 500 });
    await fixture.whenStable();

    http
      .expectOne((r) => r.url === GROUPS_URL)
      .flush({ items: [GENERAL, CDA], total: 2, page: 0, size: 50 });
    http.verify();
  });

  it('la composition du groupe général n’est pas modifiable', async () => {
    const fixture = await setup();
    const sofia = member();

    await openManage(fixture, 'Général', [sofia], [sofia]);

    expect(root(fixture).textContent).toContain("L'appartenance au groupe général est automatique");
    expect(button(fixture, 'Retirer')).toBeUndefined();
    expect(root(fixture).querySelector('#manage-group-add')).toBeNull();
    // Le renommage, lui, reste ouvert.
    expect(root(fixture).querySelector('#manage-group-name')).not.toBeNull();
    http.verify();
  });

  it('renomme un groupe et referme la boîte', async () => {
    const fixture = await setup();

    await openManage(fixture, 'CDA 2025-2026', [], []);

    const input = root(fixture).querySelector<HTMLInputElement>('#manage-group-name')!;
    input.value = 'CDA 2026-2027';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    button(fixture, 'Renommer').click();
    await fixture.whenStable();

    const request = http.expectOne(`${GROUPS_URL}/g-2/name`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ name: 'CDA 2026-2027' });
    request.flush(null);
    await fixture.whenStable();

    http
      .expectOne((r) => r.url === GROUPS_URL)
      .flush({ items: [GENERAL, CDA], total: 2, page: 0, size: 50 });
    await fixture.whenStable();

    expect(root(fixture).textContent).toContain('Groupe renommé en « CDA 2026-2027 »');
    http.verify();
  });
});

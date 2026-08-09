import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthService } from '../../../core/auth/auth.service';
import { type MemberSummary } from '../../../core/admin/admin.service';
import { ManageMemberDialog } from './manage-member-dialog';

const ORG = 'org-1';
const SELF_USER = 'u-1';
const MEMBERS_URL = `/api/organisations/${ORG}/members`;

function member(overrides: Partial<MemberSummary> = {}): MemberSummary {
  return {
    memberId: 'm-2',
    userId: 'u-2',
    firstName: 'Sofia',
    lastName: 'Nkolo',
    email: 'sofia.nkolo@mns.fr',
    role: 'MEMBER',
    memberStatus: 'ACTIVE',
    accountStatus: 'ACTIVE',
    anonymized: false,
    joinedAt: '2026-07-01T10:00:00Z',
    ...overrides,
  };
}

/** Hôte : la boîte prend `open` en liaison bidirectionnelle et remonte `changed`. */
@Component({
  imports: [ManageMemberDialog],
  template: `<app-manage-member-dialog
    [(open)]="open"
    [member]="target()"
    (changed)="messages.push($event)"
  />`,
})
class Host {
  readonly open = signal(true);
  readonly target = signal<MemberSummary | null>(member());
  readonly messages: string[] = [];
}

describe('ManageMemberDialog', () => {
  let http: HttpTestingController;

  async function setup(target: MemberSummary | null = member()): Promise<ComponentFixture<Host>> {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);

    // La boîte n'est atteignable que derrière adminGuard : la session est résolue.
    TestBed.inject(AuthService).loadCurrentUser().subscribe();
    http.expectOne('/api/auth/me').flush({
      userId: SELF_USER,
      email: 'admin@mns.fr',
      firstName: 'Yannick',
      lastName: 'Remy',
      memberId: 'm-1',
      organisationId: ORG,
      role: 'ADMIN',
      memberStatus: 'ACTIVE',
      absenceMessage: null,
    });

    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.target.set(target);
    await fixture.whenStable();
    return fixture;
  }

  function root(fixture: ComponentFixture<Host>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /** Retrouve un bouton par son libellé : la boîte en compte plusieurs. */
  function button(fixture: ComponentFixture<Host>, label: string): HTMLButtonElement {
    return Array.from(root(fixture).querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes(label),
    )!;
  }

  it('suspend un membre puis remonte le résultat', async () => {
    const fixture = await setup();

    button(fixture, 'Suspendre').click();
    await fixture.whenStable();

    const request = http.expectOne(`${MEMBERS_URL}/m-2/suspend`);
    expect(request.request.method).toBe('POST');
    request.flush(null);
    await fixture.whenStable();

    expect(fixture.componentInstance.messages).toEqual(['Membre suspendu.']);
    expect(fixture.componentInstance.open()).toBe(false);
    http.verify();
  });

  it('propose de réactiver un membre suspendu', async () => {
    const fixture = await setup(member({ memberStatus: 'SUSPENDED' }));

    button(fixture, 'Réactiver').click();
    await fixture.whenStable();

    http.expectOne(`${MEMBERS_URL}/m-2/reactivate`).flush(null);
    await fixture.whenStable();

    expect(fixture.componentInstance.messages).toEqual(['Membre réactivé.']);
    http.verify();
  });

  it('n’envoie rien tant que le rôle n’a pas changé', async () => {
    const fixture = await setup();

    expect(button(fixture, 'Enregistrer').disabled).toBe(true);
    http.verify();
  });

  it('change le rôle du membre', async () => {
    const fixture = await setup();

    const select = root(fixture).querySelector<HTMLSelectElement>('#manage-role')!;
    select.value = 'MANAGER';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    button(fixture, 'Enregistrer').click();
    await fixture.whenStable();

    const request = http.expectOne(`${MEMBERS_URL}/m-2/role`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ role: 'MANAGER' });
    request.flush(null);
    await fixture.whenStable();

    expect(fixture.componentInstance.messages).toEqual(['Rôle mis à jour.']);
    http.verify();
  });

  it('l’anonymisation demande une confirmation avant d’appeler le serveur', async () => {
    const fixture = await setup();

    button(fixture, 'Anonymiser').click();
    await fixture.whenStable();

    // Premier clic : aucune requête, seulement l'avertissement.
    http.expectNone('/api/users/u-2/anonymize');
    expect(root(fixture).textContent).toContain('cette action ne peut pas être annulée');

    button(fixture, 'Confirmer').click();
    await fixture.whenStable();

    const request = http.expectOne('/api/users/u-2/anonymize');
    expect(request.request.method).toBe('POST');
    request.flush(null);
    await fixture.whenStable();

    expect(fixture.componentInstance.messages).toEqual(['Utilisateur anonymisé.']);
    http.verify();
  });

  it('l’anonymisation vise le userId, pas le memberId', async () => {
    const fixture = await setup(member({ memberId: 'm-9', userId: 'u-42' }));

    button(fixture, 'Anonymiser').click();
    await fixture.whenStable();
    button(fixture, 'Confirmer').click();
    await fixture.whenStable();

    http.expectOne('/api/users/u-42/anonymize').flush(null);
    await fixture.whenStable();
    http.verify();
  });

  it('409 : explique le refus du dernier administrateur actif', async () => {
    const fixture = await setup(member({ role: 'ADMIN' }));

    button(fixture, 'Suspendre').click();
    await fixture.whenStable();

    http
      .expectOne(`${MEMBERS_URL}/m-2/suspend`)
      .flush(null, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();

    expect(root(fixture).textContent).toContain('au moins un administrateur actif');
    // L'échec ne referme pas la boîte : l'administrateur doit lire le motif.
    expect(fixture.componentInstance.open()).toBe(true);
    expect(fixture.componentInstance.messages).toEqual([]);
    http.verify();
  });

  it('on ne peut ni se suspendre ni s’anonymiser soi-même', async () => {
    const fixture = await setup(member({ memberId: 'm-1', userId: SELF_USER }));

    expect(root(fixture).textContent).toContain('Vous ne pouvez pas suspendre votre propre accès');
    expect(button(fixture, 'Suspendre')).toBeUndefined();
    expect(button(fixture, 'Anonymiser')).toBeUndefined();
    // Le changement de rôle reste ouvert : l'invariant du dernier admin protège déjà.
    expect(root(fixture).querySelector('#manage-role')).not.toBeNull();
    http.verify();
  });

  it('un membre anonymisé n’est plus administrable', async () => {
    const fixture = await setup(member({ anonymized: true }));

    expect(root(fixture).textContent).toContain('a été anonymisé');
    expect(root(fixture).querySelector('#manage-role')).toBeNull();
    expect(button(fixture, 'Suspendre')).toBeUndefined();
    expect(button(fixture, 'Anonymiser')).toBeUndefined();
    http.verify();
  });
});

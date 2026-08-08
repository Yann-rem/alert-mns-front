import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { BroadcastAlert } from './broadcast-alert';

const ORG = 'org-1';
const GROUPS_URL = `/api/organisations/${ORG}/groups?size=100`;
const ALERTS_URL = '/api/alerting/alerts';

const GROUPS = {
  items: [
    { groupId: 'g-general', name: 'Général', kind: 'GENERAL', createdAt: '2026-01-01T08:00:00Z' },
    {
      groupId: 'g-cda',
      name: 'Promo CDA 2026',
      kind: 'STANDARD',
      createdAt: '2026-01-02T08:00:00Z',
    },
  ],
  total: 2,
  page: 0,
  size: 100,
};

describe('BroadcastAlert', () => {
  let http: HttpTestingController;

  /** Monte l'écran avec ses groupes chargés, sauf si `flushGroups` est refusé. */
  async function setup(flushGroups = true): Promise<ComponentFixture<BroadcastAlert>> {
    await TestBed.configureTestingModule({
      imports: [BroadcastAlert],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);

    // L'orgId vient de /me : sans lui, AdminService ne sait pas construire l'URL.
    TestBed.inject(AuthService).loadCurrentUser().subscribe();
    http.expectOne('/api/auth/me').flush({
      userId: 'u-1',
      email: 'manager@mns.fr',
      firstName: 'Yannick',
      lastName: 'Remy',
      memberId: 'm-1',
      organisationId: ORG,
      role: 'MANAGER',
      memberStatus: 'ACTIVE',
      absenceMessage: null,
    });

    const fixture = TestBed.createComponent(BroadcastAlert);
    await fixture.whenStable();

    const request = http.expectOne(GROUPS_URL);
    if (flushGroups) {
      request.flush(GROUPS);
    } else {
      request.flush(null, { status: 500, statusText: 'Server Error' });
    }
    await fixture.whenStable();

    return fixture;
  }

  function element(fixture: ComponentFixture<BroadcastAlert>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function write(fixture: ComponentFixture<BroadcastAlert>, message: string): void {
    const textarea = element(fixture).querySelector<HTMLTextAreaElement>('#alert-content')!;
    textarea.value = message;
    textarea.dispatchEvent(new Event('input'));
  }

  function choose(fixture: ComponentFixture<BroadcastAlert>, groupId: string): void {
    const select = element(fixture).querySelector<HTMLSelectElement>('#alert-audience')!;
    select.value = groupId;
    select.dispatchEvent(new Event('change'));
  }

  function pickLevel(fixture: ComponentFixture<BroadcastAlert>, index: number): void {
    const radios = element(fixture).querySelectorAll<HTMLInputElement>('input[name="level"]');
    radios[index].dispatchEvent(new Event('change'));
  }

  function submit(fixture: ComponentFixture<BroadcastAlert>): void {
    element(fixture).querySelector('form')!.dispatchEvent(new Event('submit'));
  }

  it('diffuse à toute l’organisation par défaut', async () => {
    const fixture = await setup();

    write(fixture, '  Fermeture exceptionnelle demain.  ');
    submit(fixture);
    await fixture.whenStable();

    const request = http.expectOne(ALERTS_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      content: 'Fermeture exceptionnelle demain.',
      level: 'INFO',
      audienceKind: 'ORGANISATION',
    });
    request.flush({ alertId: 'a-1' }, { status: 201, statusText: 'Created' });
    await fixture.whenStable();

    expect(element(fixture).textContent).toContain("Alerte diffusée à toute l'organisation");
    http.verify();
  });

  it('cible un groupe et son niveau, puis repart des valeurs les plus prudentes', async () => {
    const fixture = await setup();

    choose(fixture, 'g-cda');
    pickLevel(fixture, 2);
    write(fixture, 'Cours annulé.');
    await fixture.whenStable();

    expect(element(fixture).querySelector('button[type="submit"]')!.textContent).toContain(
      'Diffuser à Promo CDA 2026',
    );

    submit(fixture);
    await fixture.whenStable();

    const request = http.expectOne(ALERTS_URL);
    expect(request.request.body).toEqual({
      content: 'Cours annulé.',
      level: 'URGENT',
      audienceKind: 'GROUP',
      groupId: 'g-cda',
    });
    request.flush({ alertId: 'a-2' }, { status: 201, statusText: 'Created' });
    await fixture.whenStable();

    expect(element(fixture).textContent).toContain('Alerte diffusée à Promo CDA 2026');
    // Ni le groupe ni le niveau urgent ne doivent survivre à l'envoi.
    expect(element(fixture).querySelector('button[type="submit"]')!.textContent).toContain(
      "Diffuser à toute l'organisation",
    );
    expect(element(fixture).querySelector<HTMLTextAreaElement>('#alert-content')!.value).toBe('');
    // Le sélecteur doit suivre : ses options viennent d'un @for, pas du gabarit statique.
    expect(element(fixture).querySelector<HTMLSelectElement>('#alert-audience')!.value).toBe('');
    http.verify();
  });

  it('n’offre pas le canal Général, qui ferait doublon avec l’organisation', async () => {
    const fixture = await setup();

    const options = Array.from(
      element(fixture).querySelectorAll<HTMLOptionElement>('#alert-audience option'),
    ).map((option) => option.value);

    expect(options).toEqual(['', 'g-cda']);
    http.verify();
  });

  it('message vide : aucune requête', async () => {
    const fixture = await setup();

    write(fixture, '   ');
    submit(fixture);
    await fixture.whenStable();

    http.expectNone(ALERTS_URL);
    http.verify();
  });

  it('403 : explique le refus sans vider la saisie', async () => {
    const fixture = await setup();

    write(fixture, 'Test');
    submit(fixture);
    await fixture.whenStable();

    http.expectOne(ALERTS_URL).flush(null, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();

    expect(element(fixture).textContent).toContain('pas les droits pour diffuser');
    expect(element(fixture).querySelector<HTMLTextAreaElement>('#alert-content')!.value).toBe(
      'Test',
    );
    http.verify();
  });

  it('groupes indisponibles : le prévient et laisse diffuser à l’organisation', async () => {
    const fixture = await setup(false);

    expect(element(fixture).textContent).toContain("Les groupes n'ont pas pu être chargés");

    write(fixture, 'Test');
    submit(fixture);
    await fixture.whenStable();

    expect(http.expectOne(ALERTS_URL).request.body).toMatchObject({
      audienceKind: 'ORGANISATION',
    });
    http.verify();
  });
});

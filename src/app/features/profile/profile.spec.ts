import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthService } from '../../core/auth/auth.service';
import { Profile } from './profile';

const USER_ID = 'u-1';
const PROFILE_URL = `/api/users/${USER_ID}/profile`;
const ABSENCE_URL = `/api/users/${USER_ID}/absence-message`;

function me(absenceMessage: { content: string; active: boolean } | null) {
  return {
    userId: USER_ID,
    email: 'yannick.remy@mns.fr',
    firstName: 'Yannick',
    lastName: 'Remy',
    memberId: 'm-1',
    organisationId: 'org-1',
    role: 'MEMBER',
    memberStatus: 'ACTIVE',
    absenceMessage,
  };
}

describe('Profile', () => {
  let http: HttpTestingController;

  /** L'écran vit derrière un garde : `/me` est déjà résolu quand il se monte. */
  async function setup(
    absenceMessage: { content: string; active: boolean } | null = null,
  ): Promise<ComponentFixture<Profile>> {
    await TestBed.configureTestingModule({
      imports: [Profile],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).loadCurrentUser().subscribe();
    http.expectOne('/api/auth/me').flush(me(absenceMessage));

    const fixture = TestBed.createComponent(Profile);
    await fixture.whenStable();
    return fixture;
  }

  function root(fixture: ComponentFixture<Profile>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function type(fixture: ComponentFixture<Profile>, selector: string, value: string): void {
    const field = root(fixture).querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    field.value = value;
    field.dispatchEvent(new Event('input'));
  }

  function submit(fixture: ComponentFixture<Profile>, index: number): void {
    root(fixture).querySelectorAll('form')[index].dispatchEvent(new Event('submit'));
  }

  it('pré-remplit les champs depuis la session', async () => {
    const fixture = await setup({ content: 'En congés', active: true });

    expect(root(fixture).querySelector<HTMLInputElement>('#profile-first-name')!.value).toBe(
      'Yannick',
    );
    expect(root(fixture).querySelector<HTMLInputElement>('#profile-email')!.value).toBe(
      'yannick.remy@mns.fr',
    );
    expect(root(fixture).querySelector<HTMLTextAreaElement>('#profile-absence')!.value).toBe(
      'En congés',
    );
    expect(root(fixture).querySelector('[role="switch"]')!.getAttribute('aria-checked')).toBe(
      'true',
    );
    http.verify();
  });

  it('enregistre l’identité puis recharge la session', async () => {
    const fixture = await setup();

    type(fixture, '#profile-first-name', '  Yann  ');
    submit(fixture, 0);
    await fixture.whenStable();

    const request = http.expectOne(PROFILE_URL);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ firstName: 'Yann', lastName: 'Remy' });
    request.flush(null);
    await fixture.whenStable();

    // L'en-tête de la coquille affiche le nom : la session doit suivre.
    http.expectOne('/api/auth/me').flush(me(null));
    await fixture.whenStable();

    expect(root(fixture).textContent).toContain('Identité mise à jour');
    http.verify();
  });

  it('l’adresse e-mail n’est pas modifiable', async () => {
    const fixture = await setup();

    expect(root(fixture).querySelector<HTMLInputElement>('#profile-email')!.readOnly).toBe(true);
    http.verify();
  });

  it('champ obligatoire vide : aucune requête', async () => {
    const fixture = await setup();

    type(fixture, '#profile-last-name', '   ');
    submit(fixture, 0);
    await fixture.whenStable();

    http.expectNone(PROFILE_URL);
    http.verify();
  });

  it('enregistre le message d’absence avec son état', async () => {
    const fixture = await setup();

    type(fixture, '#profile-absence', 'Absent jusqu’au 15.');
    root(fixture).querySelector<HTMLButtonElement>('[role="switch"]')!.click();
    await fixture.whenStable();

    submit(fixture, 1);
    await fixture.whenStable();

    const request = http.expectOne(ABSENCE_URL);
    expect(request.request.body).toEqual({ content: 'Absent jusqu’au 15.', active: true });
    request.flush(null);
    await fixture.whenStable();

    http.expectOne('/api/auth/me').flush(me({ content: 'Absent jusqu’au 15.', active: true }));
    await fixture.whenStable();

    expect(root(fixture).textContent).toContain("Message d'absence activé");
    http.verify();
  });

  it('désactiver renvoie le contenu, faute de suppression côté backend', async () => {
    const fixture = await setup({ content: 'En congés', active: true });

    root(fixture).querySelector<HTMLButtonElement>('[role="switch"]')!.click();
    await fixture.whenStable();

    submit(fixture, 1);
    await fixture.whenStable();

    const request = http.expectOne(ABSENCE_URL);
    expect(request.request.body).toEqual({ content: 'En congés', active: false });
    request.flush(null);
    await fixture.whenStable();

    http.expectOne('/api/auth/me').flush(me({ content: 'En congés', active: false }));
    await fixture.whenStable();

    expect(root(fixture).textContent).toContain("Message d'absence désactivé");
    http.verify();
  });

  it('message vide : aucune requête, même pour désactiver', async () => {
    const fixture = await setup();

    submit(fixture, 1);
    await fixture.whenStable();

    http.expectNone(ABSENCE_URL);
    http.verify();
  });

  it('400 : affiche l’erreur sans vider la saisie', async () => {
    const fixture = await setup();

    type(fixture, '#profile-first-name', 'Yann');
    submit(fixture, 0);
    await fixture.whenStable();

    http.expectOne(PROFILE_URL).flush(null, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();

    expect(root(fixture).textContent).toContain('Vérifiez les informations saisies');
    expect(root(fixture).querySelector<HTMLInputElement>('#profile-first-name')!.value).toBe(
      'Yann',
    );
    http.verify();
  });
});

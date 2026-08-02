import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthService } from '../../../core/auth/auth.service';
import { InviteMemberDialog } from './invite-member-dialog';

const ORG = 'org-1';
const MEMBERS_URL = `/api/organisations/${ORG}/members`;

describe('InviteMemberDialog', () => {
  let http: HttpTestingController;

  /** Crée la modale déjà ouverte : c'est son seul état utile à tester. */
  async function setup(): Promise<ComponentFixture<InviteMemberDialog>> {
    await TestBed.configureTestingModule({
      imports: [InviteMemberDialog],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);

    // L'orgId vient de /me : sans lui, AdminService ne sait pas construire l'URL.
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

    const fixture = TestBed.createComponent(InviteMemberDialog);
    fixture.componentRef.setInput('open', true);
    await fixture.whenStable();
    return fixture;
  }

  function element(fixture: ComponentFixture<InviteMemberDialog>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /** Saisit par le DOM : le rôle garde sa valeur par défaut (`MEMBER`). */
  function fill(fixture: ComponentFixture<InviteMemberDialog>): void {
    const root = element(fixture);
    type(root, '#invite-email', 'karim.belkacem@mns.fr');
    type(root, '#invite-first-name', 'Karim');
    type(root, '#invite-last-name', 'Belkacem');
  }

  function type(root: HTMLElement, selector: string, value: string): void {
    const input = root.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function submit(fixture: ComponentFixture<InviteMemberDialog>): void {
    element(fixture).querySelector('form')!.dispatchEvent(new Event('submit'));
  }

  // `showModal()` est bouchonné dans jsdom (cf. src/test-setup.ts) : on vérifie
  // le pilotage du `<dialog>`, pas le comportement modal du navigateur.
  it('ouvre la boîte de dialogue quand open passe à vrai', async () => {
    const fixture = await setup();

    expect(element(fixture).querySelector('dialog')!.open).toBe(true);
    expect(element(fixture).textContent).toContain('Inviter un membre');
    http.verify();
  });

  it('invite : poste la saisie, se referme et notifie le parent', async () => {
    const fixture = await setup();
    let invited = 0;
    fixture.componentInstance.invited.subscribe(() => (invited += 1));

    fill(fixture);
    submit(fixture);
    await fixture.whenStable();

    const request = http.expectOne(MEMBERS_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      email: 'karim.belkacem@mns.fr',
      firstName: 'Karim',
      lastName: 'Belkacem',
      role: 'MEMBER',
    });
    request.flush(null, { status: 201, statusText: 'Created' });
    await fixture.whenStable();

    expect(invited).toBe(1);
    expect(fixture.componentInstance.open()).toBe(false);
    expect(element(fixture).querySelector('dialog')!.open).toBe(false);
    http.verify();
  });

  it('409 : explique le conflit et laisse la modale ouverte', async () => {
    const fixture = await setup();
    fill(fixture);
    submit(fixture);
    await fixture.whenStable();

    http.expectOne(MEMBERS_URL).flush(null, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();

    expect(element(fixture).textContent).toContain('déjà invitée');
    expect(fixture.componentInstance.open()).toBe(true);
    http.verify();
  });

  it('formulaire incomplet : aucune requête et erreurs affichées', async () => {
    const fixture = await setup();

    submit(fixture);
    await fixture.whenStable();

    http.expectNone(MEMBERS_URL);
    expect(element(fixture).textContent).toContain('adresse e-mail valide');
    http.verify();
  });

  it('propose les trois rôles acceptés par le backend', async () => {
    const fixture = await setup();

    const roles = Array.from(element(fixture).querySelectorAll('#invite-role option')).map(
      (option) => (option as HTMLOptionElement).value,
    );

    expect(roles).toEqual(['MEMBER', 'MANAGER', 'ADMIN']);
    http.verify();
  });
});

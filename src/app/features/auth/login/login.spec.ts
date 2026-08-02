import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { Login } from './login';

describe('Login', () => {
  let http: HttpTestingController;

  async function setup(queryParams: Record<string, string> = {}) {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        // Le composant ne lit que les paramètres de requête de l'instantané.
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    return fixture;
  }

  function fill(fixture: Awaited<ReturnType<typeof setup>>, email: string, password: string) {
    const el = fixture.nativeElement as HTMLElement;
    const emailInput = el.querySelector('#email') as HTMLInputElement;
    const passwordInput = el.querySelector('#password') as HTMLInputElement;
    emailInput.value = email;
    emailInput.dispatchEvent(new Event('input'));
    passwordInput.value = password;
    passwordInput.dispatchEvent(new Event('input'));
  }

  function submit(fixture: Awaited<ReturnType<typeof setup>>) {
    const form = (fixture.nativeElement as HTMLElement).querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
  }

  it('affiche le titre et les deux champs', async () => {
    const fixture = await setup();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Se connecter');
    expect(el.querySelector('#email')).toBeTruthy();
    expect(el.querySelector('#password')).toBeTruthy();
    http.verify();
  });

  it('formulaire invalide : aucune requête envoyée', async () => {
    const fixture = await setup();
    submit(fixture);
    await fixture.whenStable();
    http.expectNone('/api/auth/login');
    http.verify();
  });

  it('401 : affiche un message d’identifiants invalides', async () => {
    const fixture = await setup();
    fill(fixture, 'a@mns.fr', 'mauvais');
    submit(fixture);
    await fixture.whenStable();

    http.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();

    const alert = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('incorrect');
    http.verify();
  });

  it('403 : signale un compte désactivé', async () => {
    const fixture = await setup();
    fill(fixture, 'a@mns.fr', 'secret');
    submit(fixture);
    await fixture.whenStable();

    http.expectOne('/api/auth/login').flush(null, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();

    const alert = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('désactivé');
    http.verify();
  });

  /** Déroule une connexion réussie et renvoie l'URL vers laquelle on a navigué. */
  async function loginSuccessfully(queryParams: Record<string, string> = {}): Promise<string> {
    const fixture = await setup(queryParams);
    const navigate = vi
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValue(true as never);

    fill(fixture, 'yannick.remy@mns.fr', 'secret');
    submit(fixture);
    await fixture.whenStable();

    http.expectOne('/api/auth/login').flush(null);
    await fixture.whenStable();

    http.expectOne('/api/auth/me').flush({
      userId: 'u-1',
      email: 'yannick.remy@mns.fr',
      firstName: 'Yannick',
      lastName: 'Remy',
    });
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledTimes(1);
    return navigate.mock.calls[0][0] as string;
  }

  it('succès : charge /me puis navigue vers /messages', async () => {
    expect(await loginSuccessfully()).toBe('/messages');
    http.verify();
  });

  it('succès : revient sur la destination mémorisée par le garde', async () => {
    expect(await loginSuccessfully({ returnUrl: '/administration' })).toBe('/administration');
    http.verify();
  });

  it('succès : ignore une destination externe', async () => {
    expect(await loginSuccessfully({ returnUrl: 'https://faux-alerte.example' })).toBe('/messages');
    http.verify();
  });
});

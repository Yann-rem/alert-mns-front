import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { Login } from './login';

describe('Login', () => {
  let http: HttpTestingController;

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
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

    http
      .expectOne('/api/auth/login')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
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

  it('succès : charge /me puis navigue vers /messages', async () => {
    const fixture = await setup();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

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

    expect(navigate).toHaveBeenCalledWith(['/messages']);
    http.verify();
  });
});

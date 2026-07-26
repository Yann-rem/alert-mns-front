import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { Activation } from './activation';

const CONTEXT = { email: 'sofia.nkolo@mns.fr', firstName: 'Sofia', lastName: 'Nkolo' };
const VALIDATE_URL = '/api/auth/magic-link/validate?token=tok-123';

describe('Activation', () => {
  let http: HttpTestingController;

  async function setup(token: string | null = 'tok-123') {
    await TestBed.configureTestingModule({
      imports: [Activation],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(token ? { token } : {}),
            },
          },
        },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Activation);
    await fixture.whenStable();
    return fixture;
  }

  function text(fixture: Awaited<ReturnType<typeof setup>>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function fill(
    fixture: Awaited<ReturnType<typeof setup>>,
    password: string,
    confirmation: string,
  ) {
    const el = fixture.nativeElement as HTMLElement;
    for (const [id, value] of [
      ['#password', password],
      ['#confirmation', confirmation],
    ] as const) {
      const input = el.querySelector(id) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
  }

  function submit(fixture: Awaited<ReturnType<typeof setup>>) {
    (fixture.nativeElement as HTMLElement)
      .querySelector('form')!
      .dispatchEvent(new Event('submit'));
  }

  it('valide le lien au chargement et affiche le prénom et l’e-mail', async () => {
    const fixture = await setup();
    http.expectOne(VALIDATE_URL).flush(CONTEXT);
    await fixture.whenStable();

    expect(text(fixture)).toContain('Sofia');
    expect(text(fixture)).toContain('sofia.nkolo@mns.fr');
    http.verify();
  });

  it('lien absent : état expiré, aucune requête', async () => {
    const fixture = await setup(null);
    http.expectNone(VALIDATE_URL);
    expect(text(fixture)).toContain('Lien expiré');
    http.verify();
  });

  it('410 à la validation : état expiré', async () => {
    const fixture = await setup();
    http.expectOne(VALIDATE_URL).flush(null, { status: 410, statusText: 'Gone' });
    await fixture.whenStable();

    expect(text(fixture)).toContain('Lien expiré');
    http.verify();
  });

  it('mot de passe trop court : aucune requête de redeem', async () => {
    const fixture = await setup();
    http.expectOne(VALIDATE_URL).flush(CONTEXT);
    await fixture.whenStable();

    fill(fixture, 'court', 'court');
    submit(fixture);
    await fixture.whenStable();

    http.expectNone('/api/auth/magic-link/redeem');
    http.verify();
  });

  it('mots de passe différents : aucune requête et message dédié', async () => {
    const fixture = await setup();
    http.expectOne(VALIDATE_URL).flush(CONTEXT);
    await fixture.whenStable();

    fill(fixture, 'motdepassevalide', 'motdepasseautre1');
    submit(fixture);
    await fixture.whenStable();

    http.expectNone('/api/auth/magic-link/redeem');
    expect(text(fixture)).toContain('ne correspondent pas');
    http.verify();
  });

  it('succès : consomme le lien puis renvoie vers la connexion', async () => {
    const fixture = await setup();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    http.expectOne(VALIDATE_URL).flush(CONTEXT);
    await fixture.whenStable();

    fill(fixture, 'motdepassevalide', 'motdepassevalide');
    submit(fixture);
    await fixture.whenStable();

    const request = http.expectOne('/api/auth/magic-link/redeem');
    expect(request.request.body).toEqual({
      token: 'tok-123',
      password: 'motdepassevalide',
    });
    request.flush(null);
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/connexion'], { queryParams: { active: 1 } });
    http.verify();
  });

  it('410 au redeem : bascule sur l’état expiré', async () => {
    const fixture = await setup();
    http.expectOne(VALIDATE_URL).flush(CONTEXT);
    await fixture.whenStable();

    fill(fixture, 'motdepassevalide', 'motdepassevalide');
    submit(fixture);
    await fixture.whenStable();

    http.expectOne('/api/auth/magic-link/redeem').flush(null, { status: 410, statusText: 'Gone' });
    await fixture.whenStable();

    expect(text(fixture)).toContain('Lien expiré');
    http.verify();
  });
});

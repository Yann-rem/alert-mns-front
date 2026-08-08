import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { RealtimeService, type AlertNotification } from '../../../core/realtime/realtime.service';
import { AlertBanner } from './alert-banner';

const ALERTS_URL = '/api/alerting/alerts';
const USER_ID = 'u-1';
/** `localStorage` est cloisonné par origine, pas par compte : la clé porte l'utilisateur. */
const DISMISSED_KEY = `alerte.dismissed-alerts.${USER_ID}`;

/** Le vrai service ouvrirait un WebSocket : on n'en garde que le flux entrant. */
class RealtimeStub {
  readonly connected = signal(true);
  readonly alerted = new Subject<AlertNotification>();
  readonly alerts$ = this.alerted.asObservable();
  connect(): void {}
  disconnect(): void {}
}

function alert(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    alertId: 'a-1',
    issuerId: 'm-9',
    issuerName: 'Marie Dupont',
    audienceKind: 'ORGANISATION',
    groupId: null,
    groupName: null,
    level: 'URGENT',
    content: 'Fermeture exceptionnelle demain.',
    issuedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('AlertBanner', () => {
  let http: HttpTestingController;
  let realtime: RealtimeStub;

  async function setup(clearStorage = true): Promise<ComponentFixture<AlertBanner>> {
    if (clearStorage) {
      localStorage.clear();
    }
    realtime = new RealtimeStub();

    await TestBed.configureTestingModule({
      imports: [AlertBanner],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RealtimeService, useValue: realtime },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);

    // La session est résolue par le garde avant que l'écran hôte ne monte le bandeau.
    TestBed.inject(AuthService).loadCurrentUser().subscribe();
    http.expectOne('/api/auth/me').flush({
      userId: USER_ID,
      email: 'jane.smith@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      memberId: 'm-1',
      organisationId: 'org-1',
      role: 'MANAGER',
      memberStatus: 'ACTIVE',
      absenceMessage: null,
    });

    const fixture = TestBed.createComponent(AlertBanner);
    await fixture.whenStable();
    return fixture;
  }

  function text(fixture: ComponentFixture<AlertBanner>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function root(fixture: ComponentFixture<AlertBanner>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('affiche l’alerte la plus récente, son émetteur et son groupe', async () => {
    const fixture = await setup();

    http.expectOne(ALERTS_URL).flush([
      alert({
        alertId: 'a-old',
        content: 'Ancienne',
        issuedAt: new Date(Date.now() - 3600_000).toISOString(),
      }),
      alert({
        alertId: 'a-new',
        content: 'Cours annulé',
        level: 'IMPORTANT',
        audienceKind: 'GROUP',
        groupId: 'g-1',
        groupName: 'Promo CDA 2026',
      }),
    ]);
    await fixture.whenStable();

    expect(text(fixture)).toContain('Cours annulé');
    expect(text(fixture)).toContain('Marie Dupont');
    expect(text(fixture)).toContain('Promo CDA 2026');
    expect(text(fixture)).toContain('Important');
    expect(text(fixture)).not.toContain('Ancienne');
    http.verify();
  });

  it('ignore les alertes trop anciennes pour être encore d’actualité', async () => {
    const fixture = await setup();

    const twoDaysAgo = new Date(Date.now() - 48 * 3600_000).toISOString();
    http.expectOne(ALERTS_URL).flush([alert({ content: 'Périmée', issuedAt: twoDaysAgo })]);
    await fixture.whenStable();

    expect(root(fixture).children.length).toBe(0);
    http.verify();
  });

  it('affiche une alerte poussée en temps réel', async () => {
    const fixture = await setup();
    http.expectOne(ALERTS_URL).flush([]);
    await fixture.whenStable();

    expect(root(fixture).children.length).toBe(0);

    realtime.alerted.next(alert({ alertId: 'a-live', content: 'Évacuation' }) as AlertNotification);
    await fixture.whenStable();

    expect(text(fixture)).toContain('Évacuation');
    // Une alerte urgente doit interrompre la lecture d'écran.
    expect(root(fixture).querySelector('[role="alert"]')).not.toBeNull();
    http.verify();
  });

  it('ne rejoue pas une alerte déjà reçue par la lecture initiale', async () => {
    const fixture = await setup();
    http.expectOne(ALERTS_URL).flush([alert({ alertId: 'a-1', content: 'Unique' })]);
    await fixture.whenStable();

    realtime.alerted.next(alert({ alertId: 'a-1', content: 'Unique' }) as AlertNotification);
    await fixture.whenStable();

    expect(text(fixture).match(/Unique/g)).toHaveLength(1);
    http.verify();
  });

  it('écarter une alerte révèle la suivante et mémorise le rejet', async () => {
    const fixture = await setup();

    http.expectOne(ALERTS_URL).flush([
      alert({
        alertId: 'a-2',
        content: 'Seconde',
        issuedAt: new Date(Date.now() - 60_000).toISOString(),
      }),
      alert({ alertId: 'a-1', content: 'Première' }),
    ]);
    await fixture.whenStable();

    expect(text(fixture)).toContain('Première');

    root(fixture).querySelector('button')!.click();
    await fixture.whenStable();

    expect(text(fixture)).toContain('Seconde');
    expect(text(fixture)).not.toContain('Première');
    expect(localStorage.getItem(DISMISSED_KEY)).toContain('a-1');
    http.verify();
  });

  it('ne subit pas les rejets d’un autre compte du même navigateur', async () => {
    // Un admin a écarté cette alerte depuis le même navigateur, sous sa propre clé.
    localStorage.clear();
    localStorage.setItem('alerte.dismissed-alerts.u-admin', JSON.stringify(['a-1']));

    // `setup` ne nettoie pas ici, sinon la clé qu'on vient de poser disparaîtrait.
    const fixture = await setup(false);
    http.expectOne(ALERTS_URL).flush([alert({ alertId: 'a-1', content: 'Évacuation' })]);
    await fixture.whenStable();

    expect(text(fixture)).toContain('Évacuation');
    http.verify();
  });

  it('lecture en échec : le bandeau reste absent plutôt que de défigurer l’écran', async () => {
    const fixture = await setup();

    http.expectOne(ALERTS_URL).flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(root(fixture).children.length).toBe(0);
    http.verify();
  });
});

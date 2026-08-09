import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { AuthService, type MemberRole } from '../../core/auth/auth.service';
import { RealtimeService, type AlertNotification } from '../../core/realtime/realtime.service';
import { Shell } from './shell';

/** Le vrai service ouvrirait un WebSocket : on compte les ouvertures et fermetures. */
class RealtimeStub {
  readonly connected = signal(true);
  readonly alerted = new Subject<AlertNotification>();
  readonly alerts$ = this.alerted.asObservable();
  connects = 0;
  disconnects = 0;
  connect(): void {
    this.connects += 1;
  }
  disconnect(): void {
    this.disconnects += 1;
  }
}

describe('Shell', () => {
  let http: HttpTestingController;
  let realtime: RealtimeStub;

  async function setup(role: MemberRole): Promise<ComponentFixture<Shell>> {
    realtime = new RealtimeStub();

    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: RealtimeService, useValue: realtime },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);

    // La coquille est montée derrière authGuard : la session est déjà résolue.
    TestBed.inject(AuthService).loadCurrentUser().subscribe();
    http.expectOne('/api/auth/me').flush({
      userId: 'u-1',
      email: 'yannick.remy@mns.fr',
      firstName: 'Yannick',
      lastName: 'Remy',
      memberId: 'm-1',
      organisationId: 'org-1',
      role,
      memberStatus: 'ACTIVE',
      absenceMessage: null,
    });

    const fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
    // Le bandeau d'alerte est monté ici : sa lecture part avec la coquille.
    http.expectOne('/api/alerting/alerts').flush([]);
    await fixture.whenStable();
    return fixture;
  }

  /** Les destinations du rail, dans l'ordre d'affichage. */
  function railLinks(fixture: ComponentFixture<Shell>): string[] {
    const rail = (fixture.nativeElement as HTMLElement).querySelector('nav')!;
    return Array.from(rail.querySelectorAll('a')).map((link) => link.getAttribute('href') ?? '');
  }

  it('un simple membre ne voit que Messages et son profil', async () => {
    const fixture = await setup('MEMBER');

    expect(railLinks(fixture)).toEqual(['/messages', '/profil']);
    http.verify();
  });

  it('un gestionnaire voit Diffuser, mais pas l’administration', async () => {
    const fixture = await setup('MANAGER');

    expect(railLinks(fixture)).toEqual(['/messages', '/diffuser', '/profil']);
    http.verify();
  });

  it('un admin voit toutes les destinations', async () => {
    const fixture = await setup('ADMIN');

    expect(railLinks(fixture)).toEqual(['/messages', '/diffuser', '/administration', '/profil']);
    http.verify();
  });

  it('ouvre le canal temps réel une seule fois, et le ferme avec la coquille', async () => {
    const fixture = await setup('MEMBER');

    expect(realtime.connects).toBe(1);
    expect(realtime.disconnects).toBe(0);

    fixture.destroy();

    expect(realtime.disconnects).toBe(1);
  });

  it('la déconnexion ferme le canal puis renvoie à la connexion', async () => {
    const fixture = await setup('MEMBER');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    const logout = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((button) => button.textContent?.includes('Se déconnecter'))!;
    logout.click();
    await fixture.whenStable();

    expect(realtime.disconnects).toBe(1);
    http.expectOne('/api/auth/logout').flush(null);
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/connexion']);
    http.verify();
  });
});

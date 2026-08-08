import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { Button } from '../../ui/button/button';
import { AlertBanner } from '../alerting/banner/alert-banner';

/** Destination de la navigation principale. */
interface Destination {
  path: string;
  label: string;
  icon: 'messages' | 'broadcast' | 'admin';
}

/**
 * Coquille applicative : identité, navigation, bandeau d'alerte et canal temps réel.
 *
 * <p><b>Elle possède la connexion temps réel.</b> Auparavant l'écran Messages l'ouvrait et la
 * fermait, si bien que passer sur la diffusion ou l'administration coupait le socket, et qu'ouvrir
 * une conversation le faisait cycler (les routes `/messages` et `/messages/:id` sont deux
 * définitions distinctes : le composant est détruit puis recréé). Ici, la connexion vit aussi
 * longtemps que la session.</p>
 *
 * <p>Le bandeau d'alerte y est monté pour la même raison : une alerte urgente doit atteindre
 * l'utilisateur quel que soit l'écran qu'il consulte.</p>
 */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertBanner, Button, NgTemplateOutlet, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shell.html',
  host: { class: 'flex h-dvh flex-col bg-surface-page text-text-primary' },
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  private readonly router = inject(Router);

  protected readonly user = this.auth.user;
  protected readonly connected = this.realtime.connected;

  /** On n'affiche pas une porte qui se refermerait : chaque destination suit son garde de route. */
  protected readonly destinations = computed<Destination[]>(() => {
    const items: Destination[] = [{ path: '/messages', label: 'Messages', icon: 'messages' }];
    if (this.auth.canBroadcast()) {
      items.push({ path: '/diffuser', label: 'Diffuser', icon: 'broadcast' });
    }
    if (this.auth.isAdmin()) {
      items.push({ path: '/administration', label: 'Administration', icon: 'admin' });
    }
    return items;
  });

  constructor() {
    this.realtime.connect();
    inject(DestroyRef).onDestroy(() => this.realtime.disconnect());
  }

  protected logout(): void {
    // Fermé avant l'appel : le serveur coupe déjà les sockets d'une session révoquée, mais on ne
    // laisse pas le client tenter de se reconnecter entre-temps.
    this.realtime.disconnect();
    this.auth.logout().subscribe({
      next: () => void this.router.navigate(['/connexion']),
      error: () => void this.router.navigate(['/connexion']),
    });
  }
}

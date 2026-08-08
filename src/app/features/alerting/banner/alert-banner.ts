import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  ALERT_LEVEL_LABELS,
  AlertingService,
  type Alert,
  type AlertLevel,
} from '../../../core/alerting/alerting.service';
import { AuthService } from '../../../core/auth/auth.service';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import { Badge, type BadgeTone } from '../../../ui/badge/badge';
import { Button } from '../../../ui/button/button';

/**
 * Durée au-delà de laquelle une alerte cesse de s'afficher.
 *
 * <p>Le backend ne connaît ni péremption ni accusé de lecture : `GET /alerts` renvoie tout
 * l'historique. Sans cette fenêtre, une information de service vieille de trois mois barrerait
 * l'écran indéfiniment. Une alerte est par nature éphémère — c'est ce qui la distingue d'un
 * message.</p>
 */
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Préfixe de stockage des alertes déjà écartées. Ne contient que des identifiants d'alerte, aucune
 * donnée personnelle.
 *
 * <p>La clé est <b>suffixée par l'utilisateur</b> : `localStorage` est cloisonné par origine, pas
 * par compte. Sans ce suffixe, deux comptes ouverts dans le même navigateur partagent leurs rejets
 * — écarter une alerte côté admin la ferait disparaître côté gestionnaire.</p>
 */
const DISMISSED_STORAGE_PREFIX = 'alerte.dismissed-alerts';

/**
 * Nombre d'identifiants écartés conservés.
 *
 * <p>Au-delà de {@link RECENT_WINDOW_MS} une alerte ne s'affiche plus de toute façon : mémoriser
 * son rejet ne sert plus à rien. La liste est donc bornée plutôt que datée.</p>
 */
const DISMISSED_MAX = 50;

const LEVEL_TONES: Readonly<Record<AlertLevel, BadgeTone>> = {
  INFO: 'accent',
  IMPORTANT: 'warning',
  URGENT: 'danger',
};

const LEVEL_SKINS: Readonly<Record<AlertLevel, string>> = {
  INFO: 'border-accent-border bg-accent-subtle',
  IMPORTANT: 'border-warning-border bg-warning-subtle',
  URGENT: 'border-danger-border bg-danger-subtle',
};

/**
 * Bandeau affichant l'alerte en cours, chargée à l'ouverture puis complétée en temps réel.
 *
 * <p>Une seule alerte à la fois — la plus récente non écartée. L'écarter révèle la suivante, ce qui
 * évite d'empiler des bandeaux tout en ne perdant rien.</p>
 *
 * <p>Le rejet est mémorisé localement : sans cela, un rechargement de page ramènerait une alerte
 * déjà lue. Le backend n'a pas de notion de lecture — l'ajouter demanderait une table et une
 * migration pour un confort d'affichage.</p>
 */
@Component({
  selector: 'app-alert-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Badge, Button],
  templateUrl: './alert-banner.html',
  // L'écran hôte est une colonne flex de hauteur fixe : sans cela, le bandeau serait le seul
  // élément compressible et se ferait écraser par le fil de discussion.
  host: { class: 'shrink-0' },
})
export class AlertBanner {
  private readonly alerting = inject(AlertingService);
  private readonly realtime = inject(RealtimeService);
  private readonly auth = inject(AuthService);

  /** Le bandeau vit derrière un garde : la session est déjà résolue quand il se monte. */
  private readonly storageKey = `${DISMISSED_STORAGE_PREFIX}.${this.auth.user()?.userId ?? 'anonyme'}`;

  /** De la plus récente à la plus ancienne, déjà filtrées sur la fenêtre de fraîcheur. */
  private readonly alerts = signal<Alert[]>([]);
  private readonly dismissed = signal<ReadonlySet<string>>(this.readDismissed());

  protected readonly current = computed(() => {
    const dismissed = this.dismissed();
    return this.alerts().find((alert) => !dismissed.has(alert.alertId)) ?? null;
  });

  constructor() {
    // Sans effet si la connexion est déjà ouverte. La fermer, en revanche, regarde l'écran hôte :
    // ce bandeau n'est pas propriétaire du canal.
    this.realtime.connect();

    this.alerting.listMine().subscribe({
      next: (alerts) => this.alerts.set(AlertBanner.recentFirst(alerts)),
      // Une alerte non chargée ne doit pas défigurer l'écran : le bandeau reste simplement absent.
      error: () => this.alerts.set([]),
    });

    this.realtime.alerts$.pipe(takeUntilDestroyed()).subscribe((notification) => {
      this.alerts.update((current) =>
        current.some((alert) => alert.alertId === notification.alertId)
          ? current
          : AlertBanner.recentFirst([notification, ...current]),
      );
    });
  }

  protected dismiss(alertId: string): void {
    const next = new Set(this.dismissed());
    next.add(alertId);
    this.dismissed.set(next);
    this.persist(next);
  }

  protected levelLabel(level: AlertLevel): string {
    return ALERT_LEVEL_LABELS[level];
  }

  protected levelTone(level: AlertLevel): BadgeTone {
    return LEVEL_TONES[level];
  }

  protected levelSkin(level: AlertLevel): string {
    return LEVEL_SKINS[level];
  }

  /** Heure seule pour aujourd'hui, date et heure au-delà : savoir « quand » compte pour une alerte. */
  protected issuedLabel(iso: string): string {
    const date = new Date(iso);
    const isToday = new Date().toDateString() === date.toDateString();
    return isToday
      ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  }

  private static recentFirst(alerts: Alert[]): Alert[] {
    const floor = Date.now() - RECENT_WINDOW_MS;
    return alerts
      .filter((alert) => new Date(alert.issuedAt).getTime() >= floor)
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  }

  private readDismissed(): ReadonlySet<string> {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      // Stockage indisponible ou corrompu : on repart d'une ardoise vierge plutôt que d'échouer.
      return new Set<string>();
    }
  }

  private persist(dismissed: ReadonlySet<string>): void {
    try {
      const kept = [...dismissed].slice(-DISMISSED_MAX);
      localStorage.setItem(this.storageKey, JSON.stringify(kept));
    } catch {
      /* rejet non mémorisé : sans conséquence sur la session en cours */
    }
  }
}

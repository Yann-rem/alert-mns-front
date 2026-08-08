import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { AdminService, type GroupSummary } from '../../../core/admin/admin.service';
import {
  ALERT_CONTENT_MAX_LENGTH,
  ALERT_LEVEL_LABELS,
  AlertingService,
  type AlertLevel,
} from '../../../core/alerting/alerting.service';
import { Button } from '../../../ui/button/button';
import { Field } from '../../../ui/field/field';

/**
 * Nombre de groupes chargés dans le sélecteur d'audience.
 *
 * <p>Une liste déroulante ne se parcourt pas au-delà : si une organisation
 * dépasse ce volume, c'est un champ de recherche qu'il faudra, pas une page
 * plus grande.</p>
 */
const GROUP_PAGE_SIZE = 100;

/** Seuil à partir duquel le compteur de caractères devient utile. */
const REMAINING_HINT_THRESHOLD = 200;

/** Ce que change concrètement le niveau choisi, dit là où on le choisit. */
const LEVEL_HINTS: Readonly<Record<AlertLevel, string>> = {
  INFO: 'Information de service, sans caractère pressant.',
  IMPORTANT: 'Mise en avant : à lire dans la journée.',
  URGENT: 'Signalée en rouge : sécurité, fermeture, incident.',
};

/**
 * Diffusion d'une alerte à toute l'organisation ou à un groupe.
 *
 * <p>Trois champs pilotés par des signaux, sans `FormsModule` : le formulaire
 * natif suffit, et l'état dérivé (compteur, libellé du bouton) se lit mieux en
 * `computed` qu'en `valueChanges`.</p>
 *
 * <p>L'action est <b>irréversible</b> — le backend n'expose aucun rappel. D'où
 * deux partis pris : le bouton nomme son audience plutôt que de dire
 * « Diffuser », et l'envoi réussi remet le formulaire à ses valeurs les plus
 * prudentes.</p>
 */
@Component({
  selector: 'app-broadcast-alert',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Field],
  templateUrl: './broadcast-alert.html',
  host: { class: 'block' },
})
export class BroadcastAlert {
  private readonly alerting = inject(AlertingService);
  private readonly admin = inject(AdminService);

  protected readonly maxLength = ALERT_CONTENT_MAX_LENGTH;

  protected readonly level = signal<AlertLevel>('INFO');
  /** Chaîne vide = toute l'organisation ; sinon l'identifiant du groupe ciblé. */
  protected readonly audience = signal('');
  protected readonly content = signal('');

  protected readonly groups = signal<GroupSummary[]>([]);
  protected readonly groupsFailed = signal(false);
  protected readonly sending = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly levelOptions: ReadonlyArray<{ value: AlertLevel; label: string }> = (
    ['INFO', 'IMPORTANT', 'URGENT'] as const
  ).map((value) => ({ value, label: ALERT_LEVEL_LABELS[value] }));

  protected readonly levelHint = computed(() => LEVEL_HINTS[this.level()]);

  /** Nommé au complément : le libellé s'insère dans « Diffuser à … ». */
  protected readonly audienceLabel = computed(() => {
    const groupId = this.audience();
    if (!groupId) {
      return "toute l'organisation";
    }
    return this.groups().find((group) => group.groupId === groupId)?.name ?? 'ce groupe';
  });

  protected readonly remaining = computed(() => this.maxLength - this.content().length);
  protected readonly showRemaining = computed(() => this.remaining() <= REMAINING_HINT_THRESHOLD);
  protected readonly canSubmit = computed(
    () => this.content().trim().length > 0 && !this.sending(),
  );

  constructor() {
    this.loadGroups();
  }

  /**
   * Soumission d'un `<form>` natif : sans `FormsModule`, c'est à nous
   * d'empêcher le rechargement de page.
   */
  protected submit(event: Event): void {
    event.preventDefault();

    const content = this.content().trim();
    if (!content || this.sending()) {
      return;
    }

    // Lu avant la remise à zéro : le message de succès nomme ce qui vient de partir.
    const target = this.audienceLabel();
    const groupId = this.audience();

    this.sending.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.alerting
      .broadcast({
        content,
        level: this.level(),
        audienceKind: groupId ? 'GROUP' : 'ORGANISATION',
        ...(groupId ? { groupId } : {}),
      })
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.successMessage.set(`Alerte diffusée à ${target}.`);
          this.reset();
        },
        error: (error: HttpErrorResponse) => {
          this.sending.set(false);
          this.errorMessage.set(BroadcastAlert.messageFor(error));
        },
      });
  }

  protected onContentInput(value: string): void {
    this.content.set(value);
    // Le succès porte sur l'alerte précédente : le garder affiché pendant la
    // rédaction de la suivante laisserait croire qu'elle est déjà partie.
    this.successMessage.set(null);
  }

  /** Classes de la pastille de niveau, teintée seulement lorsqu'elle est retenue. */
  protected levelClasses(level: AlertLevel): string {
    // Le bouton radio est masqué visuellement : c'est l'étiquette qui doit
    // porter l'anneau de focus, sans quoi la navigation au clavier devient aveugle.
    const base =
      'flex-1 cursor-pointer rounded-md border px-3 py-2 text-center text-label transition-colors ' +
      'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ' +
      'has-[:focus-visible]:outline-accent-solid';
    if (this.level() !== level) {
      return `${base} border-border-default bg-surface-default text-text-secondary hover:bg-surface-muted`;
    }
    return `${base} ${BroadcastAlert.SELECTED_SKINS[level]}`;
  }

  private static readonly SELECTED_SKINS: Readonly<Record<AlertLevel, string>> = {
    INFO: 'border-accent-border bg-accent-subtle text-accent-text',
    IMPORTANT: 'border-warning-border bg-warning-subtle text-warning-text',
    URGENT: 'border-danger-border bg-danger-subtle text-danger-text',
  };

  private loadGroups(): void {
    this.admin.listGroups({ size: GROUP_PAGE_SIZE }).subscribe({
      // Le canal Général touche déjà tout le monde : le proposer ferait doublon
      // avec « Toute l'organisation ».
      next: (page) => this.groups.set(page.items.filter((group) => group.kind !== 'GENERAL')),
      // Dégradation assumée : sans la liste, la diffusion à l'organisation reste possible.
      error: () => this.groupsFailed.set(true),
    });
  }

  /** Repart des valeurs les plus prudentes : une alerte urgente ne doit jamais être un reste d'écran. */
  private reset(): void {
    this.content.set('');
    this.level.set('INFO');
    this.audience.set('');
  }

  private static messageFor(error: HttpErrorResponse): string {
    switch (error.status) {
      case 400:
        return "Vérifiez le contenu et les destinataires de l'alerte.";
      case 403:
        return "Vous n'avez pas les droits pour diffuser une alerte.";
      case 0:
        return 'Serveur injoignable. Vérifiez votre connexion.';
      default:
        return 'Une erreur est survenue. Réessayez.';
    }
  }
}

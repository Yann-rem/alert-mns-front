import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ROLE_LABELS } from '../../core/admin/admin.service';
import { AuthService } from '../../core/auth/auth.service';
import {
  ABSENCE_MESSAGE_MAX_LENGTH,
  NAME_MAX_LENGTH,
  ProfileService,
} from '../../core/profile/profile.service';
import { Badge } from '../../ui/badge/badge';
import { Button } from '../../ui/button/button';
import { Field } from '../../ui/field/field';
import { Toggle } from '../../ui/toggle/toggle';

/** Seuil à partir duquel le compteur de caractères devient utile. */
const REMAINING_HINT_THRESHOLD = 100;

/**
 * Profil de l'utilisateur courant : identité et message d'absence.
 *
 * <p>Deux formulaires indépendants, car ils visent deux points d'entrée distincts et n'ont pas la
 * même portée : renommer quelqu'un et poser une absence ne se décident pas ensemble.</p>
 *
 * <p>L'écran s'alimente entièrement de `/api/auth/me`, déjà chargé par le garde de route : aucune
 * lecture supplémentaire n'est nécessaire. Après un enregistrement réussi, la session est
 * rechargée pour que l'en-tête de la coquille reflète le nouveau nom.</p>
 */
@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Badge, Button, Field, Toggle],
  templateUrl: './profile.html',
  host: { class: 'block' },
})
export class Profile {
  private readonly profile = inject(ProfileService);
  private readonly auth = inject(AuthService);

  protected readonly nameMaxLength = NAME_MAX_LENGTH;
  protected readonly absenceMaxLength = ABSENCE_MESSAGE_MAX_LENGTH;

  protected readonly user = this.auth.user;

  protected readonly firstName = signal(this.auth.user()?.firstName ?? '');
  protected readonly lastName = signal(this.auth.user()?.lastName ?? '');
  protected readonly absenceContent = signal(this.auth.user()?.absenceMessage?.content ?? '');
  protected readonly absenceActive = signal(this.auth.user()?.absenceMessage?.active ?? false);

  protected readonly savingIdentity = signal(false);
  protected readonly savingAbsence = signal(false);
  protected readonly identityMessage = signal<string | null>(null);
  protected readonly absenceMessageFeedback = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly canSaveIdentity = computed(
    () =>
      this.firstName().trim().length > 0 &&
      this.lastName().trim().length > 0 &&
      !this.savingIdentity(),
  );

  /** Le contenu reste exigé même pour désactiver : le backend n'accepte pas de message vide. */
  protected readonly canSaveAbsence = computed(
    () => this.absenceContent().trim().length > 0 && !this.savingAbsence(),
  );

  protected readonly remaining = computed(
    () => this.absenceMaxLength - this.absenceContent().length,
  );
  protected readonly showRemaining = computed(() => this.remaining() <= REMAINING_HINT_THRESHOLD);

  protected readonly roleLabel = computed(() => {
    const role = this.user()?.role;
    return role ? ROLE_LABELS[role] : null;
  });

  protected saveIdentity(event: Event): void {
    event.preventDefault();
    if (!this.canSaveIdentity()) {
      return;
    }

    this.savingIdentity.set(true);
    this.reset();

    this.profile.updateIdentity(this.firstName().trim(), this.lastName().trim()).subscribe({
      next: () => {
        this.savingIdentity.set(false);
        this.identityMessage.set('Identité mise à jour.');
        this.refreshSession();
      },
      error: (error: HttpErrorResponse) => {
        this.savingIdentity.set(false);
        this.errorMessage.set(Profile.messageFor(error));
      },
    });
  }

  protected saveAbsence(event: Event): void {
    event.preventDefault();
    if (!this.canSaveAbsence()) {
      return;
    }

    const active = this.absenceActive();
    this.savingAbsence.set(true);
    this.reset();

    this.profile.updateAbsenceMessage(this.absenceContent().trim(), active).subscribe({
      next: () => {
        this.savingAbsence.set(false);
        this.absenceMessageFeedback.set(
          active ? "Message d'absence activé." : "Message d'absence désactivé.",
        );
        this.refreshSession();
      },
      error: (error: HttpErrorResponse) => {
        this.savingAbsence.set(false);
        this.errorMessage.set(Profile.messageFor(error));
      },
    });
  }

  /** L'en-tête de la coquille affiche le nom : il doit suivre sans recharger la page. */
  private refreshSession(): void {
    this.auth.loadCurrentUser().subscribe({ error: () => undefined });
  }

  private reset(): void {
    this.errorMessage.set(null);
    this.identityMessage.set(null);
    this.absenceMessageFeedback.set(null);
  }

  private static messageFor(error: HttpErrorResponse): string {
    switch (error.status) {
      case 400:
        return 'Vérifiez les informations saisies.';
      case 403:
        return "Vous n'avez pas les droits pour cette modification.";
      case 404:
        return 'Compte introuvable.';
      case 0:
        return 'Serveur injoignable. Vérifiez votre connexion.';
      default:
        return 'Une erreur est survenue. Réessayez.';
    }
  }
}

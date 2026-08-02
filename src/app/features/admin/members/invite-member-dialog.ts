import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  model,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AdminService, ROLE_LABELS } from '../../../core/admin/admin.service';
import { type MemberRole } from '../../../core/auth/auth.service';
import { Button } from '../../../ui/button/button';
import { Field } from '../../../ui/field/field';
import { Modal } from '../../../ui/modal/modal';

/** Contrôles pouvant afficher une erreur de saisie (le rôle a toujours une valeur). */
type TextControl = 'email' | 'firstName' | 'lastName';

/**
 * Invitation d'une personne à rejoindre l'organisation.
 *
 * <p>Les validations reproduisent celles de `InviteMemberRequest` côté backend :
 * elles évitent un aller-retour inutile, sans jamais s'y substituer.</p>
 */
@Component({
  selector: 'app-invite-member-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Button, Field, Modal],
  templateUrl: './invite-member-dialog.html',
})
export class InviteMemberDialog {
  private readonly fb = inject(FormBuilder);
  private readonly admin = inject(AdminService);

  readonly open = model.required<boolean>();
  /** Émis après un 201 : au parent de rafraîchir sa liste. */
  readonly invited = output<void>();

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  /** Du moins au plus étendu : l'ordre guide vers le choix le plus prudent. */
  protected readonly roleOptions: ReadonlyArray<{ value: MemberRole; label: string }> = (
    ['MEMBER', 'MANAGER', 'ADMIN'] as const
  ).map((value) => ({ value, label: ROLE_LABELS[value] }));

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    role: ['MEMBER' as MemberRole, [Validators.required]],
  });

  constructor() {
    // Chaque ouverture repart d'un formulaire vierge : la modale n'est jamais
    // détruite, elle survit d'une invitation à l'autre.
    effect(() => {
      if (this.open()) {
        this.form.reset();
        this.errorMessage.set(null);
      }
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.admin.invite(this.form.getRawValue()).subscribe({
      next: () => {
        this.loading.set(false);
        this.open.set(false);
        this.invited.emit();
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(InviteMemberDialog.messageFor(error));
      },
    });
  }

  protected cancel(): void {
    this.open.set(false);
  }

  /** N'affiche l'erreur qu'après interaction, pour ne pas accueillir l'utilisateur en rouge. */
  protected isInvalid(control: TextControl): boolean {
    const target = this.form.controls[control];
    return target.touched && target.invalid;
  }

  private static messageFor(error: HttpErrorResponse): string {
    switch (error.status) {
      case 409:
        return 'Cette adresse est déjà invitée ou déjà rattachée à un compte.';
      case 400:
        return 'Vérifiez les informations saisies.';
      case 403:
        return "Vous n'avez pas les droits pour inviter un membre.";
      case 0:
        return 'Serveur injoignable. Vérifiez votre connexion.';
      default:
        return 'Une erreur est survenue. Veuillez réessayer.';
    }
  }
}

import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { Observable } from 'rxjs';

import { AdminService, ROLE_LABELS, type MemberSummary } from '../../../core/admin/admin.service';
import { AuthService, type MemberRole } from '../../../core/auth/auth.service';
import { Button } from '../../../ui/button/button';
import { Field } from '../../../ui/field/field';
import { Modal } from '../../../ui/modal/modal';

/**
 * Administration d'un membre : rôle, suspension, anonymisation.
 *
 * <p>Les trois actions sont réunies dans une seule boîte de dialogue plutôt que
 * dispersées en boutons de ligne : elles portent toutes sur la même personne, et
 * la liste reste lisible.</p>
 *
 * <p>L'anonymisation demande une confirmation en deux temps, dans la boîte
 * elle-même. Imbriquer une seconde modale dans un `<dialog>` natif poserait des
 * problèmes de piège à focus ; un second clic explicite suffit à protéger d'un
 * geste involontaire.</p>
 */
@Component({
  selector: 'app-manage-member-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Field, Modal],
  templateUrl: './manage-member-dialog.html',
})
export class ManageMemberDialog {
  private readonly admin = inject(AdminService);
  private readonly auth = inject(AuthService);

  readonly open = model.required<boolean>();
  /** Membre administré. `null` tant qu'aucune ligne n'a été ouverte. */
  readonly member = input<MemberSummary | null>(null);
  /** Émis après toute modification acceptée : au parent de recharger sa liste. */
  readonly changed = output<string>();

  protected readonly role = signal<MemberRole>('MEMBER');
  protected readonly pending = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  /** L'anonymisation a été demandée une première fois : on attend confirmation. */
  protected readonly confirmingAnonymize = signal(false);

  /** Du moins au plus étendu : l'ordre guide vers le choix le plus prudent. */
  protected readonly roleOptions: ReadonlyArray<{ value: MemberRole; label: string }> = (
    ['MEMBER', 'MANAGER', 'ADMIN'] as const
  ).map((value) => ({ value, label: ROLE_LABELS[value] }));

  protected readonly suspended = computed(() => this.member()?.memberStatus === 'SUSPENDED');
  protected readonly anonymized = computed(() => this.member()?.anonymized === true);

  /**
   * Le compte administré est celui de l'utilisateur connecté.
   *
   * <p>On lui retire alors la suspension et l'anonymisation. L'invariant du
   * dernier administrateur actif, lui, vit dans le domaine ; ce garde-fou-ci ne
   * protège que d'un geste absurde : se couper l'accès soi-même.</p>
   */
  protected readonly isSelf = computed(() => {
    const userId = this.member()?.userId;
    return userId !== undefined && userId === this.auth.user()?.userId;
  });

  protected readonly displayName = computed(() => {
    const member = this.member();
    if (!member) return '';
    const name = [member.firstName, member.lastName].filter(Boolean).join(' ');
    return name || member.email || 'Utilisateur supprimé';
  });

  constructor() {
    // Chaque ouverture repart de l'état réel du membre : la boîte survit d'une
    // ligne à l'autre, elle ne doit rien conserver de la précédente.
    effect(() => {
      const member = this.member();
      if (this.open() && member) {
        this.role.set(member.role);
        this.errorMessage.set(null);
        this.confirmingAnonymize.set(false);
      }
    });
  }

  protected saveRole(): void {
    const member = this.member();
    if (!member || this.role() === member.role) return;
    this.run(this.admin.changeMemberRole(member.memberId, this.role()), 'Rôle mis à jour.');
  }

  protected toggleSuspension(): void {
    const member = this.member();
    if (!member) return;
    this.run(
      this.suspended()
        ? this.admin.reactivateMember(member.memberId)
        : this.admin.suspendMember(member.memberId),
      this.suspended() ? 'Membre réactivé.' : 'Membre suspendu.',
    );
  }

  protected anonymize(): void {
    const member = this.member();
    if (!member) return;
    if (!this.confirmingAnonymize()) {
      this.confirmingAnonymize.set(true);
      return;
    }
    this.run(this.admin.anonymizeUser(member.userId), 'Utilisateur anonymisé.');
  }

  protected cancel(): void {
    this.open.set(false);
  }

  /** Le rôle affiché diffère de celui enregistré : il y a quelque chose à soumettre. */
  protected readonly roleChanged = computed(() => {
    const member = this.member();
    return member !== null && this.role() !== member.role;
  });

  private run(request: Observable<void>, success: string): void {
    this.pending.set(true);
    this.errorMessage.set(null);
    request.subscribe({
      next: () => {
        this.pending.set(false);
        this.open.set(false);
        this.changed.emit(success);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.confirmingAnonymize.set(false);
        this.errorMessage.set(this.describe(error));
      },
    });
  }

  /**
   * Le 409 mérite un message propre : il traduit un refus métier — le dernier
   * administrateur actif — et non une panne. Le taire renverrait l'administrateur
   * à une erreur technique là où la règle est parfaitement explicable.
   */
  private describe(error: unknown): string {
    const status = error instanceof HttpErrorResponse ? error.status : null;
    switch (status) {
      case 409:
        return "Opération refusée : l'organisation doit conserver au moins un administrateur actif.";
      case 403:
        return "Vous n'avez pas les droits pour cette opération.";
      case 404:
        return "Ce membre n'existe plus. Rafraîchissez la liste.";
      default:
        return 'Opération impossible. Réessayez.';
    }
  }
}

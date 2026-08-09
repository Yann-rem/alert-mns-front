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
import { forkJoin, Observable } from 'rxjs';

import {
  AdminService,
  type GroupSummary,
  type MemberSummary,
} from '../../../core/admin/admin.service';
import { Button } from '../../../ui/button/button';
import { Field } from '../../../ui/field/field';
import { Modal } from '../../../ui/modal/modal';

/** Longueur maximale d'un nom de groupe, alignée sur `GroupName` côté domaine. */
const NAME_MAX_LENGTH = 150;

/**
 * Taille des listes chargées.
 *
 * <p>Volontairement large : la boîte compare la composition du groupe à celle de
 * l'organisation, ce qui suppose de disposer des deux entièrement. Au-delà de
 * quelques centaines de membres, il faudrait une recherche paginée côté serveur
 * plutôt qu'un sélecteur.</p>
 */
const PAGE_SIZE = 500;

/**
 * Administration d'un groupe : nom et composition.
 *
 * <p>La composition du groupe général n'est pas modifiable : l'adhésion y est
 * automatique à l'arrivée d'un membre. Proposer de l'y retirer laisserait croire
 * à un réglage durable que le prochain événement défera.</p>
 */
@Component({
  selector: 'app-manage-group-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Field, Modal],
  templateUrl: './manage-group-dialog.html',
})
export class ManageGroupDialog {
  private readonly admin = inject(AdminService);

  readonly open = model.required<boolean>();
  readonly group = input<GroupSummary | null>(null);
  /** Émis après toute modification acceptée : au parent de recharger sa liste. */
  readonly changed = output<string>();

  protected readonly nameMaxLength = NAME_MAX_LENGTH;

  protected readonly name = signal('');
  protected readonly members = signal<MemberSummary[]>([]);
  protected readonly allMembers = signal<MemberSummary[]>([]);
  protected readonly selected = signal('');
  protected readonly loading = signal(false);
  protected readonly pending = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly feedback = signal<string | null>(null);

  protected readonly isGeneral = computed(() => this.group()?.kind === 'GENERAL');

  protected readonly nameChanged = computed(() => {
    const group = this.group();
    return group !== null && this.name().trim() !== '' && this.name().trim() !== group.name;
  });

  /** Membres de l'organisation qui ne sont pas encore dans le groupe. */
  protected readonly candidates = computed(() => {
    const present = new Set(this.members().map((member) => member.memberId));
    return this.allMembers().filter((member) => !present.has(member.memberId));
  });

  constructor() {
    effect(() => {
      const group = this.group();
      if (this.open() && group) {
        this.name.set(group.name);
        this.errorMessage.set(null);
        this.feedback.set(null);
        this.selected.set('');
        this.loadMembers(group.groupId);
      }
    });
  }

  protected displayName(member: MemberSummary): string {
    const name = [member.firstName, member.lastName].filter(Boolean).join(' ');
    return name || member.email || 'Utilisateur supprimé';
  }

  protected saveName(): void {
    const group = this.group();
    if (!group || !this.nameChanged()) return;
    const name = this.name().trim();
    this.run(this.admin.renameGroup(group.groupId, name), `Groupe renommé en « ${name} ».`, true);
  }

  protected add(): void {
    const group = this.group();
    const memberId = this.selected();
    if (!group || !memberId) return;
    this.run(this.admin.addMemberToGroup(group.groupId, memberId), 'Membre ajouté au groupe.');
  }

  protected remove(member: MemberSummary): void {
    const group = this.group();
    if (!group) return;
    this.run(
      this.admin.removeMemberFromGroup(group.groupId, member.memberId),
      `${this.displayName(member)} a été retiré du groupe.`,
    );
  }

  protected close(): void {
    this.open.set(false);
  }

  /**
   * Charge en parallèle la composition du groupe et l'annuaire de l'organisation :
   * la seconde sert à proposer les membres qui n'y figurent pas encore.
   */
  private loadMembers(groupId: string): void {
    this.loading.set(true);
    forkJoin({
      inGroup: this.admin.listMembers({ groupId, size: PAGE_SIZE }),
      all: this.admin.listMembers({ size: PAGE_SIZE }),
    }).subscribe({
      next: ({ inGroup, all }) => {
        this.members.set(inGroup.items);
        this.allMembers.set(all.items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Impossible de charger la composition du groupe.');
      },
    });
  }

  /**
   * @param closeOnSuccess vrai pour le renommage, qui modifie la ligne affichée par
   *                       le parent ; faux pour les ajouts et retraits, enchaînés
   *                       plusieurs fois de suite sans quitter la boîte.
   */
  private run(request: Observable<void>, success: string, closeOnSuccess = false): void {
    const group = this.group();
    if (!group) return;

    this.pending.set(true);
    this.errorMessage.set(null);
    request.subscribe({
      next: () => {
        this.pending.set(false);
        this.selected.set('');
        this.changed.emit(success);
        if (closeOnSuccess) {
          this.open.set(false);
          return;
        }
        this.feedback.set(success);
        this.loadMembers(group.groupId);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.errorMessage.set(this.describe(error));
      },
    });
  }

  private describe(error: unknown): string {
    const status = error instanceof HttpErrorResponse ? error.status : null;
    switch (status) {
      case 409:
        return 'Un groupe porte déjà ce nom dans l’organisation.';
      case 403:
        return "Vous n'avez pas les droits pour cette opération.";
      case 404:
        return 'Ce groupe ou ce membre n’existe plus. Rafraîchissez la liste.';
      default:
        return 'Opération impossible. Réessayez.';
    }
  }
}

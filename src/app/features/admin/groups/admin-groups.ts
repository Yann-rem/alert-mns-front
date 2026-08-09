import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';

import { AdminService, type GroupSummary } from '../../../core/admin/admin.service';
import { Badge } from '../../../ui/badge/badge';
import { Button } from '../../../ui/button/button';
import { Field } from '../../../ui/field/field';
import { Modal } from '../../../ui/modal/modal';
import { ManageGroupDialog } from './manage-group-dialog';

/** Longueur maximale d'un nom de groupe, alignée sur `GroupName` côté domaine. */
const NAME_MAX_LENGTH = 150;

/**
 * Groupes de l'organisation : consultation, création, renommage et composition.
 *
 * <p>Le groupe général est provisionné à l'amorçage et reçoit automatiquement
 * chaque nouveau membre. Il est signalé comme tel : sa composition ne se gère pas
 * à la main.</p>
 */
@Component({
  selector: 'app-admin-groups',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Badge, Button, Field, Modal, ManageGroupDialog],
  templateUrl: './admin-groups.html',
  host: { class: 'block' },
})
export class AdminGroups implements OnInit {
  private readonly admin = inject(AdminService);

  protected readonly nameMaxLength = NAME_MAX_LENGTH;

  protected readonly groups = signal<GroupSummary[]>([]);
  protected readonly total = signal(0);
  protected readonly loaded = signal(false);
  protected readonly pending = signal(false);
  protected readonly search = signal('');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly createOpen = signal(false);
  protected readonly newName = signal('');
  protected readonly creating = signal(false);
  protected readonly createError = signal<string | null>(null);

  protected readonly manageOpen = signal(false);
  protected readonly managed = signal<GroupSummary | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected onSearch(value: string): void {
    this.search.set(value);
    this.successMessage.set(null);
    this.load();
  }

  protected load(): void {
    this.pending.set(true);
    this.errorMessage.set(null);
    this.admin.listGroups({ q: this.search() }).subscribe({
      next: (page) => {
        this.groups.set(page.items);
        this.total.set(page.total);
        this.loaded.set(true);
        this.pending.set(false);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        const status = error instanceof HttpErrorResponse ? error.status : null;
        this.errorMessage.set(
          status === 403
            ? "Vous n'avez pas les droits pour consulter cette page."
            : 'Impossible de charger les groupes. Réessayez.',
        );
      },
    });
  }

  protected openCreate(): void {
    this.newName.set('');
    this.createError.set(null);
    this.successMessage.set(null);
    this.createOpen.set(true);
  }

  protected create(event: Event): void {
    event.preventDefault();
    const name = this.newName().trim();
    if (!name || this.creating()) return;

    this.creating.set(true);
    this.createError.set(null);
    this.admin.createGroup(name).subscribe({
      next: () => {
        this.creating.set(false);
        this.createOpen.set(false);
        this.successMessage.set(`Groupe « ${name} » créé.`);
        this.load();
      },
      error: (error: unknown) => {
        this.creating.set(false);
        const status = error instanceof HttpErrorResponse ? error.status : null;
        this.createError.set(
          status === 409
            ? 'Un groupe porte déjà ce nom dans l’organisation.'
            : 'Création impossible. Réessayez.',
        );
      },
    });
  }

  protected manage(group: GroupSummary): void {
    this.managed.set(group);
    this.successMessage.set(null);
    this.manageOpen.set(true);
  }

  /** Une action a abouti : la liste est rechargée, un renommage ayant pu la réordonner. */
  protected onGroupChanged(message: string): void {
    this.successMessage.set(message);
    this.load();
  }

  protected kindLabel(group: GroupSummary): string {
    return group.kind === 'GENERAL' ? 'Général' : 'Standard';
  }
}

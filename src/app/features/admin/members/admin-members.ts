import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';

import {
  AdminService,
  type MemberStatus,
  type MemberSummary,
  type PendingInvitation,
} from '../../../core/admin/admin.service';
import { Avatar } from '../../../ui/avatar/avatar';
import { Badge } from '../../../ui/badge/badge';
import { Button } from '../../../ui/button/button';
import { Field } from '../../../ui/field/field';

/** Onglets de la maquette : « en attente » ne liste pas des membres mais des invitations. */
type Tab = 'all' | 'active' | 'suspended' | 'pending';

@Component({
  selector: 'app-admin-members',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Badge, Button, Field],
  templateUrl: './admin-members.html',
})
export class AdminMembers implements OnInit {
  private readonly admin = inject(AdminService);

  protected readonly tab = signal<Tab>('all');
  protected readonly search = signal('');
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly members = signal<MemberSummary[]>([]);
  protected readonly total = signal(0);
  protected readonly invitations = signal<PendingInvitation[]>([]);

  protected readonly tabs: ReadonlyArray<{ id: Tab; label: string }> = [
    { id: 'all', label: 'Tous' },
    { id: 'active', label: 'Actifs' },
    { id: 'suspended', label: 'Suspendus' },
    { id: 'pending', label: 'En attente' },
  ];

  ngOnInit(): void {
    this.load();
  }

  protected selectTab(tab: Tab): void {
    this.tab.set(tab);
    this.load();
  }

  protected onSearch(value: string): void {
    this.search.set(value);
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    // L'onglet « en attente » interroge une autre ressource : une invitation n'est pas un membre.
    if (this.tab() === 'pending') {
      this.admin.listPendingInvitations().subscribe({
        next: (invitations) => {
          this.invitations.set(invitations);
          this.loading.set(false);
        },
        error: (error) => this.fail(error),
      });
      return;
    }

    this.admin.listMembers({ status: this.statusFilter(), q: this.search() }).subscribe({
      next: (page) => {
        this.members.set(page.items);
        this.total.set(page.total);
        this.loading.set(false);
      },
      error: (error) => this.fail(error),
    });
  }

  private statusFilter(): MemberStatus | undefined {
    switch (this.tab()) {
      case 'active':
        return 'ACTIVE';
      case 'suspended':
        return 'SUSPENDED';
      default:
        return undefined;
    }
  }

  private fail(error: unknown): void {
    this.loading.set(false);
    const status = error instanceof HttpErrorResponse ? error.status : null;
    this.errorMessage.set(
      status === 403
        ? "Vous n'avez pas les droits pour consulter cette page."
        : 'Impossible de charger les membres. Réessayez.',
    );
  }

  /** Initiales pour l'avatar ; repli sur l'e-mail si l'identité est absente. */
  protected initials(member: MemberSummary): string {
    const first = member.firstName?.charAt(0) ?? '';
    const last = member.lastName?.charAt(0) ?? '';
    return (first + last).trim() || (member.email?.charAt(0) ?? '?');
  }

  protected fullName(member: MemberSummary): string {
    const name = [member.firstName, member.lastName].filter(Boolean).join(' ');
    return name || 'Utilisateur supprimé';
  }

  protected roleLabel(role: string): string {
    return { ADMIN: 'Admin', MANAGER: 'Manager', MEMBER: 'Membre' }[role] ?? role;
  }
}

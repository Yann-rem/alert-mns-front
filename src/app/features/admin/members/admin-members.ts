import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';

import {
  AdminService,
  ROLE_LABELS,
  type MemberStatus,
  type MemberSummary,
  type PendingInvitation,
} from '../../../core/admin/admin.service';
import { Avatar } from '../../../ui/avatar/avatar';
import { Badge } from '../../../ui/badge/badge';
import { Button } from '../../../ui/button/button';
import { Field } from '../../../ui/field/field';
import { InviteMemberDialog } from './invite-member-dialog';

/** Onglets de la maquette : « en attente » ne liste pas des membres mais des invitations. */
type Tab = 'all' | 'active' | 'suspended' | 'pending';

/**
 * Délai avant d'afficher l'indicateur de chargement.
 *
 * <p>En deçà, l'attente n'est pas perçue comme telle : afficher puis retirer un
 * indicateur produirait un clignotement plus gênant que l'attente elle-même. Sur
 * une réponse rapide, aucun indicateur n'apparaît donc jamais.</p>
 */
const LOADER_DELAY_MS = 200;

@Component({
  selector: 'app-admin-members',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Badge, Button, Field, InviteMemberDialog],
  templateUrl: './admin-members.html',
  host: { class: 'block' },
})
export class AdminMembers implements OnInit {
  private readonly admin = inject(AdminService);

  /** Onglet sélectionné : met à jour la surbrillance immédiatement. */
  protected readonly tab = signal<Tab>('all');

  /**
   * Onglet effectivement rendu. Il reste en arrière de {@link tab} jusqu'à
   * l'arrivée des données : la liste précédente demeure affichée au lieu de
   * laisser un trou, et l'on n'annonce jamais « aucun résultat » avant d'avoir
   * la réponse. Vaut `null` tant que rien n'a encore été chargé.
   */
  protected readonly displayedTab = signal<Tab | null>(null);

  protected readonly search = signal('');
  /** Une requête est en cours : sert à estomper le contenu devenu périmé. */
  protected readonly pending = signal(false);
  /** {@link pending} depuis assez longtemps pour mériter un indicateur. */
  protected readonly showLoader = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly inviteOpen = signal(false);

  protected readonly members = signal<MemberSummary[]>([]);
  protected readonly total = signal(0);
  protected readonly invitations = signal<PendingInvitation[]>([]);

  private loaderTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearLoaderTimer());
  }

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
    this.successMessage.set(null);
    this.load();
  }

  protected onSearch(value: string): void {
    this.search.set(value);
    this.successMessage.set(null);
    this.load();
  }

  /**
   * L'invité n'est pas encore un membre : il n'apparaîtrait dans aucun autre
   * onglet. On bascule donc sur « En attente », où le résultat est visible.
   */
  protected onInvited(): void {
    this.tab.set('pending');
    this.load();
    this.successMessage.set('Invitation envoyée.');
  }

  protected load(): void {
    const requested = this.tab();
    this.beginLoading();

    // L'onglet « en attente » interroge une autre ressource : une invitation n'est pas un membre.
    if (requested === 'pending') {
      this.admin.listPendingInvitations().subscribe({
        next: (invitations) => {
          this.invitations.set(invitations);
          this.settle(requested);
        },
        error: (error) => this.fail(error),
      });
      return;
    }

    this.admin.listMembers({ status: this.statusFilter(), q: this.search() }).subscribe({
      next: (page) => {
        this.members.set(page.items);
        this.total.set(page.total);
        this.settle(requested);
      },
      error: (error) => this.fail(error),
    });
  }

  private beginLoading(): void {
    this.pending.set(true);
    this.errorMessage.set(null);
    this.clearLoaderTimer();
    this.loaderTimer = setTimeout(() => this.showLoader.set(true), LOADER_DELAY_MS);
  }

  /** Publie les données reçues : c'est ici, et pas avant, que l'onglet bascule. */
  private settle(loadedTab: Tab): void {
    this.stopLoading();
    this.displayedTab.set(loadedTab);
  }

  private stopLoading(): void {
    this.clearLoaderTimer();
    this.pending.set(false);
    this.showLoader.set(false);
  }

  private clearLoaderTimer(): void {
    if (this.loaderTimer !== null) {
      clearTimeout(this.loaderTimer);
      this.loaderTimer = null;
    }
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
    this.stopLoading();
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
    return ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role;
  }
}

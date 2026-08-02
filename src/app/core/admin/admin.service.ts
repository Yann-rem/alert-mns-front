import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';

import { AuthService, type MemberRole } from '../auth/auth.service';

/** Statut d'adhésion, orthogonal au statut du compte utilisateur (ADR-0019). */
export type MemberStatus = 'ACTIVE' | 'SUSPENDED';

/**
 * Libellés d'interface des rôles.
 *
 * <p>Volontairement courts : ils vivent dans des pastilles. Ce que chaque rôle
 * permet s'explique là où il y a la place de le dire, pas dans un badge.</p>
 */
export const ROLE_LABELS: Readonly<Record<MemberRole, string>> = {
  ADMIN: 'Admin',
  MANAGER: 'Gestionnaire',
  MEMBER: 'Membre',
};

/** Membre de l'organisation, enrichi de son identité par le backend. */
export interface MemberSummary {
  memberId: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role: MemberRole;
  memberStatus: MemberStatus;
  accountStatus: string | null;
  anonymized: boolean;
  joinedAt: string;
}

export interface MembersPage {
  items: MemberSummary[];
  total: number;
  page: number;
  size: number;
}

/** Personne invitée dont le compte n'est pas encore activé : ce n'est pas encore un membre. */
export interface PendingInvitation {
  invitationId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: MemberRole;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
}

export interface InviteMemberPayload {
  email: string;
  firstName: string;
  lastName: string;
  role: MemberRole;
}

/** Filtres de la liste des membres. */
export interface MemberFilters {
  status?: MemberStatus;
  role?: MemberRole;
  q?: string;
  page?: number;
  size?: number;
}

/**
 * Administration de l'organisation.
 *
 * <p>Toutes les routes sont préfixées par l'organisation courante, lue depuis
 * `/api/auth/me` (ADR-0011 : l'`orgId` reste explicite dans l'URL, le client le
 * transporte).</p>
 */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  /** Membres de l'organisation (hors invités non activés, qui n'ont pas de Member). */
  listMembers(filters: MemberFilters = {}): Observable<MembersPage> {
    const base = this.organisationUrl();
    if (!base) {
      return throwError(() => new Error('Aucune organisation associée au compte courant.'));
    }

    // Les paramètres vides sont omis : le backend traite l'absence comme « pas de filtre ».
    const params: Record<string, string> = {};
    if (filters.status) params['status'] = filters.status;
    if (filters.role) params['role'] = filters.role;
    if (filters.q?.trim()) params['q'] = filters.q.trim();
    if (filters.page !== undefined) params['page'] = String(filters.page);
    if (filters.size !== undefined) params['size'] = String(filters.size);

    return this.http.get<MembersPage>(`${base}/members`, { params });
  }

  /** Invitations encore en attente d'acceptation. */
  listPendingInvitations(): Observable<PendingInvitation[]> {
    const base = this.organisationUrl();
    if (!base) {
      return throwError(() => new Error('Aucune organisation associée au compte courant.'));
    }
    return this.http.get<PendingInvitation[]>(`${base}/invitations`);
  }

  /** Invite une personne : crée un compte en attente et envoie un lien magique. */
  invite(payload: InviteMemberPayload): Observable<void> {
    const base = this.organisationUrl();
    if (!base) {
      return throwError(() => new Error('Aucune organisation associée au compte courant.'));
    }
    return this.http.post<void>(`${base}/members`, payload);
  }

  private organisationUrl(): string | null {
    const organisationId = this.auth.organisationId();
    return organisationId ? `/api/organisations/${organisationId}` : null;
  }
}

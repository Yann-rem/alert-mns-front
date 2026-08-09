import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, throwError } from 'rxjs';

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
  /** Restreint aux membres du groupe désigné. */
  groupId?: string;
  page?: number;
  size?: number;
}

/**
 * Nature du groupe. `GENERAL` désigne le canal par défaut de l'organisation,
 * auquel tout nouveau membre est rattaché automatiquement.
 */
export type GroupKind = 'GENERAL' | 'STANDARD';

export interface GroupSummary {
  groupId: string;
  name: string;
  kind: GroupKind;
  createdAt: string;
}

export interface GroupsPage {
  items: GroupSummary[];
  total: number;
  page: number;
  size: number;
}

/** Filtres de la liste des groupes. */
export interface GroupFilters {
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
    if (filters.groupId) params['groupId'] = filters.groupId;
    if (filters.page !== undefined) params['page'] = String(filters.page);
    if (filters.size !== undefined) params['size'] = String(filters.size);

    return this.http.get<MembersPage>(`${base}/members`, { params });
  }

  /**
   * Groupes de l'organisation.
   *
   * <p>Seule lecture de ce service ouverte aux MANAGER en plus des ADMIN : le
   * sélecteur d'audience de la diffusion d'alerte s'en sert, et diffuser est
   * justement permis aux deux rôles.</p>
   */
  listGroups(filters: GroupFilters = {}): Observable<GroupsPage> {
    const base = this.organisationUrl();
    if (!base) {
      return throwError(() => new Error('Aucune organisation associée au compte courant.'));
    }

    const params: Record<string, string> = {};
    if (filters.q?.trim()) params['q'] = filters.q.trim();
    if (filters.page !== undefined) params['page'] = String(filters.page);
    if (filters.size !== undefined) params['size'] = String(filters.size);

    return this.http.get<GroupsPage>(`${base}/groups`, { params });
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

  /**
   * Suspend un membre : mesure conservatoire réversible. Le compte utilisateur
   * n'est pas touché — statut d'adhésion et statut de compte sont orthogonaux.
   */
  suspendMember(memberId: string): Observable<void> {
    return this.memberAction(memberId, 'suspend');
  }

  /** Lève la suspension d'un membre. */
  reactivateMember(memberId: string): Observable<void> {
    return this.memberAction(memberId, 'reactivate');
  }

  /**
   * Change le rôle d'un membre.
   *
   * <p>Le backend refuse en 409 de rétrograder le dernier administrateur actif :
   * l'invariant vit dans le domaine, le client se contente d'en restituer le
   * refus.</p>
   */
  changeMemberRole(memberId: string, role: MemberRole): Observable<void> {
    const base = this.organisationUrl();
    if (!base) {
      return throwError(() => new Error('Aucune organisation associée au compte courant.'));
    }
    return this.http.put<void>(`${base}/members/${memberId}/role`, { role });
  }

  /**
   * Anonymise un utilisateur — droit à l'effacement, article 17 du RGPD.
   *
   * <p>Route rattachée à l'utilisateur et non au membre : l'effacement porte sur
   * l'identité, qui vit dans un autre bounded context que l'adhésion. C'est donc
   * le `userId` qu'il faut passer, pas le `memberId`.</p>
   *
   * <p>Irréversible. L'opération est idempotente côté backend.</p>
   */
  anonymizeUser(userId: string): Observable<void> {
    return this.http.post<void>(`/api/users/${userId}/anonymize`, null);
  }

  /**
   * Crée un groupe.
   *
   * <p>Le backend répond `{ id }` — et non `{ groupId }` comme la liste des
   * groupes. L'écart est absorbé ici plutôt que propagé dans les écrans.</p>
   */
  createGroup(name: string): Observable<string> {
    const base = this.organisationUrl();
    if (!base) {
      return throwError(() => new Error('Aucune organisation associée au compte courant.'));
    }
    return this.http
      .post<{ id: string }>(`${base}/groups`, { name })
      .pipe(map((response) => response.id));
  }

  /** Renomme un groupe. Le renommage se propage à la conversation adossée au groupe. */
  renameGroup(groupId: string, name: string): Observable<void> {
    const base = this.organisationUrl();
    if (!base) {
      return throwError(() => new Error('Aucune organisation associée au compte courant.'));
    }
    return this.http.put<void>(`${base}/groups/${groupId}/name`, { name });
  }

  /** Rattache un membre à un groupe. Idempotent : rejouer l'appel laisse l'état inchangé. */
  addMemberToGroup(groupId: string, memberId: string): Observable<void> {
    const base = this.organisationUrl();
    if (!base) {
      return throwError(() => new Error('Aucune organisation associée au compte courant.'));
    }
    return this.http.put<void>(`${base}/groups/${groupId}/members/${memberId}`, null);
  }

  /** Retire un membre d'un groupe. Ni le membre ni le groupe ne sont supprimés. */
  removeMemberFromGroup(groupId: string, memberId: string): Observable<void> {
    const base = this.organisationUrl();
    if (!base) {
      return throwError(() => new Error('Aucune organisation associée au compte courant.'));
    }
    return this.http.delete<void>(`${base}/groups/${groupId}/members/${memberId}`);
  }

  private memberAction(memberId: string, action: 'suspend' | 'reactivate'): Observable<void> {
    const base = this.organisationUrl();
    if (!base) {
      return throwError(() => new Error('Aucune organisation associée au compte courant.'));
    }
    return this.http.post<void>(`${base}/members/${memberId}/${action}`, null);
  }

  private organisationUrl(): string | null {
    const organisationId = this.auth.organisationId();
    return organisationId ? `/api/organisations/${organisationId}` : null;
  }
}

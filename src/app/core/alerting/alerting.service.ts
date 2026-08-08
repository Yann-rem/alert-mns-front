import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/** Niveau de gravité, du plus neutre au plus critique (enum `AlertLevel` côté backend). */
export type AlertLevel = 'INFO' | 'IMPORTANT' | 'URGENT';

/** Portée d'une alerte : toute l'organisation, ou un groupe précis. */
export type AlertAudienceKind = 'ORGANISATION' | 'GROUP';

/** Limite du value object `AlertContent` côté backend. */
export const ALERT_CONTENT_MAX_LENGTH = 4000;

/** Libellés d'interface des niveaux. */
export const ALERT_LEVEL_LABELS: Readonly<Record<AlertLevel, string>> = {
  INFO: 'Information',
  IMPORTANT: 'Important',
  URGENT: 'Urgent',
};

export interface BroadcastAlertPayload {
  content: string;
  level: AlertLevel;
  audienceKind: AlertAudienceKind;
  /** Obligatoire si `audienceKind` vaut GROUP, à omettre sinon. */
  groupId?: string;
}

export interface BroadcastAlertResult {
  alertId: string;
}

/**
 * Diffusion des alertes.
 *
 * <p>Contrairement aux routes d'administration, celle-ci n'est pas préfixée par
 * l'organisation : le backend la déduit du membre émetteur. Diffuser est ouvert
 * aux rôles ADMIN et MANAGER (`AlertController`).</p>
 */
@Injectable({ providedIn: 'root' })
export class AlertingService {
  private readonly http = inject(HttpClient);

  /** Diffuse une alerte. Le message part immédiatement : aucun rappel n'est prévu. */
  broadcast(payload: BroadcastAlertPayload): Observable<BroadcastAlertResult> {
    return this.http.post<BroadcastAlertResult>('/api/alerting/alerts', payload);
  }
}

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/** Une conversation est soit un échange à deux, soit le fil d'un groupe. */
export type ConversationKind = 'DIRECT' | 'GROUP';

/** Aperçu du dernier message, suffisant pour la liste sans charger le fil. */
export interface LastMessage {
  messageId: string;
  authorId: string;
  authorName: string;
  content: string;
  sentAt: string;
}

/**
 * Conversation telle qu'affichée dans la liste.
 *
 * <p>`title` est résolu par le serveur **pour le lecteur** : nom du groupe, ou nom de
 * l'interlocuteur pour un échange direct. Deux participants d'un même DM ne voient donc pas le
 * même titre.</p>
 */
export interface Conversation {
  conversationId: string;
  kind: ConversationKind;
  title: string;
  groupId: string | null;
  counterpartMemberId: string | null;
  lastMessage: LastMessage | null;
  lastActivityAt: string;
  createdAt: string;
}

/** Message d'une conversation. `authorId` est un **memberId**, jamais un userId. */
export interface Message {
  messageId: string;
  authorId: string;
  authorName: string;
  content: string;
  replyToMessageId: string | null;
  sentAt: string;
}

/** Longueur maximale d'un message, alignée sur le VO `MessageContent` du domaine. */
export const MESSAGE_MAX_LENGTH = 4000;

/**
 * Lecture et écriture des conversations.
 *
 * <p>Les routes ne sont pas préfixées par l'organisation : le serveur déduit les conversations
 * accessibles du membre courant, et n'en renvoie jamais d'autres.</p>
 */
@Injectable({ providedIn: 'root' })
export class MessagingService {
  private readonly http = inject(HttpClient);

  private static readonly BASE = '/api/messaging/conversations';

  /** Conversations de l'utilisateur courant, de la plus récemment active à la plus ancienne. */
  listConversations(): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(MessagingService.BASE);
  }

  /** Messages d'une conversation, **du plus récent au plus ancien**. */
  listMessages(conversationId: string, page = 0, size = 50): Observable<Message[]> {
    return this.http.get<Message[]>(`${MessagingService.BASE}/${conversationId}/messages`, {
      params: { page: String(page), size: String(size) },
    });
  }

  /**
   * Poste un message. Le serveur répond avec son identifiant, puis pousse le message complet à
   * tous les participants — y compris l'auteur : c'est le canal temps réel qui l'affichera.
   */
  post(
    conversationId: string,
    content: string,
    replyToMessageId?: string,
  ): Observable<{ messageId: string }> {
    return this.http.post<{ messageId: string }>(
      `${MessagingService.BASE}/${conversationId}/messages`,
      { content, replyToMessageId: replyToMessageId ?? null },
    );
  }

  /** Ouvre (ou retrouve) l'échange direct avec un membre. */
  createDirect(targetMemberId: string): Observable<{ conversationId: string }> {
    return this.http.post<{ conversationId: string }>(`${MessagingService.BASE}/direct`, {
      targetMemberId,
    });
  }
}

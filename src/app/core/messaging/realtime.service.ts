import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Client, type IMessage } from '@stomp/stompjs';
import { Observable, Subject } from 'rxjs';

/**
 * Message poussé aux participants d'une conversation.
 *
 * <p>Contrairement à la lecture REST, la charge utile porte déjà le nom de l'auteur : le serveur le
 * résout à l'émission (projection {@code MessageNotification}).</p>
 */
export interface MessageNotification {
  messageId: string;
  conversationId: string;
  authorId: string;
  authorName: string;
  content: string;
  replyToId: string | null;
  sentAt: string;
}

/**
 * Signal éphémère « quelqu'un écrit », jamais persisté côté serveur.
 *
 * <p>`userId` est un identifiant d'utilisateur, pas un `memberId` : il n'est donc comparable à rien
 * de ce que porte la messagerie. C'est `userName`, résolu par le serveur, qui sert à l'affichage.</p>
 */
export interface TypingNotification {
  conversationId: string;
  userId: string;
  userName: string;
}

/**
 * Intervalle minimal entre deux signaux de frappe.
 *
 * <p>Une frappe émet un événement par caractère ; sans ce garde-fou, chaque touche déclencherait un
 * aller-retour serveur et une résolution de nom.</p>
 */
const TYPING_THROTTLE_MS = 2_000;

/**
 * Canal temps réel STOMP over WebSocket.
 *
 * <p><b>Authentification</b> : le handshake sur `/ws` est une requête HTTP qui traverse la chaîne de
 * filtres Spring Security et réutilise le cookie de session. Aucun jeton à transmettre — c'est
 * pourquoi la connexion ne doit être ouverte qu'une fois la session établie.</p>
 *
 * <p><b>Pas de SockJS</b> : le serveur enregistre l'endpoint sans `withSockJS()`, donc WebSocket
 * natif. Ajouter la couche SockJS ferait échouer le handshake.</p>
 *
 * <p><b>Destinations utilisateur</b> : le client s'abonne à `/user/queue/messages` ; le serveur
 * résout les destinataires et pousse sur `/user/{userId}/queue/messages`. Aucun `/topic` public,
 * donc aucune autorisation à contrôler au moment de l'abonnement.</p>
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private client: Client | null = null;

  /** Dernier signal de frappe émis, par conversation : sert à en brider la fréquence. */
  private readonly lastTypingSentAt = new Map<string, number>();

  private readonly incomingMessages = new Subject<MessageNotification>();
  private readonly incomingTyping = new Subject<TypingNotification>();

  /** Vrai tant que la session STOMP est active ; l'interface peut s'en servir pour prévenir. */
  readonly connected = signal(false);

  readonly messages$: Observable<MessageNotification> = this.incomingMessages.asObservable();
  readonly typing$: Observable<TypingNotification> = this.incomingTyping.asObservable();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.disconnect());
  }

  /** Ouvre le canal. Sans effet s'il est déjà ouvert : appelable à chaque entrée d'écran. */
  connect(): void {
    if (this.client) {
      return;
    }

    const client = new Client({
      brokerURL: RealtimeService.brokerUrl(),
      // Le serveur peut refuser le handshake tant que la session n'est pas prête ;
      // la reconnexion périodique rattrape ce cas sans code supplémentaire.
      reconnectDelay: 5_000,
      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
      onConnect: () => {
        this.connected.set(true);
        client.subscribe('/user/queue/messages', (frame: IMessage) =>
          this.emit(this.incomingMessages, frame),
        );
        client.subscribe('/user/queue/typing', (frame: IMessage) =>
          this.emit(this.incomingTyping, frame),
        );
      },
      onWebSocketClose: () => this.connected.set(false),
      onStompError: () => this.connected.set(false),
    });

    client.activate();
    this.client = client;
  }

  /** Ferme le canal : à appeler à la déconnexion, le serveur coupant déjà sur révocation. */
  disconnect(): void {
    this.connected.set(false);
    void this.client?.deactivate();
    this.client = null;
    this.lastTypingSentAt.clear();
  }

  /**
   * Signale que l'utilisateur est en train d'écrire.
   *
   * <p>Appelable à chaque touche : la fréquence est bridée ici, au plus près du transport, pour
   * qu'aucun appelant ne puisse l'oublier. Silencieux si le canal est fermé.</p>
   */
  notifyTyping(conversationId: string): void {
    if (!this.client?.connected) {
      return;
    }

    const now = Date.now();
    if (now - (this.lastTypingSentAt.get(conversationId) ?? 0) < TYPING_THROTTLE_MS) {
      return;
    }
    this.lastTypingSentAt.set(conversationId, now);

    this.client.publish({ destination: `/app/conversations/${conversationId}/typing` });
  }

  /** Une trame illisible ne doit pas rompre le flux : on la laisse tomber. */
  private emit<T>(target: Subject<T>, frame: IMessage): void {
    try {
      target.next(JSON.parse(frame.body) as T);
    } catch {
      /* trame ignorée */
    }
  }

  /**
   * Le WebSocket exige une URL absolue. On la dérive de l'origine courante pour que le proxy du
   * serveur de développement s'applique, et pour basculer en `wss` derrière TLS en production.
   */
  private static brokerUrl(): string {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${scheme}://${window.location.host}/ws`;
  }
}

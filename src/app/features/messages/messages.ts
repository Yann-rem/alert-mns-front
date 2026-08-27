import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import {
  MESSAGE_MAX_LENGTH,
  MessagingService,
  type Conversation,
  type Message,
} from '../../core/messaging/messaging.service';
import {
  RealtimeService,
  type MessageNotification,
  type TypingNotification,
} from '../../core/realtime/realtime.service';
import { Avatar } from '../../ui/avatar/avatar';
import { Button } from '../../ui/button/button';

/**
 * Durée de vie d'un indicateur de frappe.
 *
 * <p>Aucun signal « a cessé d'écrire » n'existe : l'indicateur s'éteint tout seul. Le délai doit
 * dépasser la période d'émission (2 s) pour qu'une frappe continue ne le fasse pas clignoter.</p>
 */
const TYPING_TTL_MS = 4_000;

/**
 * Messagerie : liste des conversations et fil de la conversation ouverte.
 *
 * <p>Sur mobile, un seul panneau à la fois — la liste, puis le fil. Au-delà de 768 px, les deux
 * cohabitent. La conversation ouverte vit dans l'URL (`/messages/:conversationId`) et non dans un
 * signal local : un lien vers une conversation doit rester partageable, et le retour arrière du
 * navigateur doit faire ce qu'on en attend.</p>
 *
 * <p>Un message envoyé n'est <b>pas</b> ajouté localement : le serveur le repousse à tous les
 * participants, <b>auteur compris</b>. Une insertion optimiste ferait doublon.</p>
 */
@Component({
  selector: 'app-messages',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Button, FormsModule, RouterLink],
  templateUrl: './messages.html',
  // Occupe la zone de contenu de la coquille, qui est une colonne flex de hauteur fixe.
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class Messages {
  private readonly messaging = inject(MessagingService);
  private readonly realtime = inject(RealtimeService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Lié au paramètre de route par `withComponentInputBinding()`. */
  readonly conversationId = input<string | undefined>();

  protected readonly maxLength = MESSAGE_MAX_LENGTH;

  protected readonly conversations = signal<Conversation[]>([]);
  protected readonly messages = signal<Message[]>([]);
  protected readonly draft = signal('');
  protected readonly sending = signal(false);
  protected readonly loadingThread = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  /** Vrai dès la première réponse : évite d'annoncer « aucune conversation » pendant l'attente. */
  protected readonly conversationsLoaded = signal(false);

  protected readonly openConversation = computed(() =>
    this.conversations().find((c) => c.conversationId === this.conversationId()),
  );

  /** Ouverture d'un échange direct en cours : garde contre le double clic. */
  protected readonly openingDirect = signal(false);

  /**
   * Le nom d'un auteur n'est cliquable que dans un fil de groupe.
   *
   * <p>Dans un échange direct, l'interlocuteur est déjà celui de la conversation ouverte : le clic
   * y ramènerait au même endroit, ce qui donnerait un bouton sans effet visible.</p>
   */
  protected readonly canOpenDirect = computed(() => this.openConversation()?.kind === 'GROUP');

  /** Personnes en train d'écrire dans la conversation ouverte, par nom d'affichage. */
  protected readonly typists = signal<string[]>([]);

  protected readonly typingLabel = computed(() => {
    const names = this.typists();
    if (names.length === 0) {
      return null;
    }
    if (names.length === 1) {
      return `${names[0]} écrit…`;
    }
    if (names.length === 2) {
      return `${names[0]} et ${names[1]} écrivent…`;
    }
    return 'Plusieurs personnes écrivent…';
  });

  private readonly thread = viewChild<ElementRef<HTMLElement>>('thread');

  /** Minuteur d'extinction par personne : chaque nouveau signal repousse l'échéance. */
  private readonly typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    // La connexion appartient à la coquille : cet écran est détruit à chaque changement de
    // conversation, la fermer ici ferait cycler le socket.
    inject(DestroyRef).onDestroy(() => this.clearTypists());

    this.loadConversations();

    // Changer de conversation recharge le fil ; sans identifiant, le panneau se vide.
    effect(() => {
      const id = this.conversationId();
      // Les personnes qui écrivaient ailleurs n'ont rien à faire dans le nouveau fil.
      this.clearTypists();
      if (id) {
        this.loadThread(id);
      } else {
        this.messages.set([]);
      }
    });

    this.realtime.messages$
      .pipe(takeUntilDestroyed())
      .subscribe((notification) => this.onMessagePushed(notification));

    this.realtime.typing$
      .pipe(takeUntilDestroyed())
      .subscribe((notification) => this.onTypingPushed(notification));
  }

  // --- Chargement ---

  private loadConversations(): void {
    this.messaging.listConversations().subscribe({
      next: (conversations) => {
        this.conversations.set(conversations);
        this.conversationsLoaded.set(true);
      },
      error: (error: HttpErrorResponse) => this.fail(error),
    });
  }

  private loadThread(conversationId: string): void {
    this.loadingThread.set(true);
    this.errorMessage.set(null);
    this.messaging.listMessages(conversationId).subscribe({
      next: (messages) => {
        // Le serveur renvoie du plus récent au plus ancien ; un fil se lit dans l'autre sens.
        this.messages.set([...messages].reverse());
        this.loadingThread.set(false);
        this.scrollToLatest();
      },
      error: (error: HttpErrorResponse) => {
        this.loadingThread.set(false);
        this.fail(error);
      },
    });
  }

  // --- Temps réel ---

  /**
   * Un message poussé sert deux panneaux : il alimente le fil s'il concerne la conversation
   * ouverte, et rafraîchit l'aperçu dans la liste dans tous les cas.
   */
  private onMessagePushed(notification: MessageNotification): void {
    if (notification.conversationId === this.conversationId()) {
      this.messages.update((current) =>
        current.some((m) => m.messageId === notification.messageId)
          ? current
          : [
              ...current,
              {
                messageId: notification.messageId,
                authorId: notification.authorId,
                authorName: notification.authorName,
                content: notification.content,
                replyToMessageId: notification.replyToId,
                sentAt: notification.sentAt,
              },
            ],
      );
      this.scrollToLatest();
    }

    this.conversations.update((current) => {
      const updated = current.map((conversation) =>
        conversation.conversationId === notification.conversationId
          ? {
              ...conversation,
              lastActivityAt: notification.sentAt,
              lastMessage: {
                messageId: notification.messageId,
                authorId: notification.authorId,
                authorName: notification.authorName,
                content: notification.content,
                sentAt: notification.sentAt,
              },
            }
          : conversation,
      );
      // Le tri par dernière activité est la règle du serveur : on la tient aussi côté client.
      return updated.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
    });
  }

  /**
   * Le serveur n'émet jamais « a cessé d'écrire » : chaque signal reçu (re)lance une extinction
   * différée. Le serveur exclut déjà l'émetteur, aucun filtrage de soi n'est nécessaire.
   */
  private onTypingPushed(notification: TypingNotification): void {
    if (notification.conversationId !== this.conversationId()) {
      return;
    }

    const name = notification.userName;
    this.typists.update((current) => (current.includes(name) ? current : [...current, name]));

    clearTimeout(this.typingTimers.get(name));
    this.typingTimers.set(
      name,
      setTimeout(() => {
        this.typingTimers.delete(name);
        this.typists.update((current) => current.filter((n) => n !== name));
      }, TYPING_TTL_MS),
    );
  }

  private clearTypists(): void {
    this.typingTimers.forEach((timer) => clearTimeout(timer));
    this.typingTimers.clear();
    this.typists.set([]);
  }

  // --- Envoi ---

  protected send(): void {
    const content = this.draft().trim();
    const conversationId = this.conversationId();
    if (!content || !conversationId || this.sending()) {
      return;
    }

    this.sending.set(true);
    this.errorMessage.set(null);
    this.messaging.post(conversationId, content).subscribe({
      next: () => {
        this.sending.set(false);
        this.draft.set('');
      },
      error: (error: HttpErrorResponse) => {
        this.sending.set(false);
        this.errorMessage.set(Messages.messageFor(error));
      },
    });
  }

  /** Entrée envoie, Maj+Entrée passe à la ligne — la convention des messageries. */
  protected onDraftKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
      return;
    }

    const conversationId = this.conversationId();
    if (conversationId) {
      // La fréquence est bridée dans le service : on peut signaler à chaque touche.
      this.realtime.notifyTyping(conversationId);
    }
  }

  // --- Échange direct ---

  /**
   * Ouvre l'échange direct avec l'auteur d'un message.
   *
   * <p>C'est le seul chemin vers une conversation directe. Le cas d'usage existait côté serveur et
   * dans ce service, mais aucun écran ne l'appelait : l'attente n°6 du cahier des charges était
   * donc implémentée sans être atteignable, ce qu'a révélé le jeu d'essai.</p>
   *
   * <p><b>Pourquoi partir du nom affiché</b> plutôt que d'un annuaire : la liste des membres est
   * réservée aux administrateurs, et l'ouvrir à tous supposerait un point d'entrée dédié, une
   * projection réduite des données personnelles et une décision sur ce que chacun a le droit de
   * voir. Le nom de l'auteur est déjà sous les yeux du lecteur, avec son identifiant.</p>
   *
   * <p>Le serveur retrouve la conversation lorsqu'elle existe déjà : deux clics successifs mènent
   * au même fil, jamais à un doublon.</p>
   */
  protected openDirect(message: Message): void {
    if (this.openingDirect()) {
      return;
    }

    this.openingDirect.set(true);
    this.errorMessage.set(null);
    this.messaging.createDirect(message.authorId).subscribe({
      next: ({ conversationId }) => {
        this.openingDirect.set(false);
        // La conversation vient d'apparaître : sans ce rechargement, la liste ne la connaîtrait
        // pas et le fil resterait sur « Ouverture de la conversation… ».
        this.loadConversations();
        void this.router.navigate(['/messages', conversationId]);
      },
      error: (error: HttpErrorResponse) => {
        this.openingDirect.set(false);
        this.fail(error);
      },
    });
  }

  // --- Rendu ---

  protected isMine(message: Message): boolean {
    return message.authorId === this.auth.memberId();
  }

  protected initials(name: string): string {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.charAt(0) ?? '';
    const last = parts.length > 1 ? (parts.at(-1)?.charAt(0) ?? '') : '';
    return (first + last).toUpperCase() || '?';
  }

  /** Heure seule pour aujourd'hui, date courte au-delà : une liste n'a pas besoin de plus. */
  protected shortTime(iso: string): string {
    const date = new Date(iso);
    const isToday = new Date().toDateString() === date.toDateString();
    return isToday
      ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  }

  private scrollToLatest(): void {
    // Après le rendu de la nouvelle ligne, sinon on défile vers l'avant-dernière.
    queueMicrotask(() => {
      const element = this.thread()?.nativeElement;
      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    });
  }

  private fail(error: HttpErrorResponse): void {
    this.errorMessage.set(Messages.messageFor(error));
  }

  private static messageFor(error: HttpErrorResponse): string {
    switch (error.status) {
      case 403:
        return 'Vous ne participez pas à cette conversation.';
      case 404:
        return 'Cette conversation est introuvable.';
      case 0:
        return 'Serveur injoignable. Vérifiez votre connexion.';
      default:
        return 'Une erreur est survenue. Réessayez.';
    }
  }
}

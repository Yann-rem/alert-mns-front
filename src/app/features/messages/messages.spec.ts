import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import {
  RealtimeService,
  type MessageNotification,
  type TypingNotification,
} from '../../core/realtime/realtime.service';
import { Messages } from './messages';

const CONVERSATIONS_URL = '/api/messaging/conversations';
const MY_MEMBER_ID = 'me-1';

/** Le vrai service ouvrirait un WebSocket : on n'en garde que le flux entrant. */
class RealtimeStub {
  readonly connected = signal(true);
  readonly pushed = new Subject<MessageNotification>();
  readonly typed = new Subject<TypingNotification>();
  readonly messages$ = this.pushed.asObservable();
  readonly typing$ = this.typed.asObservable();
  readonly typingCalls: string[] = [];
  connect(): void {}
  disconnect(): void {}
  notifyTyping(conversationId: string): void {
    this.typingCalls.push(conversationId);
  }
}

const GROUP_CONVERSATION = {
  conversationId: 'c-1',
  kind: 'GROUP',
  title: 'Général',
  groupId: 'g-1',
  counterpartMemberId: null,
  lastMessage: {
    messageId: 'm-0',
    authorId: 'other-1',
    authorName: 'Sofia Nkolo',
    content: 'Bonjour à tous',
    sentAt: '2026-08-01T09:00:00Z',
  },
  lastActivityAt: '2026-08-01T09:00:00Z',
  createdAt: '2026-07-01T09:00:00Z',
};

const DIRECT_CONVERSATION = {
  conversationId: 'c-2',
  kind: 'DIRECT',
  title: 'Karim Belkacem',
  groupId: null,
  counterpartMemberId: 'other-2',
  lastMessage: null,
  lastActivityAt: '2026-07-20T09:00:00Z',
  createdAt: '2026-07-20T09:00:00Z',
};

describe('Messages', () => {
  let http: HttpTestingController;
  let realtime: RealtimeStub;

  async function setup(conversationId?: string) {
    realtime = new RealtimeStub();

    await TestBed.configureTestingModule({
      imports: [Messages],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: RealtimeService, useValue: realtime },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);

    // Session établie : le memberId sert à distinguer ses propres messages.
    TestBed.inject(AuthService).loadCurrentUser().subscribe();
    http.expectOne('/api/auth/me').flush({
      userId: 'u-1',
      email: 'yannick.remy@mns.fr',
      firstName: 'Yannick',
      lastName: 'Remy',
      memberId: MY_MEMBER_ID,
      organisationId: 'org-1',
      role: 'MEMBER',
      memberStatus: 'ACTIVE',
      absenceMessage: null,
    });

    const fixture = TestBed.createComponent(Messages);
    if (conversationId) {
      fixture.componentRef.setInput('conversationId', conversationId);
    }
    await fixture.whenStable();
    return fixture;
  }

  function text(fixture: ComponentFixture<Messages>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function flushConversations(
    conversations: unknown[] = [GROUP_CONVERSATION, DIRECT_CONVERSATION],
  ) {
    http.expectOne(CONVERSATIONS_URL).flush(conversations);
  }

  it('liste les conversations avec leur titre et l’aperçu du dernier message', async () => {
    const fixture = await setup();
    flushConversations();
    await fixture.whenStable();

    expect(text(fixture)).toContain('Général');
    expect(text(fixture)).toContain('Karim Belkacem');
    expect(text(fixture)).toContain('Bonjour à tous');
    expect(text(fixture)).toContain('Aucun message');
    http.verify();
  });

  it('sans conversation ouverte : ne charge aucun fil', async () => {
    const fixture = await setup();
    flushConversations();
    await fixture.whenStable();

    http.expectNone((r) => r.url.endsWith('/messages'));
    http.verify();
  });

  it('ouvre un fil et le remet dans l’ordre de lecture', async () => {
    const fixture = await setup('c-1');
    flushConversations();

    // Le serveur renvoie du plus récent au plus ancien.
    http
      .expectOne((r) => r.url === `${CONVERSATIONS_URL}/c-1/messages`)
      .flush([
        {
          messageId: 'm-2',
          authorId: 'other-1',
          authorName: 'Sofia Nkolo',
          content: 'Deuxième',
          replyToMessageId: null,
          sentAt: '2026-08-01T09:05:00Z',
        },
        {
          messageId: 'm-1',
          authorId: MY_MEMBER_ID,
          authorName: 'Yannick Remy',
          content: 'Premier',
          replyToMessageId: null,
          sentAt: '2026-08-01T09:00:00Z',
        },
      ]);
    await fixture.whenStable();

    const bubbles = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('li .rounded-lg'),
    ).map((b) => b.textContent?.trim());
    expect(bubbles).toEqual(['Premier', 'Deuxième']);
    http.verify();
  });

  it('le nom d’un auteur ouvre l’échange direct avec lui', async () => {
    const fixture = await setup('c-1');
    flushConversations();
    http
      .expectOne((r) => r.url === `${CONVERSATIONS_URL}/c-1/messages`)
      .flush([
        {
          messageId: 'm-2',
          authorId: 'other-1',
          authorName: 'Sofia Nkolo',
          content: 'Bonjour à tous',
          replyToMessageId: null,
          sentAt: '2026-08-01T09:05:00Z',
        },
      ]);
    await fixture.whenStable();

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Envoyer un message direct à Sofia Nkolo"]',
      )!
      .click();
    await fixture.whenStable();

    const created = http.expectOne(`${CONVERSATIONS_URL}/direct`);
    expect(created.request.body).toEqual({ targetMemberId: 'other-1' });
    created.flush({ conversationId: 'c-9' });
    await fixture.whenStable();

    // La liste est rechargée avant la navigation : sans elle, le fil resterait sur
    // « Ouverture de la conversation… », la nouvelle conversation lui étant inconnue.
    flushConversations();
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/messages', 'c-9']);
    http.verify();
  });

  it('dans un échange direct, le nom de l’interlocuteur n’est pas cliquable', async () => {
    const fixture = await setup('c-2');
    flushConversations();
    http
      .expectOne((r) => r.url === `${CONVERSATIONS_URL}/c-2/messages`)
      .flush([
        {
          messageId: 'm-3',
          authorId: 'other-2',
          authorName: 'Karim Belkacem',
          content: 'Salut',
          replyToMessageId: null,
          sentAt: '2026-08-01T09:05:00Z',
        },
      ]);
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('button[aria-label^="Envoyer un message direct"]')).toBeNull();
    expect(text(fixture)).toContain('Karim Belkacem');
    http.verify();
  });

  it('envoie un message sans l’ajouter localement : le serveur le repoussera', async () => {
    const fixture = await setup('c-1');
    flushConversations();
    http.expectOne((r) => r.url === `${CONVERSATIONS_URL}/c-1/messages`).flush([]);
    await fixture.whenStable();

    const textarea = (fixture.nativeElement as HTMLElement).querySelector('textarea')!;
    textarea.value = 'Bonjour';
    textarea.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement)
      .querySelector('form')!
      .dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const request = http.expectOne(
      (r) => r.method === 'POST' && r.url === `${CONVERSATIONS_URL}/c-1/messages`,
    );
    expect(request.request.body).toEqual({ content: 'Bonjour', replyToMessageId: null });
    request.flush({ messageId: 'm-9' });
    await fixture.whenStable();

    // Aucune bulle : le message n'apparaîtra qu'une fois repoussé par le serveur.
    const bubbles = (fixture.nativeElement as HTMLElement).querySelectorAll('li .rounded-lg');
    expect(bubbles.length).toBe(0);
    expect(textarea.value).toBe('');
    http.verify();
  });

  it('affiche un message poussé dans la conversation ouverte', async () => {
    const fixture = await setup('c-1');
    flushConversations();
    http.expectOne((r) => r.url === `${CONVERSATIONS_URL}/c-1/messages`).flush([]);
    await fixture.whenStable();

    realtime.pushed.next({
      messageId: 'm-9',
      conversationId: 'c-1',
      authorId: 'other-1',
      authorName: 'Sofia Nkolo',
      content: 'Message temps réel',
      replyToId: null,
      sentAt: '2026-08-02T10:00:00Z',
    });
    await fixture.whenStable();

    expect(text(fixture)).toContain('Message temps réel');
    http.verify();
  });

  it('un message poussé ailleurs met à jour la liste sans polluer le fil ouvert', async () => {
    const fixture = await setup('c-1');
    flushConversations();
    http.expectOne((r) => r.url === `${CONVERSATIONS_URL}/c-1/messages`).flush([]);
    await fixture.whenStable();

    realtime.pushed.next({
      messageId: 'm-9',
      conversationId: 'c-2',
      authorId: 'other-2',
      authorName: 'Karim Belkacem',
      content: 'Ailleurs',
      replyToId: null,
      sentAt: '2026-08-02T10:00:00Z',
    });
    await fixture.whenStable();

    // Présent dans l'aperçu de la liste, absent des bulles du fil.
    expect(text(fixture)).toContain('Ailleurs');
    const bubbles = (fixture.nativeElement as HTMLElement).querySelectorAll('li .rounded-lg');
    expect(bubbles.length).toBe(0);
    http.verify();
  });

  it('ignore un doublon poussé deux fois', async () => {
    const fixture = await setup('c-1');
    flushConversations();
    http.expectOne((r) => r.url === `${CONVERSATIONS_URL}/c-1/messages`).flush([]);
    await fixture.whenStable();

    const notification: MessageNotification = {
      messageId: 'm-9',
      conversationId: 'c-1',
      authorId: 'other-1',
      authorName: 'Sofia Nkolo',
      content: 'Une seule fois',
      replyToId: null,
      sentAt: '2026-08-02T10:00:00Z',
    };
    realtime.pushed.next(notification);
    realtime.pushed.next(notification);
    await fixture.whenStable();

    const bubbles = (fixture.nativeElement as HTMLElement).querySelectorAll('li .rounded-lg');
    expect(bubbles.length).toBe(1);
    http.verify();
  });

  it('affiche qui écrit, puis éteint l’indicateur faute de nouveau signal', async () => {
    const fixture = await setup('c-1');
    flushConversations();
    http.expectOne((r) => r.url === `${CONVERSATIONS_URL}/c-1/messages`).flush([]);
    await fixture.whenStable();

    // Ne simuler que setTimeout : `whenStable` s'appuie sur les autres minuteurs, les figer
    // le ferait attendre indéfiniment. D'où la détection de changements synchrone ci-dessous.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      realtime.typed.next({ conversationId: 'c-1', userId: 'u-2', userName: 'Sofia Nkolo' });
      fixture.detectChanges();
      expect(text(fixture)).toContain('Sofia Nkolo écrit…');

      // Aucun signal de renouvellement : l'indicateur doit s'éteindre seul.
      vi.advanceTimersByTime(5_000);
      fixture.detectChanges();
      expect(text(fixture)).not.toContain('écrit…');
    } finally {
      vi.useRealTimers();
    }

    http.verify();
  });

  it('accorde le libellé au nombre de personnes qui écrivent', async () => {
    const fixture = await setup('c-1');
    flushConversations();
    http.expectOne((r) => r.url === `${CONVERSATIONS_URL}/c-1/messages`).flush([]);
    await fixture.whenStable();

    realtime.typed.next({ conversationId: 'c-1', userId: 'u-2', userName: 'Sofia Nkolo' });
    realtime.typed.next({ conversationId: 'c-1', userId: 'u-3', userName: 'Karim Belkacem' });
    await fixture.whenStable();

    expect(text(fixture)).toContain('Sofia Nkolo et Karim Belkacem écrivent…');
    http.verify();
  });

  it('ignore un signal de frappe venant d’une autre conversation', async () => {
    const fixture = await setup('c-1');
    flushConversations();
    http.expectOne((r) => r.url === `${CONVERSATIONS_URL}/c-1/messages`).flush([]);
    await fixture.whenStable();

    realtime.typed.next({ conversationId: 'c-2', userId: 'u-2', userName: 'Karim Belkacem' });
    await fixture.whenStable();

    expect(text(fixture)).not.toContain('écrit…');
    http.verify();
  });

  it('signale la frappe au serveur, sauf sur la touche d’envoi', async () => {
    const fixture = await setup('c-1');
    flushConversations();
    http.expectOne((r) => r.url === `${CONVERSATIONS_URL}/c-1/messages`).flush([]);
    await fixture.whenStable();

    const textarea = (fixture.nativeElement as HTMLElement).querySelector('textarea')!;
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }));
    expect(realtime.typingCalls).toEqual(['c-1', 'c-1']);

    // Entrée envoie : ce n'est pas de la frappe.
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(realtime.typingCalls).toEqual(['c-1', 'c-1']);
    http.verify();
  });

  it('403 : explique que la conversation n’est pas accessible', async () => {
    const fixture = await setup('c-1');
    flushConversations();
    http
      .expectOne((r) => r.url === `${CONVERSATIONS_URL}/c-1/messages`)
      .flush(null, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();

    expect(text(fixture)).toContain('ne participez pas');
    http.verify();
  });
});

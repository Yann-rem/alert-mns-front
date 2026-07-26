import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { Avatar } from '../../ui/avatar/avatar';
import { Button } from '../../ui/button/button';

/**
 * Page provisoire d'atterrissage après connexion.
 *
 * TODO : remplacer par le véritable écran Messages (liste des conversations
 * + fil de discussion temps réel). Elle sert pour l'instant à vérifier que la
 * session et `GET /api/auth/me` fonctionnent de bout en bout.
 */
@Component({
  selector: 'app-messages',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Button],
  template: `
    <main class="flex min-h-dvh items-center justify-center bg-surface-page p-4">
      <div
        class="flex w-full max-w-sm flex-col items-center gap-4 rounded-lg border border-border-default bg-surface-default p-6 text-center"
      >
        @if (user(); as u) {
          <app-avatar
            [initials]="initials(u.firstName, u.lastName)"
            size="lg"
            [ariaLabel]="u.firstName + ' ' + u.lastName"
          />
          <div class="flex flex-col gap-1">
            <p class="text-heading">Bonjour {{ u.firstName }}</p>
            <p class="text-body text-text-secondary">{{ u.email }}</p>
          </div>
          <p class="text-caption text-text-muted">
            Connexion réussie. L'écran Messages arrive bientôt.
          </p>
          <button appButton variant="secondary" (click)="logout()">Se déconnecter</button>
        } @else {
          <p class="text-body text-text-secondary">Session non établie.</p>
        }
      </div>
    </main>
  `,
})
export class Messages {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly user = this.auth.user;

  protected initials(firstName: string, lastName: string): string {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`;
  }

  protected logout(): void {
    this.auth.logout().subscribe({
      next: () => void this.router.navigate(['/connexion']),
      error: () => void this.router.navigate(['/connexion']),
    });
  }
}

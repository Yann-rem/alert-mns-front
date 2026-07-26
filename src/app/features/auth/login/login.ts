import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { Button } from '../../../ui/button/button';
import { Field } from '../../../ui/field/field';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Button, Field],
  templateUrl: './login.html',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Vrai quand on arrive juste d'une activation réussie (`/connexion?active=1`). */
  protected readonly justActivated =
    this.route.snapshot.queryParamMap.get('active') === '1';

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();
    this.loading.set(true);
    this.errorMessage.set(null);

    this.auth
      .login(email, password)
      // La session est ouverte mais l'identité n'est pas dans la réponse :
      // on enchaîne sur /me pour savoir qui est connecté.
      .pipe(switchMap(() => this.auth.loadCurrentUser()))
      .subscribe({
        next: () => {
          this.loading.set(false);
          void this.router.navigate(['/messages']);
        },
        error: (error: HttpErrorResponse) => {
          this.loading.set(false);
          this.errorMessage.set(Login.messageFor(error));
        },
      });
  }

  /** Traduit le code HTTP en message affichable, sans détailler la cause exacte. */
  private static messageFor(error: HttpErrorResponse): string {
    switch (error.status) {
      case 401:
        return 'Adresse e-mail ou mot de passe incorrect.';
      case 403:
        return 'Votre compte est désactivé. Contactez un administrateur.';
      case 0:
        return 'Serveur injoignable. Vérifiez votre connexion.';
      default:
        return 'Une erreur est survenue. Veuillez réessayer.';
    }
  }
}

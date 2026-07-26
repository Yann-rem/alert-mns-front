import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import {
  AuthService,
  PASSWORD_MIN_LENGTH,
  type MagicLinkContext,
} from '../../../core/auth/auth.service';
import { Button } from '../../../ui/button/button';
import { Field } from '../../../ui/field/field';

/** Étapes de l'écran : le lien est vérifié avant d'afficher quoi que ce soit. */
type ActivationStatus = 'validating' | 'ready' | 'expired' | 'error';

/** Exige que les deux saisies de mot de passe soient identiques. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmation = group.get('confirmation')?.value;
  return password && confirmation && password !== confirmation ? { passwordsMismatch: true } : null;
}

/**
 * Activation de compte via lien magique (`/activation?token=…`).
 *
 * Le lien est validé au chargement : on n'affiche le formulaire que si le
 * backend confirme sa validité, afin de ne pas faire saisir un mot de passe
 * pour rien.
 */
@Component({
  selector: 'app-activation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Button, Field],
  templateUrl: './activation.html',
})
export class Activation implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly minLength = PASSWORD_MIN_LENGTH;
  protected readonly status = signal<ActivationStatus>('validating');
  protected readonly context = signal<MagicLinkContext | null>(null);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private token = '';

  protected readonly form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)]],
      confirmation: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.status.set('expired');
      return;
    }

    this.auth.validateMagicLink(this.token).subscribe({
      next: (context) => {
        this.context.set(context);
        this.status.set('ready');
      },
      error: (error: HttpErrorResponse) =>
        this.status.set(error.status === 410 ? 'expired' : 'error'),
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.auth.redeemMagicLink(this.token, this.form.getRawValue().password).subscribe({
      // Le redeem n'ouvre pas de session : on renvoie vers la connexion, en
      // signalant l'activation réussie.
      next: () => void this.router.navigate(['/connexion'], { queryParams: { active: 1 } }),
      error: (error: HttpErrorResponse) => {
        this.submitting.set(false);
        if (error.status === 410) {
          this.status.set('expired');
          return;
        }
        this.errorMessage.set(
          error.status === 0
            ? 'Serveur injoignable. Vérifiez votre connexion.'
            : 'Une erreur est survenue. Veuillez réessayer.',
        );
      },
    });
  }
}

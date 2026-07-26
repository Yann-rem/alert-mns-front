import { booleanAttribute, computed, Directive, input } from '@angular/core';

/**
 * Champ de saisie du design system Alerte.
 *
 * Directive appliquée sur un `<input>` natif : l'intégration aux formulaires
 * (ngModel / Reactive Forms) reste native, et les états focus / disabled /
 * readonly sont gérés par les pseudo-classes.
 *
 * ```html
 * <input appField placeholder="Adresse e-mail" />
 * <input appField [invalid]="emailCtrl.invalid" formControlName="email" />
 * ```
 */
@Directive({
  selector: 'input[appField]',
  host: {
    '[class]': 'classes()',
    '[attr.aria-invalid]': 'invalid() || null',
  },
})
export class Field {
  /** Passe le champ en état d'erreur (bordure danger + `aria-invalid`). */
  readonly invalid = input(false, { transform: booleanAttribute });

  private static readonly BASE =
    'w-full h-10 px-3 rounded-md border bg-surface-sunken text-body text-text-primary ' +
    'placeholder:text-text-muted transition-colors ' +
    'focus-visible:outline-2 focus-visible:outline-offset-1 ' +
    'disabled:opacity-60 disabled:cursor-not-allowed read-only:text-text-secondary';

  protected readonly classes = computed(() =>
    this.invalid()
      ? `${Field.BASE} border-danger-border focus:border-danger-solid focus-visible:outline-danger-solid`
      : `${Field.BASE} border-border-default focus:border-accent-solid focus-visible:outline-accent-solid`,
  );
}

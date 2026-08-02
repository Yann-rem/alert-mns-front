import { booleanAttribute, computed, Directive, input } from '@angular/core';

/**
 * Champ de saisie du design system Alerte.
 *
 * Directive appliquée sur un `<input>` ou un `<select>` natif : l'intégration
 * aux formulaires (ngModel / Reactive Forms) reste native, et les états focus /
 * disabled / readonly sont gérés par les pseudo-classes. Le `<select>` conserve
 * sa flèche native — aucun composant Select n'existe dans le design system.
 *
 * ```html
 * <input appField placeholder="Adresse e-mail" />
 * <input appField [invalid]="emailCtrl.invalid" formControlName="email" />
 * <select appField formControlName="role">…</select>
 * ```
 */
@Directive({
  selector: 'input[appField], select[appField]',
  host: {
    '[class]': 'classes()',
    '[attr.aria-invalid]': 'invalid() || null',
  },
})
export class Field {
  /** Passe le champ en état d'erreur (bordure danger + `aria-invalid`). */
  readonly invalid = input(false, { transform: booleanAttribute });

  // L'outline est toujours déclaré (largeur fixe, transparent au repos) et collé
  // à la bordure : seule sa couleur s'anime, sans interstice laissant voir le fond.
  private static readonly BASE =
    'w-full h-10 px-3 rounded-md border bg-surface-sunken text-body text-text-primary ' +
    'placeholder:text-text-muted transition-colors ' +
    'outline-2 outline-offset-0 outline-transparent ' +
    'disabled:opacity-60 disabled:cursor-not-allowed read-only:text-text-secondary';

  protected readonly classes = computed(() =>
    this.invalid()
      ? `${Field.BASE} border-danger-border focus-visible:border-danger-solid focus-visible:outline-danger-solid`
      : `${Field.BASE} border-border-default focus-visible:border-accent-solid focus-visible:outline-accent-solid`,
  );
}

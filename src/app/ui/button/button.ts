import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

/** Style visuel du bouton, aligné sur le design system Figma. */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/**
 * Bouton du design system Alerte.
 *
 * S'applique en attribut sur un `<button>` natif, pour rester accessible et
 * compatible avec les formulaires :
 *
 * ```html
 * <button appButton variant="primary">Se connecter</button>
 * <button appButton variant="danger" [disabled]="loading()">Anonymiser</button>
 * ```
 */
@Component({
  selector: 'button[appButton]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content />',
  host: {
    '[class]': 'classes()',
    '[attr.type]': 'type()',
    '[attr.disabled]': 'disabled() ? "" : null',
  },
})
export class Button {
  /** Style visuel. */
  readonly variant = input<ButtonVariant>('primary');
  /** Type HTML natif (défaut `button` pour éviter les soumissions accidentelles). */
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  /** Désactive le bouton (attribut `disabled` natif + styles). */
  readonly disabled = input(false, { transform: booleanAttribute });

  // Outline toujours déclaré, transparent au repos : seule la couleur s'anime
  // (sinon la transition part de la valeur par défaut du navigateur → flash).
  //
  // `whitespace-nowrap` et `shrink-0` vont avec la hauteur fixe : dans un conteneur flex
  // à l'étroit, un libellé qui se replie déborde du fond du bouton au lieu de l'agrandir.
  // Mieux vaut un bouton qui garde sa taille et pousse ses voisins.
  private static readonly BASE =
    'inline-flex shrink-0 items-center justify-center gap-2 h-9 px-4 rounded-md ' +
    'whitespace-nowrap text-body font-medium select-none transition-colors ' +
    'outline-2 outline-offset-2 outline-transparent focus-visible:outline-accent-solid ' +
    'disabled:opacity-50 disabled:pointer-events-none';

  private static readonly VARIANTS: Record<ButtonVariant, string> = {
    primary: 'bg-accent-solid text-text-on-accent hover:bg-accent-solid/90',
    secondary:
      'bg-surface-default text-text-primary border border-border-default hover:bg-surface-muted',
    ghost: 'bg-transparent text-text-primary hover:bg-surface-muted',
    danger: 'bg-danger-solid text-text-on-accent hover:bg-danger-solid/90',
  };

  protected readonly classes = computed(() => `${Button.BASE} ${Button.VARIANTS[this.variant()]}`);
}

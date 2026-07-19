import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

/** Tonalité sémantique de la pastille. */
export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
/** Remplie (fond teinté) ou contour. */
export type BadgeVariant = 'filled' | 'outline';

/**
 * Pastille d'état ou de rôle (design system Alerte).
 *
 * ```html
 * <app-badge tone="success">Actif</app-badge>
 * <app-badge tone="neutral" variant="outline">Membre</app-badge>
 * ```
 */
@Component({
  selector: 'app-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content />',
  host: { '[class]': 'classes()' },
})
export class Badge {
  readonly tone = input<BadgeTone>('neutral');
  readonly variant = input<BadgeVariant>('filled');

  private static readonly BASE =
    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-micro font-medium whitespace-nowrap';

  /** Classes { fond, texte, bordure } par tonalité. */
  private static readonly TONES: Record<
    BadgeTone,
    { bg: string; text: string; border: string }
  > = {
    neutral: {
      bg: 'bg-surface-muted',
      text: 'text-text-secondary',
      border: 'border-border-default',
    },
    accent: {
      bg: 'bg-accent-subtle',
      text: 'text-accent-text',
      border: 'border-accent-border',
    },
    success: {
      bg: 'bg-success-subtle',
      text: 'text-success-text',
      border: 'border-success-text',
    },
    warning: {
      bg: 'bg-warning-subtle',
      text: 'text-warning-text',
      border: 'border-warning-border',
    },
    danger: {
      bg: 'bg-danger-subtle',
      text: 'text-danger-text',
      border: 'border-danger-border',
    },
  };

  protected readonly classes = computed(() => {
    const tone = Badge.TONES[this.tone()];
    const skin =
      this.variant() === 'filled'
        ? `${tone.bg} ${tone.text}`
        : `bg-transparent border ${tone.border} ${tone.text}`;
    return `${Badge.BASE} ${skin}`;
  });
}

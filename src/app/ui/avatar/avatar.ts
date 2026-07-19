import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

export type AvatarSize = 'sm' | 'md' | 'lg';
export type AvatarPresence = 'none' | 'online' | 'offline';

/**
 * Avatar à initiales avec indicateur de présence optionnel (design system Alerte).
 *
 * ```html
 * <app-avatar initials="JM" size="md" presence="online" ariaLabel="Julien Meyer" />
 * ```
 */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ initials() }}
    @if (presence() !== 'none') {
      <span [class]="dotClasses()" aria-hidden="true"></span>
    }`,
  host: {
    '[class]': 'classes()',
    '[attr.aria-label]': 'ariaLabel() || initials()',
    role: 'img',
  },
})
export class Avatar {
  /** Initiales affichées (ex. « JM »). */
  readonly initials = input('');
  readonly size = input<AvatarSize>('md');
  readonly presence = input<AvatarPresence>('none');
  /** Nom accessible (défaut : les initiales). */
  readonly ariaLabel = input('');

  private static readonly BASE =
    'relative inline-flex items-center justify-center shrink-0 rounded-full ' +
    'bg-accent-subtle text-accent-text font-medium uppercase select-none';

  private static readonly SIZES: Record<AvatarSize, string> = {
    sm: 'w-7 h-7 text-caption',
    md: 'w-8 h-8 text-label',
    lg: 'w-12 h-12 text-heading',
  };

  private static readonly DOT_SIZES: Record<AvatarSize, string> = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  protected readonly classes = computed(
    () => `${Avatar.BASE} ${Avatar.SIZES[this.size()]}`,
  );

  protected readonly dotClasses = computed(() => {
    const color =
      this.presence() === 'online' ? 'bg-presence-online' : 'bg-text-muted';
    return `absolute bottom-0 right-0 rounded-full ring-2 ring-surface-default ${Avatar.DOT_SIZES[this.size()]} ${color}`;
  });
}

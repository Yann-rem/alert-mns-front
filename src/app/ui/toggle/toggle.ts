import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  input,
  model,
} from '@angular/core';

/**
 * Interrupteur on/off (design system Alerte).
 *
 * ```html
 * <app-toggle [(checked)]="active" />
 * <app-toggle [checked]="msg.active()" (checkedChange)="msg.setActive($event)" />
 * ```
 */
@Component({
  selector: 'app-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <button
      type="button"
      role="switch"
      [attr.aria-checked]="checked()"
      [disabled]="disabled()"
      (click)="toggle()"
      class="relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full transition-colors
             focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-solid
             disabled:opacity-50 disabled:pointer-events-none"
      [class.bg-accent-solid]="checked()"
      [class.bg-border-strong]="!checked()"
    >
      <span
        class="absolute left-0.5 inline-block h-[18px] w-[18px] rounded-full bg-surface-default shadow-sm transition-transform"
        [class.translate-x-4]="checked()"
      ></span>
    </button>
  `,
})
export class Toggle {
  /** État on/off, bindable dans les deux sens via `[(checked)]`. */
  readonly checked = model(false);
  readonly disabled = input(false, { transform: booleanAttribute });

  protected toggle(): void {
    if (!this.disabled()) {
      this.checked.update((v) => !v);
    }
  }
}

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { Avatar } from '../../ui/avatar/avatar';
import { Badge } from '../../ui/badge/badge';
import { Button } from '../../ui/button/button';
import { Field } from '../../ui/field/field';
import { Toggle } from '../../ui/toggle/toggle';

/** Vitrine interne du design system (non exposée aux utilisateurs finaux). */
@Component({
  selector: 'app-showcase',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Badge, Avatar, Field, Toggle],
  templateUrl: './showcase.html',
})
export class Showcase {
  protected readonly dark = signal(false);
  protected readonly notify = signal(true);

  protected toggleTheme(): void {
    this.dark.update((v) => !v);
    document.documentElement.classList.toggle('dark', this.dark());
  }
}

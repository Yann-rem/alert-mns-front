import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { Avatar } from './ui/avatar/avatar';
import { Badge } from './ui/badge/badge';
import { Button } from './ui/button/button';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Badge, Avatar],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  /** Vitrine du design system : bascule de thème clair/sombre (classe `.dark`). */
  protected readonly dark = signal(false);

  protected toggleTheme(): void {
    this.dark.update((v) => !v);
    document.documentElement.classList.toggle('dark', this.dark());
  }
}

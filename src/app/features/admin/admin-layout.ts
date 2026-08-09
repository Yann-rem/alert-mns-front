import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/**
 * Coquille de l'administration : la navigation entre ses écrans.
 *
 * <p>Membres et groupes partagent un en-tête plutôt que d'être deux destinations
 * du rail principal : l'administration reste une seule entrée pour les rôles qui
 * n'y ont pas accès, et le rail ne grandit pas à chaque écran d'administration
 * ajouté.</p>
 */
@Component({
  selector: 'app-admin-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="flex min-h-0 flex-1 flex-col">
      <nav
        aria-label="Sections de l'administration"
        class="flex shrink-0 gap-1 border-b border-border-default bg-surface-default px-4 md:px-6"
      >
        @for (item of sections; track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="border-accent-solid text-accent-text"
            #active="routerLinkActive"
            [attr.aria-current]="active.isActive ? 'page' : null"
            class="border-b-2 border-transparent px-3 py-2.5 text-label text-text-secondary transition-colors hover:text-text-primary"
          >
            {{ item.label }}
          </a>
        }
      </nav>

      <div class="min-h-0 flex-1 overflow-y-auto">
        <router-outlet />
      </div>
    </div>
  `,
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class AdminLayout {
  protected readonly sections: ReadonlyArray<{ path: string; label: string }> = [
    { path: 'membres', label: 'Membres' },
    { path: 'groupes', label: 'Groupes' },
  ];
}

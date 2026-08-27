import { effect, Injectable, signal } from '@angular/core';

/** Les deux thèmes proposés. Pas de troisième état « système » : voir la note du service. */
export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'alerte.theme';

/**
 * Choix du thème, appliqué au document et retenu d'une visite à l'autre.
 *
 * <p><b>Le mode sombre existait déjà</b> : la feuille de styles définit ses jetons sous la classe
 * `.dark`, et la variante `dark:` de Tailwind est alignée sur cette classe plutôt que sur la
 * préférence système. Il manquait seulement de quoi poser cette classe, ce qui rendait le thème
 * inatteignable depuis l'interface.</p>
 *
 * <p><b>Deux états, pas trois.</b> Un troisième état « suivre le système » aurait demandé de
 * distinguer « clair choisi » de « clair hérité » et d'écouter les changements de préférence en
 * cours de session. La préférence système sert donc de valeur initiale, et le premier clic la
 * remplace définitivement.</p>
 *
 * <p><b>Défensif sur le stockage.</b> `localStorage` lève dans un navigateur qui bloque le stockage
 * local, et `matchMedia` manque à certains environnements de test. Ni l'un ni l'autre ne doit
 * empêcher l'application de démarrer : à défaut, le thème clair s'applique.</p>
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly current = signal<Theme>(initialTheme());

  /** Thème actif, en lecture seule pour les composants. */
  readonly theme = this.current.asReadonly();

  constructor() {
    effect(() => {
      const theme = this.current();
      document.documentElement.classList.toggle('dark', theme === 'dark');
      store(theme);
    });
  }

  toggle(): void {
    this.current.update((theme) => (theme === 'dark' ? 'light' : 'dark'));
  }
}

function initialTheme(): Theme {
  return readStored() ?? (prefersDark() ? 'dark' : 'light');
}

function readStored(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function store(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Stockage indisponible : le thème reste valable pour la session en cours.
  }
}

function prefersDark(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

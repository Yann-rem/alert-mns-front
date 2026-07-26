import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'connexion',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
    title: 'Connexion — Alerte',
  },
  {
    // Chemin imposé par le lien magique construit côté backend
    // (IssueActivationTokenService : frontendBaseUrl + "/activation?token=…").
    path: 'activation',
    loadComponent: () =>
      import('./features/auth/activation/activation').then((m) => m.Activation),
    title: 'Activation — Alerte',
  },
  {
    path: 'messages',
    canActivate: [authGuard],
    loadComponent: () => import('./features/messages/messages').then((m) => m.Messages),
    title: 'Messages — Alerte',
  },
  {
    path: 'design-system',
    loadComponent: () =>
      import('./features/design-system/showcase').then((m) => m.Showcase),
    title: 'Design system — Alerte',
  },
  { path: '', pathMatch: 'full', redirectTo: 'connexion' },
  { path: '**', redirectTo: 'connexion' },
];

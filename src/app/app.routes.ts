import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'connexion',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
    title: 'Connexion — Alerte',
  },
  {
    path: 'messages',
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

import { Routes } from '@angular/router';

import { adminGuard } from './core/auth/admin.guard';
import { authGuard } from './core/auth/auth.guard';
import { broadcastGuard } from './core/auth/broadcast.guard';
import { guestGuard } from './core/auth/guest.guard';

export const routes: Routes = [
  {
    path: 'connexion',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
    title: 'Connexion — Alerte',
  },
  {
    // Chemin imposé par le lien magique construit côté backend
    // (IssueActivationTokenService : frontendBaseUrl + "/activation?token=…").
    path: 'activation',
    loadComponent: () => import('./features/auth/activation/activation').then((m) => m.Activation),
    title: 'Activation — Alerte',
  },
  {
    path: 'design-system',
    loadComponent: () => import('./features/design-system/showcase').then((m) => m.Showcase),
    title: 'Design system — Alerte',
  },
  // Placé avant la coquille : celle-ci matche n'importe quel préfixe, y compris la racine.
  { path: '', pathMatch: 'full', redirectTo: 'connexion' },
  {
    // Écrans authentifiés. L'authentification est portée ici une bonne fois ; les gardes de rôle
    // restent sur leur route et demeurent autonomes (les gardes d'un même tableau sont parallèles).
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/shell/shell').then((m) => m.Shell),
    children: [
      {
        path: 'messages',
        loadComponent: () => import('./features/messages/messages').then((m) => m.Messages),
        title: 'Messages — Alerte',
      },
      {
        // Même composant : la conversation ouverte vit dans l'URL pour rester partageable,
        // et pour que le retour arrière du navigateur referme le fil.
        path: 'messages/:conversationId',
        loadComponent: () => import('./features/messages/messages').then((m) => m.Messages),
        title: 'Messages — Alerte',
      },
      {
        path: 'diffuser',
        canActivate: [broadcastGuard],
        loadComponent: () =>
          import('./features/alerting/broadcast/broadcast-alert').then((m) => m.BroadcastAlert),
        title: 'Diffuser une alerte — Alerte',
      },
      {
        path: 'administration',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/admin/members/admin-members').then((m) => m.AdminMembers),
        title: 'Administration — Alerte',
      },
    ],
  },
  { path: '**', redirectTo: 'connexion' },
];

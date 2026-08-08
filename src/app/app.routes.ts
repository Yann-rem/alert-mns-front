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
    path: 'messages',
    canActivate: [authGuard],
    loadComponent: () => import('./features/messages/messages').then((m) => m.Messages),
    title: 'Messages — Alerte',
  },
  {
    // Même composant : la conversation ouverte vit dans l'URL pour rester partageable,
    // et pour que le retour arrière du navigateur referme le fil.
    path: 'messages/:conversationId',
    canActivate: [authGuard],
    loadComponent: () => import('./features/messages/messages').then((m) => m.Messages),
    title: 'Messages — Alerte',
  },
  {
    path: 'diffuser',
    // broadcastGuard seul, pour les mêmes raisons qu'adminGuard ci-dessous.
    canActivate: [broadcastGuard],
    loadComponent: () =>
      import('./features/alerting/broadcast/broadcast-alert').then((m) => m.BroadcastAlert),
    title: 'Diffuser une alerte — Alerte',
  },
  {
    path: 'administration',
    // adminGuard seul : il couvre déjà l'authentification. Le composer avec
    // authGuard déclencherait deux appels à /me, les gardes étant parallèles.
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/admin/members/admin-members').then((m) => m.AdminMembers),
    title: 'Administration — Alerte',
  },
  {
    path: 'design-system',
    loadComponent: () => import('./features/design-system/showcase').then((m) => m.Showcase),
    title: 'Design system — Alerte',
  },
  { path: '', pathMatch: 'full', redirectTo: 'connexion' },
  { path: '**', redirectTo: 'connexion' },
];

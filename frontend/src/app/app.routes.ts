import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './session/auth-guards';

export const routes: Routes = [
  {
    path: 'design-system',
    loadComponent: () => import('./design-system/design-system'),
    title: 'Design system',
  },
  {
    path: 'logowanie',
    loadComponent: () => import('./account/pages/login-page'),
    canActivate: [guestGuard],
    title: 'Logowanie',
  },
  {
    path: 'rejestracja',
    loadComponent: () => import('./account/pages/register-page'),
    canActivate: [guestGuard],
    title: 'Rejestracja',
  },
  {
    path: 'konto',
    loadComponent: () => import('./account/pages/account-page'),
    canActivate: [authGuard],
    title: 'Moje konto',
  },
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./forecast-map/forecast-map'),
    title: 'Mapa prognozy',
  },
];

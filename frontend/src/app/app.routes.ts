import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'design-system',
    loadComponent: () => import('./design-system/design-system'),
    title: 'Design system',
  },
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./forecast-map/forecast-map'),
    title: 'Mapa prognozy',
  },
];

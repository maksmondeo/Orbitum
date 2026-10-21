import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'design-system',
    loadComponent: () => import('./design-system/design-system'),
    title: 'Design system',
  },
  // Tymczasowo: S-01 zastąpi to stroną z mapą.
  { path: '', pathMatch: 'full', redirectTo: 'design-system' },
];

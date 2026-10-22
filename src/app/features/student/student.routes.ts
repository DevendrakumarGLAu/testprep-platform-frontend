import { Routes } from '@angular/router';
import { Shell } from '../../layout/shell';

export const STUDENT_ROUTES: Routes = [
  {
    // The exam screen is full-screen: no sidebar, so nothing distracts or takes space during a test.
    path: 'attempt/:id',
    loadComponent: () => import('./attempt/attempt').then((m) => m.AttemptPage),
  },
  {
    path: '',
    component: Shell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./dashboard').then((m) => m.StudentDashboard) },
      { path: 'prepare', loadComponent: () => import('./prepare').then((m) => m.Prepare) },
      { path: 'prepare/:id', loadComponent: () => import('./prep-hub').then((m) => m.PrepHub) },
      { path: 'tests', loadComponent: () => import('./tests').then((m) => m.StudentTests) },
      { path: 'tests/:id', loadComponent: () => import('./test-instructions').then((m) => m.TestInstructions) },
      { path: 'results/:id', loadComponent: () => import('./result-page').then((m) => m.StudentResultPage) },
      { path: 'attempts', loadComponent: () => import('./history').then((m) => m.AttemptHistory) },
    ],
  },
];

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
      { path: 'notes', loadComponent: () => import('./notes').then((m) => m.Notes) },
      { path: 'notes/:id', loadComponent: () => import('./notes').then((m) => m.NoteDetail) },
      { path: 'series', loadComponent: () => import('./series').then((m) => m.SeriesList) },
      { path: 'series/:id', loadComponent: () => import('./series').then((m) => m.SeriesDetail) },
      { path: 'notifications', loadComponent: () => import('../notifications/notifications-page').then((m) => m.NotificationsPage) },
      { path: 'saved', loadComponent: () => import('./saved').then((m) => m.Saved) },
      { path: 'revise', loadComponent: () => import('./revise').then((m) => m.Revise) },
      { path: 'practice', loadComponent: () => import('./practice').then((m) => m.Practice) },
      { path: 'attempts', loadComponent: () => import('./history').then((m) => m.AttemptHistory) },
      { path: 'profile', loadComponent: () => import('../profile/profile').then((m) => m.Profile) },
    ],
  },
];

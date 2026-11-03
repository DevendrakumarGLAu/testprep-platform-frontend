import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/password-pages').then((m) => m.ForgotPassword),
  },
  {
    path: 'reset-password/:uid/:token',
    loadComponent: () => import('./features/auth/password-pages').then((m) => m.ResetPassword),
  },
  {
    path: 'verify-email/:token',
    loadComponent: () => import('./features/auth/password-pages').then((m) => m.VerifyEmail),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register').then((m) => m.Register),
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard('admin', 'super_admin')],
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: 'student',
    canActivate: [authGuard, roleGuard('student')],
    loadChildren: () => import('./features/student/student.routes').then((m) => m.STUDENT_ROUTES),
  },
  { path: 'terms', loadComponent: () => import('./features/legal/terms').then((m) => m.Terms) },
  { path: 'privacy', loadComponent: () => import('./features/legal/privacy').then((m) => m.Privacy) },
  { path: 'exam/:id', loadComponent: () => import('./features/landing/exam-page').then((m) => m.PublicExamPage) },
  { path: '', pathMatch: 'full', loadComponent: () => import('./features/landing/landing').then((m) => m.Landing) },
  { path: '**', redirectTo: '' },
];

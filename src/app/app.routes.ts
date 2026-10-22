import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
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
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];

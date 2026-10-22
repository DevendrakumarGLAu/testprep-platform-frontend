import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Role } from './models';

/** Navigation guards only. Real authorization is enforced by the Django API. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isLoggedIn()) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? inject(Router).parseUrl(auth.homeRoute()) : true;
};

export const roleGuard =
  (...roles: Role[]): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    const role = auth.role();
    if (role && roles.includes(role)) return true;
    return inject(Router).parseUrl(auth.isLoggedIn() ? auth.homeRoute() : '/login');
  };

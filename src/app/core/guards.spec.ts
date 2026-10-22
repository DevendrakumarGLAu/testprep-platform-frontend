import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { authGuard, guestGuard, roleGuard } from './guards';
import { Role } from './models';

function setup(role: Role | null) {
  const fake = {
    isLoggedIn: () => role !== null,
    role: () => role ?? undefined,
    homeRoute: () => (role === 'student' ? '/student' : '/admin'),
  };
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthService, useValue: fake }],
  });
}

const run = (guard: any, url = '/admin/users') =>
  TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot));

describe('route guards', () => {
  it('authGuard sends anonymous users to login with a return URL', () => {
    setup(null);
    const result = run(authGuard) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/login?returnUrl=%2Fadmin%2Fusers');
  });

  it('authGuard lets signed-in users through', () => {
    setup('student');
    expect(run(authGuard)).toBe(true);
  });

  it('guestGuard redirects signed-in users to their home', () => {
    setup('student');
    const result = run(guestGuard) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/student');
  });

  it('roleGuard blocks students from admin routes', () => {
    setup('student');
    const result = run(roleGuard('admin', 'super_admin')) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/student');
  });

  it('roleGuard allows a matching role', () => {
    setup('admin');
    expect(run(roleGuard('admin', 'super_admin'))).toBe(true);
  });

  it('roleGuard blocks admins from super-admin-only routes', () => {
    setup('admin');
    expect(run(roleGuard('super_admin'))).not.toBe(true);
  });
});

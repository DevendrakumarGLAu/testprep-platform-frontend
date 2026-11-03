import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { PlatformService } from '../../core/platform.service';
import { Login } from './login';

const CAPTCHA = `${environment.apiUrl}/auth/captcha/`;

function setup(opts: { login?: unknown; captcha?: object; email?: boolean; register?: boolean; returnUrl?: string | null; mustChange?: boolean; phone?: string } = {}) {
  const login = vi.fn(() => opts.login ?? of({}));
  const auth = { login, homeRoute: () => '/student', user: () => ({ must_change_password: !!opts.mustChange }) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthService, useValue: auth },
      { provide: PlatformService, useValue: { info: () => ({ platform_name: 'TestPrep', email_enabled: !!opts.email, allow_registration: opts.register !== false, support_phone: opts.phone ?? '', support_email: '' }) } },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => opts.returnUrl ?? null } } } },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const f = TestBed.createComponent(Login);
  f.detectChanges();
  http.expectOne(CAPTCHA).flush(opts.captcha ?? { enabled: false });
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  const field = (id: string) => el.querySelector(`#${id}`) as HTMLInputElement;
  const type = (id: string, value: string) => {
    const input = field(id);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    f.detectChanges(); // a browser redraws after every keystroke
  };
  const submit = () => {
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    f.detectChanges();
  };
  return { f, el, http, login, nav, field, type, submit };
}

describe('Login', () => {
  it('shows the form and welcomes the person to the platform', () => {
    const { el } = setup();
    expect(el.textContent).toContain('Sign in');
    expect(el.textContent).toContain('Welcome back to TestPrep');
    expect(el.querySelector('#login-username')).not.toBeNull();
    expect(el.querySelector('#login-password')).not.toBeNull();
  });

  it('uses Bootstrap controls, with no Material components left', () => {
    const { el } = setup();
    expect(el.querySelector('.form-control')).not.toBeNull();
    expect(el.querySelector('button[type="submit"].btn.btn-primary')).not.toBeNull();
    expect(el.querySelector('mat-form-field, mat-icon, mat-spinner, [mat-flat-button]')).toBeNull();
    expect(el.classList.contains('bs')).toBe(true);
  });

  it('asks for the missing fields instead of sending the form', () => {
    const { el, login, submit } = setup();
    submit();
    expect(login).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Username or email is required');
    expect(el.textContent).toContain('Password is required');
    expect(el.querySelector('#login-username')!.classList.contains('is-invalid')).toBe(true);
  });

  it('signs in with the trimmed username and goes to the home page of the role', () => {
    const { login, nav, type, submit } = setup();
    type('login-username', '  riya  ');
    type('login-password', 'secret');
    submit();
    expect(login).toHaveBeenCalledWith('riya', 'secret', {});
    expect(nav).toHaveBeenCalledWith('/student');
  });

  it('follows a return address only when it stays inside the area of the role', () => {
    const ok = setup({ returnUrl: '/student/tests' });
    ok.type('login-username', 'a');
    ok.type('login-password', 'b');
    ok.submit();
    expect(ok.nav).toHaveBeenCalledWith('/student/tests');
    TestBed.resetTestingModule();
    const bad = setup({ returnUrl: '/admin/users' });
    bad.type('login-username', 'a');
    bad.type('login-password', 'b');
    bad.submit();
    expect(bad.nav).toHaveBeenCalledWith('/student');
  });

  it('sends a person with a temporary password to change it first', () => {
    const { nav, type, submit } = setup({ mustChange: true });
    type('login-username', 'a');
    type('login-password', 'b');
    submit();
    expect(nav).toHaveBeenCalledWith('/student/profile');
  });

  it('shows why a sign-in failed and gets a new captcha picture', () => {
    const { el, http, f, type, submit } = setup({ login: throwError(() => ({ status: 401 })), captcha: { enabled: true, token: 't', image: 'x' } });
    type('login-username', 'a');
    type('login-password', 'b');
    type('captcha-answer', 'abc12');
    submit();
    expect(el.querySelector('.alert-danger')!.textContent).toContain('Invalid credentials');
    http.expectOne(CAPTCHA).flush({ enabled: true, token: 't2', image: 'y' });
    f.detectChanges();
    expect((el.querySelector('#captcha-answer') as HTMLInputElement).value).toBe(''); // a new picture needs a new answer
  });

  it('does not send the form while the captcha is empty', () => {
    const { el, login, type, submit } = setup({ captcha: { enabled: true, token: 't', image: 'x' } });
    type('login-username', 'a');
    type('login-password', 'b');
    submit();
    expect(login).not.toHaveBeenCalled();
    expect(el.querySelector('.alert-danger')!.textContent).toContain('Type the characters shown in the picture');
  });

  it('shows and hides the password', () => {
    const { f, el, field } = setup();
    expect(field('login-password').type).toBe('password');
    (el.querySelector('.input-group button') as HTMLButtonElement).click();
    f.detectChanges();
    expect(field('login-password').type).toBe('text');
    expect((el.querySelector('.input-group button') as HTMLButtonElement).getAttribute('aria-label')).toBe('Hide password');
  });

  it('links to password reset when email is set up, otherwise tells the person to ask the administrator', () => {
    expect(setup({ email: true }).el.querySelector('a[href="/forgot-password"]')).not.toBeNull();
    TestBed.resetTestingModule();
    const without = setup({ email: false }).el;
    expect(without.querySelector('a[href="/forgot-password"]')).toBeNull();
    expect(without.textContent).toContain('Ask your administrator to reset it');
  });

  it('without email, points to the support phone when one is set, and says so in words', () => {
    const el = setup({ email: false, phone: '+91 98765 43210' }).el;
    expect(el.textContent).toContain('Forgot your password? Contact us');
    expect(el.querySelector('.forgot a.phone')!.getAttribute('href')).toBe('tel:+919876543210');
    expect(el.textContent).not.toContain('Ask your administrator to reset it');
  });

  it('shows links to the terms of use and the privacy policy', () => {
    const el = setup().el;
    expect(el.querySelector('a[href="/terms"]')).not.toBeNull();
    expect(el.querySelector('a[href="/privacy"]')).not.toBeNull();
  });

  it('offers registration only when it is allowed', () => {
    expect(setup({ register: true }).el.querySelector('a[href="/register"]')).not.toBeNull();
    TestBed.resetTestingModule();
    const closed = setup({ register: false }).el;
    expect(closed.querySelector('a[href="/register"]')).toBeNull();
    expect(closed.textContent).toContain('Ask your administrator');
  });
});

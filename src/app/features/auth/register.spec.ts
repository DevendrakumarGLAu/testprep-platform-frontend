import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { NotifyService } from '../../core/notify.service';
import { PlatformService } from '../../core/platform.service';
import { Register } from './register';

const CAPTCHA = `${environment.apiUrl}/auth/captcha/`;

function setup(opts: { register?: unknown; captcha?: object; open?: boolean } = {}) {
  const register = vi.fn(() => opts.register ?? of({}));
  const notify = { success: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthService, useValue: { register } },
      { provide: NotifyService, useValue: notify },
      { provide: PlatformService, useValue: { info: () => ({ platform_name: 'TestPrep', email_enabled: false, allow_registration: opts.open !== false }) } },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const f = TestBed.createComponent(Register);
  f.detectChanges();
  http.expectOne(CAPTCHA).flush(opts.captcha ?? { enabled: false });
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  const type = (id: string, value: string) => {
    const input = el.querySelector(`#${id}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    f.detectChanges(); // a browser redraws after every keystroke
  };
  const submit = () => {
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    f.detectChanges();
  };
  const fillValid = () => {
    type('reg-first', 'Riya');
    type('reg-last', 'Sharma');
    type('reg-username', 'riya');
    type('reg-email', 'riya@example.com');
    type('reg-password', 'longenough1');
    type('reg-confirm', 'longenough1');
  };
  return { f, el, http, register, notify, nav, type, submit, fillValid };
}

describe('Register', () => {
  it('shows the form with Bootstrap controls and no Material components', () => {
    const { el } = setup();
    expect(el.textContent).toContain('Create student account');
    expect(el.querySelectorAll('.form-control').length).toBe(6);
    expect(el.querySelector('button[type="submit"].btn.btn-primary')).not.toBeNull();
    expect(el.querySelector('mat-form-field, mat-error, mat-hint, mat-spinner, [mat-flat-button]')).toBeNull();
    expect(el.classList.contains('bs')).toBe(true);
  });

  it('hides the form and explains when registration is closed', () => {
    const { el } = setup({ open: false });
    expect(el.textContent).toContain('Registration is closed');
    expect((el.querySelector('form') as HTMLFormElement).hidden).toBe(true);
  });

  it('asks for every missing field instead of sending', () => {
    const { el, register, submit } = setup();
    submit();
    expect(register).not.toHaveBeenCalled();
    const messages = Array.from(el.querySelectorAll('.invalid-feedback')).map((m) => m.textContent!.trim());
    expect(messages).toContain('A valid email is required');
    expect(messages).toContain('Password must be at least 8 characters');
    expect(el.querySelector('#reg-first')!.classList.contains('is-invalid')).toBe(true);
  });

  it('shows the password hint, and replaces it with the error (not both) when the password is wrong', () => {
    const { el, type, submit } = setup();
    expect(el.textContent).toContain('At least 8 characters, not too common');
    type('reg-password', 'short');
    submit();
    expect(el.textContent).toContain('Password must be at least 8 characters');
    expect(el.textContent).not.toContain('At least 8 characters, not too common');
  });

  it('rejects an address that is not an email and a password that is too short', () => {
    const { el, type, submit, register } = setup();
    type('reg-first', 'A');
    type('reg-username', 'a');
    type('reg-email', 'not-an-email');
    type('reg-password', 'short');
    type('reg-confirm', 'short');
    submit();
    expect(register).not.toHaveBeenCalled();
    expect(el.querySelector('#reg-email')!.classList.contains('is-invalid')).toBe(true);
    expect(el.querySelector('#reg-password')!.classList.contains('is-invalid')).toBe(true);
  });

  it('says so when the two passwords differ', () => {
    const { el, type, submit, register } = setup();
    type('reg-password', 'longenough1');
    type('reg-confirm', 'longenough2');
    submit();
    expect(register).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Passwords do not match');
  });

  it('creates the account without sending the confirmation, thanks the person and goes to sign in', () => {
    const { register, notify, nav, fillValid, submit } = setup();
    fillValid();
    submit();
    expect(register).toHaveBeenCalledWith({
      first_name: 'Riya', last_name: 'Sharma', username: 'riya', email: 'riya@example.com', password: 'longenough1',
    });
    expect(notify.success).toHaveBeenCalledWith('Account created. Please sign in.');
    expect(nav).toHaveBeenCalledWith('/login');
  });

  it('sends the captcha answer with the account details', () => {
    const { register, fillValid, type, submit } = setup({ captcha: { enabled: true, token: 't', image: 'x' } });
    fillValid();
    type('captcha-answer', 'ab3cd');
    submit();
    expect(register).toHaveBeenCalledWith(expect.objectContaining({ captcha_token: 't', captcha_answer: 'ab3cd', username: 'riya' }));
  });

  it('does not send while the captcha is empty', () => {
    const { el, register, fillValid, submit } = setup({ captcha: { enabled: true, token: 't', image: 'x' } });
    fillValid();
    submit();
    expect(register).not.toHaveBeenCalled();
    expect(el.querySelector('.alert-danger')!.textContent).toContain('Type the characters shown in the picture');
  });

  it('shows the reason the server gave and loads a new captcha picture', () => {
    const { el, http, f, fillValid, type, submit } = setup({
      register: throwError(() => ({ error: { username: ['A user with that username already exists.'] } })),
      captcha: { enabled: true, token: 't', image: 'x' },
    });
    fillValid();
    type('captcha-answer', 'ab3cd');
    submit();
    expect(el.querySelector('.alert-danger')!.textContent).toContain('already exists');
    http.expectOne(CAPTCHA).flush({ enabled: true, token: 't2', image: 'y' });
    f.detectChanges();
    expect((el.querySelector('#captcha-answer') as HTMLInputElement).value).toBe('');
  });

  it('links back to sign in', () => {
    expect(setup().el.querySelector('a[href="/login"]')).not.toBeNull();
  });
});

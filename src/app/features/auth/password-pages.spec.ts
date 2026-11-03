import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { ForgotPassword, ResetPassword, VerifyEmail } from './password-pages';

const AUTH = `${environment.apiUrl}/auth`;

describe('password pages', () => {
  let http: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
  }

  function flushStartup() {
    for (const r of http.match(() => true)) {
      if (r.request.url.endsWith('/auth/captcha/')) r.flush({ enabled: false });
      else if (r.request.url.endsWith('/platform/')) r.flush({ platform_name: 'T', allow_registration: true, support_email: '', email_enabled: true });
    }
  }

  afterEach(() => {
    flushStartup(); // the shared auth layout asks the server about the site
    http.verify();
  });

  it('forgot password sends the email and shows the reply', async () => {
    setup();
    const fixture = TestBed.createComponent(ForgotPassword);
    fixture.detectChanges();
    flushStartup();
    fixture.componentInstance.form.setValue({ email: 'dan@x.com' });
    fixture.componentInstance.send();
    const req = http.expectOne(`${AUTH}/forgot-password/`);
    expect(req.request.body.email).toBe('dan@x.com');
    req.flush({ detail: 'A link has been sent.' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('A link has been sent.');
  });

  it('forgot password will not send an invalid address', () => {
    setup();
    const fixture = TestBed.createComponent(ForgotPassword);
    fixture.detectChanges();
    flushStartup();
    fixture.componentInstance.form.setValue({ email: 'nope' });
    fixture.componentInstance.send();
    http.expectNone(`${AUTH}/forgot-password/`);
  });

  it('reset password posts the link parts and goes to sign in', () => {
    setup();
    const router = TestBed.inject(Router);
    const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ResetPassword);
    fixture.componentRef.setInput('uid', 'u1');
    fixture.componentRef.setInput('token', 't1');
    fixture.detectChanges();
    fixture.componentInstance.form.setValue({ password: 'Br4nd!new-pass', confirm: 'Br4nd!new-pass' });
    fixture.componentInstance.save();
    const req = http.expectOne(`${AUTH}/reset-password/`);
    expect(req.request.body).toEqual({ uid: 'u1', token: 't1', new_password: 'Br4nd!new-pass' });
    req.flush({ detail: 'Changed.' });
    expect(nav).toHaveBeenCalledWith('/login');
  });

  it('reset password refuses mismatched passwords and shows a bad link error', () => {
    setup();
    const fixture = TestBed.createComponent(ResetPassword);
    fixture.componentRef.setInput('uid', 'u1');
    fixture.componentRef.setInput('token', 't1');
    fixture.detectChanges();
    fixture.componentInstance.form.setValue({ password: 'Br4nd!new-pass', confirm: 'different' });
    fixture.componentInstance.save();
    http.expectNone(`${AUTH}/reset-password/`);
    fixture.componentInstance.form.setValue({ password: 'Br4nd!new-pass', confirm: 'Br4nd!new-pass' });
    fixture.componentInstance.save();
    http.expectOne(`${AUTH}/reset-password/`).flush({ detail: 'This link is invalid or has expired.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('invalid or has expired');
  });

  it('verify email confirms straight away', async () => {
    setup();
    const fixture = TestBed.createComponent(VerifyEmail);
    fixture.componentRef.setInput('token', 'tok');
    fixture.detectChanges();
    await Promise.resolve();
    http.expectOne(`${AUTH}/verify-email/`).flush({ detail: 'Your email is confirmed.' });
    fixture.detectChanges();
    expect(fixture.componentInstance.state()).toBe('ok');
    expect(fixture.nativeElement.textContent).toContain('Your email is confirmed.');
  });

  it('verify email shows a failure', async () => {
    setup();
    const fixture = TestBed.createComponent(VerifyEmail);
    fixture.componentRef.setInput('token', 'bad');
    fixture.detectChanges();
    await Promise.resolve();
    http.expectOne(`${AUTH}/verify-email/`).flush({ detail: 'Expired.' }, { status: 400, statusText: 'Bad Request' });
    expect(fixture.componentInstance.state()).toBe('failed');
  });
});

describe('password pages: Bootstrap screens', () => {
  let http: HttpTestingController;

  function setup(emailEnabled = true) {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
    return (fixture: { detectChanges: () => void }) => {
      fixture.detectChanges();
      for (const r of http.match(() => true)) {
        if (r.request.url.endsWith('/auth/captcha/')) r.flush({ enabled: false });
        else if (r.request.url.endsWith('/platform/')) r.flush({ platform_name: 'T', allow_registration: true, support_email: '', email_enabled: emailEnabled });
      }
      fixture.detectChanges();
    };
  }

  const NO_MATERIAL = 'mat-form-field, mat-error, mat-hint, mat-spinner, mat-icon, [mat-flat-button], [mat-stroked-button]';

  afterEach(() => http.match(() => true));

  it('forgot password: Bootstrap controls, an error under a bad address, and the success message', () => {
    const settle = setup();
    const f = TestBed.createComponent(ForgotPassword);
    settle(f);
    const el = f.nativeElement as HTMLElement;
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelector(NO_MATERIAL)).toBeNull();
    expect(el.querySelector('#forgot-email.form-control')).not.toBeNull();
    f.componentInstance.form.setValue({ email: 'nope' });
    f.componentInstance.send();
    f.detectChanges();
    expect(el.querySelector('#forgot-email')!.classList.contains('is-invalid')).toBe(true);
    expect(el.querySelector('.invalid-feedback')!.textContent).toContain('Enter a valid email address');
    f.componentInstance.sent.set('A link has been sent.');
    f.detectChanges();
    expect(el.querySelector('.alert-success')!.textContent).toContain('A link has been sent.');
    expect(el.querySelector('form')).toBeNull();
  });

  it('forgot password: says so when emails are not set up on the site', () => {
    const settle = setup(false);
    const f = TestBed.createComponent(ForgotPassword);
    settle(f);
    expect(f.nativeElement.querySelector('.alert-danger')!.textContent).toContain('Emails are not set up');
  });

  it('forgot password: shows the server error and keeps the form', () => {
    const settle = setup();
    const f = TestBed.createComponent(ForgotPassword);
    settle(f);
    f.componentInstance.form.setValue({ email: 'dan@x.com' });
    f.componentInstance.send();
    http.expectOne(`${AUTH}/forgot-password/`).flush({ detail: 'Too many requests.' }, { status: 429, statusText: 'Too Many' });
    for (const r of http.match(() => true)) r.flush({ enabled: false }); // the captcha is refreshed after a failure
    f.detectChanges();
    expect(f.nativeElement.querySelector('.alert-danger')!.textContent).toContain('Too many requests.');
    expect(f.nativeElement.querySelector('form')).not.toBeNull();
  });

  it('reset password: Bootstrap controls and clear messages for a short or mismatched password', () => {
    const settle = setup();
    const f = TestBed.createComponent(ResetPassword);
    f.componentRef.setInput('uid', 'u1');
    f.componentRef.setInput('token', 't1');
    settle(f);
    const el = f.nativeElement as HTMLElement;
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelector(NO_MATERIAL)).toBeNull();
    expect(el.textContent).toContain('At least 8 characters, not too common');
    f.componentInstance.save();
    f.detectChanges();
    expect(Array.from(el.querySelectorAll('.invalid-feedback')).map((m) => m.textContent!.trim())).toContain('Password must be at least 8 characters');
    expect(el.textContent).not.toContain('At least 8 characters, not too common'); // the error replaces the hint
    f.componentInstance.form.setValue({ password: 'Br4nd!new-pass', confirm: 'different' });
    f.componentInstance.form.controls.confirm.markAsTouched();
    f.detectChanges();
    expect(el.textContent).toContain('Passwords do not match');
  });

  it('reset password: a failed link offers to ask for a new one', () => {
    const settle = setup();
    const f = TestBed.createComponent(ResetPassword);
    f.componentRef.setInput('uid', 'u1');
    f.componentRef.setInput('token', 't1');
    settle(f);
    f.componentInstance.form.setValue({ password: 'Br4nd!new-pass', confirm: 'Br4nd!new-pass' });
    f.componentInstance.save();
    http.expectOne(`${AUTH}/reset-password/`).flush({ detail: 'This link is invalid or has expired.' }, { status: 400, statusText: 'Bad Request' });
    f.detectChanges();
    expect(f.nativeElement.querySelector('.alert-danger')!.textContent).toContain('invalid or has expired');
    expect(f.nativeElement.querySelector('a[href="/forgot-password"]')).not.toBeNull();
  });

  it('verify email: spinner while working, then a Continue button, or an error with a way back', async () => {
    const settle = setup();
    const ok = TestBed.createComponent(VerifyEmail);
    ok.componentRef.setInput('token', 'tok');
    settle(ok);
    expect(ok.nativeElement.classList.contains('bs')).toBe(true);
    expect(ok.nativeElement.querySelector('.spinner-border')).not.toBeNull();
    expect(ok.nativeElement.querySelector(NO_MATERIAL)).toBeNull();
    await Promise.resolve();
    http.expectOne(`${AUTH}/verify-email/`).flush({ detail: 'Your email is confirmed.' });
    ok.detectChanges();
    expect(ok.nativeElement.textContent).toContain('Your email is confirmed.');
    expect(ok.nativeElement.querySelector('a.btn-primary[href="/login"]')).not.toBeNull();
    TestBed.resetTestingModule();
    const settle2 = setup();
    const bad = TestBed.createComponent(VerifyEmail);
    bad.componentRef.setInput('token', 'bad');
    settle2(bad);
    await Promise.resolve();
    http.expectOne(`${AUTH}/verify-email/`).flush({ detail: 'Expired.' }, { status: 400, statusText: 'Bad Request' });
    bad.detectChanges();
    expect(bad.nativeElement.querySelector('.alert-danger')!.textContent).toContain('Expired.');
    expect(bad.nativeElement.querySelector('a[href="/login"]')).not.toBeNull();
  });
});

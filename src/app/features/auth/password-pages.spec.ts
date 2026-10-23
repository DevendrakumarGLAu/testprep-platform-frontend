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

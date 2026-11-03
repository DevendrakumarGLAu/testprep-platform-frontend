import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { NotifyService } from '../../core/notify.service';
import { Profile } from './profile';

const API = environment.apiUrl;
const USER = {
  id: 1, username: 'dan', email: 'dan@x.com', first_name: 'Dan', last_name: 'Old', phone: '9999999999',
  role: 'student', is_active: true, date_joined: '2026-01-05T10:00:00Z',
};

const text = (e: HTMLElement) => e.textContent!.replace(/\s+/g, ' ');

describe('Profile page', () => {
  let http: HttpTestingController;
  let notify: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  async function open() {
    localStorage.clear();
    localStorage.setItem('tp_access', 'A');
    localStorage.setItem('tp_user', JSON.stringify(USER));
    notify = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: NotifyService, useValue: notify }],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Profile);
    fixture.detectChanges();
    http.expectOne(`${API}/auth/captcha/`).flush({ enabled: false });
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => http.verify());

  it('shows the person, their details and read-only username and email', async () => {
    const { el, c } = await open();
    expect(el.querySelector('h1')!.textContent).toBe('Dan Old');
    expect(c.initials()).toBe('DO');
    expect(el.textContent).toContain('Student');
    const disabled = [...el.querySelectorAll<HTMLInputElement>('input[disabled]')].map((i) => i.value);
    expect(disabled).toEqual(['dan', 'dan@x.com']);
    expect(c.details.getRawValue()).toEqual({ first_name: 'Dan', last_name: 'Old', phone: '9999999999', daily_goal_questions: 20, weekly_summary: true });
  });

  it('save is off until something changes, then sends the new details and updates the signed-in user', async () => {
    const { c, fixture } = await open();
    expect((fixture.nativeElement.querySelector('button[type=submit]') as HTMLButtonElement).disabled).toBe(true);
    c.details.patchValue({ first_name: 'Daniel', phone: '+91 98765 43210' });
    c.details.markAsDirty();
    c.saveDetails();
    const req = http.expectOne(`${API}/auth/me/`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ first_name: 'Daniel', last_name: 'Old', phone: '+91 98765 43210', daily_goal_questions: 20, weekly_summary: true });
    req.flush({ ...USER, first_name: 'Daniel', phone: '+91 98765 43210' });
    expect(TestBed.inject(AuthService).user()!.first_name).toBe('Daniel');
    expect(c.fullName()).toBe('Daniel Old');
    expect(notify.success).toHaveBeenCalledWith('Your details were saved.');
    expect(c.details.pristine).toBe(true);
  });

  it('lets a student change the daily goal and the appearance', async () => {
    const { c, el } = await open();
    expect(text(el)).toContain('Daily goal (questions)');
    expect(text(el)).toContain('Appearance');
    c.details.patchValue({ daily_goal_questions: 50 });
    c.details.markAsDirty();
    c.saveDetails();
    const req = http.expectOne(`${API}/auth/me/`);
    expect(req.request.body.daily_goal_questions).toBe(50);
    expect(req.request.body.weekly_summary).toBe(true);
    req.flush({ ...USER, daily_goal_questions: 50 });
    expect(TestBed.inject(AuthService).user()!.daily_goal_questions).toBe(50);
    c.theme.set('dark');
    expect(document.body.style.colorScheme).toBe('dark');
    c.theme.set('light');
  });

  it('does not send an empty first name or a bad phone number', async () => {
    const { c } = await open();
    c.details.patchValue({ first_name: '', phone: 'abc' });
    c.saveDetails();
    http.expectNone(`${API}/auth/me/`);
    expect(c.details.controls.first_name.invalid).toBe(true);
    expect(c.details.controls.phone.hasError('phone')).toBe(true);
  });

  it('shows the server message when saving fails', async () => {
    const { c } = await open();
    c.details.patchValue({ phone: '12345678' });
    c.saveDetails();
    http.expectOne(`${API}/auth/me/`).flush({ phone: ['Enter a valid phone number.'] }, { status: 400, statusText: 'Bad' });
    expect(c.detailsError()).toContain('Enter a valid phone number.');
  });

  it('changes the password, with the confirmation having to match', async () => {
    const { c } = await open();
    c.password.setValue({ old_password: 'old-pass-1', new_password: 'Brand-new-9', confirm: 'different' });
    c.changePassword();
    http.expectNone(`${API}/auth/change-password/`);
    expect(c.password.controls.confirm.hasError('mismatch')).toBe(true);

    c.password.patchValue({ confirm: 'Brand-new-9' });
    c.changePassword();
    const req = http.expectOne(`${API}/auth/change-password/`);
    expect(req.request.body).toEqual({ old_password: 'old-pass-1', new_password: 'Brand-new-9' });
    req.flush({ detail: 'Password updated.' });
    http.expectOne(`${API}/auth/captcha/`).flush({ enabled: false });
    http.expectOne(`${API}/auth/me/`).flush({}); // refreshes the temporary-password flag
    expect(notify.success).toHaveBeenCalledWith('Your password was changed.');
    expect(c.password.getRawValue().old_password).toBe('');
  });

  it('shows why a password change was refused and loads a fresh captcha picture', async () => {
    const { c } = await open();
    c.password.setValue({ old_password: 'wrong', new_password: 'Brand-new-9', confirm: 'Brand-new-9' });
    c.changePassword();
    http.expectOne(`${API}/auth/change-password/`).flush({ old_password: ['Current password is incorrect.'] }, { status: 400, statusText: 'Bad' });
    http.expectOne(`${API}/auth/captcha/`).flush({ enabled: false });
    expect(c.passwordError()).toContain('Current password is incorrect.');
  });
});

describe('Profile page (Bootstrap)', () => {
  async function open() {
    localStorage.clear();
    localStorage.setItem('tp_access', 'A');
    localStorage.setItem('tp_user', JSON.stringify(USER));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: NotifyService, useValue: { success: vi.fn(), error: vi.fn() } }],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Profile);
    fixture.detectChanges();
    http.expectOne(`${API}/auth/captcha/`).flush({ enabled: false });
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('is made of Bootstrap cards and fields with no Material component', async () => {
    const { el } = await open();
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelectorAll('.card').length).toBe(3);
    expect(el.querySelector('select.form-select')).not.toBeNull();
    expect(el.querySelector('input.form-check-input[type="checkbox"]')).not.toBeNull();
    expect(el.querySelector('mat-card, mat-form-field, mat-select, mat-checkbox, mat-button-toggle-group, mat-icon, [mat-flat-button]')).toBeNull();
  });

  it('the appearance buttons show and change the chosen mode', async () => {
    const { fixture, c, el } = await open();
    const buttons = () => Array.from(el.querySelectorAll<HTMLButtonElement>('.btn-group button'));
    buttons().find((b) => b.textContent!.trim() === 'Dark')!.click();
    fixture.detectChanges();
    expect(c.theme.mode()).toBe('dark');
    expect(buttons().filter((b) => b.classList.contains('active')).map((b) => b.textContent!.trim())).toEqual(['Dark']);
    c.theme.set('light');
  });

  it('shows a field error only after the field is touched, and the password hint is replaced by its error', async () => {
    const { fixture, c, el } = await open();
    expect(el.querySelector('.invalid-feedback')).toBeNull();
    c.password.markAllAsTouched();
    c.details.patchValue({ first_name: '' });
    c.details.markAllAsTouched();
    fixture.detectChanges();
    const messages = Array.from(el.querySelectorAll('.invalid-feedback')).map((e) => e.textContent!.trim());
    expect(messages).toContain('First name is required');
    expect(messages).toContain('Enter your current password');
    expect(messages).toContain('Password must be at least 8 characters');
    expect(el.textContent).not.toContain('At least 8 characters, not too common');
  });
});

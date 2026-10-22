import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';

const API = environment.apiUrl;

describe('authInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('tp_access', 'OLD');
    localStorage.setItem('tp_refresh', 'REF');
    localStorage.setItem('tp_user', JSON.stringify({ id: 1, role: 'student', username: 'u' }));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => ctrl.verify());

  it('adds the bearer token to API requests only', () => {
    http.get(`${API}/things/`).subscribe();
    expect(ctrl.expectOne(`${API}/things/`).request.headers.get('Authorization')).toBe('Bearer OLD');
    http.get('https://example.com/other').subscribe();
    expect(ctrl.expectOne('https://example.com/other').request.headers.has('Authorization')).toBe(false);
  });

  it('does not attach a token to login', () => {
    http.post(`${API}/auth/login/`, {}).subscribe();
    expect(ctrl.expectOne(`${API}/auth/login/`).request.headers.has('Authorization')).toBe(false);
  });

  it('on 401 refreshes once and retries the request with the new token', () => {
    let result: unknown;
    http.get(`${API}/things/`).subscribe((r) => (result = r));
    ctrl.expectOne(`${API}/things/`).flush({}, { status: 401, statusText: 'Unauthorized' });

    const refresh = ctrl.expectOne(`${API}/auth/refresh/`);
    expect(refresh.request.body).toEqual({ refresh: 'REF' });
    refresh.flush({ access: 'NEW', refresh: 'REF2' });

    const retry = ctrl.expectOne(`${API}/things/`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer NEW');
    retry.flush({ ok: true });
    expect(result).toEqual({ ok: true });
    expect(auth.refreshToken).toBe('REF2');
  });

  it('several requests failing together share a single refresh call', () => {
    http.get(`${API}/a/`).subscribe();
    http.get(`${API}/b/`).subscribe();
    ctrl.expectOne(`${API}/a/`).flush({}, { status: 401, statusText: 'Unauthorized' });
    ctrl.expectOne(`${API}/b/`).flush({}, { status: 401, statusText: 'Unauthorized' });

    ctrl.expectOne(`${API}/auth/refresh/`).flush({ access: 'NEW', refresh: 'REF2' });
    ctrl.expectOne(`${API}/a/`).flush({});
    ctrl.expectOne(`${API}/b/`).flush({});
  });

  it('signs the user out when the refresh itself fails', () => {
    let error: unknown;
    http.get(`${API}/things/`).subscribe({ error: (e) => (error = e) });
    ctrl.expectOne(`${API}/things/`).flush({}, { status: 401, statusText: 'Unauthorized' });
    ctrl.expectOne(`${API}/auth/refresh/`).flush({}, { status: 401, statusText: 'Unauthorized' });
    ctrl.expectOne(`${API}/auth/logout/`).flush(null, { status: 204, statusText: 'No Content' });

    expect(error).toBeTruthy();
    expect(auth.isLoggedIn()).toBe(false);
  });

  it('signs out without trying to refresh when there is no refresh token', () => {
    localStorage.removeItem('tp_refresh');
    let error: unknown;
    http.get(`${API}/things/`).subscribe({ error: (e) => (error = e) });
    ctrl.expectOne(`${API}/things/`).flush({}, { status: 401, statusText: 'Unauthorized' });
    ctrl.expectNone(`${API}/auth/refresh/`);
    expect(error).toBeTruthy();
    expect(auth.isLoggedIn()).toBe(false);
  });

  it('passes other errors through untouched', () => {
    let status = 0;
    http.get(`${API}/things/`).subscribe({ error: (e) => (status = e.status) });
    ctrl.expectOne(`${API}/things/`).flush({ detail: 'nope' }, { status: 403, statusText: 'Forbidden' });
    expect(status).toBe(403);
    expect(auth.isLoggedIn()).toBe(true);
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

const API = environment.apiUrl;
const USER = { id: 1, username: 'u', email: 'u@x.com', first_name: 'U', last_name: '', phone: '', role: 'student', is_active: true, date_joined: '' };

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('starts signed out', () => {
    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.role()).toBeUndefined();
    expect(auth.homeRoute()).toBe('/login');
  });

  it('login stores tokens and the user, and routes by role', () => {
    auth.login('u', 'pw').subscribe();
    const req = http.expectOne(`${API}/auth/login/`);
    expect(req.request.body).toEqual({ username: 'u', password: 'pw' });
    req.flush({ access: 'A1', refresh: 'R1', user: USER });

    expect(auth.isLoggedIn()).toBe(true);
    expect(auth.accessToken).toBe('A1');
    expect(auth.refreshToken).toBe('R1');
    expect(auth.role()).toBe('student');
    expect(auth.homeRoute()).toBe('/student');
    expect(auth.isAdminRole()).toBe(false);
  });

  it('restores the session from storage on a new instance', () => {
    auth.login('u', 'pw').subscribe();
    http.expectOne(`${API}/auth/login/`).flush({ access: 'A', refresh: 'R', user: { ...USER, role: 'admin' } });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const again = TestBed.inject(AuthService);
    expect(again.isLoggedIn()).toBe(true);
    expect(again.isAdminRole()).toBe(true);
    expect(again.homeRoute()).toBe('/admin');
  });

  it('does not treat a user without a token as signed in', () => {
    localStorage.setItem('tp_user', JSON.stringify(USER));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    expect(TestBed.inject(AuthService).isLoggedIn()).toBe(false);
  });

  it('refresh stores the rotated refresh token', () => {
    auth.login('u', 'pw').subscribe();
    http.expectOne(`${API}/auth/login/`).flush({ access: 'A1', refresh: 'R1', user: USER });
    auth.refresh().subscribe();
    const req = http.expectOne(`${API}/auth/refresh/`);
    expect(req.request.body).toEqual({ refresh: 'R1' });
    req.flush({ access: 'A2', refresh: 'R2' });
    expect(auth.accessToken).toBe('A2');
    expect(auth.refreshToken).toBe('R2');
  });

  it('logout retires the refresh token on the server, clears storage and goes to login', () => {
    auth.login('u', 'pw').subscribe();
    http.expectOne(`${API}/auth/login/`).flush({ access: 'A1', refresh: 'R1', user: USER });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    auth.logout();

    const req = http.expectOne(`${API}/auth/logout/`);
    expect(req.request.body).toEqual({ refresh: 'R1' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(auth.isLoggedIn()).toBe(false);
    expect(localStorage.getItem('tp_access')).toBeNull();
    expect(localStorage.getItem('tp_refresh')).toBeNull();
    expect(localStorage.getItem('tp_user')).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('logout without a session makes no server call', () => {
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    auth.logout();
    http.expectNone(`${API}/auth/logout/`);
  });
});

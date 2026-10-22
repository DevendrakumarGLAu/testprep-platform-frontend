import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { LoginResponse, User, homeRouteFor } from './models';

const ACCESS = 'tp_access';
const REFRESH = 'tp_refresh';
const USER = 'tp_user';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: session lasts until reload */
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private base = `${environment.apiUrl}/auth`;

  private _user = signal<User | null>(this.restoreUser());
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null && !!this.accessToken);
  readonly role = computed(() => this._user()?.role);
  readonly isAdminRole = computed(() => this.role() === 'admin' || this.role() === 'super_admin');

  get accessToken(): string | null {
    return read(ACCESS);
  }
  get refreshToken(): string | null {
    return read(REFRESH);
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.base}/login/`, { username, password }).pipe(
      tap((res) => {
        write(ACCESS, res.access);
        write(REFRESH, res.refresh);
        this.setUser(res.user);
      }),
    );
  }

  register(payload: Record<string, string>): Observable<User> {
    return this.http.post<User>(`${this.base}/register/`, payload);
  }

  refresh(): Observable<{ access: string; refresh?: string }> {
    return this.http
      .post<{ access: string; refresh?: string }>(`${this.base}/refresh/`, { refresh: this.refreshToken })
      .pipe(
        tap((res) => {
          write(ACCESS, res.access);
          if (res.refresh) write(REFRESH, res.refresh);
        }),
      );
  }

  /** Re-validates the stored session with the server (role/status may have changed). */
  loadProfile(): Observable<User> {
    return this.http.get<User>(`${this.base}/me/`).pipe(tap((u) => this.setUser(u)));
  }

  logout(redirect = true) {
    const refresh = this.refreshToken;
    if (refresh) {
      // Best effort: the server blacklists the refresh token so it cannot be replayed.
      this.http.post(`${this.base}/logout/`, { refresh }).subscribe({ error: () => undefined });
    }
    write(ACCESS, null);
    write(REFRESH, null);
    write(USER, null);
    this._user.set(null);
    if (redirect) this.router.navigateByUrl('/login');
  }

  homeRoute(): string {
    return homeRouteFor(this._user()?.role);
  }

  private setUser(u: User) {
    write(USER, JSON.stringify(u));
    this._user.set(u);
  }

  private restoreUser(): User | null {
    const raw = read(USER);
    if (!raw || !read(ACCESS)) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }
}

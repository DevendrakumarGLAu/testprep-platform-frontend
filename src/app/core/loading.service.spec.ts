import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { environment } from '../../environments/environment';
import { loadingInterceptor } from './loading.interceptor';
import { LoadingService } from './loading.service';

describe('LoadingService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows nothing for a request that finishes quickly', () => {
    const l = new LoadingService();
    l.start();
    vi.advanceTimersByTime(100);
    l.stop();
    vi.advanceTimersByTime(2000);
    expect(l.bar()).toBe(false);
    expect(l.overlay()).toBe(false);
  });

  it('shows the bar first and the spinner only for slow requests', () => {
    const l = new LoadingService();
    l.start();
    vi.advanceTimersByTime(200);
    expect([l.bar(), l.overlay()]).toEqual([true, false]);
    vi.advanceTimersByTime(1000);
    expect([l.bar(), l.overlay()]).toEqual([true, true]);
    l.stop();
    expect([l.bar(), l.overlay()]).toEqual([false, false]);
  });

  it('flags a request that takes over 5 seconds as a likely sleeping server, and clears it when done', () => {
    const l = new LoadingService();
    l.start();
    vi.advanceTimersByTime(4_000);
    expect(l.slow()).toBe(false);
    vi.advanceTimersByTime(1_500);
    expect(l.slow()).toBe(true);
    l.stop();
    expect(l.slow()).toBe(false);
  });

  it('stays visible until the last of several requests ends', () => {
    const l = new LoadingService();
    l.start();
    l.start();
    vi.advanceTimersByTime(300);
    l.stop();
    expect(l.bar()).toBe(true);
    l.stop();
    expect(l.bar()).toBe(false);
  });

  it('ignores a stop() it did not start', () => {
    const l = new LoadingService();
    l.stop();
    l.start();
    vi.advanceTimersByTime(300);
    expect(l.bar()).toBe(true);
  });
});

describe('loadingInterceptor', () => {
  let http: HttpClient;
  let ctl: HttpTestingController;
  let loading: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([loadingInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    ctl = TestBed.inject(HttpTestingController);
    loading = TestBed.inject(LoadingService);
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('tracks an API call from start to finish, also when it fails', () => {
    http.get(`${environment.apiUrl}/exams/`).subscribe({ error: () => undefined });
    vi.advanceTimersByTime(200);
    expect(loading.bar()).toBe(true);
    ctl.expectOne(`${environment.apiUrl}/exams/`).flush('x', { status: 500, statusText: 'err' });
    expect(loading.bar()).toBe(false);
  });

  it('does not show the loader for the exam autosave or the captcha picture', () => {
    http.put(`${environment.apiUrl}/student/attempts/a1/answers/`, {}).subscribe();
    http.get(`${environment.apiUrl}/auth/captcha/`).subscribe();
    vi.advanceTimersByTime(2000);
    expect([loading.bar(), loading.overlay()]).toEqual([false, false]);
    ctl.match(() => true).forEach((r) => r.flush({}));
  });

  it('leaves requests to other sites alone', () => {
    http.get('https://example.com/x').subscribe();
    vi.advanceTimersByTime(2000);
    expect(loading.bar()).toBe(false);
    ctl.expectOne('https://example.com/x').flush({});
  });
});

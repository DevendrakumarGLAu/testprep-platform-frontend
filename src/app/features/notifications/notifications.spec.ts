import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { NotificationBell } from '../../layout/notification-bell';
import { AppNotification, NotificationsService } from './notifications.service';
import { NotificationsPage } from './notifications-page';

const API = `${environment.apiUrl}/notifications`;
const note = (id: number, over: Partial<AppNotification> = {}): AppNotification => ({
  id, kind: 'new_test', title: `Title ${id}`, body: '', link: '/student/tests/abc', created_at: '2026-10-20T10:00:00Z', read: false, ...over,
});
const text = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent!.replace(/\s+/g, ' ');

function setup() {
  localStorage.clear();
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  return TestBed.inject(HttpTestingController);
}

describe('NotificationsService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('asks for the unread count straight away and again every minute, but not while the page is hidden', () => {
    const http = setup();
    const svc = TestBed.inject(NotificationsService);
    const stop = svc.startPolling();
    http.expectOne(`${API}/unread-count/`).flush({ unread: 3 });
    expect(svc.unread()).toBe(3);
    vi.advanceTimersByTime(60_000);
    http.expectOne(`${API}/unread-count/`).flush({ unread: 4 });
    expect(svc.unread()).toBe(4);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    vi.advanceTimersByTime(60_000);
    http.expectNone(`${API}/unread-count/`);
    stop();
    vi.advanceTimersByTime(120_000);
    http.expectNone(`${API}/unread-count/`);
  });

  it('marks one message read and lowers the count at once', () => {
    const http = setup();
    const svc = TestBed.inject(NotificationsService);
    svc.load().subscribe();
    http.expectOne(`${API}/`).flush({ unread: 2, results: [note(1), note(2)] });
    svc.markRead([1]).subscribe();
    expect(svc.unread()).toBe(1);
    expect(svc.items().map((n) => n.read)).toEqual([true, false]);
    expect(http.expectOne(`${API}/read/`).request.body).toEqual({ ids: [1] });
  });

  it('marks everything read', () => {
    const http = setup();
    const svc = TestBed.inject(NotificationsService);
    svc.load().subscribe();
    http.expectOne(`${API}/`).flush({ unread: 2, results: [note(1), note(2)] });
    svc.markAllRead().subscribe();
    expect(svc.unread()).toBe(0);
    expect(http.expectOne(`${API}/read/`).request.body).toEqual({ all: true });
  });
});

describe('NotificationBell', () => {
  it('shows the unread count, lists the latest messages when opened and opens the link of the one clicked', () => {
    const http = setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const f = TestBed.createComponent(NotificationBell);
    f.detectChanges();
    http.expectOne(`${API}/unread-count/`).flush({ unread: 2 });
    f.detectChanges();
    expect(f.nativeElement.querySelector('.badge')?.textContent).toContain('2');
    f.componentInstance.opened();
    http.expectOne(`${API}/`).flush({ unread: 2, results: [note(1, { title: 'New test: Mock' }), note(2, { read: true })] });
    const first = f.componentInstance.svc.items()[0];
    f.componentInstance.open(first);
    expect(navigate).toHaveBeenCalledWith('/student/tests/abc');
    expect(http.expectOne(`${API}/read/`).request.body).toEqual({ ids: [1] });
    http.match(`${API}/unread-count/`).forEach((r) => r.flush({ unread: 1 }));
  });

  it('points "See all" to the right area for the role', () => {
    const http = setup();
    localStorage.setItem('tp_access', 'A');
    localStorage.setItem('tp_user', JSON.stringify({ id: 1, username: 'a', email: 'a@x.com', first_name: 'A', last_name: '', phone: '', role: 'admin', is_active: true, date_joined: '' }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const f = TestBed.createComponent(NotificationBell);
    f.detectChanges();
    expect(f.componentInstance.allLink()).toBe('/admin/notifications');
    TestBed.inject(HttpTestingController).match(() => true);
    void http;
  });
});

describe('NotificationsPage', () => {
  it('lists everything, marks unread ones, and says when there is nothing', () => {
    const http = setup();
    const f = TestBed.createComponent(NotificationsPage);
    f.detectChanges();
    http.expectOne(`${API}/`).flush({ unread: 1, results: [note(1, { title: 'Result ready', body: 'See how you did' }), note(2, { read: true, title: 'Old news' })] });
    f.detectChanges();
    expect(text(f)).toContain('Result ready');
    expect(text(f)).toContain('See how you did');
    expect(f.nativeElement.querySelectorAll('.card.unread').length).toBe(1);

    TestBed.resetTestingModule();
    const http2 = setup();
    const empty = TestBed.createComponent(NotificationsPage);
    empty.detectChanges();
    http2.expectOne(`${API}/`).flush({ unread: 0, results: [] });
    empty.detectChanges();
    expect(text(empty)).toContain('all caught up');
  });
});

describe('NotificationBell (Bootstrap)', () => {
  it('opens a panel when the bell is pressed, and closes it on a click elsewhere', () => {
    const http = setup();
    const f = TestBed.createComponent(NotificationBell);
    f.detectChanges();
    http.expectOne(`${API}/unread-count/`).flush({ unread: 0 });
    const el = f.nativeElement as HTMLElement;
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelector('.panel')).toBeNull();
    el.querySelector<HTMLButtonElement>('button.bell')!.click();
    http.expectOne(`${API}/`).flush({ unread: 0, results: [] });
    f.detectChanges();
    expect(el.querySelector('.panel')!.textContent).toContain('You are all caught up.');
    document.body.click();
    f.detectChanges();
    expect(el.querySelector('.panel')).toBeNull();
    expect(el.querySelector('mat-icon, mat-menu, [mat-icon-button]')).toBeNull();
  });
});

describe('NotificationsPage (Bootstrap)', () => {
  it('lists notifications as Bootstrap cards with an icon each', () => {
    const http = setup();
    const f = TestBed.createComponent(NotificationsPage);
    f.detectChanges();
    http.expectOne(`${API}/`).flush({ unread: 1, results: [note(1, { title: 'Result ready' })] });
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.classList.contains('bs')).toBe(true);
    expect(el.querySelector('.card .bi')).not.toBeNull();
    expect(el.querySelector('mat-card, mat-icon, mat-progress-bar, [mat-stroked-button]')).toBeNull();
  });
});

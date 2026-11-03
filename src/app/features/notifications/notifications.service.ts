import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AppNotification {
  id: number;
  kind: 'announcement' | 'new_test' | 'result' | 'reminder' | 'report' | 'weekly';
  title: string;
  body: string;
  link: string;
  created_at: string;
  read: boolean;
}

/** The icon of each kind of notification, as a Bootstrap Icons class. */
export const KIND_BI_ICON: Record<AppNotification['kind'], string> = {
  announcement: 'bi-megaphone',
  new_test: 'bi-clipboard-check',
  result: 'bi-trophy',
  reminder: 'bi-alarm',
  report: 'bi-flag',
  weekly: 'bi-graph-up',
};

const POLL_MS = 60_000;

/** The signed-in person's notifications. The unread count is refreshed every minute while the page is open and visible. */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/notifications`;

  readonly unread = signal(0);
  readonly items = signal<AppNotification[]>([]);
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Starts polling the count (once). Returns a function that stops it. */
  startPolling(): () => void {
    this.refreshCount();
    if (!this.timer) {
      this.timer = setInterval(() => {
        if (typeof document === 'undefined' || document.visibilityState !== 'hidden') this.refreshCount();
      }, POLL_MS);
    }
    return () => {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
    };
  }

  refreshCount() {
    this.http.get<{ unread: number }>(`${this.api}/unread-count/`).subscribe({ next: (r) => this.unread.set(r.unread), error: () => undefined });
  }

  load() {
    return this.http.get<{ unread: number; results: AppNotification[] }>(`${this.api}/`).pipe(
      tap((r) => {
        this.items.set(r.results);
        this.unread.set(r.unread);
      }),
    );
  }

  markRead(ids: number[]) {
    const newlyRead = this.items().filter((i) => ids.includes(i.id) && !i.read).length;
    this.items.update((l) => l.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    this.unread.update((n) => Math.max(0, n - newlyRead));
    return this.http.post<{ marked: number }>(`${this.api}/read/`, { ids }).pipe(tap(() => this.refreshCount()));
  }

  markAllRead() {
    this.items.update((l) => l.map((n) => ({ ...n, read: true })));
    this.unread.set(0);
    return this.http.post<{ marked: number }>(`${this.api}/read/`, { all: true });
  }
}

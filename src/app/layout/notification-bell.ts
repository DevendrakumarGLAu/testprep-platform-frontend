import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { AppNotification, KIND_ICON, NotificationsService } from '../features/notifications/notifications.service';

/** The bell in the top bar: how many messages are unread, and the latest ones in a menu. */
@Component({
  selector: 'app-notification-bell',
  imports: [DatePipe, RouterLink, MatBadgeModule, MatButtonModule, MatIconModule, MatMenuModule],
  styles: `
    .panel { width: min(380px, 92vw); max-height: 70vh; overflow-y: auto; }
    .top { display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; position: sticky; top: 0; background: var(--mat-sys-surface-container); }
    .item { display: flex; gap: 12px; padding: 10px 16px; cursor: pointer; border-bottom: 1px solid var(--mat-sys-outline-variant); text-align: left; background: none; border-left: 0; border-right: 0; border-top: 0; width: 100%; color: inherit; font: inherit; }
    .item:hover { background: var(--mat-sys-surface-container-high); }
    .item.unread { background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent); }
    .item mat-icon { color: var(--mat-sys-primary); flex: none; }
    .t { font-weight: 500; }
    .b, .d { color: var(--mat-sys-on-surface-variant); font-size: 0.85em; }
    .empty { padding: 24px 16px; text-align: center; color: var(--mat-sys-on-surface-variant); }
    .all { display: block; text-align: center; padding: 10px; }
  `,
  template: `
    <button mat-icon-button [matMenuTriggerFor]="menu" (menuOpened)="opened()" [attr.aria-label]="'Notifications, ' + svc.unread() + ' unread'">
      <mat-icon [matBadge]="svc.unread() || null" matBadgeSize="small" matBadgeColor="warn" [matBadgeHidden]="!svc.unread()">notifications</mat-icon>
    </button>
    <mat-menu #menu="matMenu" class="notification-menu" xPosition="before">
      <div class="panel" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()" role="presentation">
        <div class="top">
          <strong>Notifications</strong>
          <button mat-button (click)="readAll()" [disabled]="!svc.unread()">Mark all as read</button>
        </div>
        @for (n of svc.items(); track n.id) {
          <button class="item" [class.unread]="!n.read" (click)="open(n)">
            <mat-icon>{{ icon(n) }}</mat-icon>
            <span>
              <span class="t">{{ n.title }}</span>
              @if (n.body) { <span class="b"><br />{{ n.body }}</span> }
              <span class="d"><br />{{ n.created_at | date: 'MMM d, h:mm a' }}</span>
            </span>
          </button>
        } @empty { <div class="empty">You are all caught up.</div> }
        <a class="all" mat-button [routerLink]="allLink()">See all</a>
      </div>
    </mat-menu>
  `,
})
export class NotificationBell {
  svc = inject(NotificationsService);
  private router = inject(Router);
  private auth = inject(AuthService);

  allLink = computed(() => (this.auth.role() === 'student' ? '/student/notifications' : '/admin/notifications'));

  constructor() {
    inject(DestroyRef).onDestroy(this.svc.startPolling());
  }

  icon = (n: AppNotification) => KIND_ICON[n.kind] ?? 'notifications';

  opened() {
    this.svc.load().subscribe({ error: () => undefined });
  }

  readAll() {
    this.svc.markAllRead().subscribe({ error: () => undefined });
  }

  open(n: AppNotification) {
    if (!n.read) this.svc.markRead([n.id]).subscribe({ error: () => undefined });
    if (n.link) this.router.navigateByUrl(n.link);
  }
}

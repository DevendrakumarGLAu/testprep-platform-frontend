import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import { AppNotification, KIND_ICON, NotificationsService } from './notifications.service';

/** All of the person's notifications on one page (the bell shows only the latest). Used by students and admins. */
@Component({
  selector: 'app-notifications-page',
  imports: [DatePipe, MatButtonModule, MatCardModule, MatIconModule, MatProgressBarModule],
  styles: `
    :host { display: block; max-width: 760px; }
    .head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
    mat-card { margin-bottom: 8px; }
    .row { display: flex; gap: 14px; align-items: flex-start; cursor: pointer; }
    .row mat-icon { color: var(--mat-sys-primary); margin-top: 2px; }
    .unread { border-left: 4px solid var(--mat-sys-primary); }
    .t { font-weight: 500; }
    .muted { color: var(--mat-sys-on-surface-variant); font-size: 0.9em; }
  `,
  template: `
    <div class="head">
      <h1>Notifications</h1>
      <button mat-stroked-button (click)="readAll()" [disabled]="!svc.unread()">Mark all as read</button>
    </div>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    @for (n of svc.items(); track n.id) {
      <mat-card appearance="outlined" [class.unread]="!n.read">
        <mat-card-content>
          <div class="row" (click)="open(n)" (keydown.enter)="open(n)" tabindex="0" role="button">
            <mat-icon>{{ icon(n) }}</mat-icon>
            <div>
              <div class="t">{{ n.title }}</div>
              @if (n.body) { <div>{{ n.body }}</div> }
              <div class="muted">{{ n.created_at | date: 'medium' }}</div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    } @empty {
      @if (!loading()) { <mat-card appearance="outlined"><mat-card-content>You are all caught up.</mat-card-content></mat-card> }
    }
  `,
})
export class NotificationsPage {
  svc = inject(NotificationsService);
  private router = inject(Router);
  loading = signal(true);

  constructor() {
    this.svc.load().subscribe({ next: () => this.loading.set(false), error: () => this.loading.set(false) });
  }

  icon = (n: AppNotification) => KIND_ICON[n.kind] ?? 'notifications';

  readAll() {
    this.svc.markAllRead().subscribe({ error: () => undefined });
  }

  open(n: AppNotification) {
    if (!n.read) this.svc.markRead([n.id]).subscribe({ error: () => undefined });
    if (n.link) this.router.navigateByUrl(n.link);
  }
}

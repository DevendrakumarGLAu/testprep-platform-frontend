import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppNotification, KIND_BI_ICON, NotificationsService } from './notifications.service';

/** All of the person's notifications on one page (the bell shows only the latest). Used by students and admins. */
@Component({
  selector: 'app-notifications-page',
  imports: [DatePipe],
  templateUrl: './notifications-page.html',
  styleUrl: './notifications-page.scss',
  host: { class: 'bs' },
})
export class NotificationsPage {
  svc = inject(NotificationsService);
  private router = inject(Router);
  loading = signal(true);

  constructor() {
    this.svc.load().subscribe({ next: () => this.loading.set(false), error: () => this.loading.set(false) });
  }

  icon = (n: AppNotification) => KIND_BI_ICON[n.kind] ?? 'bi-bell';

  readAll() {
    this.svc.markAllRead().subscribe({ error: () => undefined });
  }

  open(n: AppNotification) {
    if (!n.read) this.svc.markRead([n.id]).subscribe({ error: () => undefined });
    if (n.link) this.router.navigateByUrl(n.link);
  }
}

import { DatePipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { AppNotification, KIND_BI_ICON, NotificationsService } from '../features/notifications/notifications.service';

/** The bell in the top bar: how many messages are unread, and the latest ones in a menu. */
@Component({
  selector: 'app-notification-bell',
  imports: [DatePipe, RouterLink],
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.scss',
  host: { class: 'bs' },
})
export class NotificationBell {
  svc = inject(NotificationsService);
  private router = inject(Router);
  private auth = inject(AuthService);

  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  isOpen = signal(false);

  allLink = computed(() => (this.auth.role() === 'student' ? '/student/notifications' : '/admin/notifications'));

  constructor() {
    inject(DestroyRef).onDestroy(this.svc.startPolling());
  }

  icon = (n: AppNotification) => KIND_BI_ICON[n.kind] ?? 'bi-bell';

  toggle() {
    this.isOpen.update((v) => !v);
    if (this.isOpen()) this.opened();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent) {
    if (this.isOpen() && !this.host.nativeElement.contains(event.target as Node)) this.isOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape() {
    this.isOpen.set(false);
  }

  opened() {
    this.svc.load().subscribe({ error: () => undefined });
  }

  readAll() {
    this.svc.markAllRead().subscribe({ error: () => undefined });
  }

  open(n: AppNotification) {
    if (!n.read) this.svc.markRead([n.id]).subscribe({ error: () => undefined });
    this.isOpen.set(false);
    if (n.link) this.router.navigateByUrl(n.link);
  }
}

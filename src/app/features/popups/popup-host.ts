import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BsModal } from '../coach/bs-modal/bs-modal';
import { PopupService, StudentPopup } from './popups.service';

/**
 * Shows the announcement waiting for the signed-in student, one at a time. Closing it, or using its button, marks it seen so it
 * does not come back; then the next one (if any) follows. A failed request just means no pop-up.
 */
@Component({
  selector: 'app-popup-host',
  imports: [BsModal],
  templateUrl: './popup-host.html',
  styleUrl: './popup-host.scss',
})
export class PopupHost {
  private api = inject(PopupService);
  private router = inject(Router);
  popup = signal<StudentPopup | null>(null);

  constructor() {
    this.next();
  }

  private next() {
    this.api.pending().subscribe({
      next: (r) => this.popup.set(r.popup),
      error: () => this.popup.set(null),
    });
  }

  dismiss() {
    const p = this.popup();
    if (!p) return;
    this.popup.set(null);
    this.api.markSeen(p.id).subscribe({ next: () => this.next(), error: () => undefined });
  }

  open() {
    const p = this.popup();
    if (!p) return;
    this.dismiss();
    if (p.link.startsWith('/')) void this.router.navigateByUrl(p.link);
    else window.open(p.link, '_blank', 'noopener');
  }
}

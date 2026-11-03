import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'warning' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** The label of the button that closes it. */
  action: string;
}

/** Short messages shown by the Toasts component in the top-right corner, where they do not cover the exam or the page's own buttons. */
@Injectable({ providedIn: 'root' })
export class NotifyService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  success(msg: string) {
    this.show('success', msg, 'OK', 3500);
  }

  /** A heads-up that stays long enough to be read, such as the time warnings in an exam. */
  warning(msg: string) {
    this.show('warning', msg, 'OK', 8000);
  }

  error(msg: string) {
    this.show('error', msg, 'Dismiss', 6000);
  }

  dismiss(id: number) {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private show(kind: ToastKind, message: string, action: string, ms: number) {
    const id = this.nextId++;
    // A newer message replaces the one before it, as the old snack bar did, so they never pile up.
    this.toasts.set([{ id, kind, message, action }]);
    setTimeout(() => this.dismiss(id), ms);
  }
}

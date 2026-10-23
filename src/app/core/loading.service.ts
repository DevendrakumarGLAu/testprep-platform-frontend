import { Injectable, signal } from '@angular/core';

const BAR_AFTER_MS = 150;
const OVERLAY_AFTER_MS = 900;
const SLOW_AFTER_MS = 5000;

/**
 * Counts the requests in flight. A thin bar appears for anything slower than a blink, and a spinner over the page for the
 * slow ones (imports, big saves), which also stops a second click on the same button. Fast requests show nothing at all.
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  readonly bar = signal(false);
  readonly overlay = signal(false);
  /** True when something has taken over 5 seconds: on free hosting that usually means the server was asleep and is starting. */
  readonly slow = signal(false);

  private pending = 0;
  private barTimer: ReturnType<typeof setTimeout> | null = null;
  private overlayTimer: ReturnType<typeof setTimeout> | null = null;
  private slowTimer: ReturnType<typeof setTimeout> | null = null;

  start() {
    if (this.pending++ > 0) return;
    this.barTimer = setTimeout(() => this.bar.set(true), BAR_AFTER_MS);
    this.overlayTimer = setTimeout(() => this.overlay.set(true), OVERLAY_AFTER_MS);
    this.slowTimer = setTimeout(() => this.slow.set(true), SLOW_AFTER_MS);
  }

  stop() {
    if (this.pending === 0 || --this.pending > 0) return;
    if (this.barTimer) clearTimeout(this.barTimer);
    if (this.overlayTimer) clearTimeout(this.overlayTimer);
    if (this.slowTimer) clearTimeout(this.slowTimer);
    this.barTimer = this.overlayTimer = this.slowTimer = null;
    this.bar.set(false);
    this.overlay.set(false);
    this.slow.set(false);
  }
}

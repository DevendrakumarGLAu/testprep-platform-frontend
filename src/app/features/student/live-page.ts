import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { NotifyService } from '../../core/notify.service';
import { countdown } from '../../shared/countdown';
import { LiveExam } from './student.models';
import { StudentService } from './student.service';

/**
 * The page behind a live test's share link (/student/live/<id>). Only signed-in students get here: anyone else is sent to log in first
 * and brought back. It counts down to the start by the server's clock and leads to the test page; the questions are never on it.
 */
@Component({
  selector: 'app-live-page',
  imports: [DatePipe, RouterLink],
  templateUrl: './live-page.html',
  styleUrl: './live-page.scss',
  host: { class: 'bs' },
})
export class LivePage {
  id = input.required<string>();
  private api = inject(StudentService);
  private notify = inject(NotifyService);
  private router = inject(Router);
  private title = inject(Title);

  loading = signal(true);
  t = signal<LiveExam | null>(null);

  // The countdown runs on the server's clock: the browser only counts the seconds between syncs.
  private offsetMs = 0;
  private now = signal(Date.now());
  private serverMs = computed(() => this.now() + this.offsetMs);

  untilStart = computed(() => countdown((this.ms('start_at') - this.serverMs()) / 1000));
  untilClose = computed(() => countdown((this.ms('join_closes_at') - this.serverMs()) / 1000));

  /** What the test is doing right now, worked out from the times so it changes by itself without asking the server. */
  state = computed<'upcoming' | 'live' | 'joining_closed' | 'ended'>(() => {
    const e = this.t();
    if (!e) return 'ended';
    const now = this.serverMs();
    if (now < this.ms('start_at')) return 'upcoming';
    if (now <= this.ms('join_closes_at')) return 'live';
    return e.ends_at && now <= new Date(e.ends_at).getTime() ? 'joining_closed' : 'ended';
  });

  constructor() {
    const tick = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
    effect(() => {
      this.id();
      untracked(() => this.load());
    });
  }

  private load() {
    this.loading.set(true);
    this.api.live(this.id()).subscribe({
      next: (e) => {
        this.offsetMs = new Date(e.server_now).getTime() - Date.now();
        this.now.set(Date.now());
        this.t.set(e);
        this.title.setTitle(`${e.title} (live test)`);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        // A test the student may not see looks exactly like one that does not exist.
        this.notify.error(err.status === 404 ? 'This live test is not available to you.' : 'Could not open the live test.');
        this.router.navigateByUrl('/student/tests');
      },
    });
  }

  private ms(key: 'start_at' | 'join_closes_at'): number {
    const e = this.t();
    const v = e?.[key];
    return v ? new Date(v).getTime() : 0;
  }
}

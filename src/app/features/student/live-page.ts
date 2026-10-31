import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
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
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule],
  styles: `
    :host { display: block; max-width: 760px; }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 3px 12px; border-radius: 999px; font-weight: 700; font-size: 0.8rem; letter-spacing: 0.04em; background: var(--mat-sys-error-container); color: var(--mat-sys-on-error-container); }
    .badge.upcoming { background: var(--mat-sys-secondary-container); color: var(--mat-sys-on-secondary-container); }
    .badge.over { background: var(--mat-sys-surface-container-highest); color: var(--mat-sys-on-surface-variant); }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; animation: pulse 1.2s infinite; }
    @keyframes pulse { 50% { opacity: 0.25; } }
    h1 { font-size: clamp(1.6rem, 4vw, 2.3rem); margin: 12px 0 4px; }
    .crumb { color: var(--mat-sys-on-surface-variant); }
    .clock { margin: 20px 0; padding: 20px; border-radius: 20px; text-align: center; color: #fff; background: var(--tp-gradient, var(--mat-sys-primary)); }
    .clock .big { font-size: clamp(2rem, 8vw, 3.2rem); font-weight: 800; letter-spacing: 0.02em; font-variant-numeric: tabular-nums; }
    .clock .small { opacity: 0.9; }
    .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 16px 0; }
    .fact { padding: 10px 14px; border-radius: 14px; background: var(--mat-sys-surface-container-high); font-weight: 600; }
    .fact span { display: block; color: var(--mat-sys-on-surface-variant); font-weight: 400; font-size: 0.85em; }
    .cta { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
    .note { color: var(--mat-sys-on-surface-variant); margin: 14px 0 0; font-size: 0.92em; }
  `,
  template: `
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    @if (t(); as e) {
      <span class="badge" [class.upcoming]="state() === 'upcoming'" [class.over]="state() === 'joining_closed' || state() === 'ended'">
        @if (state() === 'live') { <span class="dot"></span> }
        {{ state() === 'live' ? 'LIVE NOW' : state() === 'upcoming' ? 'LIVE TEST' : 'LIVE TEST OVER' }}
      </span>
      <h1>{{ e.title }}</h1>
      @if (e.category_name) { <div class="crumb">{{ e.family ? e.family + ' › ' : '' }}{{ e.category_name }}</div> }
      @if (e.description) { <p>{{ e.description }}</p> }

      <div class="clock" role="timer" aria-live="off">
        @switch (state()) {
          @case ('upcoming') {
            <div class="small">Starts in</div>
            <div class="big">{{ untilStart() }}</div>
            <div class="small">{{ e.start_at | date: 'EEEE, d MMM y, h:mm a' }}</div>
          }
          @case ('live') {
            <div class="small">The test is on. You can still join for</div>
            <div class="big">{{ untilClose() }}</div>
            <div class="small">It ends for everyone at {{ e.ends_at | date: 'h:mm a' }}</div>
          }
          @case ('joining_closed') {
            <div class="big">Joining has closed</div>
            <div class="small">The test is still running for those who joined.</div>
          }
          @default {
            <div class="big">This live test has ended</div>
          }
        }
      </div>

      <div class="facts">
        <div class="fact"><span>Duration</span>{{ e.duration_minutes }} minutes</div>
        <div class="fact"><span>Questions</span>{{ e.question_count }}</div>
        <div class="fact"><span>Total marks</span>{{ e.total_marks }}</div>
        <div class="fact"><span>Negative marking</span>{{ e.negative_marking_enabled ? 'Yes' : 'No' }}</div>
      </div>

      <div class="cta">
        @if (e.status === 'in_progress') {
          <a mat-flat-button [routerLink]="['/student/tests', e.id]"><mat-icon>play_arrow</mat-icon> Resume your attempt</a>
        } @else if (e.last_attempt_id && e.result_available) {
          <a mat-flat-button [routerLink]="['/student/results', e.last_attempt_id]"><mat-icon>assessment</mat-icon> View your result</a>
        } @else if (state() === 'live' && e.can_start) {
          <a mat-flat-button [routerLink]="['/student/tests', e.id]">Join now</a>
        } @else if (state() === 'upcoming') {
          <a mat-flat-button [routerLink]="['/student/tests', e.id]">Open the test page</a>
        }
        <a mat-stroked-button routerLink="/student/tests">All tests</a>
      </div>
      @if (state() === 'upcoming' || state() === 'live') {
        <p class="note">
          Everyone starts together and finishes together{{ e.late_join_minutes ? ', and you can join up to ' + e.late_join_minutes + ' minutes late (you then get the time that is left)' : '' }}.
          The test page opens by itself when the time comes, so you can wait there.
        </p>
      }
    }
  `,
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

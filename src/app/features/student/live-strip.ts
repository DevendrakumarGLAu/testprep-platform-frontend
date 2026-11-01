import { DatePipe } from '@angular/common';
import { Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { countdown } from '../../shared/countdown';
import { StudentExam } from './student.models';
import { StudentService } from './student.service';

/**
 * Live tests that have not finished yet, soonest first, with a countdown and a button to join. They sit in their own "Live tests" tab
 * (on the Tests page for all exams, and on an exam's page for just that exam), so a long list never pushes the exams down. Given
 * `list` it shows that; otherwise it loads the list itself. Without `inTab` it shows nothing when there is no live test.
 */
@Component({
  selector: 'app-live-strip',
  imports: [DatePipe, RouterLink, MatButtonModule, MatCardModule],
  styles: `
    :host { display: block; }
    section { margin: 8px 0 20px; }
    h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; font-size: 1.1rem; }
    .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--mat-sys-error); animation: pulse 1.2s infinite; }
    @keyframes pulse { 50% { opacity: 0.25; } }
    .list { display: grid; gap: 10px; }
    mat-card { border-left: 4px solid var(--mat-sys-error); }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 12px 16px; }
    .meta { color: var(--mat-sys-on-surface-variant); font-size: 0.9em; }
    .when { font-weight: 700; font-variant-numeric: tabular-nums; }
    .when.now { color: var(--mat-sys-error); }
    .empty { padding: 16px 0; color: var(--mat-sys-on-surface-variant); }
  `,
  template: `
    @if (inTab() && !items().length) {
      <p class="empty">No live tests right now. They will appear here.</p>
    }
    @if (items().length) {
      <section aria-label="Live tests">
        @if (!inTab()) { <h2><span class="dot"></span> Live tests</h2> }
        <div class="list">
          @for (e of items(); track e.id) {
            <mat-card appearance="outlined" class="live-card">
              <div class="row">
                <div>
                  <strong>{{ e.title }}</strong>
                  <div class="meta">
                    {{ e.category_name ? e.category_name + ' · ' : '' }}{{ e.start_at | date: 'EEE, d MMM, h:mm a' }} · {{ e.duration_minutes }} min
                  </div>
                </div>
                <div class="when" [class.now]="phase(e) === 'live'">{{ when(e) }}</div>
                <a mat-flat-button [routerLink]="['/student/tests', e.id]">{{ action(e) }}</a>
              </div>
            </mat-card>
          }
        </div>
      </section>
    }
  `,
})
export class LiveStrip {
  /** Only live tests of this exam (public id). Empty = every exam. */
  category = input<string>();
  /** The live tests to show, when the page already has them. Empty or missing: the strip loads them. */
  list = input<StudentExam[] | null>(null);
  /** Shown inside a tab: no heading of its own, and it says so when there is nothing. */
  inTab = input(false);
  private api = inject(StudentService);

  items = signal<StudentExam[]>([]);
  private now = signal(Date.now());

  constructor() {
    const tick = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
    effect(() => {
      const given = this.list();
      if (given) return this.items.set(given);
      const category = this.category();
      untracked(() => this.api.exams({ live: 1, category: category ?? null }).subscribe({ next: (l) => this.items.set(l), error: () => this.items.set([]) }));
    });
  }

  phase(e: StudentExam): 'upcoming' | 'live' | 'closed' {
    const now = this.now();
    if (e.start_at && now < new Date(e.start_at).getTime()) return 'upcoming';
    if (e.join_closes_at && now <= new Date(e.join_closes_at).getTime()) return 'live';
    return 'closed';
  }

  when(e: StudentExam): string {
    if (e.status === 'in_progress') return 'You are in this test';
    if (e.status === 'completed') return 'Done';
    const p = this.phase(e);
    if (p === 'upcoming') return `Starts in ${countdown((new Date(e.start_at!).getTime() - this.now()) / 1000)}`;
    return p === 'live' ? 'Live now' : 'Joining closed';
  }

  action(e: StudentExam): string {
    if (e.status === 'in_progress') return 'Resume';
    if (e.status === 'completed') return 'Details';
    return this.phase(e) === 'live' ? 'Join now' : 'Open';
  }
}

import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { ActivityCards } from './activity-cards';
import { LiveStrip } from './live-strip';
import { WeeklyCard } from './weekly-card';
import { Dashboard } from './student.models';
import { StudentService } from './student.service';
import { TestCard } from './test-card';

/** Circumference of the progress rings (radius 52 in a 120 x 120 box). */
const RING = 2 * Math.PI * 52;

type Preparing = Dashboard['preparing'][number];

@Component({
  selector: 'app-student-dashboard',
  imports: [DatePipe, RouterLink, MatCardModule, MatIconModule, MatButtonModule, MatProgressBarModule, TestCard, ActivityCards, WeeklyCard, LiveStrip],
  styleUrl: './dashboard.scss',
  template: `
    <header class="hero">
      <div class="hero-text">
        <p class="eyebrow">{{ today | date: 'EEEE, d MMMM' }}</p>
        <h1>{{ greeting() }}, {{ name() }}</h1>
        <p class="sub">{{ subtitle() }}</p>
        <div class="hero-actions">
          <a mat-flat-button class="on-hero" [routerLink]="primary().link" [queryParams]="primary().query">
            <mat-icon>{{ primary().icon }}</mat-icon> {{ primary().label }}
          </a>
          <a mat-stroked-button class="ghost" routerLink="/student/practice">Practise weak topics</a>
        </div>
      </div>
      @if (d(); as d) {
        <div class="hero-side">
          <div class="ring" role="img" [attr.aria-label]="d.activity.today + ' of ' + d.activity.goal + ' questions answered today'">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r="52" class="track" />
              <circle cx="60" cy="60" r="52" class="progress" [attr.stroke-dasharray]="ring" [attr.stroke-dashoffset]="goalOffset()" />
            </svg>
            <div class="ring-text"><strong>{{ d.activity.today }}</strong><span>of {{ d.activity.goal }}</span></div>
          </div>
          <div class="side-meta">
            <span class="streak"><mat-icon>local_fire_department</mat-icon> {{ d.activity.streak ? d.activity.streak + '-day streak' : 'Start a streak today' }}</span>
            <span class="goal-note">{{ d.activity.goal_reached ? 'Goal reached' : "Today's goal" }}</span>
          </div>
        </div>
      }
    </header>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

    <app-live-strip />

    @if (d(); as d) {
      @if (d.in_progress.length) {
        <section class="block" aria-label="Tests in progress">
          <h2>Continue where you left off</h2>
          <div class="resume-list">
            @for (e of d.in_progress; track e.id) {
              <a class="resume" [routerLink]="['/student/tests', e.id]">
                <mat-icon class="play">play_circle</mat-icon>
                <span class="resume-text">
                  <strong>{{ e.title }}</strong>
                  <span class="muted">{{ e.category_name || 'Mock test' }} · {{ e.duration_minutes }} min</span>
                </span>
                <span class="go">Resume <mat-icon>arrow_forward</mat-icon></span>
              </a>
            }
          </div>
        </section>
      }

      <div class="kpis">
        <div class="kpi done"><mat-icon>task_alt</mat-icon>
          <div><div class="value">{{ d.counts.completed }}</div><div class="label">Tests completed</div></div></div>
        <div class="kpi score"><mat-icon>percent</mat-icon>
          <div><div class="value">{{ d.average_score_percent === null ? '—' : d.average_score_percent + '%' }}</div><div class="label">Average score</div></div></div>
        <div class="kpi acc"><mat-icon>gps_fixed</mat-icon>
          <div><div class="value">{{ d.accuracy_percent === null ? '—' : d.accuracy_percent + '%' }}</div><div class="label">Accuracy</div></div></div>
        <div class="kpi open"><mat-icon>assignment</mat-icon>
          <div>
            <div class="value">{{ d.counts.available }}</div>
            <div class="label">Tests to take</div>
            @if (d.counts.in_progress || d.counts.upcoming) {
              <div class="sublabel">{{ d.counts.in_progress }} in progress · {{ d.counts.upcoming }} upcoming</div>
            }
          </div>
        </div>
      </div>

      <section class="block" aria-label="Your exams">
        <div class="block-head">
          <h2>Your exams</h2>
          <a mat-button routerLink="/student/prepare">{{ d.preparing.length ? 'Change exams' : 'Browse exams' }}</a>
        </div>
        @if (d.preparing.length) {
          <div class="exams">
            @for (p of d.preparing; track p.id) {
              <mat-card appearance="outlined" class="exam">
                <mat-card-content>
                  <div class="mini-ring" role="img" [attr.aria-label]="percent(p) + ' percent of tests attempted'">
                    <svg viewBox="0 0 120 120" aria-hidden="true">
                      <circle cx="60" cy="60" r="52" class="track" />
                      <circle cx="60" cy="60" r="52" class="progress" [attr.stroke-dasharray]="ring" [attr.stroke-dashoffset]="offset(percent(p))" />
                    </svg>
                    <span>{{ percent(p) }}%</span>
                  </div>
                  <div class="exam-text">
                    @if (p.group) { <div class="family">{{ p.group.name }}</div> }
                    <h3>{{ p.name }}</h3>
                    <p class="muted">{{ p.attempted_tests }} of {{ p.total_tests }} tests attempted</p>
                  </div>
                </mat-card-content>
                <mat-card-actions>
                  @if (p.group) {
                    <a mat-flat-button [routerLink]="['/student/tests/family', p.group.id]" [queryParams]="{ exam: p.id }">Open tests</a>
                  } @else {
                    <a mat-flat-button [routerLink]="['/student/tests/exam', p.id]">Open tests</a>
                  }
                </mat-card-actions>
              </mat-card>
            }
          </div>
        } @else {
          <mat-card appearance="outlined" class="onboard">
            <mat-card-content>
              <mat-icon>flag</mat-icon>
              <div>
                <h3>Pick your exam to get started</h3>
                <p class="muted">Choose the exam you are preparing for, for example SSC CGL. Its full tests, mini mocks, previous year papers and subject tests will be one tap away.</p>
              </div>
              <a mat-flat-button routerLink="/student/prepare">Choose your exam</a>
            </mat-card-content>
          </mat-card>
        }
      </section>

      <section class="block" aria-label="Today and this week">
        <h2>Today &amp; this week</h2>
        <app-activity-cards [activity]="d.activity" />
        <app-weekly-card />
      </section>

      <section class="block two" aria-label="Performance">
        <mat-card appearance="outlined">
          <mat-card-header><mat-card-title>Performance trend</mat-card-title></mat-card-header>
          <mat-card-content>
            @if (points().length) {
              <svg viewBox="0 0 300 130" class="trend" role="img" aria-label="Score percentage over recent attempts">
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--mat-sys-primary)" stop-opacity="0.28" />
                    <stop offset="100%" stop-color="var(--mat-sys-primary)" stop-opacity="0" />
                  </linearGradient>
                </defs>
                @for (g of grid; track g.value) {
                  <line x1="26" [attr.y1]="g.y" x2="292" [attr.y2]="g.y" class="axis" [class.faint]="g.value > 0" />
                  <text x="22" [attr.y]="g.y + 3" class="tick" text-anchor="end">{{ g.value }}</text>
                }
                <polygon [attr.points]="area()" fill="url(#trendFill)" />
                <polyline [attr.points]="line()" class="line" />
                @for (p of points(); track p.attempt) {
                  <circle [attr.cx]="p.x" [attr.cy]="p.y" r="3.5" class="dot"><title>{{ p.title }}: {{ p.percentage }}%</title></circle>
                }
              </svg>
              <p class="muted trend-note">
                Last {{ points().length }} result{{ points().length === 1 ? '' : 's' }}.
                Latest: <strong>{{ latest()?.percentage }}%</strong>
                @if (change() !== null) { <span [class.up]="change()! > 0" [class.down]="change()! < 0">({{ change()! > 0 ? '+' : '' }}{{ change() }} points)</span> }
              </p>
            } @else {
              <p class="muted">Your trend appears after your first released result.</p>
            }
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined">
          <mat-card-header><mat-card-title>Subject-wise accuracy</mat-card-title></mat-card-header>
          <mat-card-content>
            @for (s of subjects(); track s.subject; let i = $index) {
              <div class="bar-row">
                <span class="bar-label">{{ s.subject }}</span>
                <div class="bar"><div class="fill" [class]="level(s.accuracy)" [style.width.%]="s.accuracy"></div></div>
                <span class="bar-val">{{ s.accuracy }}%</span>
              </div>
            } @empty {
              <p class="muted">No released results yet.</p>
            }
            @if (subjects().length > 1) {
              <p class="muted subject-note">Weakest first. <a routerLink="/student/practice">Practise {{ subjects()[0].subject }}</a></p>
            }
          </mat-card-content>
        </mat-card>
      </section>

      <section class="block" aria-label="Recent results">
        <div class="block-head">
          <h2>Recent results</h2>
          <a mat-button routerLink="/student/attempts">All attempts</a>
        </div>
        <mat-card appearance="outlined">
          <mat-card-content class="results">
            @for (r of d.recent_results; track r.id) {
              <a class="result-row" [routerLink]="['/student/results', r.id]">
                <span class="r-main"><strong>{{ r.exam_title }}</strong><span class="muted">{{ r.submitted_at | date: 'medium' }}</span></span>
                <span class="r-score">{{ r.score }} <span class="muted">/ {{ r.total_marks }}</span></span>
                <span class="pill" [class.pass]="r.passed" [class.fail]="!r.passed">{{ r.passed ? 'Passed' : 'Not passed' }}</span>
                <mat-icon class="chev">chevron_right</mat-icon>
              </a>
            } @empty {
              <p class="muted empty">No released results yet. Results from tests with manual or scheduled release appear once published.</p>
            }
          </mat-card-content>
        </mat-card>
      </section>

      @if (d.upcoming.length) {
        <section class="block" aria-label="Upcoming tests">
          <h2>Upcoming tests</h2>
          <div class="cards">@for (e of d.upcoming; track e.id) { <app-test-card [exam]="e" /> }</div>
        </section>
      }

      @if (d.recommended.length) {
        <section class="block" aria-label="Suggested tests">
          <h2>Suggested for you</h2>
          <div class="cards">@for (e of d.recommended; track e.id) { <app-test-card [exam]="e" /> }</div>
        </section>
      }
    }
  `,
})
export class StudentDashboard {
  auth = inject(AuthService);
  private api = inject(StudentService);
  private notify = inject(NotifyService);

  loading = signal(true);
  d = signal<Dashboard | null>(null);
  today = new Date();
  ring = RING;
  /** Horizontal lines of the trend chart: where 0, 50 and 100 percent sit. */
  grid = [100, 50, 0].map((value) => ({ value, y: 108 - value * 0.98 }));

  name = computed(() => this.auth.user()?.first_name || this.auth.user()?.username || '');

  greeting = computed(() => {
    const h = this.today.getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  });

  /** One line about where the student stands today. */
  subtitle = computed(() => {
    const d = this.d();
    if (!d) return 'A little practice every day adds up.';
    if (d.in_progress.length) return d.in_progress.length === 1 ? 'You have a test in progress. Pick it up where you left off.' : `You have ${d.in_progress.length} tests in progress.`;
    if (d.activity.goal_reached) return 'You have reached today’s goal. Great work!';
    const left = Math.max(0, d.activity.goal - d.activity.today);
    return left ? `${left} more question${left === 1 ? '' : 's'} to reach today’s goal.` : 'A little practice every day adds up.';
  });

  /** The one thing to do next: resume a test, open the student's exam, or find a test. */
  primary = computed<{ label: string; icon: string; link: (string | number)[]; query: Record<string, string> | null }>(() => {
    const d = this.d();
    const running = d?.in_progress[0];
    if (running) return { label: `Resume ${running.title}`, icon: 'play_arrow', link: ['/student/tests', running.id], query: null };
    const first = d?.preparing[0];
    if (first) return first.group
      ? { label: `Open ${first.name}`, icon: 'arrow_forward', link: ['/student/tests/family', first.group.id], query: { exam: first.id } }
      : { label: `Open ${first.name}`, icon: 'arrow_forward', link: ['/student/tests/exam', first.id], query: null };
    return { label: 'Browse tests', icon: 'search', link: ['/student/tests'], query: null };
  });

  goalOffset = computed(() => {
    const a = this.d()?.activity;
    return this.offset(a ? Math.min(100, Math.round((a.today * 100) / (a.goal || 1))) : 0);
  });

  points = computed(() => {
    const t = this.d()?.trend ?? [];
    const step = t.length > 1 ? 266 / (t.length - 1) : 0;
    return t.map((p, i) => ({
      ...p,
      x: t.length > 1 ? 26 + i * step : 159,
      y: 108 - Math.max(0, Math.min(100, p.percentage)) * 0.98,
    }));
  });
  line = computed(() => this.points().map((p) => `${p.x},${p.y}`).join(' '));
  /** The line closed down to the axis, filled with a soft gradient. */
  area = computed(() => {
    const p = this.points();
    return p.length < 2 ? '' : `${p[0].x},108 ${this.line()} ${p[p.length - 1].x},108`;
  });
  latest = computed(() => this.points().at(-1) ?? null);
  /** Points gained or lost since the result before; null with fewer than two results. */
  change = computed(() => {
    const p = this.points();
    return p.length < 2 ? null : Math.round((p[p.length - 1].percentage - p[p.length - 2].percentage) * 10) / 10;
  });

  /** Subjects with the weakest first, so the one to work on is at the top. */
  subjects = computed(() => [...(this.d()?.subjects ?? [])].sort((a, b) => a.accuracy - b.accuracy));

  constructor() {
    this.api.dashboard().subscribe({
      next: (d) => {
        this.d.set(d);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }

  percent(p: Preparing) {
    return p.total_tests ? Math.round((p.attempted_tests * 100) / p.total_tests) : 0;
  }

  /** Dash offset that leaves `pct` percent of a ring drawn. */
  offset(pct: number) {
    return RING * (1 - Math.max(0, Math.min(100, pct)) / 100);
  }

  /** Colour class for an accuracy bar. */
  level(accuracy: number) {
    return accuracy < 40 ? 'low' : accuracy < 70 ? 'mid' : 'high';
  }
}

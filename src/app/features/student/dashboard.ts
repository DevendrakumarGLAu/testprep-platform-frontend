import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { ActivityCards } from './activity-cards';
import { LiveStrip } from './live-strip';
import { StudyPlanCard } from '../coach/study-plan-card/study-plan-card';
import { WeeklyCard } from './weekly-card';
import { Dashboard } from './student.models';
import { StudentService } from './student.service';
import { TestCard } from './test-card';

/** Circumference of the progress rings (radius 52 in a 120 x 120 box). */
const RING = 2 * Math.PI * 52;

type Preparing = Dashboard['preparing'][number];

@Component({
  selector: 'app-student-dashboard',
  imports: [DatePipe, RouterLink, TestCard, ActivityCards, WeeklyCard, LiveStrip, StudyPlanCard],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  host: { class: 'bs' },
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
    if (running) return { label: `Resume ${running.title}`, icon: 'bi-play-fill', link: ['/student/tests', running.id], query: null };
    const first = d?.preparing[0];
    if (first) return first.group
      ? { label: `Open ${first.name}`, icon: 'bi-arrow-right', link: ['/student/tests/family', first.group.id], query: { exam: first.id } }
      : { label: `Open ${first.name}`, icon: 'bi-arrow-right', link: ['/student/tests/exam', first.id], query: null };
    return { label: 'Browse tests', icon: 'bi-search', link: ['/student/tests'], query: null };
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

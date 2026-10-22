import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { ChartComponent } from '../../shared/chart';
import { AdminDashboardData, ReportsService } from './students/reports.service';

@Component({
  selector: 'app-admin-dashboard',
  imports: [DatePipe, RouterLink, MatCardModule, MatIconModule, MatProgressBarModule, ChartComponent],
  styles: `
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin: 16px 0; }
    .stat { display: flex; flex-direction: row; align-items: center; gap: 14px; padding: 14px; }
    .stat mat-icon { font-size: 32px; width: 32px; height: 32px; color: var(--mat-sys-primary); }
    .value { font: var(--mat-sys-headline-small); }
    .label, .muted { color: var(--mat-sys-on-surface-variant); }
    .label small { display: block; }
    .charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-bottom: 16px; }
    mat-card-content { padding-top: 12px; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .pass { color: #2e7d32; } .fail { color: var(--mat-sys-error); }
    .top-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); }
  `,
  template: `
    <h1>Welcome, {{ auth.user()?.first_name || auth.user()?.username }}</h1>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

    @if (d(); as d) {
      <div class="stats">
        <mat-card appearance="outlined" class="stat"><mat-icon>school</mat-icon>
          <div><div class="value">{{ d.students.total }}</div><div class="label">Registered students<small>{{ d.students.new_last_30_days }} new in 30 days</small></div></div></mat-card>
        <mat-card appearance="outlined" class="stat"><mat-icon>how_to_reg</mat-icon>
          <div><div class="value">{{ d.students.active }}</div><div class="label">Active students</div></div></mat-card>
        <mat-card appearance="outlined" class="stat"><mat-icon>quiz</mat-icon>
          <div><div class="value">{{ d.questions.total }}</div><div class="label">Questions<small>{{ d.questions.active }} active</small></div></div></mat-card>
        <mat-card appearance="outlined" class="stat"><mat-icon>assignment</mat-icon>
          <div><div class="value">{{ d.tests.total }}</div><div class="label">Tests<small>{{ d.tests.published }} published · {{ d.tests.draft }} draft</small></div></div></mat-card>
        <mat-card appearance="outlined" class="stat"><mat-icon>fact_check</mat-icon>
          <div><div class="value">{{ d.attempts.submitted }}</div><div class="label">Attempts submitted<small>{{ d.attempts.in_progress }} in progress</small></div></div></mat-card>
        <mat-card appearance="outlined" class="stat"><mat-icon>percent</mat-icon>
          <div><div class="value">{{ d.average_percentage === null ? '—' : d.average_percentage + '%' }}</div><div class="label">Average score<small>Pass rate {{ d.pass_rate === null ? '—' : d.pass_rate + '%' }}</small></div></div></mat-card>
      </div>

      <div class="charts">
        <mat-card appearance="outlined">
          <mat-card-header><mat-card-title>Participation, last 14 days</mat-card-title></mat-card-header>
          <mat-card-content>
            <app-chart type="line" [labels]="participationLabels()" [series]="participationSeries()" label="Submitted attempts per day over the last 14 days" />
          </mat-card-content>
        </mat-card>
        <mat-card appearance="outlined">
          <mat-card-header><mat-card-title>Score distribution</mat-card-title></mat-card-header>
          <mat-card-content>
            <app-chart type="bar" [labels]="distLabels()" [series]="distSeries()" label="Number of attempts by score range" />
          </mat-card-content>
        </mat-card>
        <mat-card appearance="outlined">
          <mat-card-header><mat-card-title>Subject-wise accuracy</mat-card-title></mat-card-header>
          <mat-card-content>
            @if (d.subjects.length) {
              <app-chart type="bar" [horizontal]="true" [max]="100" [labels]="subjectLabels()" [series]="subjectSeries()" label="Accuracy percentage by subject" />
            } @else { <p class="muted">No completed attempts yet.</p> }
          </mat-card-content>
        </mat-card>
        <mat-card appearance="outlined">
          <mat-card-header><mat-card-title>Most attempted tests</mat-card-title></mat-card-header>
          <mat-card-content>
            @for (t of d.top_tests; track t.id) {
              <div class="top-row"><a [routerLink]="['/admin/tests', t.id, 'results']">{{ t.title }}</a><strong>{{ t.attempts }}</strong></div>
            } @empty { <p class="muted">No completed attempts yet.</p> }
          </mat-card-content>
        </mat-card>
      </div>

      <mat-card appearance="outlined">
        <mat-card-header><mat-card-title>Recent test activity</mat-card-title></mat-card-header>
        <mat-card-content>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Test</th><th>Score</th><th>Result</th><th>Submitted</th><th></th></tr></thead>
              <tbody>
                @for (a of d.recent_activity; track a.attempt) {
                  <tr>
                    <td>{{ a.student }}</td><td>{{ a.exam }}</td>
                    <td>{{ a.score }} / {{ a.total_marks }} ({{ a.percentage }}%)</td>
                    <td [class]="a.passed ? 'pass' : 'fail'">{{ a.passed ? 'Passed' : 'Not passed' }}</td>
                    <td>{{ a.submitted_at | date: 'short' }}</td>
                    <td><a [routerLink]="['/admin/attempts', a.attempt]">Review</a></td>
                  </tr>
                }
              </tbody>
            </table>
            @if (!d.recent_activity.length) { <p class="muted">Nothing yet. Activity appears when students submit tests.</p> }
          </div>
        </mat-card-content>
      </mat-card>
    }
  `,
})
export class AdminDashboard {
  auth = inject(AuthService);
  private api = inject(ReportsService);
  private notify = inject(NotifyService);

  loading = signal(true);
  d = signal<AdminDashboardData | null>(null);

  participationLabels = computed(() => (this.d()?.participation ?? []).map((p) => p.date.slice(5)));
  participationSeries = computed(() => [{ label: 'Attempts', data: (this.d()?.participation ?? []).map((p) => p.attempts) }]);
  distLabels = computed(() => (this.d()?.score_distribution ?? []).map((b) => b.range));
  distSeries = computed(() => [{ label: 'Attempts', data: (this.d()?.score_distribution ?? []).map((b) => b.count) }]);
  subjectLabels = computed(() => (this.d()?.subjects ?? []).map((s) => s.subject));
  subjectSeries = computed(() => [{ label: 'Accuracy %', data: (this.d()?.subjects ?? []).map((s) => s.accuracy) }]);

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
}

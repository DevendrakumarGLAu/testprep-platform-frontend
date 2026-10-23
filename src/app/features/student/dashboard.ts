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
import { WeeklyCard } from './weekly-card';
import { Dashboard } from './student.models';
import { StudentService } from './student.service';
import { TestCard } from './test-card';

@Component({
  selector: 'app-student-dashboard',
  imports: [DatePipe, RouterLink, MatCardModule, MatIconModule, MatButtonModule, MatProgressBarModule, TestCard, ActivityCards, WeeklyCard],
  styleUrl: './dashboard.scss',
  template: `
    <header class="hero">
      <h1>Welcome back, {{ auth.user()?.first_name || auth.user()?.username }}</h1>
      <p>Keep your streak going. A little practice every day adds up.</p>
    </header>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

    @if (d(); as d) {
      <div class="stats">
        <mat-card appearance="outlined" class="stat"><mat-icon>assignment</mat-icon>
          <div><div class="value">{{ d.counts.available }}</div><div class="label">Available tests</div></div></mat-card>
        <mat-card appearance="outlined" class="stat"><mat-icon>event</mat-icon>
          <div><div class="value">{{ d.counts.upcoming }}</div><div class="label">Upcoming</div></div></mat-card>
        <mat-card appearance="outlined" class="stat"><mat-icon>pending_actions</mat-icon>
          <div><div class="value">{{ d.counts.in_progress }}</div><div class="label">In progress</div></div></mat-card>
        <mat-card appearance="outlined" class="stat"><mat-icon>task_alt</mat-icon>
          <div><div class="value">{{ d.counts.completed }}</div><div class="label">Completed</div></div></mat-card>
        <mat-card appearance="outlined" class="stat"><mat-icon>percent</mat-icon>
          <div><div class="value">{{ d.average_score_percent === null ? '—' : d.average_score_percent + '%' }}</div><div class="label">Average score</div></div></mat-card>
        <mat-card appearance="outlined" class="stat"><mat-icon>gps_fixed</mat-icon>
          <div><div class="value">{{ d.accuracy_percent === null ? '—' : d.accuracy_percent + '%' }}</div><div class="label">Accuracy</div></div></mat-card>
      </div>

      <app-activity-cards [activity]="d.activity" />
      <app-weekly-card />

      <h2>Your preparation</h2>
      @if (d.preparing.length) {
        <div class="cards">
          @for (p of d.preparing; track p.id) {
            <mat-card appearance="outlined">
              <mat-card-content>
                <h3>{{ p.name }}</h3>
                <div class="bar"><div class="fill" [style.width.%]="p.total_tests ? (p.attempted_tests * 100) / p.total_tests : 0"></div></div>
                <p class="muted">{{ p.attempted_tests }} of {{ p.total_tests }} tests attempted</p>
              </mat-card-content>
              <mat-card-actions><a mat-flat-button [routerLink]="['/student/prepare', p.id]">Open</a></mat-card-actions>
            </mat-card>
          }
        </div>
        <a mat-button routerLink="/student/prepare">Change exams</a>
      } @else {
        <mat-card appearance="outlined">
          <mat-card-content>
            <p>Choose the exam you are preparing for, for example SSC, and see its full tests, subject tests and previous year papers in one place.</p>
            <a mat-flat-button routerLink="/student/prepare">Choose your exam</a>
          </mat-card-content>
        </mat-card>
      }

      @if (d.in_progress.length) {
        <h2>Continue where you left off</h2>
        <div class="cards">@for (e of d.in_progress; track e.id) { <app-test-card [exam]="e" /> }</div>
      }

      <div class="two">
        <mat-card appearance="outlined">
          <mat-card-header><mat-card-title>Performance trend</mat-card-title></mat-card-header>
          <mat-card-content>
            @if (points().length) {
              <svg viewBox="0 0 300 120" class="trend" role="img" aria-label="Score percentage over recent attempts">
                <line x1="20" y1="100" x2="290" y2="100" class="axis" />
                <line x1="20" y1="10" x2="290" y2="10" class="axis faint" />
                <polyline [attr.points]="line()" class="line" />
                @for (p of points(); track p.attempt) {
                  <circle [attr.cx]="p.x" [attr.cy]="p.y" r="4" class="dot"><title>{{ p.title }}: {{ p.percentage }}%</title></circle>
                }
                <text x="2" y="14" class="tick">100</text><text x="6" y="104" class="tick">0</text>
              </svg>
            } @else {
              <p class="muted">Your trend appears after your first released result.</p>
            }
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined">
          <mat-card-header><mat-card-title>Subject-wise accuracy</mat-card-title></mat-card-header>
          <mat-card-content>
            @for (s of d.subjects; track s.subject) {
              <div class="bar-row">
                <span class="bar-label">{{ s.subject }}</span>
                <div class="bar"><div class="fill" [style.width.%]="s.accuracy"></div></div>
                <span class="bar-val">{{ s.accuracy }}%</span>
              </div>
            } @empty {
              <p class="muted">No released results yet.</p>
            }
          </mat-card-content>
        </mat-card>
      </div>

      <mat-card appearance="outlined">
        <mat-card-header><mat-card-title>Recent results</mat-card-title></mat-card-header>
        <mat-card-content>
          @for (r of d.recent_results; track r.id) {
            <div class="result-row">
              <span>{{ r.exam_title }}</span>
              <span class="muted">{{ r.submitted_at | date: 'medium' }}</span>
              <strong>{{ r.score }} / {{ r.total_marks }}</strong>
              <span [class]="r.passed ? 'pass' : 'fail'">{{ r.passed ? 'Passed' : 'Not passed' }}</span>
              <a mat-button [routerLink]="['/student/results', r.id]">Review</a>
            </div>
          } @empty {
            <p class="muted">No released results yet. Results from tests with manual or scheduled release appear once published.</p>
          }
          <a mat-button routerLink="/student/attempts">All attempts</a>
        </mat-card-content>
      </mat-card>

      @if (d.upcoming.length) {
        <h2>Upcoming tests</h2>
        <div class="cards">@for (e of d.upcoming; track e.id) { <app-test-card [exam]="e" /> }</div>
      }

      @if (d.recommended.length) {
        <h2>Recommended for you</h2>
        <div class="cards">@for (e of d.recommended; track e.id) { <app-test-card [exam]="e" /> }</div>
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

  points = computed(() => {
    const t = this.d()?.trend ?? [];
    const step = t.length > 1 ? 270 / (t.length - 1) : 0;
    return t.map((p, i) => ({
      ...p,
      x: t.length > 1 ? 20 + i * step : 155,
      y: 100 - Math.max(0, Math.min(100, p.percentage)) * 0.9,
    }));
  });
  line = computed(() => this.points().map((p) => `${p.x},${p.y}`).join(' '));

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

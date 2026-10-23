import { HttpClient } from '@angular/common/http';
import { Component, effect, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { StudentExam } from './student.models';
import { TestCard } from './test-card';

export interface SeriesRow {
  id: string;
  title: string;
  description: string;
  category: string | null;
  total: number;
  attempted: number;
}

export interface SeriesFull extends SeriesRow {
  tests: StudentExam[];
}

@Component({
  selector: 'app-series-list',
  imports: [RouterLink, MatCardModule, MatProgressBarModule],
  styles: `
    :host { display: block; max-width: 900px; }
    mat-card { margin-bottom: 12px; }
    a.card { display: block; text-decoration: none; color: inherit; }
    h2 { margin: 2px 0; }
    .meta, p { color: var(--mat-sys-on-surface-variant); margin: 4px 0; }
  `,
  template: `
    <h1>Test series</h1>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    @for (s of rows(); track s.id) {
      <a class="card" [routerLink]="['/student/series', s.id]">
        <mat-card appearance="outlined"><mat-card-content>
          <div class="meta">{{ s.category || 'All exams' }}</div>
          <h2>{{ s.title }}</h2>
          @if (s.description) { <p>{{ s.description }}</p> }
          <mat-progress-bar mode="determinate" [value]="s.total ? (s.attempted * 100) / s.total : 0" />
          <p>{{ s.attempted }} of {{ s.total }} tests attempted</p>
        </mat-card-content></mat-card>
      </a>
    } @empty {
      @if (!loading()) { <mat-card appearance="outlined"><mat-card-content>No test series yet. Check back soon.</mat-card-content></mat-card> }
    }
  `,
})
export class SeriesList {
  private http = inject(HttpClient);
  private notify = inject(NotifyService);
  loading = signal(true);
  rows = signal<SeriesRow[]>([]);

  constructor() {
    this.http.get<{ results: SeriesRow[] }>(`${environment.apiUrl}/student/series/`).subscribe({
      next: (r) => {
        this.rows.set(r.results);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }
}

@Component({
  selector: 'app-series-detail',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule, TestCard],
  styles: `
    :host { display: block; }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin-top: 12px; }
    .muted { color: var(--mat-sys-on-surface-variant); }
    mat-progress-bar { max-width: 420px; }
  `,
  template: `
    <a mat-button routerLink="/student/series"><mat-icon>arrow_back</mat-icon> All series</a>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    @if (series(); as s) {
      <h1>{{ s.title }}</h1>
      @if (s.description) { <p class="muted">{{ s.description }}</p> }
      <mat-progress-bar mode="determinate" [value]="s.total ? (s.attempted * 100) / s.total : 0" />
      <p class="muted">{{ s.attempted }} of {{ s.total }} tests attempted</p>
      <div class="cards">@for (t of s.tests; track t.id; let i = $index) { <app-test-card [exam]="t" /> }</div>
    } @else if (!loading()) {
      <p>This series is not available.</p>
    }
  `,
})
export class SeriesDetail {
  id = input.required<string>();
  private http = inject(HttpClient);
  loading = signal(true);
  series = signal<SeriesFull | null>(null);

  constructor() {
    effect(() => {
      this.loading.set(true);
      this.http.get<SeriesFull>(`${environment.apiUrl}/student/series/${this.id()}/`).subscribe({
        next: (s) => {
          this.series.set(s);
          this.loading.set(false);
        },
        error: () => {
          this.series.set(null);
          this.loading.set(false);
        },
      });
    });
  }
}

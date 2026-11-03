import { HttpClient } from '@angular/common/http';
import { Component, effect, inject, input, signal } from '@angular/core';
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
  imports: [RouterLink],
  templateUrl: './series-list.html',
  styleUrl: './series-list.scss',
  host: { class: 'bs' },
})
export class SeriesList {
  private http = inject(HttpClient);
  private notify = inject(NotifyService);
  loading = signal(true);
  rows = signal<SeriesRow[]>([]);

  /** How much of the series the student has attempted, 0 to 100. */
  percent(s: SeriesRow) {
    return s.total ? (s.attempted * 100) / s.total : 0;
  }

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
  imports: [RouterLink, TestCard],
  templateUrl: './series-detail.html',
  styleUrl: './series-detail.scss',
  host: { class: 'bs' },
})
export class SeriesDetail {
  id = input.required<string>();
  private http = inject(HttpClient);
  loading = signal(true);
  series = signal<SeriesFull | null>(null);

  /** How much of the series the student has attempted, 0 to 100. */
  percent(s: SeriesRow) {
    return s.total ? (s.attempted * 100) / s.total : 0;
  }

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

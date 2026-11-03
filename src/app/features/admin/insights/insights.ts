import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { Exam } from '../exams/exam.models';
import { ExamService } from '../exams/exam.service';

export interface QuestionStat {
  question: number;
  text: string;
  subject: string | null;
  attempts: number;
  correct_percent: number | null;
  skipped_percent: number;
}

export interface Insights {
  attempts: number;
  min_answers: number;
  tests: { id: number; title: string; attempts: number; average_percent: number | null }[];
  hardest: QuestionStat[];
  most_skipped: QuestionStat[];
}

export interface Dropoff {
  exam: string;
  attempts: number;
  positions: { number: number; answered_percent: number; correct_percent: number | null; average_seconds: number }[];
}

/** Where students spend their time and struggle: busiest tests, hardest and most skipped questions, and where they give up in a test. */
@Component({
  selector: 'app-insights',
  imports: [RouterLink],
  templateUrl: './insights.html',
  styleUrl: './insights.scss',
  host: { class: 'bs' },
})
export class InsightsPage {
  private http = inject(HttpClient);
  private examApi = inject(ExamService);
  private notify = inject(NotifyService);

  loading = signal(true);
  data = signal<Insights | null>(null);
  exams = signal<Exam[]>([]);
  examId = signal<number | null>(null);
  dropoff = signal<Dropoff | null>(null);

  constructor() {
    this.http.get<Insights>(`${environment.apiUrl}/admin/insights/`).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
        if (d.tests[0]) this.pick(d.tests[0].id);
      },
      error: (e) => {
        this.loading.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
    this.examApi.list({ page_size: 200, ordering: 'title' }).subscribe((p) => this.exams.set(p.results));
  }

  pick(id: number) {
    this.examId.set(id);
    this.http.get<Dropoff>(`${environment.apiUrl}/exams/${id}/dropoff/`).subscribe({
      next: (d) => this.dropoff.set(d),
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }
}

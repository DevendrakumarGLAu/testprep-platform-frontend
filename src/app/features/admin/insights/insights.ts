import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
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
  imports: [RouterLink, MatCardModule, MatFormFieldModule, MatProgressBarModule, MatSelectModule],
  styles: `
    :host { display: block; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; margin-top: 12px; }
    .row { display: grid; grid-template-columns: 1fr auto; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); align-items: center; }
    .row .t { overflow: hidden; text-overflow: ellipsis; }
    .meta, .muted { color: var(--mat-sys-on-surface-variant); font-size: 0.85em; }
    .big { font: var(--mat-sys-headline-medium); }
    .bad { color: var(--mat-sys-error); font-weight: 500; }
    .chart { display: flex; align-items: flex-end; gap: 3px; height: 150px; margin: 12px 0 4px; overflow-x: auto; padding-bottom: 4px; }
    .col { display: flex; flex-direction: column; justify-content: flex-end; align-items: center; min-width: 22px; height: 100%; }
    .col .bar { width: 16px; border-radius: 3px 3px 0 0; background: var(--mat-sys-primary); }
    .col .bar.low { background: var(--mat-sys-error); }
    .col small { font-size: 10px; color: var(--mat-sys-on-surface-variant); }
    a { color: var(--mat-sys-primary); }
  `,
  template: `
    <h1>Insights</h1>
    <p class="muted">Based on submitted attempts of real tests. Students' own practice sets are not counted.</p>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    @if (data(); as d) {
      <mat-card appearance="outlined"><mat-card-content>
        <div class="big">{{ d.attempts }}</div><div class="muted">submitted attempts</div>
      </mat-card-content></mat-card>

      <div class="grid">
        <mat-card appearance="outlined">
          <mat-card-header><mat-card-title>Busiest tests</mat-card-title></mat-card-header>
          <mat-card-content>
            @for (t of d.tests; track t.id) {
              <div class="row"><span class="t"><a [routerLink]="['/admin/tests', t.id]">{{ t.title }}</a></span><span>{{ t.attempts }} attempts · avg {{ t.average_percent === null ? '—' : t.average_percent + '%' }}</span></div>
            } @empty { <p class="muted">No attempts yet.</p> }
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined">
          <mat-card-header><mat-card-title>Hardest questions</mat-card-title><mat-card-subtitle>Fewest right answers (at least {{ d.min_answers }} attempts)</mat-card-subtitle></mat-card-header>
          <mat-card-content>
            @for (q of d.hardest; track q.question) {
              <div class="row"><span class="t"><a [routerLink]="['/admin/questions', q.question]">#{{ q.question }}</a> {{ q.text }}<div class="meta">{{ q.subject }} · {{ q.attempts }} attempts</div></span><span class="bad">{{ q.correct_percent }}% right</span></div>
            } @empty { <p class="muted">Not enough attempts yet.</p> }
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined">
          <mat-card-header><mat-card-title>Most skipped questions</mat-card-title><mat-card-subtitle>Left unanswered most often</mat-card-subtitle></mat-card-header>
          <mat-card-content>
            @for (q of d.most_skipped; track q.question) {
              <div class="row"><span class="t"><a [routerLink]="['/admin/questions', q.question]">#{{ q.question }}</a> {{ q.text }}<div class="meta">{{ q.subject }} · {{ q.attempts }} attempts</div></span><span class="bad">{{ q.skipped_percent }}% skipped</span></div>
            } @empty { <p class="muted">No skipped questions to show yet.</p> }
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined">
          <mat-card-header><mat-card-title>Where students give up</mat-card-title><mat-card-subtitle>Share who answered, by question number</mat-card-subtitle></mat-card-header>
          <mat-card-content>
            <mat-form-field appearance="outline" subscriptSizing="dynamic" style="width: 100%">
              <mat-label>Test</mat-label>
              <mat-select [value]="examId()" (selectionChange)="pick($event.value)">
                @for (t of exams(); track t.id) { <mat-option [value]="t.id">{{ t.title }}</mat-option> }
              </mat-select>
            </mat-form-field>
            @if (dropoff(); as o) {
              @if (o.attempts) {
                <div class="chart" role="img" [attr.aria-label]="'Share of students who answered each question of ' + o.exam">
                  @for (p of o.positions; track p.number) {
                    <div class="col" [title]="'Q' + p.number + ': ' + p.answered_percent + '% answered, ' + (p.correct_percent ?? 0) + '% right, ' + p.average_seconds + 's'">
                      <div class="bar" [class.low]="p.answered_percent < 60" [style.height.%]="p.answered_percent"></div><small>{{ p.number }}</small>
                    </div>
                  }
                </div>
                <p class="meta">{{ o.attempts }} attempts. Red bars: fewer than 60% answered.</p>
              } @else { <p class="muted">Nobody has submitted this test yet.</p> }
            }
          </mat-card-content>
        </mat-card>
      </div>
    }
  `,
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

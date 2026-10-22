import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { formatDuration } from '../../student/student.models';
import { ReportsService } from '../students/reports.service';
import { blobError } from '../students/student-list';
import { saveBlob } from '../imports/import.service';
import { AdminAttempt, ResultsSummary } from './exam.models';
import { ExamService } from './exam.service';

@Component({
  selector: 'app-exam-results',
  imports: [DatePipe, RouterLink, MatCardModule, MatButtonModule, MatIconModule, MatTableModule, MatPaginatorModule, MatProgressBarModule],
  styles: `
    .head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 16px 0; }
    .stat { padding: 14px; }
    .stat .value { font: var(--mat-sys-headline-small); }
    .stat .label, .muted { color: var(--mat-sys-on-surface-variant); }
    .release { margin-bottom: 16px; }
    .release .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 8px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; }
    .pass { color: #2e7d32; } .fail { color: var(--mat-sys-error); }
    .qrow { display: grid; grid-template-columns: 1fr 80px 80px 80px; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    @media (max-width: 600px) { .qrow { grid-template-columns: 1fr 56px 56px 56px; } }
  `,
  template: `
    <div class="head">
      <h1>Results{{ s() ? ': ' + s()!.exam.title : '' }}</h1>
      <span>
        <button mat-stroked-button (click)="pdf()" [disabled]="pdfBusy()"><mat-icon>picture_as_pdf</mat-icon> PDF report</button>
        <a mat-button [routerLink]="['/admin/tests', id()]"><mat-icon>arrow_back</mat-icon> Back to test</a>
      </span>
    </div>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

    @if (s(); as d) {
      <div class="stats">
        <mat-card appearance="outlined" class="stat"><div class="value">{{ d.attempts_submitted }}</div><div class="label">Submitted attempts</div></mat-card>
        <mat-card appearance="outlined" class="stat"><div class="value">{{ d.students }}</div><div class="label">Students</div></mat-card>
        <mat-card appearance="outlined" class="stat"><div class="value">{{ d.attempts_in_progress }}</div><div class="label">In progress</div></mat-card>
        <mat-card appearance="outlined" class="stat"><div class="value">{{ d.average_score ?? '—' }}</div><div class="label">Average score ({{ d.average_percentage ?? '—' }}%)</div></mat-card>
        <mat-card appearance="outlined" class="stat"><div class="value">{{ d.highest_score ?? '—' }}</div><div class="label">Highest</div></mat-card>
        <mat-card appearance="outlined" class="stat"><div class="value">{{ d.lowest_score ?? '—' }}</div><div class="label">Lowest</div></mat-card>
        <mat-card appearance="outlined" class="stat"><div class="value">{{ d.pass_rate === null ? '—' : d.pass_rate + '%' }}</div><div class="label">Pass rate</div></mat-card>
      </div>

      <mat-card appearance="outlined" class="release">
        <mat-card-header><mat-card-title>Release status</mat-card-title></mat-card-header>
        <mat-card-content>
          <div class="row">
            <div>
              <strong>Results: {{ d.exam.results_visible ? 'visible to students' : 'hidden from students' }}</strong>
              <div class="muted">Policy: {{ policy(d.exam.result_release) }}
                @if (d.exam.result_release === 'scheduled' && d.exam.result_release_at) { · {{ d.exam.result_release_at | date: 'medium' }} }</div>
            </div>
            @if (d.exam.result_release === 'manual') {
              @if (d.exam.results_visible) {
                <button mat-stroked-button (click)="release('hide-results')">Hide results</button>
              } @else {
                <button mat-flat-button (click)="release('release-results')">Release results</button>
              }
            }
          </div>
          <div class="row">
            <div>
              <strong>Solutions: {{ d.exam.solutions_visible ? 'visible to students' : 'hidden from students' }}</strong>
              <div class="muted">Policy: {{ policy(d.exam.solution_release) }}</div>
            </div>
            @if (d.exam.solution_release === 'manual') {
              @if (d.exam.solutions_released) {
                <button mat-stroked-button (click)="release('hide-solutions')">Hide solutions</button>
              } @else {
                <button mat-flat-button (click)="release('release-solutions')">Release solutions</button>
              }
            }
          </div>
          <p class="muted">Release policies are set under the test's Details tab. Manual buttons only appear for manual policies.</p>
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined" class="release">
        <mat-card-header><mat-card-title>Attempts</mat-card-title></mat-card-header>
        <mat-card-content>
          <div class="table-wrap">
            <table mat-table [dataSource]="rows()">
              <ng-container matColumnDef="student">
                <th mat-header-cell *matHeaderCellDef>Student</th>
                <td mat-cell *matCellDef="let a">{{ a.student_name }}<div class="muted">{{ a.student_email }}</div></td>
              </ng-container>
              <ng-container matColumnDef="attempt">
                <th mat-header-cell *matHeaderCellDef>#</th>
                <td mat-cell *matCellDef="let a">{{ a.attempt_number }}</td>
              </ng-container>
              <ng-container matColumnDef="score">
                <th mat-header-cell *matHeaderCellDef>Score</th>
                <td mat-cell *matCellDef="let a">
                  @if (a.status === 'submitted') { {{ a.score }} / {{ a.total_marks }} ({{ a.percentage }}%) } @else { <span class="muted">In progress</span> }
                </td>
              </ng-container>
              <ng-container matColumnDef="result">
                <th mat-header-cell *matHeaderCellDef>Result</th>
                <td mat-cell *matCellDef="let a">
                  @if (a.status === 'submitted') { <span [class]="a.passed ? 'pass' : 'fail'">{{ a.passed ? 'Passed' : 'Not passed' }}</span> }
                </td>
              </ng-container>
              <ng-container matColumnDef="time">
                <th mat-header-cell *matHeaderCellDef>Time</th>
                <td mat-cell *matCellDef="let a">{{ a.time_taken_seconds === null ? '—' : duration(a.time_taken_seconds) }}</td>
              </ng-container>
              <ng-container matColumnDef="submitted">
                <th mat-header-cell *matHeaderCellDef>Submitted</th>
                <td mat-cell *matCellDef="let a">{{ a.submitted_at ? (a.submitted_at | date: 'short') : '—' }}{{ a.auto_submitted ? ' (auto)' : '' }}</td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let a">
                  @if (a.status === 'submitted') { <a mat-button [routerLink]="['/admin/attempts', a.id]">Review</a> }
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns"></tr>
            </table>
            @if (rows().length === 0) { <p class="muted">No attempts yet.</p> }
          </div>
          <mat-paginator [length]="total()" [pageIndex]="pageIndex()" [pageSize]="20" (page)="onPage($event)" hidePageSize />
        </mat-card-content>
      </mat-card>

      @if (d.questions.length) {
        <mat-card appearance="outlined">
          <mat-card-header><mat-card-title>Question difficulty (hardest first)</mat-card-title></mat-card-header>
          <mat-card-content>
            <div class="qrow muted"><span>Question</span><span>Correct</span><span>Answered</span><span>Avg time</span></div>
            @for (q of d.questions; track q.question) {
              <div class="qrow"><span>{{ q.text }}</span><span>{{ q.correct_percent }}%</span><span>{{ q.answered_percent }}%</span><span>{{ q.average_seconds }}s</span></div>
            }
          </mat-card-content>
        </mat-card>
      }
    }
  `,
})
export class ExamResults {
  id = input.required<string>();
  private api = inject(ExamService);
  private notify = inject(NotifyService);
  private reports = inject(ReportsService);
  pdfBusy = signal(false);

  columns = ['student', 'attempt', 'score', 'result', 'time', 'submitted', 'actions'];
  loading = signal(true);
  s = signal<ResultsSummary | null>(null);
  rows = signal<AdminAttempt[]>([]);
  total = signal(0);
  pageIndex = signal(0);
  duration = formatDuration;

  constructor() {
    effect(() => {
      this.id();
      untracked(() => {
        this.loadSummary();
        this.loadAttempts();
      });
    });
  }

  pdf() {
    this.pdfBusy.set(true);
    this.reports.consolidatedPdf({ exam_ids: [+this.id()] }).subscribe({
      next: (b) => {
        this.pdfBusy.set(false);
        saveBlob(b, `test-report-${this.id()}.pdf`);
      },
      error: async (e) => {
        this.pdfBusy.set(false);
        this.notify.error(await blobError(e));
      },
    });
  }

  policy(v: string) {
    return ({
      immediate: 'immediately after submission', scheduled: 'at a scheduled time', manual: 'manual release',
      with_result: 'together with the result', after_end: 'after the test window closes',
    } as Record<string, string>)[v] ?? v;
  }

  private loadSummary() {
    this.api.resultsSummary(+this.id()).subscribe({
      next: (s) => {
        this.s.set(s);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }

  private loadAttempts() {
    this.api.attempts(+this.id(), { page: this.pageIndex() + 1, page_size: 20 }).subscribe({
      next: (p) => {
        this.rows.set(p.results);
        this.total.set(p.count);
      },
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }

  onPage(e: PageEvent) {
    this.pageIndex.set(e.pageIndex);
    this.loadAttempts();
  }

  release(action: 'release-results' | 'hide-results' | 'release-solutions' | 'hide-solutions') {
    this.api.release(+this.id(), action).subscribe({
      next: () => {
        this.notify.success('Release settings updated');
        this.loadSummary();
      },
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }
}

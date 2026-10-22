import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { ChartComponent } from '../../../shared/chart';
import { formatDuration } from '../../student/student.models';
import { Batch, Exam } from '../exams/exam.models';
import { ExamService } from '../exams/exam.service';
import { saveBlob } from '../imports/import.service';
import { ReportsService, StudentProfileData } from './reports.service';
import { blobError } from './student-list';

@Component({
  selector: 'app-student-profile',
  imports: [DatePipe, RouterLink, MatCardModule, MatButtonModule, MatIconModule, MatSelectModule, MatFormFieldModule, MatProgressBarModule, ChartComponent],
  styles: `
    .head { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px; }
    .muted { color: var(--mat-sys-on-surface-variant); }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 16px 0; }
    .stat { padding: 14px; } .stat .value { font: var(--mat-sys-headline-small); }
    .two { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-bottom: 16px; }
    mat-card { margin-bottom: 16px; } mat-card-content { padding-top: 12px; }
    .table-wrap { overflow-x: auto; } table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .pass { color: #2e7d32; } .fail { color: var(--mat-sys-error); }
    .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; } .row mat-form-field { flex: 1; min-width: 220px; }
    .note { padding: 8px 12px; border-radius: 8px; background: var(--mat-sys-secondary-container); margin: 8px 0; }
    .chip { padding: 2px 10px; border-radius: 12px; background: var(--mat-sys-surface-container-high); margin-right: 4px; }
  `,
  template: `
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    @if (s(); as s) {
      <div class="head">
        <div>
          <h1>{{ s.name }}</h1>
          <div class="muted">{{ s.email }}{{ s.phone ? ' · ' + s.phone : '' }} · {{ s.username }}</div>
          <div class="muted">Registered {{ s.date_joined | date: 'mediumDate' }} · {{ s.is_active ? 'Active' : 'Inactive' }}</div>
        </div>
        <div>
          <a mat-button routerLink="/admin/students"><mat-icon>arrow_back</mat-icon> Students</a>
          <button mat-flat-button (click)="pdf()" [disabled]="pdfBusy()"><mat-icon>picture_as_pdf</mat-icon> Download PDF report</button>
        </div>
      </div>

      <div class="stats">
        <mat-card appearance="outlined" class="stat"><div class="value">{{ s.performance.attempts_count }}</div><div class="muted">Completed attempts</div></mat-card>
        <mat-card appearance="outlined" class="stat"><div class="value">{{ val(s.performance.average_percentage) }}</div><div class="muted">Average score</div></mat-card>
        <mat-card appearance="outlined" class="stat"><div class="value">{{ val(s.performance.best_percentage) }}</div><div class="muted">Best score</div></mat-card>
        <mat-card appearance="outlined" class="stat"><div class="value">{{ val(s.performance.accuracy_percent) }}</div><div class="muted">Accuracy</div></mat-card>
        <mat-card appearance="outlined" class="stat"><div class="value">{{ val(s.performance.pass_rate) }}</div><div class="muted">Pass rate</div></mat-card>
      </div>

      <div class="two">
        <mat-card appearance="outlined">
          <mat-card-header><mat-card-title>Performance trend</mat-card-title></mat-card-header>
          <mat-card-content>
            @if (trendLabels().length) {
              <app-chart type="line" [max]="100" [labels]="trendLabels()" [series]="trendSeries()" label="Score percentage of the last attempts" />
            } @else { <p class="muted">No completed attempts yet.</p> }
          </mat-card-content>
        </mat-card>
        <mat-card appearance="outlined">
          <mat-card-header><mat-card-title>Subject-wise accuracy</mat-card-title></mat-card-header>
          <mat-card-content>
            @if (subjectLabels().length) {
              <app-chart type="bar" [horizontal]="true" [max]="100" [labels]="subjectLabels()" [series]="subjectSeries()" label="Accuracy percentage by subject" />
            } @else { <p class="muted">No completed attempts yet.</p> }
          </mat-card-content>
        </mat-card>
      </div>

      <mat-card appearance="outlined">
        <mat-card-header><mat-card-title>Batches</mat-card-title></mat-card-header>
        <mat-card-content>
          <div class="row">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Member of</mat-label>
              <mat-select multiple [value]="batchIds()" (selectionChange)="batchIds.set($event.value)">
                @for (b of allBatches(); track b.id) { <mat-option [value]="b.id">{{ b.name }}</mat-option> }
              </mat-select>
            </mat-form-field>
            <button mat-stroked-button (click)="saveBatches()">Save batches</button>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined">
        <mat-card-header><mat-card-title>Assigned tests</mat-card-title></mat-card-header>
        <mat-card-content>
          @for (e of s.assigned_exams; track e.id) {
            <div class="row"><span><strong>{{ e.title }}</strong> <span class="muted">{{ e.status }} · access: {{ e.access_type }}</span></span>
              <button mat-button (click)="unassign(e.id)">Remove</button></div>
          } @empty { <p class="muted">No tests assigned individually.</p> }
          @for (n of notes(); track n) { <div class="note"><mat-icon inline>info</mat-icon> {{ n }}</div> }
          <div class="row">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Assign tests</mat-label>
              <mat-select multiple [value]="toAssign()" (selectionChange)="toAssign.set($event.value)">
                @for (e of assignable(); track e.id) { <mat-option [value]="e.id">{{ e.title }} ({{ e.status }})</mat-option> }
              </mat-select>
            </mat-form-field>
            <button mat-flat-button (click)="assign()" [disabled]="!toAssign().length">Assign</button>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined">
        <mat-card-header><mat-card-title>Attempt history</mat-card-title></mat-card-header>
        <mat-card-content>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Test</th><th>#</th><th>Started</th><th>Status</th><th>Score</th><th>Result</th><th>Time</th><th></th></tr></thead>
              <tbody>
                @for (h of s.performance.history; track h.id) {
                  <tr>
                    <td>{{ h.exam_title }}</td><td>{{ h.attempt_number }}</td><td>{{ h.started_at | date: 'short' }}</td>
                    <td>{{ h.status === 'in_progress' ? 'In progress' : h.auto_submitted ? 'Auto-submitted' : 'Submitted' }}</td>
                    <td>@if (h.score !== null) { {{ h.score }} / {{ h.total_marks }} ({{ h.percentage }}%) } @else { — }</td>
                    <td [class]="h.passed ? 'pass' : 'fail'">{{ h.passed === null ? '' : h.passed ? 'Passed' : 'Not passed' }}</td>
                    <td>{{ h.time_taken_seconds === null ? '—' : duration(h.time_taken_seconds) }}</td>
                    <td>@if (h.status === 'submitted') { <a [routerLink]="['/admin/attempts', h.id]">Review</a> }</td>
                  </tr>
                }
              </tbody>
            </table>
            @if (!s.performance.history.length) { <p class="muted">No attempts yet.</p> }
          </div>
        </mat-card-content>
      </mat-card>
    }
  `,
})
export class StudentProfile {
  id = input.required<string>();
  private api = inject(ReportsService);
  private exams = inject(ExamService);
  private notify = inject(NotifyService);

  loading = signal(true);
  pdfBusy = signal(false);
  s = signal<StudentProfileData | null>(null);
  allBatches = signal<Batch[]>([]);
  allExams = signal<Exam[]>([]);
  batchIds = signal<number[]>([]);
  toAssign = signal<number[]>([]);
  notes = signal<string[]>([]);
  duration = formatDuration;

  assignable = computed(() => {
    const have = new Set(this.s()?.assigned_exams.map((e) => e.id));
    return this.allExams().filter((e) => !have.has(e.id) && e.status !== 'archived');
  });
  trendLabels = computed(() => (this.s()?.performance.trend ?? []).map((t) => t.title));
  trendSeries = computed(() => [{ label: 'Score %', data: (this.s()?.performance.trend ?? []).map((t) => t.percentage ?? 0) }]);
  subjectLabels = computed(() => (this.s()?.performance.subjects ?? []).map((x) => x.subject));
  subjectSeries = computed(() => [{ label: 'Accuracy %', data: (this.s()?.performance.subjects ?? []).map((x) => x.accuracy) }]);

  constructor() {
    this.exams.batches().subscribe((p) => this.allBatches.set(p.results));
    this.exams.list({ page_size: 100, ordering: 'title' }).subscribe((p) => this.allExams.set(p.results));
    effect(() => {
      this.id();
      untracked(() => this.load());
    });
  }

  val(v: number | null) {
    return v === null ? '—' : v + '%';
  }

  private load() {
    this.api.student(+this.id()).subscribe({
      next: (s) => {
        this.s.set(s);
        this.batchIds.set(s.batches.map((b) => b.id));
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }

  pdf() {
    this.pdfBusy.set(true);
    this.api.studentReportPdf(+this.id()).subscribe({
      next: (b) => {
        this.pdfBusy.set(false);
        saveBlob(b, `student-report-${this.s()!.username}.pdf`);
      },
      error: async (e) => {
        this.pdfBusy.set(false);
        this.notify.error(await blobError(e));
      },
    });
  }

  saveBatches() {
    this.api.setBatches(+this.id(), this.batchIds()).subscribe({
      next: (r) => {
        this.s.update((s) => (s ? { ...s, batches: r.batches } : s));
        this.notify.success('Batches saved');
      },
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }

  assign() {
    this.api.assignTests(+this.id(), this.toAssign(), 'add').subscribe({
      next: (r) => {
        this.s.update((s) => (s ? { ...s, assigned_exams: r.assigned_exams } : s));
        this.notes.set(r.notes);
        this.toAssign.set([]);
        this.notify.success('Tests assigned');
      },
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }

  unassign(examId: number) {
    this.api.assignTests(+this.id(), [examId], 'remove').subscribe({
      next: (r) => {
        this.s.update((s) => (s ? { ...s, assigned_exams: r.assigned_exams } : s));
        this.notes.set([]);
      },
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }
}

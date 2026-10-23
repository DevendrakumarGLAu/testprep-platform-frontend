import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { switchMap, tap } from 'rxjs';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { QuestionReportRow } from './qb.models';
import { QuestionBankService } from './qb.service';

/** The queue of problems students reported on questions. Each is marked fixed or "no change needed", with a note the student can read. */
@Component({
  selector: 'app-question-reports',
  imports: [
    DatePipe, FormsModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatPaginatorModule, MatProgressBarModule, MatSelectModule,
  ],
  styles: `
    .filters { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
    mat-card { margin-bottom: 12px; }
    .head { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
    .head .id { font-weight: 600; }
    .chip { padding: 1px 10px; border-radius: 10px; font-size: 0.8em; background: var(--mat-sys-error-container); color: var(--mat-sys-on-error-container); }
    .chip.resolved { background: #c8e6c9; color: #1b5e20; }
    .chip.rejected { background: var(--mat-sys-surface-container-high); color: var(--mat-sys-on-surface-variant); }
    .text { margin: 6px 0; }
    .msg { background: var(--mat-sys-surface-container); padding: 8px 12px; border-radius: 8px; margin: 6px 0; white-space: pre-wrap; }
    .meta { color: var(--mat-sys-on-surface-variant); font-size: 0.85em; }
    mat-form-field { width: 100%; margin-top: 8px; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .empty { padding: 24px; text-align: center; color: var(--mat-sys-on-surface-variant); }
  `,
  template: `
    <h1>Question reports</h1>
    <p class="meta">Problems students reported while reviewing their results. A reported question is held back from newly published tests until you approve it again.</p>
    <div class="filters">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Show</mat-label>
        <mat-select [value]="status()" (selectionChange)="status.set($event.value); pageIndex.set(0)">
          <mat-option value="open">Open</mat-option>
          <mat-option value="resolved">Fixed</mat-option>
          <mat-option value="rejected">No change needed</mat-option>
          <mat-option value="">All</mat-option>
        </mat-select>
      </mat-form-field>
      <span class="meta">{{ total() }} report{{ total() === 1 ? '' : 's' }}</span>
    </div>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

    @for (r of rows(); track r.id) {
      <mat-card appearance="outlined">
        <mat-card-content>
          <div class="head">
            <a class="id" [routerLink]="['/admin/questions', r.question]">Question #{{ r.question }}</a>
            <span class="chip" [class]="'chip ' + r.status">{{ statusLabel(r.status) }}</span>
            <span>{{ r.reason_label }}</span>
          </div>
          <div class="text">{{ r.question_text }}</div>
          @if (r.message) { <div class="msg">{{ r.message }}</div> }
          <div class="meta">Reported by {{ r.student_name }}{{ r.exam_title ? ' in ' + r.exam_title : '' }} · {{ r.created_at | date: 'medium' }}</div>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Note to the student (optional)</mat-label>
            <input matInput [ngModel]="note(r)" (ngModelChange)="setNote(r, $event)" maxlength="500" />
          </mat-form-field>
          <div class="actions">
            <a mat-stroked-button [routerLink]="['/admin/questions', r.question]"><mat-icon>edit</mat-icon> Open question</a>
            @if (r.status !== 'resolved') { <button mat-flat-button (click)="set(r, 'resolved')"><mat-icon>check</mat-icon> Mark fixed</button> }
            @if (r.status !== 'rejected') { <button mat-button (click)="set(r, 'rejected')">No change needed</button> }
            @if (r.status !== 'open') { <button mat-button (click)="set(r, 'open')">Reopen</button> }
          </div>
        </mat-card-content>
      </mat-card>
    } @empty {
      @if (!loading()) { <div class="empty">No reports here. Nothing is waiting for you.</div> }
    }
    <mat-paginator [length]="total()" [pageIndex]="pageIndex()" [pageSize]="pageSize" [hidePageSize]="true" (page)="pageIndex.set($event.pageIndex)" />
  `,
})
export class QuestionReports {
  private api = inject(QuestionBankService);
  private notify = inject(NotifyService);

  readonly pageSize = 20;
  status = signal('open');
  pageIndex = signal(0);
  loading = signal(true);
  total = signal(0);
  rows = signal<QuestionReportRow[]>([]);
  notes = signal<Record<number, string>>({});
  private reload = signal(0);

  constructor() {
    const query = computed(() => ({ status: this.status(), page: this.pageIndex() + 1, page_size: this.pageSize, ordering: '-created_at', r: this.reload() }));
    toObservable(query)
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(({ r, ...q }) => this.api.reports(q)),
      )
      .subscribe({
        next: (p) => {
          this.rows.set(p.results);
          this.total.set(p.count);
          this.loading.set(false);
        },
        error: (e) => {
          this.loading.set(false);
          this.notify.error(apiErrorMessage(e));
        },
      });
  }

  statusLabel = (s: string) => ({ open: 'Open', resolved: 'Fixed', rejected: 'No change needed' })[s] ?? s;
  note = (r: QuestionReportRow) => this.notes()[r.id] ?? r.admin_note;
  setNote(r: QuestionReportRow, text: string) {
    this.notes.update((n) => ({ ...n, [r.id]: text }));
  }

  set(r: QuestionReportRow, status: 'open' | 'resolved' | 'rejected') {
    this.api.updateReport(r.id, { status, admin_note: this.note(r) }).subscribe({
      next: () => {
        this.notify.success(status === 'resolved' ? 'Marked as fixed.' : status === 'rejected' ? 'Closed, no change needed.' : 'Reopened.');
        this.reload.update((n) => n + 1);
      },
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }
}

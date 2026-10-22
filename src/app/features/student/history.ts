import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { HistoryRow } from './student.models';
import { StudentService } from './student.service';

@Component({
  selector: 'app-attempt-history',
  imports: [DatePipe, RouterLink, MatTableModule, MatButtonModule, MatProgressBarModule],
  styles: `
    .table-wrap { overflow-x: auto; }
    table { width: 100%; }
    .empty { padding: 24px; text-align: center; color: var(--mat-sys-on-surface-variant); }
    .muted { color: var(--mat-sys-on-surface-variant); }
  `,
  template: `
    <h1>My attempts</h1>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    <div class="table-wrap">
      <table mat-table [dataSource]="rows()">
        <ng-container matColumnDef="exam">
          <th mat-header-cell *matHeaderCellDef>Test</th>
          <td mat-cell *matCellDef="let r">{{ r.exam_title }} <span class="muted">#{{ r.attempt_number }}</span></td>
        </ng-container>
        <ng-container matColumnDef="started">
          <th mat-header-cell *matHeaderCellDef>Started</th>
          <td mat-cell *matCellDef="let r">{{ r.started_at | date: 'medium' }}</td>
        </ng-container>
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let r">{{ r.status === 'in_progress' ? 'In progress' : r.auto_submitted ? 'Auto-submitted' : 'Submitted' }}</td>
        </ng-container>
        <ng-container matColumnDef="score">
          <th mat-header-cell *matHeaderCellDef>Score</th>
          <td mat-cell *matCellDef="let r">
            @if (r.result_available) { {{ r.score }} / {{ r.total_marks }} ({{ r.percentage }}%) {{ r.passed ? '· Passed' : '· Not passed' }} }
            @else if (r.status === 'submitted') { <span class="muted">Result not released yet</span> }
            @else { — }
          </td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let r">
            @if (r.status === 'in_progress') { <a mat-button [routerLink]="['/student/attempt', r.id]">Resume</a> }
            @if (r.result_available) { <a mat-button [routerLink]="['/student/results', r.id]">View result</a> }
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns"></tr>
      </table>
      @if (!loading() && rows().length === 0) { <div class="empty">You have not attempted any tests yet.</div> }
    </div>
  `,
})
export class AttemptHistory {
  private api = inject(StudentService);
  private notify = inject(NotifyService);
  columns = ['exam', 'started', 'status', 'score', 'actions'];
  loading = signal(true);
  rows = signal<HistoryRow[]>([]);

  constructor() {
    this.api.history().subscribe({
      next: (r) => {
        this.rows.set(r);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }
}

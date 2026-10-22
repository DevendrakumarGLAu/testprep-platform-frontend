import { SelectionModel } from '@angular/cdk/collections';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { ConfirmDialog } from '../../../shared/confirm-dialog';
import { openPicker } from '../../../shared/pickers';
import { saveBlob } from '../imports/import.service';
import { Batch } from '../exams/exam.models';
import { ExamService } from '../exams/exam.service';
import { ReportsService, StudentRow } from './reports.service';

@Component({
  selector: 'app-student-list',
  imports: [
    DatePipe, ReactiveFormsModule, RouterLink, MatTableModule, MatPaginatorModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatCheckboxModule, MatProgressBarModule,
  ],
  styles: `
    .head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
    .filters { display: flex; gap: 12px; flex-wrap: wrap; }
    .filters mat-form-field { min-width: 160px; }
    .bulk { display: flex; align-items: center; gap: 8px; padding: 8px 12px; margin-bottom: 8px; border-radius: 8px; background: var(--mat-sys-secondary-container); flex-wrap: wrap; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; }
    .off { color: var(--mat-sys-error); }
    .muted { color: var(--mat-sys-on-surface-variant); }
    .empty { padding: 24px; text-align: center; color: var(--mat-sys-on-surface-variant); }
    .chip { padding: 1px 8px; border-radius: 10px; background: var(--mat-sys-surface-container-high); font-size: 0.8em; margin-right: 4px; }
  `,
  template: `
    <div class="head"><h1>Students</h1></div>
    <div class="filters">
      <mat-form-field appearance="outline">
        <mat-label>Search</mat-label>
        <input matInput [formControl]="search" placeholder="Name, email, phone" />
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Status</mat-label>
        <mat-select [value]="status()" (selectionChange)="status.set($event.value); pageIndex.set(0)">
          <mat-option value="">All</mat-option><mat-option value="true">Active</mat-option><mat-option value="false">Inactive</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Batch</mat-label>
        <mat-select [value]="batch()" (selectionChange)="batch.set($event.value); pageIndex.set(0)">
          <mat-option value="">All</mat-option>
          @for (b of batches(); track b.id) { <mat-option [value]="b.id">{{ b.name }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Registered from</mat-label>
        <input #fromIn matInput type="date" [value]="from()" (change)="from.set($any($event.target).value); pageIndex.set(0)" />
        <button mat-icon-button matSuffix type="button" (click)="pickDate(fromIn)" aria-label="Choose a date"><mat-icon>calendar_month</mat-icon></button>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Registered to</mat-label>
        <input #toIn matInput type="date" [value]="to()" (change)="to.set($any($event.target).value); pageIndex.set(0)" />
        <button mat-icon-button matSuffix type="button" (click)="pickDate(toIn)" aria-label="Choose a date"><mat-icon>calendar_month</mat-icon></button>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Sort by</mat-label>
        <mat-select [value]="ordering()" (selectionChange)="ordering.set($event.value); pageIndex.set(0)">
          <mat-option value="-date_joined">Newest registered</mat-option>
          <mat-option value="first_name">Name</mat-option>
          <mat-option value="-average_percentage">Highest average</mat-option>
          <mat-option value="-attempts_count">Most attempts</mat-option>
          <mat-option value="-last_attempt_at">Recently active</mat-option>
        </mat-select>
      </mat-form-field>
    </div>

    @if (selection.hasValue()) {
      <div class="bulk">
        <strong>{{ selection.selected.length }} selected</strong>
        <button mat-flat-button (click)="consolidated()" [disabled]="pdfBusy()"><mat-icon>picture_as_pdf</mat-icon> PDF report for selected</button>
        <button mat-button (click)="selection.clear()">Clear</button>
      </div>
    }

    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    <div class="table-wrap">
      <table mat-table [dataSource]="rows()">
        <ng-container matColumnDef="select">
          <th mat-header-cell *matHeaderCellDef>
            <mat-checkbox (change)="$event.checked ? selectPage() : selection.clear()" [checked]="allSelected()"
              [indeterminate]="selection.hasValue() && !allSelected()" aria-label="Select all on page" />
          </th>
          <td mat-cell *matCellDef="let s"><mat-checkbox (change)="selection.toggle(s.id)" [checked]="selection.isSelected(s.id)" [attr.aria-label]="'Select ' + s.name" /></td>
        </ng-container>
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Student</th>
          <td mat-cell *matCellDef="let s"><a [routerLink]="['/admin/students', s.id]">{{ s.name }}</a><div class="muted">{{ s.email }}</div></td>
        </ng-container>
        <ng-container matColumnDef="batches">
          <th mat-header-cell *matHeaderCellDef>Batches</th>
          <td mat-cell *matCellDef="let s">@for (b of s.batches; track b.id) { <span class="chip">{{ b.name }}</span> } @empty { <span class="muted">—</span> }</td>
        </ng-container>
        <ng-container matColumnDef="attempts">
          <th mat-header-cell *matHeaderCellDef>Attempts</th>
          <td mat-cell *matCellDef="let s">{{ s.attempts_count }}</td>
        </ng-container>
        <ng-container matColumnDef="average">
          <th mat-header-cell *matHeaderCellDef>Average</th>
          <td mat-cell *matCellDef="let s">{{ s.average_percentage === null ? '—' : s.average_percentage + '%' }}</td>
        </ng-container>
        <ng-container matColumnDef="registered">
          <th mat-header-cell *matHeaderCellDef>Registered</th>
          <td mat-cell *matCellDef="let s">{{ s.date_joined | date: 'mediumDate' }}</td>
        </ng-container>
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let s"><span [class.off]="!s.is_active">{{ s.is_active ? 'Active' : 'Inactive' }}</span></td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let s">
            <a mat-icon-button [routerLink]="['/admin/students', s.id]" aria-label="Open profile"><mat-icon>person</mat-icon></a>
            <button mat-icon-button (click)="toggle(s)" [attr.aria-label]="s.is_active ? 'Deactivate student' : 'Activate student'">
              <mat-icon>{{ s.is_active ? 'person_off' : 'person_add' }}</mat-icon>
            </button>
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns"></tr>
      </table>
      @if (!loading() && rows().length === 0) { <div class="empty">No students match your filters.</div> }
    </div>
    <mat-paginator [length]="total()" [pageIndex]="pageIndex()" [pageSize]="pageSize()" [pageSizeOptions]="[10, 20, 50]"
      (page)="onPage($event)" showFirstLastButtons />
  `,
})
export class StudentList {
  private api = inject(ReportsService);
  private exams = inject(ExamService);
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);

  pickDate = openPicker;
  columns = ['select', 'name', 'batches', 'attempts', 'average', 'registered', 'status', 'actions'];
  selection = new SelectionModel<number>(true, []);
  search = new FormControl('', { nonNullable: true });
  private term = toSignal(this.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged()), { initialValue: '' });
  status = signal('');
  batch = signal<number | ''>('');
  from = signal('');
  to = signal('');
  ordering = signal('-date_joined');
  pageIndex = signal(0);
  pageSize = signal(20);
  reload = signal(0);

  loading = signal(true);
  pdfBusy = signal(false);
  total = signal(0);
  rows = signal<StudentRow[]>([]);
  batches = signal<Batch[]>([]);
  allSelected = computed(() => this.rows().length > 0 && this.rows().every((r) => this.selection.isSelected(r.id)));

  constructor() {
    this.exams.batches().subscribe((p) => this.batches.set(p.results));
    this.search.valueChanges.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.pageIndex.set(0));
    const query = computed(() => ({
      search: this.term(), is_active: this.status(), batch: this.batch(), registered_from: this.from(),
      registered_to: this.to(), ordering: this.ordering(), page: this.pageIndex() + 1, page_size: this.pageSize(), r: this.reload(),
    }));
    toObservable(query)
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(({ r, ...q }) => this.api.students(q)),
        takeUntilDestroyed(),
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

  onPage(e: PageEvent) {
    this.pageIndex.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
  }

  selectPage() {
    this.rows().forEach((r) => this.selection.select(r.id));
  }

  consolidated() {
    this.pdfBusy.set(true);
    this.api.consolidatedPdf({ student_ids: this.selection.selected }).subscribe({
      next: (b) => {
        this.pdfBusy.set(false);
        saveBlob(b, 'consolidated-student-report.pdf');
      },
      error: async (e) => {
        this.pdfBusy.set(false);
        this.notify.error(await blobError(e));
      },
    });
  }

  toggle(s: StudentRow) {
    const off = s.is_active;
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: off ? 'Deactivate student?' : 'Activate student?',
          message: off ? `${s.name} will not be able to sign in. Their attempts and results are kept.` : `${s.name} will be able to sign in again.`,
          confirmLabel: off ? 'Deactivate' : 'Activate',
        },
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        const url = `${environment.apiUrl}/users/${s.id}/`;
        const req = off ? this.http.delete(url) : this.http.post(`${url}activate/`, {});
        req.subscribe({
          next: () => {
            this.notify.success(off ? 'Student deactivated' : 'Student activated');
            this.reload.update((n) => n + 1);
          },
          error: (e) => this.notify.error(apiErrorMessage(e)),
        });
      });
  }
}

/** Errors for blob requests arrive as a Blob; read the JSON message out of it. */
export async function blobError(e: { error?: unknown }): Promise<string> {
  try {
    if (e.error instanceof Blob) {
      const body = JSON.parse(await e.error.text());
      return typeof body.detail === 'string' ? body.detail : Object.values(body).flat().join(' ');
    }
  } catch {
    /* fall through */
  }
  return apiErrorMessage(e);
}

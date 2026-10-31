import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { ConfirmDialog } from '../../../shared/confirm-dialog';
import { Exam, TEST_TYPE_LABELS } from './exam.models';
import { ExamService } from './exam.service';

@Component({
  selector: 'app-exam-list',
  imports: [
    DatePipe, ReactiveFormsModule, RouterLink, MatTableModule, MatPaginatorModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatMenuModule, MatProgressBarModule,
  ],
  styles: `
    .head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
    .filters { display: flex; gap: 12px; flex-wrap: wrap; }
    .filters mat-form-field { min-width: 180px; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; }
    .chip { padding: 2px 10px; border-radius: 12px; font: var(--mat-sys-label-medium); background: var(--mat-sys-surface-container-high); }
    .chip.published { background: var(--mat-sys-tertiary-container); }
    .chip.archived { background: var(--mat-sys-error-container); }
    .sub { color: var(--mat-sys-on-surface-variant); font-size: 0.85em; }
    .empty { padding: 24px; text-align: center; color: var(--mat-sys-on-surface-variant); }
  `,
  template: `
    <div class="head">
      <h1>Tests</h1>
      <button mat-flat-button routerLink="/admin/tests/new"><mat-icon>add</mat-icon> New test</button>
    </div>
    <div class="filters">
      <mat-form-field appearance="outline">
        <mat-label>Search</mat-label>
        <input matInput [formControl]="search" />
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Status</mat-label>
        <mat-select [value]="status()" (selectionChange)="status.set($event.value); pageIndex.set(0)">
          <mat-option value="">All</mat-option>
          <mat-option value="draft">Draft</mat-option>
          <mat-option value="published">Published</mat-option>
          <mat-option value="archived">Archived</mat-option>
        </mat-select>
      </mat-form-field>
    </div>

    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    <div class="table-wrap">
      <table mat-table [dataSource]="rows()">
        <ng-container matColumnDef="title">
          <th mat-header-cell *matHeaderCellDef>Test</th>
          <td mat-cell *matCellDef="let e"><a [routerLink]="['/admin/tests', e.id]">{{ e.title }}</a>@if (e.is_live) { <span class="live-chip"><mat-icon inline>sensors</mat-icon> LIVE</span> }</td>
        </ng-container>
        <ng-container matColumnDef="category">
          <th mat-header-cell *matHeaderCellDef>Exam / type</th>
          <td mat-cell *matCellDef="let e">{{ e.category_name || '—' }}
            <div class="sub">{{ typeLabel(e) }}</div></td>
        </ng-container>
        <ng-container matColumnDef="questions">
          <th mat-header-cell *matHeaderCellDef>Questions / marks</th>
          <td mat-cell *matCellDef="let e">{{ e.question_count }} / {{ e.total_marks }}</td>
        </ng-container>
        <ng-container matColumnDef="duration">
          <th mat-header-cell *matHeaderCellDef>Duration</th>
          <td mat-cell *matCellDef="let e">{{ e.duration_minutes }} min</td>
        </ng-container>
        <ng-container matColumnDef="window">
          <th mat-header-cell *matHeaderCellDef>Available</th>
          <td mat-cell *matCellDef="let e">
            @if (e.start_at || e.end_at) {
              {{ e.start_at ? (e.start_at | date: 'short') : 'Any time' }} → {{ e.end_at ? (e.end_at | date: 'short') : 'No end' }}
            } @else { Always }
          </td>
        </ng-container>
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let e"><span class="chip" [class]="'chip ' + e.status">{{ e.status }}</span></td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let e">
            <button mat-icon-button [matMenuTriggerFor]="menu" aria-label="Actions"><mat-icon>more_vert</mat-icon></button>
            <mat-menu #menu="matMenu">
              <button mat-menu-item [routerLink]="['/admin/tests', e.id]"><mat-icon>edit</mat-icon> Open / edit</button>
              <button mat-menu-item [routerLink]="['/admin/tests', e.id, 'preview']"><mat-icon>visibility</mat-icon> Preview as student</button>
              @if (e.status !== 'draft') {
                <button mat-menu-item [routerLink]="['/admin/tests', e.id, 'results']"><mat-icon>bar_chart</mat-icon> Results</button>
              }
              @if (e.is_live && e.status === 'published') {
                <button mat-menu-item (click)="copyLiveLink(e)"><mat-icon>link</mat-icon> Copy live link</button>
              }
              <button mat-menu-item (click)="duplicate(e)"><mat-icon>content_copy</mat-icon> Duplicate</button>
              @if (e.status === 'draft') {
                <button mat-menu-item (click)="publish(e)"><mat-icon>publish</mat-icon> Publish</button>
                <button mat-menu-item (click)="remove(e)"><mat-icon>delete</mat-icon> Delete draft</button>
              }
              @if (e.status === 'published') {
                <button mat-menu-item (click)="run(e, 'unpublish', 'Unpublish test?', 'Students will no longer see it. You can edit it again.')">
                  <mat-icon>unpublished</mat-icon> Unpublish</button>
              }
              @if (e.status !== 'archived') {
                <button mat-menu-item (click)="run(e, 'archive', 'Archive test?', 'It is hidden from students. Past results are kept.')">
                  <mat-icon>archive</mat-icon> Archive</button>
              } @else {
                <button mat-menu-item (click)="run(e, 'restore', 'Restore test?', 'It returns as a draft and must be published again.')">
                  <mat-icon>unarchive</mat-icon> Restore</button>
              }
            </mat-menu>
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns"></tr>
      </table>
      @if (!loading() && rows().length === 0) { <div class="empty">No tests found.</div> }
    </div>
    <mat-paginator [length]="total()" [pageIndex]="pageIndex()" [pageSize]="pageSize()"
      [pageSizeOptions]="[10, 20, 50]" (page)="onPage($event)" showFirstLastButtons />
  `,
})
export class ExamList {
  private api = inject(ExamService);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);

  /** The link to give students for a live test. */
  copyLiveLink(e: Exam) {
    const link = `${window.location.origin}/student/live/${e.public_id}`;
    const fail = () => this.notify.error(`Could not copy. The link is ${link}`);
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link).then(() => this.notify.success('Live link copied'), fail);
    else fail();
  }
  private router = inject(Router);

  columns = ['title', 'category', 'questions', 'duration', 'window', 'status', 'actions'];
  search = new FormControl('', { nonNullable: true });
  private term = toSignal(this.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged()), { initialValue: '' });
  status = signal('');
  pageIndex = signal(0);
  pageSize = signal(20);
  reload = signal(0);
  loading = signal(true);
  total = signal(0);
  rows = signal<Exam[]>([]);

  constructor() {
    this.search.valueChanges.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.pageIndex.set(0));
    const query = computed(() => ({
      search: this.term(), status: this.status(), page: this.pageIndex() + 1, page_size: this.pageSize(), r: this.reload(),
    }));
    toObservable(query)
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(({ r, ...q }) => this.api.list(q)),
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

  typeLabel(e: Exam) {
    const base = TEST_TYPE_LABELS[e.test_type];
    return e.test_type === 'sectional' && e.subject_name ? `${base}: ${e.subject_name}` : e.test_type === 'previous_year' && e.year ? `${base} ${e.year}` : base;
  }

  onPage(e: PageEvent) {
    this.pageIndex.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
  }

  private refresh() {
    this.reload.update((n) => n + 1);
  }

  duplicate(e: Exam) {
    this.api.action(e.id, 'duplicate').subscribe({
      next: (copy) => {
        this.notify.success('Copy created as a draft');
        this.router.navigate(['/admin/tests', copy.id]);
      },
      error: (err) => this.notify.error(apiErrorMessage(err)),
    });
  }

  publish(e: Exam) {
    this.api.action(e.id, 'publish').subscribe({
      next: () => {
        this.notify.success('Test published');
        this.refresh();
      },
      error: (err) => {
        const problems: string[] = err.error?.errors ?? [];
        this.notify.error(problems.length ? `Cannot publish: ${problems.join(' ')}` : apiErrorMessage(err));
      },
    });
  }

  run(e: Exam, name: 'unpublish' | 'archive' | 'restore', title: string, message: string) {
    this.dialog.open(ConfirmDialog, { data: { title, message, confirmLabel: title.split(' ')[0] } }).afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.api.action(e.id, name).subscribe({
        next: () => {
          this.notify.success('Done');
          this.refresh();
        },
        error: (err) => this.notify.error(apiErrorMessage(err)),
      });
    });
  }

  remove(e: Exam) {
    this.dialog
      .open(ConfirmDialog, { data: { title: 'Delete draft?', message: `Permanently delete "${e.title}"?`, confirmLabel: 'Delete' } })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.api.remove(e.id).subscribe({
          next: () => {
            this.notify.success('Draft deleted');
            this.refresh();
          },
          error: (err) => this.notify.error(apiErrorMessage(err)),
        });
      });
  }
}

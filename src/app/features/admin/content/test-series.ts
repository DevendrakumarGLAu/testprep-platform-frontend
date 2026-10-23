import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { ConfirmDialog } from '../../../shared/confirm-dialog';
import { Exam, ExamCategory } from '../exams/exam.models';
import { ExamService } from '../exams/exam.service';
import { ContentService, TestSeries } from './content.service';

interface SeriesDialogData {
  series: TestSeries | null;
  categories: ExamCategory[];
  exams: Exam[];
}

@Component({
  selector: 'app-series-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule, MatButtonModule, MatIconModule],
  styles: `
    form { display: flex; flex-direction: column; min-width: min(560px, 86vw); padding-top: 8px; }
    .err { color: var(--mat-sys-error); margin: 0; }
    ol { padding: 0; margin: 4px 0 12px; list-style: none; }
    li { display: flex; align-items: center; gap: 4px; padding: 2px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    li .n { width: 28px; color: var(--mat-sys-on-surface-variant); }
    li .t { flex: 1; }
    .muted { color: var(--mat-sys-on-surface-variant); }
  `,
  template: `
    <h2 mat-dialog-title>{{ data.series ? 'Edit test series' : 'New test series' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" id="series-form" (ngSubmit)="save()" novalidate>
        <mat-form-field appearance="outline">
          <mat-label>Title</mat-label>
          <input matInput formControlName="title" maxlength="200" placeholder="SSC CGL 2026: 30 mock tests" />
          <mat-error>Required</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Description</mat-label>
          <textarea matInput rows="2" formControlName="description"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Exam</mat-label>
          <mat-select formControlName="category">
            <mat-option [value]="null">Any exam</mat-option>
            @for (c of data.categories; track c.id) { <mat-option [value]="c.id">{{ c.name }}</mat-option> }
          </mat-select>
        </mat-form-field>

        <strong>Tests in this series (in order)</strong>
        <ol>
          @for (e of chosen(); track e.id; let i = $index) {
            <li>
              <span class="n">{{ i + 1 }}.</span><span class="t">{{ e.title }} <span class="muted">({{ e.status }})</span></span>
              <button mat-icon-button type="button" (click)="move(i, -1)" [disabled]="i === 0" aria-label="Move up"><mat-icon>arrow_upward</mat-icon></button>
              <button mat-icon-button type="button" (click)="move(i, 1)" [disabled]="i === chosen().length - 1" aria-label="Move down"><mat-icon>arrow_downward</mat-icon></button>
              <button mat-icon-button type="button" (click)="remove(e.id)" aria-label="Remove from series"><mat-icon>close</mat-icon></button>
            </li>
          } @empty { <li class="muted">No tests yet. Add some below.</li> }
        </ol>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Add a test</mat-label>
          <mat-select (selectionChange)="add($event.value)" [value]="null">
            @for (e of available(); track e.id) { <mat-option [value]="e.id">{{ e.title }} ({{ e.status }})</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-slide-toggle formControlName="is_published" style="margin-top: 16px">Visible to students</mat-slide-toggle>
        @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button type="submit" form="series-form" [disabled]="saving()">Save</button>
    </mat-dialog-actions>
  `,
})
export class SeriesDialog {
  data = inject<SeriesDialogData>(MAT_DIALOG_DATA);
  private ref = inject<MatDialogRef<SeriesDialog, boolean>>(MatDialogRef);
  private api = inject(ContentService);
  private fb = inject(FormBuilder);
  saving = signal(false);
  error = signal('');
  ids = signal<number[]>((this.data.series?.exams ?? []).map((e) => e.id));

  form = this.fb.nonNullable.group({
    title: [this.data.series?.title ?? ''],
    description: [this.data.series?.description ?? ''],
    category: this.fb.control<number | null>(this.data.series?.category ?? null),
    is_published: [this.data.series?.is_published ?? false],
  });

  private byId = computed(() => new Map(this.data.exams.map((e) => [e.id, e])));
  chosen = computed<{ id: number; title: string; status: string }[]>(() => this.ids().map((id) => this.byId().get(id) ?? { id, title: `Test #${id}`, status: '' }));
  available = computed(() => this.data.exams.filter((e) => !this.ids().includes(e.id) && e.status !== 'archived'));

  add(id: number | null) {
    if (id !== null) this.ids.update((l) => [...l, id]);
  }
  remove(id: number) {
    this.ids.update((l) => l.filter((x) => x !== id));
  }
  move(i: number, d: number) {
    this.ids.update((l) => {
      const next = [...l];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });
  }

  save() {
    const v = this.form.getRawValue();
    if (!v.title.trim()) return this.error.set('Give the series a title.');
    this.saving.set(true);
    this.error.set('');
    this.api.saveSeries({ ...v, title: v.title.trim(), exam_ids: this.ids() }, this.data.series?.id).subscribe({
      next: () => this.ref.close(true),
      error: (e) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(e));
      },
    });
  }
}

/** Test series: ordered groups of tests with a progress bar for each student. */
@Component({
  selector: 'app-test-series',
  imports: [MatTableModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  styles: `
    .head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
    .muted { color: var(--mat-sys-on-surface-variant); }
    .on { color: #2e7d32; }
    table { width: 100%; }
  `,
  template: `
    <div class="head">
      <h1>Test series</h1>
      <button mat-flat-button (click)="edit(null)"><mat-icon>add</mat-icon> New series</button>
    </div>
    <p class="muted">Group tests into an ordered series, for example "SSC CGL 2026: 30 mocks". Students see their progress through it.</p>
    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    <table mat-table [dataSource]="rows()">
      <ng-container matColumnDef="title">
        <th mat-header-cell *matHeaderCellDef>Series</th>
        <td mat-cell *matCellDef="let s">{{ s.title }}<div class="muted">{{ s.category_name || 'Any exam' }}</div></td>
      </ng-container>
      <ng-container matColumnDef="tests">
        <th mat-header-cell *matHeaderCellDef>Tests</th>
        <td mat-cell *matCellDef="let s">{{ s.exams.length }}</td>
      </ng-container>
      <ng-container matColumnDef="status">
        <th mat-header-cell *matHeaderCellDef>Status</th>
        <td mat-cell *matCellDef="let s"><span [class.on]="s.is_published">{{ s.is_published ? 'Published' : 'Draft' }}</span></td>
      </ng-container>
      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef></th>
        <td mat-cell *matCellDef="let s">
          <button mat-icon-button (click)="edit(s)" aria-label="Edit series"><mat-icon>edit</mat-icon></button>
          <button mat-icon-button (click)="remove(s)" aria-label="Delete series"><mat-icon>delete</mat-icon></button>
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let r; columns: columns"></tr>
    </table>
    @if (!loading() && rows().length === 0) { <p class="muted">No series yet.</p> }
  `,
})
export class TestSeriesPage {
  private api = inject(ContentService);
  private examApi = inject(ExamService);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);

  columns = ['title', 'tests', 'status', 'actions'];
  loading = signal(true);
  rows = signal<TestSeries[]>([]);
  private categories: ExamCategory[] = [];
  private exams: Exam[] = [];

  constructor() {
    this.examApi.categories().subscribe((p) => (this.categories = p.results.filter((c) => c.is_active)));
    this.examApi.list({ page_size: 200, ordering: 'title' }).subscribe((p) => (this.exams = p.results));
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.series().subscribe({
      next: (p) => {
        this.rows.set(p.results);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }

  edit(series: TestSeries | null) {
    this.dialog
      .open<SeriesDialog, SeriesDialogData, boolean>(SeriesDialog, { data: { series, categories: this.categories, exams: this.exams }, width: '640px', maxWidth: '96vw' })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.notify.success('Series saved.');
          this.load();
        }
      });
  }

  remove(series: TestSeries) {
    this.dialog
      .open(ConfirmDialog, { data: { title: 'Delete this series?', message: `"${series.title}" will be removed. The tests in it are not deleted.`, confirmLabel: 'Delete' } })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.api.deleteSeries(series.id).subscribe({
          next: () => {
            this.notify.success('Series deleted.');
            this.load();
          },
          error: (e) => this.notify.error(apiErrorMessage(e)),
        });
      });
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
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
  imports: [ReactiveFormsModule],
  templateUrl: './series-dialog.html',
  styleUrl: './series-dialog.scss',
  host: { class: 'bs' },
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

  cancel() {
    this.ref.close(false);
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
  imports: [],
  templateUrl: './test-series.html',
  styleUrl: './test-series.scss',
  host: { class: 'bs' },
})
export class TestSeriesPage {
  private api = inject(ContentService);
  private examApi = inject(ExamService);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);

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

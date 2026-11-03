import { SelectionModel } from '@angular/cdk/collections';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { BsPager, PageChange } from '../../../shared/bs-pager/bs-pager';
import { ConfirmDialog } from '../../../shared/confirm-dialog';
import { openPicker } from '../../../shared/pickers';
import { saveBlob } from '../imports/import.service';
import { Batch } from '../exams/exam.models';
import { ExamService } from '../exams/exam.service';
import { ReportsService, StudentRow } from './reports.service';

@Component({
  selector: 'app-student-list',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, BsPager],
  templateUrl: './student-list.html',
  styleUrl: './student-list.scss',
  host: { class: 'bs' },
})
export class StudentList {
  private api = inject(ReportsService);
  private exams = inject(ExamService);
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);

  pickDate = openPicker;
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

  onPage(e: PageChange) {
    this.pageIndex.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
  }

  pickBatch(value: string) {
    this.batch.set(value ? Number(value) : '');
    this.pageIndex.set(0);
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

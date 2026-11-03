import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { switchMap, tap } from 'rxjs';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { BsPager } from '../../../shared/bs-pager/bs-pager';
import { ImageViewer } from '../../../shared/image-viewer';
import { QuestionReportRow } from './qb.models';
import { QuestionBankService } from './qb.service';

/** The queue of problems students reported on questions. Each is marked fixed or "no change needed", with a note the student can read. */
@Component({
  selector: 'app-question-reports',
  imports: [DatePipe, FormsModule, RouterLink, BsPager],
  templateUrl: './question-reports.html',
  styleUrl: './question-reports.scss',
  host: { class: 'bs' },
})
export class QuestionReports {
  private api = inject(QuestionBankService);
  private notify = inject(NotifyService);
  private dialog = inject(MatDialog);

  zoom(src: string) {
    ImageViewer.open(this.dialog, src, 'Picture attached by the student');
  }

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

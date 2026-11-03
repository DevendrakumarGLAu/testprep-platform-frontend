import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { BsPager, PageChange } from '../../../shared/bs-pager/bs-pager';
import { formatDuration } from '../../student/student.models';
import { ReportsService } from '../students/reports.service';
import { blobError } from '../students/student-list';
import { saveBlob } from '../imports/import.service';
import { AdminAttempt, ResultsSummary } from './exam.models';
import { ExamService } from './exam.service';

@Component({
  selector: 'app-exam-results',
  imports: [DatePipe, RouterLink, BsPager],
  templateUrl: './exam-results.html',
  styleUrl: './exam-results.scss',
  host: { class: 'bs' },
})
export class ExamResults {
  id = input.required<string>();
  private api = inject(ExamService);
  private notify = inject(NotifyService);
  private reports = inject(ReportsService);
  pdfBusy = signal(false);

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

  onPage(e: PageChange) {
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

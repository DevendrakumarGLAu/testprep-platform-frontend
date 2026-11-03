import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiErrorMessage } from '../../../../core/models';
import { NotifyService } from '../../../../core/notify.service';
import { Sparkline } from '../../sparkline/sparkline';
import { CoachService } from '../../coach.service';
import { BatchOption, BatchProgressData, ProgressStatus, STATUS_LABEL } from '../../coach.models';

/** For a teacher: how each student of a batch is doing, who has fallen behind and who is improving. */
@Component({
  selector: 'app-batch-progress',
  imports: [FormsModule, DatePipe, Sparkline],
  templateUrl: './batch-progress.html',
  styleUrl: './batch-progress.scss',
  host: { class: 'bs' },
})
export class BatchProgress {
  private api = inject(CoachService);
  private notify = inject(NotifyService);

  batches = signal<BatchOption[]>([]);
  batchId = signal<number | null>(null);
  days = signal(30);
  data = signal<BatchProgressData | null>(null);
  loading = signal(false);
  error = signal('');
  filter = signal<ProgressStatus | ''>('');
  search = signal('');
  protected label = STATUS_LABEL;

  readonly statuses: ProgressStatus[] = ['behind', 'declining', 'steady', 'improving', 'new'];
  readonly windows = [7, 30, 90];

  rows = computed(() => {
    const d = this.data();
    if (!d) return [];
    const f = this.filter();
    const q = this.search().trim().toLowerCase();
    return d.results.filter((r) => (!f || r.status === f) && (!q || r.name.toLowerCase().includes(q) || r.username.toLowerCase().includes(q)));
  });

  constructor() {
    this.api.batches().subscribe({
      next: (r) => {
        this.batches.set(r.results);
        if (r.results.length) this.choose(r.results[0].id);
      },
      error: (e) => this.error.set(apiErrorMessage(e)),
    });
  }

  choose(id: number | string) {
    this.batchId.set(Number(id));
    this.filter.set('');
    this.load();
  }

  setDays(days: number | string) {
    this.days.set(Number(days));
    this.load();
  }

  load() {
    const id = this.batchId();
    if (id === null) return;
    this.loading.set(true);
    this.error.set('');
    this.api.batchProgress(id, this.days()).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(e));
      },
    });
  }

  toggleFilter(status: ProgressStatus) {
    this.filter.set(this.filter() === status ? '' : status);
  }

  download() {
    const id = this.batchId();
    if (id === null) return;
    this.api.batchProgressCsv(id, this.days()).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `progress-${this.data()?.batch.name ?? id}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }

  badge(status: ProgressStatus) {
    return { behind: 'text-bg-danger', declining: 'text-bg-warning', steady: 'text-bg-secondary', improving: 'text-bg-success', new: 'text-bg-light border' }[status];
  }

  icon(status: ProgressStatus) {
    return { behind: 'bi-exclamation-octagon', declining: 'bi-graph-down-arrow', steady: 'bi-dash-circle', improving: 'bi-graph-up-arrow', new: 'bi-hourglass-split' }[status];
  }

  tone(percent: number | null) {
    return percent === null ? '' : percent >= 70 ? 'bg-success' : percent >= 40 ? '' : 'bg-danger';
  }
}

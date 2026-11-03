import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../../core/models';
import { CoachService } from '../coach.service';
import { DOUBT_LABEL, DoubtRow, DoubtStatus } from '../coach.models';

/** The student's own doubts, with a filter by status. */
@Component({
  selector: 'app-doubt-list',
  imports: [RouterLink, DatePipe],
  templateUrl: './doubt-list.html',
  styleUrl: './doubt-list.scss',
  host: { class: 'bs' },
})
export class DoubtList {
  private api = inject(CoachService);
  rows = signal<DoubtRow[]>([]);
  loading = signal(true);
  error = signal('');
  filter = signal<DoubtStatus | ''>('');
  protected label = DOUBT_LABEL;
  readonly tabs: { value: DoubtStatus | ''; text: string }[] = [
    { value: '', text: 'All' },
    { value: 'open', text: 'Waiting' },
    { value: 'answered', text: 'Answered' },
    { value: 'resolved', text: 'Resolved' },
  ];

  constructor() {
    this.load();
  }

  pick(value: DoubtStatus | '') {
    this.filter.set(value);
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.api.myDoubts(this.filter()).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(e));
      },
    });
  }

  badge(status: DoubtStatus) {
    return status === 'resolved' ? 'text-bg-success' : status === 'answered' ? 'text-bg-primary' : 'text-bg-warning';
  }
}

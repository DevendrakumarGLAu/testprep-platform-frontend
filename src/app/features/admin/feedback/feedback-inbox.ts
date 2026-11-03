import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { apiErrorMessage } from '../../../core/models';
import { NotifyService } from '../../../core/notify.service';
import { FeedbackRow, FeedbackService, FeedbackStatus } from '../../feedback/feedback.service';

/** What people sent with the feedback button, newest first. Tick a note off when it is dealt with. */
@Component({
  selector: 'app-feedback-inbox',
  imports: [DatePipe],
  templateUrl: './feedback-inbox.html',
  styleUrl: './feedback-inbox.scss',
  host: { class: 'bs' },
})
export class FeedbackInbox {
  private api = inject(FeedbackService);
  private notify = inject(NotifyService);

  loading = signal(true);
  rows = signal<FeedbackRow[]>([]);
  filter = signal<FeedbackStatus | ''>('new');
  newCount = signal(0);

  constructor() {
    this.load();
  }

  pick(filter: FeedbackStatus | '') {
    this.filter.set(filter);
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.inbox(this.filter()).subscribe({
      next: (d) => {
        this.rows.set(d.results);
        this.newCount.set(d.new_count);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }

  toggle(row: FeedbackRow) {
    const next: FeedbackStatus = row.status === 'done' ? 'new' : 'done';
    this.api.setStatus(row.id, next).subscribe({
      next: () => this.load(),
      error: (e) => this.notify.error(apiErrorMessage(e)),
    });
  }
}

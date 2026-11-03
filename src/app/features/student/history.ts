import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { HistoryRow } from './student.models';
import { StudentService } from './student.service';

/** "My attempts": every attempt the student has made, with the score once it is released. */
@Component({
  selector: 'app-attempt-history',
  imports: [DatePipe, RouterLink],
  templateUrl: './history.html',
  styleUrl: './history.scss',
  host: { class: 'bs' },
})
export class AttemptHistory {
  private api = inject(StudentService);
  private notify = inject(NotifyService);
  loading = signal(true);
  rows = signal<HistoryRow[]>([]);

  constructor() {
    this.api.history().subscribe({
      next: (r) => {
        this.rows.set(r);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.notify.error(apiErrorMessage(e));
      },
    });
  }

  status(r: HistoryRow) {
    return r.status === 'in_progress' ? 'In progress' : r.auto_submitted ? 'Auto-submitted' : 'Submitted';
  }
}
